import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, MoreThan, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { pipeline } from 'stream/promises';
import { StorageService } from '../storage/storage.service';
import { Lesson, LessonReport, LessonStatus } from './entities/lesson.entity';
import { LessonsService } from './lessons.service';
import { Teacher } from '../teachers/entities/teacher.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { LearningService } from '../learning/learning.service';
import { ComputeJob, ComputeJobStatus } from './entities/compute-job.entity';

const LOCAL_COMPUTE_LEASE_MS = 5 * 60 * 1000;
const MAX_LOCAL_COMPUTE_ATTEMPTS = 10;
const MAX_REPORT_PROCESSING_ATTEMPTS = 10;
const MAX_REPORT_TEXT_CHARS = 5_000;
const MAX_REPORT_LIST_ITEMS = 8;

function normalizeQueryRows<T>(value: T[] | T[][]): T[] {
  return Array.isArray(value[0]) ? (value[0] as T[]) : (value as T[]);
}

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
    @InjectRepository(Teacher)
    private readonly teacherRepo: Repository<Teacher>,
    private readonly learning: LearningService,
    @Optional()
    @InjectRepository(ComputeJob)
    private readonly computeJobRepo?: Repository<ComputeJob>,
    @Optional()
    private readonly dataSource?: DataSource,
  ) {}

  @Interval(5_000)
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
      .andWhere(
        `NOT EXISTS (
          SELECT 1 FROM "compute_jobs" job
          WHERE job."lessonId" = lesson.id
            AND job."status" IN (:...activeComputeStatuses)
        )`,
        {
          activeComputeStatuses: [
            ComputeJobStatus.PENDING,
            ComputeJobStatus.PROCESSING,
          ],
        },
      )
      .orderBy('lesson.nextProcessingAt', 'ASC')
      .take(4)
      .getMany();

    await Promise.all(
      pending.map((lesson) => this.processOneSafely(lesson)),
    );
  }

  async claimLocalComputeJob() {
    if (!this.dataSource) throw new Error('Очередь локальной обработки не настроена');
    const leaseToken = randomUUID();
    const { claimed, failedLessons } = await this.dataSource.transaction(
      async (manager) => {
        const failedResult = await manager.query(
          `
            UPDATE "compute_jobs"
            SET "status" = $1,
                "leaseToken" = NULL,
                "leaseExpiresAt" = NULL,
                "error" = COALESCE("error", 'Локальный обработчик завершился без ответа'),
                "updatedAt" = now()
            WHERE "status" = $2
              AND ("leaseExpiresAt" IS NULL OR "leaseExpiresAt" <= now())
              AND "attempts" >= $3
            RETURNING "lessonId"
          `,
          [
            ComputeJobStatus.FAILED,
            ComputeJobStatus.PROCESSING,
            MAX_LOCAL_COMPUTE_ATTEMPTS,
          ],
        );
        const failed = normalizeQueryRows<{ lessonId: string }>(failedResult);
        const failedLessonIds = failed.map((row: { lessonId: string }) => row.lessonId);
        const failedLessonResult = failedLessonIds.length
          ? await manager.query(
              `
                UPDATE "lessons"
                SET "status" = $1,
                    "processingLeaseId" = NULL,
                    "processingError" = 'Локальный компьютер не завершил обработку после нескольких попыток',
                    "nextProcessingAt" = NULL,
                    "updatedAt" = now()
                WHERE "id" = ANY($2::uuid[])
                  AND "status" = $3
                RETURNING "id", "teacherId"
              `,
              [LessonStatus.FAILED, failedLessonIds, LessonStatus.PROCESSING],
            )
          : [];
        const failedLessons = normalizeQueryRows<{
          id: string;
          teacherId: string;
        }>(failedLessonResult);

        const claimedResult = await manager.query(
          `
            WITH candidate AS (
              SELECT "id"
              FROM "compute_jobs"
              WHERE "attempts" < $1
                AND (
                  ("status" = $2 AND ("retryAt" IS NULL OR "retryAt" <= now()))
                  OR ("status" = $3 AND ("leaseExpiresAt" IS NULL OR "leaseExpiresAt" <= now()))
                )
              ORDER BY "createdAt" ASC
              FOR UPDATE SKIP LOCKED
              LIMIT 1
            )
            UPDATE "compute_jobs" AS job
            SET "status" = $3,
                "leaseToken" = $4,
                "leaseExpiresAt" = now() + interval '5 minutes',
                "retryAt" = NULL,
                "attempts" = job."attempts" + 1,
                "error" = NULL,
                "updatedAt" = now()
            FROM candidate
            WHERE job."id" = candidate."id"
            RETURNING job."id" AS "jobId",
                      job."lessonId" AS "jobLessonId",
                      job."lessonNote" AS "jobLessonNote"
          `,
          [
            MAX_LOCAL_COMPUTE_ATTEMPTS,
            ComputeJobStatus.PENDING,
            ComputeJobStatus.PROCESSING,
            leaseToken,
          ],
        );
        const rows = normalizeQueryRows<{
          jobId: string;
          jobLessonId: string;
          jobLessonNote: string | null;
        }>(claimedResult);
        const claimed = rows[0]
          ? {
              jobId: rows[0].jobId ?? (rows[0] as any).id,
              jobLessonId: rows[0].jobLessonId ?? (rows[0] as any).lessonId,
              jobLessonNote:
                rows[0].jobLessonNote ?? (rows[0] as any).lessonNote ?? null,
            }
          : null;

        if (claimed) {
          await manager.query(
            `
              UPDATE "lessons"
              SET "processingError" = 'Локальный компьютер обрабатывает запись',
                  "updatedAt" = now()
              WHERE "id" = $1 AND "status" = $2
            `,
            [claimed.jobLessonId, LessonStatus.PROCESSING],
          );
        }

        return { claimed, failedLessons };
      },
    );

    for (const lesson of failedLessons) {
      await this.notifyLessonProcessingFailed(
        lesson.id,
        lesson.teacherId,
        'Локальный компьютер не завершил обработку после нескольких попыток',
      );
    }

    if (!claimed) return null;
    return {
      id: claimed.jobId,
      lessonId: claimed.jobLessonId,
      lessonNote: claimed.jobLessonNote ?? '',
      leaseToken,
      recordingPath: `/api/compute/jobs/${claimed.jobId}/recording`,
      transcriptPath: `/api/compute/jobs/${claimed.jobId}/transcript`,
    };
  }

  async localComputeRecording(id: string, leaseToken: string) {
    const job = await this.findActiveLocalComputeJob(id, leaseToken);
    return job.recordingObjectKey;
  }

  async localComputeTranscript(id: string, leaseToken: string) {
    const job = await this.findActiveLocalComputeJob(id, leaseToken);
    const transcriptKey = `lessons/${job.lessonId}/transcript.json`;
    if (!(await this.storage.exists(transcriptKey))) return null;
    try {
      return await this.storage.getJson<TranscriptionResult>(transcriptKey);
    } catch {
      // A corrupt checkpoint is safe to replace by transcribing the recording
      // again; it should not permanently block the queue.
      return null;
    }
  }

  async checkpointLocalTranscript(
    id: string,
    leaseToken: string,
    transcriptValue: unknown,
  ) {
    const job = await this.findActiveLocalComputeJob(id, leaseToken);
    const lesson = await this.lessonRepo.findOne({
      where: { id: job.lessonId, status: LessonStatus.PROCESSING },
    });
    if (!lesson) {
      throw new ConflictException('Урок больше не ожидает локальную обработку');
    }
    const transcript = this.parseLocalTranscript(transcriptValue);
    const transcriptTextKey = `lessons/${lesson.id}/transcript.txt`;
    const transcriptJsonKey = `lessons/${lesson.id}/transcript.json`;
    await Promise.all([
      this.storage.putText(transcriptTextKey, this.formatTranscript(transcript)),
      this.storage.putJson(transcriptJsonKey, transcript),
    ]);
    // Recheck the lease after object storage writes so a stale worker cannot
    // publish its checkpoint after the job has been handed to another worker.
    await this.findActiveLocalComputeJob(id, leaseToken);
    await this.lessonRepo.update(
      { id: lesson.id, status: LessonStatus.PROCESSING },
      {
        transcriptObjectKey: transcriptTextKey,
        transcriptLanguage: transcript.language,
        transcriptDurationSeconds: transcript.duration,
      },
    );
    return { ok: true };
  }

  async heartbeatLocalComputeJob(id: string, leaseToken: string) {
    if (!this.computeJobRepo) throw new Error('Очередь локальной обработки не настроена');
    const now = new Date();
    const leaseExpiresAt = new Date(now.getTime() + LOCAL_COMPUTE_LEASE_MS);
    const result = await this.computeJobRepo.update(
      {
        id,
        status: ComputeJobStatus.PROCESSING,
        leaseToken,
        leaseExpiresAt: MoreThan(now),
      },
      { leaseExpiresAt },
    );
    if (!result.affected) {
      throw new ConflictException('Задание уже передано другому обработчику');
    }
    return { ok: true, leaseExpiresAt };
  }

  async completeLocalComputeJob(
    id: string,
    leaseToken: string,
    transcriptValue: unknown,
    reportValue: unknown,
  ) {
    if (!this.dataSource || !this.computeJobRepo) {
      throw new Error('Очередь локальной обработки не настроена');
    }
    const job = await this.findActiveLocalComputeJob(id, leaseToken);
    const lesson = await this.lessonRepo.findOne({
      where: { id: job.lessonId, status: LessonStatus.PROCESSING },
      relations: ['slot', 'teacher'],
    });
    if (!lesson) {
      throw new ConflictException('Урок больше не ожидает локальную обработку');
    }

    const transcript = this.parseLocalTranscript(transcriptValue);
    const report = this.parseLocalReport(reportValue);
    const cachedTranscriptTextKey = `lessons/${lesson.id}/transcript.txt`;
    const cachedTranscriptJsonKey = `lessons/${lesson.id}/transcript.json`;
    const hasCheckpoint =
      lesson.transcriptObjectKey === cachedTranscriptTextKey &&
      (await this.storage.exists(cachedTranscriptJsonKey));
    const artifactId = randomUUID();
    const transcriptTextKey = hasCheckpoint
      ? cachedTranscriptTextKey
      : `lessons/${lesson.id}/transcript-${artifactId}.txt`;
    const reportKey = `lessons/${lesson.id}/report-${artifactId}.json`;
    const artifacts: Promise<unknown>[] = [this.storage.putJson(reportKey, report)];
    if (!hasCheckpoint) {
      artifacts.push(
        this.storage.putText(transcriptTextKey, this.formatTranscript(transcript)),
        this.storage.putJson(
          `lessons/${lesson.id}/transcript-${artifactId}.json`,
          transcript,
        ),
      );
    }
    await Promise.all(artifacts);

    await this.dataSource.transaction(async (manager) => {
      const now = new Date();
      const jobUpdate = await manager.update(
        ComputeJob,
        {
          id,
          status: ComputeJobStatus.PROCESSING,
          leaseToken,
          leaseExpiresAt: MoreThan(now),
        },
        {
          status: ComputeJobStatus.COMPLETED,
          leaseToken: null,
          leaseExpiresAt: null,
          error: null,
        },
      );
      if (!jobUpdate.affected) {
        throw new ConflictException('Срок обработки завершился до отправки результата');
      }

      const lessonUpdate = await manager.update(
        Lesson,
        { id: lesson.id, status: LessonStatus.PROCESSING },
        {
          status: LessonStatus.COMPLETED,
          transcriptObjectKey: transcriptTextKey,
          reportObjectKey: reportKey,
          transcriptLanguage: transcript.language,
          transcriptDurationSeconds: transcript.duration,
          report,
          endedAt: lesson.endedAt || new Date(),
          processingLeaseId: null,
          processingError: null,
          nextProcessingAt: null,
        },
      );
      if (!lessonUpdate.affected) {
        throw new ConflictException('Урок уже завершён или изменён');
      }
    });

    lesson.report = report;
    lesson.transcriptObjectKey = transcriptTextKey;
    lesson.reportObjectKey = reportKey;
    lesson.transcriptLanguage = transcript.language;
    lesson.transcriptDurationSeconds = transcript.duration;
    lesson.status = LessonStatus.COMPLETED;
    await this.lessons.markBookingsCompleted(lesson.slotId);
    try {
      await this.learning.createDraftsForLesson(lesson, report);
    } catch (error) {
      this.logger.warn(
        `Could not create learning draft for lesson ${lesson.id}: ${error instanceof Error ? error.message : error}`,
      );
    }
    await this.notifyReportReady(lesson);
    this.logger.log(`Lesson ${lesson.id} report completed by the local compute worker`);
    return { ok: true, status: LessonStatus.COMPLETED };
  }

  async failLocalComputeJob(id: string, leaseToken: string, error: string) {
    if (!this.dataSource || !this.computeJobRepo) {
      throw new Error('Очередь локальной обработки не настроена');
    }
    const message = error.slice(0, 2000) || 'Локальная обработка не удалась';
    const failedLesson = await this.dataSource.transaction(async (manager) => {
      const job = await manager.findOne(ComputeJob, {
        where: {
          id,
          status: ComputeJobStatus.PROCESSING,
          leaseToken,
          leaseExpiresAt: MoreThan(new Date()),
        },
      });
      if (!job) {
        throw new ConflictException('Задание уже передано другому обработчику');
      }

      const permanentlyFailed = job.attempts >= MAX_LOCAL_COMPUTE_ATTEMPTS;
      const retryDelaySeconds = Math.min(
        600,
        15 * 2 ** Math.max(0, job.attempts - 1),
      );
      const update = await manager.update(
        ComputeJob,
        {
          id,
          status: ComputeJobStatus.PROCESSING,
          leaseToken,
          leaseExpiresAt: MoreThan(new Date()),
        },
        {
          status: permanentlyFailed
            ? ComputeJobStatus.FAILED
            : ComputeJobStatus.PENDING,
          leaseToken: null,
          leaseExpiresAt: null,
          retryAt: permanentlyFailed
            ? null
            : new Date(Date.now() + retryDelaySeconds * 1000),
          error: message,
        },
      );
      if (!update.affected) {
        throw new ConflictException('Задание уже передано другому обработчику');
      }
      if (!permanentlyFailed) {
        await manager.update(
          Lesson,
          { id: job.lessonId, status: LessonStatus.PROCESSING },
          { processingError: `Повтор локальной обработки: ${message.slice(0, 300)}` },
        );
        return null;
      }

      const lessonUpdate = await manager.update(
        Lesson,
        { id: job.lessonId, status: LessonStatus.PROCESSING },
        {
          status: LessonStatus.FAILED,
          processingLeaseId: null,
          processingError: message,
          nextProcessingAt: null,
        },
      );
      if (!lessonUpdate.affected) {
        throw new ConflictException('Урок уже завершён или изменён');
      }
      const failed = await manager.findOneBy(Lesson, { id: job.lessonId });
      return { id: job.lessonId, teacherId: failed?.teacherId };
    });

    if (failedLesson) {
      await this.notifyLessonProcessingFailed(failedLesson.id, failedLesson.teacherId, message);
    }
    return {
      ok: true,
      status: failedLesson ? LessonStatus.FAILED : ComputeJobStatus.PENDING,
    };
  }

  private async findActiveLocalComputeJob(id: string, leaseToken: string) {
    if (!this.computeJobRepo) throw new Error('Очередь локальной обработки не настроена');
    if (!leaseToken) {
      throw new ConflictException('Отсутствует ключ блокировки задания');
    }
    const job = await this.computeJobRepo.findOne({
      where: {
        id,
        status: ComputeJobStatus.PROCESSING,
        leaseToken,
        leaseExpiresAt: MoreThan(new Date()),
      },
    });
    if (!job) {
      throw new ConflictException('Задание уже передано другому обработчику');
    }
    return job;
  }

  private parseLocalTranscript(value: unknown): TranscriptionResult {
    if (!value || typeof value !== 'object') {
      throw new BadRequestException('Некорректный транскрипт');
    }
    const candidate = value as Partial<TranscriptionResult>;
    if (
      typeof candidate.text !== 'string' ||
      typeof candidate.duration !== 'number' ||
      !Number.isFinite(candidate.duration)
    ) {
      throw new BadRequestException('Некорректный транскрипт');
    }
    const segments = Array.isArray(candidate.segments)
      ? candidate.segments
          .slice(0, 100_000)
          .filter(
            (segment) =>
              segment &&
              typeof segment.text === 'string' &&
              Number.isFinite(segment.start) &&
              Number.isFinite(segment.end),
          )
          .map((segment) => ({
            start: segment.start,
            end: segment.end,
            text: segment.text.slice(0, 5_000),
          }))
      : [];
    return {
      text: candidate.text.slice(0, 5_000_000),
      language:
        typeof candidate.language === 'string' ? candidate.language : 'unknown',
      duration: candidate.duration,
      segments,
    };
  }

  private parseLocalReport(value: unknown): LessonReport {
    if (!value || typeof value !== 'object') {
      throw new BadRequestException('Некорректный отчёт');
    }
    const candidate = value as Partial<LessonReport>;
    const keyMoments = Array.isArray(candidate.keyMoments)
      ? candidate.keyMoments
          .filter((item) => item && typeof item.description === 'string')
          .slice(0, 30)
          .map((item) => ({
            time: typeof item.time === 'string' ? item.time : undefined,
            description: item.description.trim().slice(0, 1000),
          }))
      : [];
    return {
      summary:
        typeof candidate.summary === 'string' && candidate.summary.trim()
          ? candidate.summary.trim().slice(0, 5000)
          : 'Отчёт сформирован без резюме',
      topics: this.stringArray(candidate.topics),
      achievements: this.stringArray(candidate.achievements),
      difficulties: this.stringArray(candidate.difficulties),
      homework: this.stringArray(candidate.homework),
      recommendations: this.stringArray(candidate.recommendations),
      keyMoments,
    };
  }

  private async notifyLessonProcessingFailed(
    lessonId: string,
    teacherId: string,
    message: string,
  ) {
    const teacher = await this.teacherRepo.findOne({ where: { id: teacherId } });
    if (!teacher?.userId) return;
    try {
      await this.notifications.notifyLessonFailed(teacher.userId, lessonId, message);
    } catch (error) {
      this.logger.warn(
        `Could not notify teacher about failed lesson ${lessonId}: ${error instanceof Error ? error.message : error}`,
      );
    }
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
      const permanentlyFailed = attempts >= MAX_REPORT_PROCESSING_ATTEMPTS;
      const delaySeconds = Math.min(600, 15 * 2 ** attempts);

      if (permanentlyFailed && (lesson.startedAt || lesson.participantCount > 0)) {
        try {
          const report = this.emptyReport(
            'Урок посещали, но автоматически обработать запись не удалось. Отчёт сформирован без анализа транскрипта.',
          );
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
              reportObjectKey: reportKey,
              report,
              endedAt: lesson.endedAt || new Date(),
              processingAttempts: attempts,
              processingLeaseId: null,
              processingError: null,
              nextProcessingAt: null,
            },
          );
          if (completed.affected) {
            await this.lessons.markBookingsCompleted(lesson.slotId);
            try {
              await this.learning.createDraftsForLesson(lesson, report);
            } catch (draftError) {
              this.logger.warn(
                `Could not create learning draft for lesson ${lesson.id}: ${draftError instanceof Error ? draftError.message : draftError}`,
              );
            }
            await this.notifyReportReady(lesson);
            this.logger.warn(
              `Lesson ${lesson.id} was completed with a fallback report after ${attempts} processing attempts`,
            );
            return;
          }
        } catch (fallbackError) {
          this.logger.error(
            `Could not save fallback report for lesson ${lesson.id}: ${fallbackError instanceof Error ? fallbackError.message : fallbackError}`,
          );
        }
      }

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
        `Lesson ${lesson.id} processing failed (${attempts}/${MAX_REPORT_PROCESSING_ATTEMPTS}): ${message}`,
      );
      if (permanentlyFailed) {
        try {
          const userId = await this.resolveTeacherUserId(lesson);
          if (userId) {
            await this.notifications.notifyLessonFailed(
              userId,
              lesson.id,
              message,
            );
          }
        } catch {
          /* ignore */
        }
      }
    } finally {
      clearInterval(heartbeat);
      this.running.delete(lesson.id);
    }
  }

  private async resolveTeacherUserId(lesson: Lesson) {
    if (lesson.teacher?.userId) return lesson.teacher.userId;
    if (!lesson.teacherId) return null;
    const teacher = await this.teacherRepo.findOne({
      where: { id: lesson.teacherId },
    });
    return teacher?.userId ?? null;
  }

  private async enqueueLocalComputeJob(lesson: Lesson, leaseId: string) {
    if (!this.computeJobRepo) {
      throw new Error('Очередь локальной обработки не настроена');
    }
    const existing = await this.computeJobRepo.findOne({
      where: { lessonId: lesson.id },
    });
    if (!existing) {
      await this.computeJobRepo.insert({
        lessonId: lesson.id,
        status: ComputeJobStatus.PENDING,
        recordingObjectKey: lesson.recordingObjectKey,
        lessonNote: lesson.slot?.note ?? null,
      });
    } else if (
      existing.status === ComputeJobStatus.COMPLETED ||
      existing.status === ComputeJobStatus.FAILED
    ) {
      // A lesson can be reopened after an earlier attempt. Reset its unique
      // queue row instead of silently ignoring the insert and leaving the
      // lesson waiting forever on a completed job.
      await Promise.all([
        this.storage.deleteObject(`lessons/${lesson.id}/transcript.txt`),
        this.storage.deleteObject(`lessons/${lesson.id}/transcript.json`),
      ]);
      await this.computeJobRepo.update(existing.id, {
        status: ComputeJobStatus.PENDING,
        recordingObjectKey: lesson.recordingObjectKey,
        lessonNote: lesson.slot?.note ?? null,
        attempts: 0,
        leaseToken: null,
        leaseExpiresAt: null,
        retryAt: null,
        error: null,
      });
      await this.lessonRepo.update(lesson.id, {
        transcriptObjectKey: null,
        transcriptLanguage: null,
        transcriptDurationSeconds: null,
      });
    }
    await this.lessonRepo.update(
      {
        id: lesson.id,
        status: LessonStatus.PROCESSING,
        processingLeaseId: leaseId,
      },
      {
        processingLeaseId: null,
        nextProcessingAt: null,
        processingError: 'Ожидает локальный компьютер для обработки',
      },
    );
    this.logger.log(`Lesson ${lesson.id} queued for the local compute worker`);
  }

  private async processOne(lesson: Lesson, leaseId: string) {
    const hasRecording = Boolean(
      lesson.recordingObjectKey &&
        (await this.storage.exists(lesson.recordingObjectKey)),
    );
    if (
      lesson.recordingObjectKey &&
      !hasRecording &&
      !lesson.transcriptObjectKey
    ) {
      throw new Error('Аудиозапись ещё загружается в хранилище');
    }

    // In remote mode the local compute worker owns this archive and stores the
    // downloaded copy on its own machine. The API must not duplicate audio on
    // the VPS in that mode.
    if (hasRecording && this.config.get<string>('compute.mode') !== 'remote') {
      await this.archiveRecordingLocally(lesson.id, lesson.recordingObjectKey);
    }

    if (
      hasRecording &&
      this.config.get<string>('compute.mode') === 'remote'
    ) {
      if (!this.config.get<string>('compute.secret')) {
        throw new Error('Для локальной очереди не задан COMPUTE_SECRET');
      }
      await this.enqueueLocalComputeJob(lesson, leaseId);
      return;
    }

    if (hasRecording && this.config.get<string>('compute.apiUrl')) {
      await this.processViaHomeGpu(lesson, leaseId);
      return;
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
    } else if (hasRecording) {
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
    } else {
      transcriptText = '';
      transcriptKey = undefined;
      transcriptLanguage = undefined;
      transcriptDuration = undefined;
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
      : this.emptyReport(
          hasRecording
            ? 'В аудиозаписи урока речь не обнаружена.'
            : 'В урок зашли, но аудиозапись не сохранилась. Отчёт сформирован без транскрипта.',
        );
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
        transcriptObjectKey: transcriptKey ?? null,
        reportObjectKey: reportKey,
        transcriptLanguage: transcriptLanguage ?? null,
        transcriptDurationSeconds: transcriptDuration ?? null,
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
      try {
        await this.learning.createDraftsForLesson(lesson, report);
      } catch (draftError) {
        this.logger.warn(
          `Could not create learning draft for lesson ${lesson.id}: ${draftError instanceof Error ? draftError.message : draftError}`,
        );
      }
      this.logger.log(`Lesson ${lesson.id} report is ready`);
      await this.notifyReportReady(lesson);
    }
  }

  private async archiveRecordingLocally(lessonId: string, objectKey: string) {
    const archiveDir = this.config.get<string>('storage.localAudioArchiveDir');
    if (!archiveDir) return;

    const safeLessonId = lessonId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const archivePath = path.join(archiveDir, `lesson-${safeLessonId}.ogg`);
    const partialPath = `${archivePath}.part-${randomUUID()}`;
    try {
      await fs.promises.mkdir(archiveDir, { recursive: true });
      try {
        const existing = await fs.promises.stat(archivePath);
        if (existing.isFile() && existing.size > 0) return;
      } catch (error: any) {
        if (error?.code !== 'ENOENT') throw error;
      }

      const recording = await this.storage.getObject(objectKey);
      await pipeline(recording, fs.createWriteStream(partialPath, { flags: 'wx' }));
      const archived = await fs.promises.stat(partialPath);
      if (!archived.size) throw new Error('Аудиозапись оказалась пустой');
      await fs.promises.rename(partialPath, archivePath);
      this.logger.log(`Archived lesson audio locally: ${archivePath}`);
    } catch (error) {
      await fs.promises.rm(partialPath, { force: true }).catch(() => undefined);
      this.logger.warn(
        `Could not archive lesson ${lessonId} audio locally; processing will continue from object storage: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  private async processViaHomeGpu(lesson: Lesson, leaseId: string) {
    const audio = await this.storage.getBuffer(lesson.recordingObjectKey);
    const apiUrl = this.config.get<string>('compute.apiUrl');
    const secret = this.config.get<string>('compute.secret');
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-Compute-Token': secret,
        'X-Lesson-Note': encodeURIComponent(lesson.slot?.note || ''),
      },
      body: new Uint8Array(audio),
      signal: AbortSignal.timeout(40 * 60 * 1000),
    });
    if (!response.ok) {
      throw new Error(
        `Домашний GPU (${response.status}): ${(await response.text()).slice(0, 500)}`,
      );
    }
    const result = (await response.json()) as {
      transcript: TranscriptionResult;
      report: LessonReport;
    };
    const transcript = result.transcript;
    const report = result.report;
    const transcriptText = this.formatTranscript(transcript);
    const transcriptKey = `lessons/${lesson.id}/transcript.txt`;
    const reportKey = `lessons/${lesson.id}/report.json`;
    await Promise.all([
      this.storage.putText(transcriptKey, transcriptText),
      this.storage.putJson(`lessons/${lesson.id}/transcript.json`, transcript),
      this.storage.putJson(reportKey, report),
    ]);
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
        transcriptLanguage: transcript.language,
        transcriptDurationSeconds: transcript.duration,
        report,
        endedAt: lesson.endedAt || new Date(),
        processingLeaseId: null,
        processingError: null,
        nextProcessingAt: null,
      },
    );
    if (completed.affected) {
      await this.lessons.markBookingsCompleted(lesson.slotId);
      try {
        await this.learning.createDraftsForLesson(lesson, report);
      } catch (draftError) {
        this.logger.warn(
          `Could not create learning draft for lesson ${lesson.id}: ${draftError instanceof Error ? draftError.message : draftError}`,
        );
      }
      this.logger.log(`Lesson ${lesson.id} report came from the home GPU`);
      await this.notifyReportReady(lesson);
    }
  }

  private async notifyReportReady(lesson: Lesson) {
    if (lesson.teacher?.userId) {
      try {
        await this.notifications.notifyLessonReportReady(
          lesson.teacher.userId,
          lesson.id,
          lesson.slot?.startTime,
        );
      } catch (error) {
        this.logger.warn(
          `Could not notify teacher about lesson ${lesson.id}: ${
            error instanceof Error ? error.message : error
          }`,
        );
      }
    }

  }

  private emptyReport(summary: string): LessonReport {
    return {
      summary,
      topics: [],
      achievements: [],
      difficulties: [],
      homework: [],
      recommendations: [],
      keyMoments: [],
    };
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
    const maxChunk = 18_000;
    let source = transcript;

    if (transcript.length > 70_000) {
      const chunks: string[] = [];
      const sourceChunks: string[] = [];
      for (let i = 0; i < transcript.length; i += maxChunk) {
        sourceChunks.push(transcript.slice(i, i + maxChunk));
      }
      for (let i = 0; i < sourceChunks.length; i += 2) {
        chunks.push(
          ...(await Promise.all(
            sourceChunks.slice(i, i + 2).map((chunk) =>
              this.callOllama(
                `Сделай подробный конспект части транскрипта урока. Сохрани темы, достижения, трудности, домашние задания и временные метки.\n\n${chunk}`,
                false,
              ),
            ),
          )),
        );
      }
      source = chunks.join('\n\n--- ЧАСТЬ ---\n\n');
    }

    const prompt = `
Ты — методист онлайн-школы. На основе транскрипта подготовь объективный отчёт об уроке на русском языке.
Не выдумывай факты. Если информации нет, используй пустой массив.
Тема урока — то, что реально разбирали в транскрипте, одним названием. Домашние задания бери только из транскрипта и только по этой теме.
Пиши кратко: summary — не более 3 предложений, не более 4 пунктов в каждом списке и не более 6 важных моментов.
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
        keep_alive: '30m',
        options: {
          temperature: 0.2,
        num_ctx: this.config.get<number>('ollama.contextWindow') || 16384,
          num_predict: json ? 1200 : 768,
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
      ? value
          .filter((item): item is string => typeof item === 'string')
          .map((item) => item.trim().slice(0, MAX_REPORT_TEXT_CHARS))
          .filter(Boolean)
          .slice(0, MAX_REPORT_LIST_ITEMS)
      : [];
  }
}
