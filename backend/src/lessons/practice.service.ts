import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Booking, BookingStatus } from '../bookings/entities/booking.entity';
import { User } from '../users/entities/user.entity';
import {
  Lesson,
  LessonReport,
  PracticePlan,
} from './entities/lesson.entity';
import { LessonsService } from './lessons.service';

@Injectable()
export class PracticeService {
  private readonly logger = new Logger(PracticeService.name);

  constructor(
    private readonly lessons: LessonsService,
    private readonly config: ConfigService,
    @InjectRepository(Lesson)
    private readonly lessonRepo: Repository<Lesson>,
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
  ) {}

  async forLesson(user: User, lessonId: string, refresh = false) {
    const lesson = await this.lessons.getAccessibleLesson(user, lessonId);
    if (!refresh && lesson.practicePlan?.items?.length) {
      return lesson.practicePlan;
    }
    const plan = await this.buildPlan(lesson);
    lesson.practicePlan = plan;
    await this.lessonRepo.update(lesson.id, { practicePlan: plan });
    return plan;
  }

  private async buildPlan(lesson: Lesson): Promise<PracticePlan> {
    const booking = await this.bookingRepo.findOne({
      where: {
        slotId: lesson.slotId,
        status: In([BookingStatus.CONFIRMED, BookingStatus.COMPLETED]),
      },
      relations: ['student', 'student.user'],
    });
    const previous = booking
      ? await this.previousReports(booking.studentId, lesson.id)
      : [];
    const studentName = booking?.student?.user
      ? `${booking.student.user.firstName ?? ''} ${booking.student.user.lastName ?? ''}`.trim()
      : 'ученик';
    const note = lesson.slot?.note || '';

    try {
      const generated = await this.askModel(studentName, note, previous);
      if (generated.items.length) return generated;
    } catch (error) {
      this.logger.warn(
        `Practice plan fallback for ${lesson.id}: ${
          error instanceof Error ? error.message : error
        }`,
      );
    }
    return this.fallback(note, previous);
  }

  private async previousReports(studentId: string, currentLessonId: string) {
    const bookings = await this.bookingRepo.find({
      where: { studentId, status: BookingStatus.COMPLETED },
      relations: ['slot'],
    });
    const slotIds = bookings.map((item) => item.slotId);
    if (!slotIds.length) return [];
    const lessons = await this.lessonRepo.find({
      where: { slotId: In(slotIds) },
      relations: ['slot'],
    });
    return lessons
      .filter((item) => item.id !== currentLessonId && item.report)
      .sort(
        (a, b) =>
          new Date(b.endedAt || b.createdAt).getTime() -
          new Date(a.endedAt || a.createdAt).getTime(),
      )
      .slice(0, 3)
      .map((item) => item.report);
  }

  private async askModel(
    studentName: string,
    note: string,
    previous: LessonReport[],
  ): Promise<PracticePlan> {
    const history = previous
      .map(
        (report, index) =>
          `Урок ${index + 1}: ${report.summary}\nСложности: ${report.difficulties.join('; ') || 'нет'}\nДЗ: ${report.homework.join('; ') || 'нет'}`,
      )
      .join('\n\n');
    const prompt = `
Ты — репетитор. Предложи 4 задачи, которые стоит решить на ближайшем уроке с учеником ${studentName}.
Опирайся на прошлые сложности и домашние задания. Не повторяй дословно старые формулировки, если можно дать похожую задачу.
${note ? `Тема текущего слота: ${note}` : ''}
${history ? `Прошлые уроки:\n${history}` : 'Прошлых отчётов нет — дай стартовый набор по теме слота или по школьной физике.'}

Верни строго JSON:
{
  "summary": "зачем этот набор",
  "items": [
    { "title": "короткое название", "task": "условие задачи", "reason": "почему это сейчас полезно" }
  ]
}
`.trim();

    const raw = await this.callOllama(prompt);
    const parsed = JSON.parse(raw) as {
      summary?: string;
      items?: Array<{ title?: string; task?: string; reason?: string }>;
    };
    const items = (parsed.items || [])
      .filter((item) => item?.task)
      .slice(0, 6)
      .map((item) => ({
        title: item.title?.trim() || 'Задача',
        task: item.task.trim(),
        reason: item.reason?.trim() || '',
      }));
    return {
      summary: parsed.summary?.trim() || 'Подбор по прошлым урокам',
      items,
      generatedAt: new Date().toISOString(),
    };
  }

  private fallback(note: string, previous: LessonReport[]): PracticePlan {
    const items = [
      ...previous.flatMap((report) =>
        report.difficulties.slice(0, 2).map((difficulty) => ({
          title: 'Повторить сложное',
          task: `Разобрать ещё раз: ${difficulty}`,
          reason: 'Это вызывало трудности на прошлом уроке',
        })),
      ),
      ...previous.flatMap((report) =>
        report.homework.slice(0, 2).map((task) => ({
          title: 'Проверить домашнее',
          task,
          reason: 'Задание было дано после прошлого урока',
        })),
      ),
    ].slice(0, 4);

    if (!items.length) {
      items.push({
        title: note || 'Разбор темы',
        task: note
          ? `Решить 3 задачи по теме «${note}»: одну базовую, одну среднюю и одну с ловушкой в условии.`
          : 'Решить 3 задачи по теме урока: базовую, среднюю и одну, где в условии есть лишние данные.',
        reason: 'Стартовый набор, пока нет истории прошлых уроков',
      });
    }

    return {
      summary: 'Подбор без модели: по прошлым сложностям и домашним заданиям',
      items,
      generatedAt: new Date().toISOString(),
    };
  }

  private async callOllama(prompt: string) {
    const baseUrl = this.config.get<string>('ollama.url').replace(/\/$/, '');
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.config.get<string>('ollama.model'),
        prompt,
        stream: false,
        format: 'json',
      }),
      signal: AbortSignal.timeout(90_000),
    });
    if (!response.ok) {
      throw new Error(`Ollama ${response.status}`);
    }
    const data = (await response.json()) as { response?: string };
    if (!data.response) throw new Error('Пустой ответ модели');
    return data.response;
  }
}
