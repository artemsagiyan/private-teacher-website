import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { Booking, BookingStatus } from '../bookings/entities/booking.entity';
import { CalendarSlot } from '../calendar/entities/calendar-slot.entity';
import { StorageService } from '../storage/storage.service';
import { Student } from '../students/entities/student.entity';
import { Teacher } from '../teachers/entities/teacher.entity';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/enums/user-role.enum';
import { Lesson, LessonStatus } from './entities/lesson.entity';

type LessonFileType = 'board' | 'recording' | 'transcript' | 'report';

@Injectable()
export class LessonsService {
  constructor(
    @InjectRepository(Lesson)
    private readonly lessonRepo: Repository<Lesson>,
    @InjectRepository(CalendarSlot)
    private readonly slotRepo: Repository<CalendarSlot>,
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(Teacher)
    private readonly teacherRepo: Repository<Teacher>,
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    private readonly storage: StorageService,
  ) {}

  async ensureForSlot(slotId: string): Promise<Lesson> {
    const existing = await this.lessonRepo.findOne({
      where: { slotId },
      relations: ['slot', 'teacher', 'teacher.user'],
    });
    if (existing) return existing;

    const slot = await this.slotRepo.findOne({
      where: { id: slotId },
      relations: ['teacher', 'teacher.user'],
    });
    if (!slot) throw new NotFoundException('Слот не найден');

    const lesson = this.lessonRepo.create({
      slotId: slot.id,
      slot,
      teacherId: slot.teacherId,
      teacher: slot.teacher,
      roomName: `lesson-${slot.id}`,
    });

    try {
      return await this.lessonRepo.save(lesson);
    } catch (error: any) {
      if (error?.code === '23505') {
        return this.lessonRepo.findOneOrFail({
          where: { slotId },
          relations: ['slot', 'teacher', 'teacher.user'],
        });
      }
      throw error;
    }
  }

  async findByRoomName(roomName: string) {
    return this.lessonRepo.findOne({
      where: { roomName },
      relations: ['slot', 'teacher', 'teacher.user'],
    });
  }

  async findByEgressId(egressId: string) {
    return this.lessonRepo.findOne({
      where: { egressId },
      relations: ['slot', 'teacher', 'teacher.user'],
    });
  }

  async listForUser(user: User) {
    let lessons: Lesson[];

    if (user.role === UserRole.ADMIN) {
      lessons = await this.lessonRepo.find({
        relations: ['slot', 'teacher', 'teacher.user'],
        order: { createdAt: 'DESC' },
      });
    } else if (user.role === UserRole.TEACHER) {
      const teacher = await this.teacherRepo.findOne({
        where: { userId: user.id },
      });
      if (!teacher) return [];
      lessons = await this.lessonRepo.find({
        where: { teacherId: teacher.id },
        relations: ['slot', 'teacher', 'teacher.user'],
        order: { createdAt: 'DESC' },
      });
    } else {
      const student = await this.studentRepo.findOne({
        where: { userId: user.id },
      });
      if (!student) return [];

      lessons = await this.lessonRepo
        .createQueryBuilder('lesson')
        .leftJoinAndSelect('lesson.slot', 'slot')
        .leftJoinAndSelect('lesson.teacher', 'teacher')
        .leftJoinAndSelect('teacher.user', 'teacherUser')
        .innerJoin(
          Booking,
          'booking',
          'booking.slotId = lesson.slotId AND booking.studentId = :studentId AND booking.status IN (:...statuses)',
          {
            studentId: student.id,
            statuses: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED],
          },
        )
        .orderBy('lesson.createdAt', 'DESC')
        .getMany();
    }

