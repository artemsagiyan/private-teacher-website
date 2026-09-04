import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { StorageService } from '../storage/storage.service';
import { Lesson, LessonReport, LessonStatus } from './entities/lesson.entity';
import { LessonsService } from './lessons.service';
import { Booking, BookingStatus } from '../bookings/entities/booking.entity';
import { NotificationsService } from '../notifications/notifications.service';

interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

interface TranscriptionResult {
  text: string;
  language: string;
  duration: number;
  segments: TranscriptSegment[];
}

@Injectable()
export class LessonProcessingService {
  private readonly logger = new Logger(LessonProcessingService.name);
  private readonly running = new Set<string>();

  constructor(
    private readonly config: ConfigService,
    private readonly storage: StorageService,
    private readonly lessons: LessonsService,
    private readonly notifications: NotificationsService,
    @InjectRepository(Lesson)
    private readonly lessonRepo: Repository<Lesson>,
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
  ) {}

  @Interval(20_000)
  async processPendingLessons() {
    const pending = await this.lessonRepo
      .createQueryBuilder('lesson')
      .leftJoinAndSelect('lesson.slot', 'slot')
      .leftJoinAndSelect('lesson.teacher', 'teacher')
      .where('lesson.status = :status', {
        status: LessonStatus.PROCESSING,
      })
      .andWhere(
        '(lesson.nextProcessingAt IS NULL OR lesson.nextProcessingAt <= :now)',
        { now: new Date() },
      )
      .orderBy('lesson.nextProcessingAt', 'ASC')
      .take(2)
      .getMany();

    await Promise.all(
      pending.map((lesson) => this.processOneSafely(lesson)),
    );
  }

  private async processOneSafely(lesson: Lesson) {
    if (this.running.has(lesson.id)) return;

    const leaseId = randomUUID();
    const leaseUntil = new Date(Date.now() + 4 * 60 * 60 * 1000);
    const claimed = await this.lessonRepo
      .createQueryBuilder()
      .update(Lesson)
      .set({ nextProcessingAt: leaseUntil, processingLeaseId: leaseId })
      .where('"id" = :id', { id: lesson.id })
      .andWhere('"status" = :status', { status: LessonStatus.PROCESSING })
      .andWhere(
        '("nextProcessingAt" IS NULL OR "nextProcessingAt" <= :now)',
        { now: new Date() },
      )
      .execute();
    if (!claimed.affected) return;

    this.running.add(lesson.id);
    const heartbeat = setInterval(() => {
      void this.lessonRepo.update(
        {
          id: lesson.id,
          status: LessonStatus.PROCESSING,
          processingLeaseId: leaseId,
        },
        {
          nextProcessingAt: new Date(Date.now() + 4 * 60 * 60 * 1000),
        },
      );
    }, 60_000);

    try {
      await this.processOne(lesson, leaseId);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      const attempts = lesson.processingAttempts + 1;
      const permanentlyFailed = attempts >= 10;
      const delaySeconds = Math.min(600, 15 * 2 ** attempts);

      await this.lessonRepo.update(
        {
          id: lesson.id,
          status: LessonStatus.PROCESSING,
          processingLeaseId: leaseId,
        },
        {
          status: permanentlyFailed
            ? LessonStatus.FAILED
            : LessonStatus.PROCESSING,
          processingAttempts: attempts,
          processingLeaseId: null,
          processingError: message,
          nextProcessingAt: permanentlyFailed
            ? null
            : new Date(Date.now() + delaySeconds * 1000),
        },
      );
      this.logger.error(
        `Lesson ${lesson.id} processing failed (${attempts}/10): ${message}`,
      );
      if (permanentlyFailed) {
        try {
          await this.notifications.notifyLessonFailed(
            lesson.teacher?.userId || lesson.teacherId,
            lesson.id,
            message,
          );
        } catch {
          /* ignore */
        }
      }
    } finally {
      clearInterval(heartbeat);
      this.running.delete(lesson.id);
    }
  }