    return lessons.map((lesson) => this.toResponse(lesson));
  }

  async getForUser(user: User, lessonId: string) {
    const lesson = await this.getAccessibleLesson(user, lessonId);
    return this.toResponse(lesson, true);
  }

  async getStatusForUser(user: User, lessonId: string) {
    const lesson = await this.getAccessibleLesson(user, lessonId);
    return {
      id: lesson.id,
      status: lesson.status,
      participantCount: lesson.participantCount,
      startedAt: lesson.startedAt,
      endedAt: lesson.endedAt,
      processingError: lesson.processingError,
    };
  }

  async assertTeacherOwns(user: User, lessonId: string) {
    if (user.role !== UserRole.TEACHER) {
      throw new ForbiddenException('Только преподаватель может завершить урок');
    }
    const teacher = await this.teacherRepo.findOne({
      where: { userId: user.id },
    });
    if (!teacher) throw new ForbiddenException();

    const lesson = await this.lessonRepo.findOne({
      where: { id: lessonId, teacherId: teacher.id },
      relations: ['slot', 'teacher', 'teacher.user'],
    });
    if (!lesson) {
      throw new ForbiddenException('Этот урок не принадлежит вам');
    }
    return lesson;
  }

  async saveBoard(user: User, lessonId: string, scene: Record<string, unknown>) {
    const lesson = await this.getAccessibleLesson(user, lessonId);
    if (
      [
        LessonStatus.ENDING,
        LessonStatus.PROCESSING,
        LessonStatus.COMPLETED,
        LessonStatus.FAILED,
      ].includes(lesson.status)
    ) {
      throw new ConflictException('Доска завершённого урока доступна только для чтения');
    }

    const expectedRevision = Number(scene.revision ?? lesson.boardRevision ?? 0);
    const nextRevision = expectedRevision + 1;
    const objectKey = `lessons/${lesson.id}/boards/${nextRevision}-${randomUUID()}.excalidraw`;

    const normalized = {
      type: 'excalidraw',
      version: 2,
      source: 'TutorPlatform',
      revision: nextRevision,
      clientId:
        typeof scene.clientId === 'string' ? scene.clientId : undefined,
      elements: Array.isArray(scene.elements) ? scene.elements : [],
      appState:
        scene.appState && typeof scene.appState === 'object'
          ? scene.appState
          : {},
      files:
        scene.files && typeof scene.files === 'object' ? scene.files : {},
      savedAt: new Date().toISOString(),
    };

    await this.storage.putJson(objectKey, normalized);
    const saved = await this.lessonRepo.update(
      {
        id: lesson.id,
        boardRevision: expectedRevision,
        status: In([
          LessonStatus.WAITING,
          LessonStatus.STARTING,
          LessonStatus.ACTIVE,
        ]),
      },
      {
        boardObjectKey: objectKey,
        boardRevision: nextRevision,
        boardUpdatedAt: new Date(),
      },
    );
    if (!saved.affected) {
      // CAS lost — remove orphan object so MinIO doesn't keep the loser's draft
      try {
        await this.storage.deleteObject(objectKey);
      } catch {
        // ignore cleanup errors
      }
      const current = await this.lessonRepo.findOneBy({ id: lesson.id });
      throw new ConflictException({
        message: 'Доска была изменена другим участником',
        currentRevision: current?.boardRevision ?? expectedRevision,
      });
    }

    return { savedAt: normalized.savedAt, revision: nextRevision };
  }

  async getBoard(user: User, lessonId: string) {
    const lesson = await this.getAccessibleLesson(user, lessonId);
    if (
      !lesson.boardObjectKey ||
      !(await this.storage.exists(lesson.boardObjectKey))
    ) {
      return {
        type: 'excalidraw',
        version: 2,
        source: 'TutorPlatform',
        elements: [],
        appState: {},
        files: {},
        revision: lesson.boardRevision || 0,
      };
    }
    const scene = await this.storage.getJson<Record<string, unknown>>(
      lesson.boardObjectKey,
    );
    return { ...scene, revision: lesson.boardRevision || 0 };
  }

  async getFile(
    user: User,
    lessonId: string,
    type: LessonFileType,
  ): Promise<{
    objectKey: string;
    contentType: string;
    filename: string;
  }> {
    const lesson = await this.getAccessibleLesson(user, lessonId);
    const descriptors: Record<
      LessonFileType,
      { key: string; contentType: string; filename: string }
    > = {
      board: {
        key: lesson.boardObjectKey,
        contentType: 'application/json; charset=utf-8',
        filename: `lesson-${lesson.id}-board.excalidraw`,
      },
      recording: {
        key: lesson.recordingObjectKey,
        contentType: 'audio/ogg',
        filename: `lesson-${lesson.id}-audio.ogg`,
      },
      transcript: {
        key: lesson.transcriptObjectKey,
        contentType: 'text/plain; charset=utf-8',
        filename: `lesson-${lesson.id}-transcript.txt`,
      },
      report: {
        key: lesson.reportObjectKey,
        contentType: 'application/json; charset=utf-8',
        filename: `lesson-${lesson.id}-report.json`,
      },
    };

    const descriptor = descriptors[type];
    if (
      !descriptor?.key ||
      !(await this.storage.exists(descriptor.key))
    ) {
      throw new NotFoundException('Файл ещё не готов');
    }

    return {
      objectKey: descriptor.key,
      contentType: descriptor.contentType,
      filename: descriptor.filename,
    };
  }

  async markBookingsCompleted(slotId: string) {
    await this.bookingRepo.update(
      {
        slotId,
        status: In([BookingStatus.CONFIRMED]),
      },
      { status: BookingStatus.COMPLETED },
    );
  }

  toResponse(lesson: Lesson, includeReport = false) {
    return {
      id: lesson.id,
      slotId: lesson.slotId,
      roomName: lesson.roomName,
      status: lesson.status,
      participantCount: lesson.participantCount,
      startedAt: lesson.startedAt,
      endedAt: lesson.endedAt,
      endReason: lesson.endReason,
      boardUpdatedAt: lesson.boardUpdatedAt,
      boardRevision: lesson.boardRevision,
      transcriptLanguage: lesson.transcriptLanguage,
      transcriptDurationSeconds: lesson.transcriptDurationSeconds,
      processingError: lesson.processingError,
      createdAt: lesson.createdAt,
      slot: lesson.slot,
      teacher: lesson.teacher
        ? {
            id: lesson.teacher.id,
            userId: lesson.teacher.userId,
            bio: lesson.teacher.bio,
            subjects: lesson.teacher.subjects,
            user: lesson.teacher.user
              ? {
                  id: lesson.teacher.user.id,
                  firstName: lesson.teacher.user.firstName,
                  lastName: lesson.teacher.user.lastName,
                  avatarUrl: lesson.teacher.user.avatarUrl,
                }
              : null,
          }
        : null,
      report: includeReport ? lesson.report : lesson.report
        ? { summary: lesson.report.summary }
        : null,
      files: {
        board: !!lesson.boardObjectKey,
        recording: !!lesson.recordingObjectKey,
        transcript: !!lesson.transcriptObjectKey,
        report: !!lesson.reportObjectKey,
      },
    };
  }

  private async getAccessibleLesson(user: User, lessonId: string) {
    const lesson = await this.lessonRepo.findOne({
      where: { id: lessonId },
      relations: ['slot', 'teacher', 'teacher.user'],
    });
    if (!lesson) throw new NotFoundException('Урок не найден');
    if (user.role === UserRole.ADMIN) return lesson;

    if (user.role === UserRole.TEACHER) {
      const teacher = await this.teacherRepo.findOne({
        where: { userId: user.id },
      });
      if (teacher?.id === lesson.teacherId) return lesson;
    }

    if (user.role === UserRole.STUDENT) {
      const student = await this.studentRepo.findOne({
        where: { userId: user.id },
      });
      if (
        student &&
        (await this.bookingRepo.exists({
          where: {
            studentId: student.id,
            slotId: lesson.slotId,
            status: In([
              BookingStatus.CONFIRMED,
              BookingStatus.COMPLETED,
            ]),
          },
        }))
      ) {
        return lesson;
      }
    }

    throw new ForbiddenException('Нет доступа к этому уроку');
  }
}