  private async processOne(lesson: Lesson, leaseId: string) {
    if (!lesson.recordingObjectKey) {
      throw new Error('У урока нет аудиозаписи');
    }
    if (!(await this.storage.exists(lesson.recordingObjectKey))) {
      throw new Error('Аудиозапись ещё загружается в хранилище');
    }

    let transcriptText: string;
    let transcriptKey = lesson.transcriptObjectKey;
    let transcriptLanguage = lesson.transcriptLanguage;
    let transcriptDuration = lesson.transcriptDurationSeconds;

    if (
      transcriptKey &&
      (await this.storage.exists(transcriptKey))
    ) {
      transcriptText = (
        await this.storage.getBuffer(transcriptKey)
      ).toString('utf8');
    } else {
      const transcript = await this.transcribe(lesson);
      transcriptText = this.formatTranscript(transcript);
      transcriptKey = `lessons/${lesson.id}/transcript.txt`;
      const transcriptJsonKey = `lessons/${lesson.id}/transcript.json`;
      transcriptLanguage = transcript.language;
      transcriptDuration = transcript.duration;

      await Promise.all([
        this.storage.putText(transcriptKey, transcriptText),
        this.storage.putJson(transcriptJsonKey, transcript),
      ]);
      await this.lessonRepo.update(
        {
          id: lesson.id,
          status: LessonStatus.PROCESSING,
          processingLeaseId: leaseId,
        },
        {
          transcriptObjectKey: transcriptKey,
          transcriptLanguage,
          transcriptDurationSeconds: transcriptDuration,
        },
      );
    }

    const ownsLease = await this.lessonRepo.exists({
      where: {
        id: lesson.id,
        status: LessonStatus.PROCESSING,
        processingLeaseId: leaseId,
      },
    });
    if (!ownsLease) {
      throw new Error('Потеряна блокировка обработки урока');
    }

    const report = transcriptText.trim()
      ? await this.generateReport(transcriptText, lesson.slot?.note)
      : {
          summary: 'В аудиозаписи урока речь не обнаружена.',
          topics: [],
          achievements: [],
          difficulties: [],
          homework: [],
          recommendations: [],
          keyMoments: [],
        };
    const reportKey = `lessons/${lesson.id}/report.json`;
    await this.storage.putJson(reportKey, report);

    const completed = await this.lessonRepo.update(
      {
        id: lesson.id,
        status: LessonStatus.PROCESSING,
        processingLeaseId: leaseId,
      },
      {
        status: LessonStatus.COMPLETED,
        transcriptObjectKey: transcriptKey,
        reportObjectKey: reportKey,
        transcriptLanguage,
        transcriptDurationSeconds: transcriptDuration,
        report,
        endedAt: lesson.endedAt || new Date(),
        processingAttempts: lesson.processingAttempts,
        processingLeaseId: null,
        processingError: null,
        nextProcessingAt: null,
      },
    );
    if (completed.affected) {
      await this.lessons.markBookingsCompleted(lesson.slotId);
      this.logger.log(`Lesson ${lesson.id} report is ready`);
      await this.notifyReportReady(lesson);
    }
  }

  private async notifyReportReady(lesson: Lesson) {
    const recipients = new Set<string>();

    if (lesson.teacher?.userId) {
      recipients.add(lesson.teacher.userId);
    }

    const bookings = await this.bookingRepo.find({
      where: [
        { slotId: lesson.slotId, status: BookingStatus.COMPLETED },
        { slotId: lesson.slotId, status: BookingStatus.CONFIRMED },
      ],
      relations: ['student'],
    });

    for (const booking of bookings) {
      if (booking.student?.userId) recipients.add(booking.student.userId);
    }

    for (const userId of recipients) {
      try {
        await this.notifications.notifyLessonReportReady(
          userId,
          lesson.id,
          lesson.slot?.startTime,
        );
      } catch (error) {
        this.logger.warn(
          `Could not notify ${userId} about lesson report: ${
            error instanceof Error ? error.message : error
          }`,
        );
      }
    }
  }

  private async transcribe(lesson: Lesson): Promise<TranscriptionResult> {
    const recordingUrl = await this.storage.presignedGetUrl(
      lesson.recordingObjectKey,
      4 * 60 * 60,
    );
    const baseUrl = this.config
      .get<string>('transcription.url')
      .replace(/\/$/, '');

    const response = await fetch(`${baseUrl}/transcribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: recordingUrl,
        language: this.config.get<string>('transcription.language'),
      }),
      signal: AbortSignal.timeout(4 * 60 * 60 * 1000),
    });

    if (!response.ok) {
      throw new Error(
        `Ошибка транскрипции (${response.status}): ${await response.text()}`,
      );
    }

    const result = (await response.json()) as TranscriptionResult;
    return result;
  }

  private async generateReport(
    transcript: string,
    lessonNote?: string,
  ): Promise<LessonReport> {
    const maxChunk = 24_000;
    let source = transcript;

    if (transcript.length > 70_000) {
      const chunks: string[] = [];
      for (let i = 0; i < transcript.length; i += maxChunk) {
        const chunk = transcript.slice(i, i + maxChunk);
        chunks.push(
          await this.callOllama(
            `Сделай подробный конспект части транскрипта урока. Сохрани темы, достижения, трудности, домашние задания и временные метки.\n\n${chunk}`,
            false,
          ),
        );
      }
      source = chunks.join('\n\n--- ЧАСТЬ ---\n\n');
    }

    const prompt = `
Ты — методист онлайн-школы. На основе транскрипта подготовь объективный отчёт об уроке на русском языке.
Не выдумывай факты. Если информации нет, используй пустой массив.
${lessonNote ? `Заметка преподавателя о слоте: ${lessonNote}` : ''}

Верни строго JSON:
{
  "summary": "краткое содержание урока",
  "topics": ["изученные темы"],
  "achievements": ["что получилось"],
  "difficulties": ["что вызвало сложности"],
  "homework": ["домашние задания, если были"],
  "recommendations": ["рекомендации для следующего занятия"],
  "keyMoments": [{"time": "HH:MM:SS", "description": "важный момент"}]
}

ТРАНСКРИПТ:
${source}
`.trim();

    const raw = await this.callOllama(prompt, true);
    try {
      const parsed = JSON.parse(raw) as Partial<LessonReport>;
      return {
        summary:
          typeof parsed.summary === 'string' && parsed.summary.trim()
            ? parsed.summary.trim()
            : 'Отчёт сформирован без резюме',
        topics: this.stringArray(parsed.topics),
        achievements: this.stringArray(parsed.achievements),
        difficulties: this.stringArray(parsed.difficulties),
        homework: this.stringArray(parsed.homework),
        recommendations: this.stringArray(parsed.recommendations),
        keyMoments: Array.isArray(parsed.keyMoments)
          ? parsed.keyMoments
              .filter((item) => item && typeof item.description === 'string')
              .map((item) => ({
                time:
                  typeof item.time === 'string' ? item.time : undefined,
                description: item.description,
              }))
          : [],
      };
    } catch {
      throw new Error('Локальная модель вернула некорректный JSON отчёта');
    }
  }

  private async callOllama(prompt: string, json: boolean) {
    const baseUrl = this.config.get<string>('ollama.url').replace(/\/$/, '');
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.config.get<string>('ollama.model'),
        prompt,
        stream: false,
        format: json ? 'json' : undefined,
        think: false,
        options: {
          temperature: 0.2,
          num_ctx: 32768,
        },
      }),
      signal: AbortSignal.timeout(30 * 60 * 1000),
    });

    if (!response.ok) {
      throw new Error(
        `Ошибка Ollama (${response.status}): ${await response.text()}`,
      );
    }
    const body = (await response.json()) as { response?: string };
    if (!body.response?.trim()) {
      throw new Error('Ollama вернула пустой ответ');
    }
    return body.response.trim();
  }

  private formatTranscript(transcript: TranscriptionResult) {
    if (!transcript.segments?.length) return transcript.text.trim();
    return transcript.segments
      .map(
        (segment) =>
          `[${this.formatTime(segment.start)}] ${segment.text.trim()}`,
      )
      .join('\n');
  }

  private formatTime(seconds: number) {
    const value = Math.max(0, Math.round(seconds || 0));
    const h = Math.floor(value / 3600);
    const m = Math.floor((value % 3600) / 60);
    const s = value % 60;
    return [h, m, s].map((part) => String(part).padStart(2, '0')).join(':');
  }

  private stringArray(value: unknown): string[] {
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string')
      : [];
  }
}
