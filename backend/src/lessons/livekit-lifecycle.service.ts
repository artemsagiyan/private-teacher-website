import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import {
  In,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
import {
  EgressClient,
  EgressStatus,
  EncodedFileOutput,
  EncodedFileType,
  RoomServiceClient,
  S3Upload,
  WebhookReceiver,
} from 'livekit-server-sdk';
import { User } from '../users/entities/user.entity';
import {
  Lesson,
  LessonEndReason,
  LessonStatus,
} from './entities/lesson.entity';
import { LessonsService } from './lessons.service';

@Injectable()
export class LivekitLifecycleService {
  private readonly logger = new Logger(LivekitLifecycleService.name);
  private readonly receiver: WebhookReceiver;
  private readonly roomClient: RoomServiceClient;
  private readonly egressClient: EgressClient;
  private readonly ending = new Set<string>();
  private readonly roomRefreshes = new Map<string, Promise<boolean>>();

  constructor(
    private readonly config: ConfigService,
    private readonly lessons: LessonsService,
    @InjectRepository(Lesson)
    private readonly lessonRepo: Repository<Lesson>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {
    const apiKey = this.config.get<string>('livekit.apiKey');
    const apiSecret = this.config.get<string>('livekit.apiSecret');
    const wsUrl = this.config.get<string>('livekit.url');
    const apiUrl = wsUrl
      .replace(/^ws:\/\//, 'http://')
      .replace(/^wss:\/\//, 'https://');

    this.receiver = new WebhookReceiver(apiKey, apiSecret);
    this.roomClient = new RoomServiceClient(apiUrl, apiKey, apiSecret);
    this.egressClient = new EgressClient(apiUrl, apiKey, apiSecret);
  }

  async ensureRoom(lesson: Lesson) {
    const existing = await this.roomClient.listRooms([lesson.roomName]);
    if (existing.length) return existing[0];

    const timeout = this.config.get<number>(
      'livekit.roomEmptyTimeoutSeconds',
    );
    return this.roomClient.createRoom({
      name: lesson.roomName,
      emptyTimeout: timeout,
      departureTimeout: timeout,
      metadata: JSON.stringify({
        lessonId: lesson.id,
        slotId: lesson.slotId,
      }),
    });
  }

  async handleWebhook(rawBody: string, authorization?: string) {
    const event = await this.receiver.receive(rawBody, authorization);
    const roomName = event.room?.name;

    switch (event.event) {
      case 'participant_joined':
      case 'participant_left':
      case 'participant_connection_aborted':
        if (roomName) await this.refreshParticipantCount(roomName);
        break;

      case 'room_finished':
        if (roomName) {
          const lesson = await this.lessons.findByRoomName(roomName);
          if (lesson) {
            await this.finishLesson(
              lesson,
              LessonEndReason.ROOM_FINISHED,
              false,
            );
          }
        }
        break;

      case 'egress_ended':
        if (event.egressInfo?.egressId) {
          await this.handleEgressEnded(
            event.egressInfo.egressId,
            event.egressInfo.status,
            event.egressInfo.error,
            event.egressInfo.roomName,
          );
        }
        break;
    }

    return { ok: true };
  }

  async endByTeacher(user: User, lessonId: string) {
    const lesson = await this.lessons.assertTeacherOwns(user, lessonId);
    await this.finishLesson(lesson, LessonEndReason.TEACHER, true);
    return { ok: true };
  }

  @Interval(60_000)
  async finishAbandonedLessons() {
    const timeoutSeconds = this.config.get<number>(
      'livekit.roomEmptyTimeoutSeconds',
    );
    const cutoff = new Date(Date.now() - timeoutSeconds * 1000);
    const abandoned = await this.lessonRepo.find({
      where: {
        status: In([
          LessonStatus.STARTING,
          LessonStatus.ACTIVE,
          LessonStatus.ENDING,
        ]),
        participantCount: 0,
        lastParticipantLeftAt: LessThanOrEqual(cutoff),
      },
    });

    for (const lesson of abandoned) {
      const refreshed = await this.refreshParticipantCount(lesson.roomName);
      if (!refreshed) continue;
      const reconciled = await this.lessonRepo.findOneBy({ id: lesson.id });
      if (
        reconciled &&
        reconciled.participantCount === 0 &&
        reconciled.lastParticipantLeftAt &&
        reconciled.lastParticipantLeftAt <= cutoff
      ) {
        await this.finishLesson(
          reconciled,
          LessonEndReason.EMPTY_ROOM,
          true,
        );
      }
    }

    const waitingWithParticipants = await this.lessonRepo.find({
      where: {
        status: LessonStatus.WAITING,
        participantCount: MoreThanOrEqual(2),
      },
      take: 10,
    });
    for (const lesson of waitingWithParticipants) {
      await this.refreshParticipantCount(lesson.roomName);
    }

    const endingRecordings = await this.lessonRepo.find({
      where: { status: LessonStatus.ENDING },
      take: 10,
    });
    for (const lesson of endingRecordings) {
      // STARTING→ENDING without egressId: complete after short grace
      if (
        !lesson.egressId &&
        lesson.endedAt &&
        lesson.endedAt.getTime() < Date.now() - 90_000
      ) {
        await this.lessonRepo.update(
          { id: lesson.id, status: LessonStatus.ENDING },
          {
            status: LessonStatus.COMPLETED,
            processingError:
              lesson.processingError ||
              'Урок завершён без аудиозаписи',
          },
        );
        await this.lessons.markBookingsCompleted(lesson.slotId);
        try {
          await this.roomClient.deleteRoom(lesson.roomName);
        } catch {
          // ignore
        }
        continue;
      }
      if (!lesson.egressId) continue;
      try {
        const [info] = await this.egressClient.listEgress({
          egressId: lesson.egressId,
        });
        if (
          info &&
          [
            EgressStatus.EGRESS_COMPLETE,
            EgressStatus.EGRESS_FAILED,
            EgressStatus.EGRESS_ABORTED,
            EgressStatus.EGRESS_LIMIT_REACHED,
          ].includes(info.status)
        ) {
          await this.handleEgressEnded(
            info.egressId,
            info.status,
            info.error,
            info.roomName,
          );
        }
      } catch (error) {
        this.logger.warn(
          `Could not reconcile ending egress ${lesson.egressId}: ${
            error instanceof Error ? error.message : error
          }`,
        );
      }
    }
  }

  private async refreshParticipantCount(roomName: string): Promise<boolean> {
    const previous =
      this.roomRefreshes.get(roomName) || Promise.resolve(true);
    const current = previous
      .catch(() => false)
      .then(() => this.reconcileParticipantCount(roomName));
    this.roomRefreshes.set(roomName, current);
    try {
      return await current;
    } finally {
      if (this.roomRefreshes.get(roomName) === current) {
        this.roomRefreshes.delete(roomName);
      }
    }
  }

  private async reconcileParticipantCount(roomName: string): Promise<boolean> {
    const lesson = await this.lessons.findByRoomName(roomName);
    if (!lesson) return true;

    let identities: string[];
    try {
      const participants =
        await this.roomClient.listParticipants(roomName);
      identities = participants.map((participant) => participant.identity);
    } catch (error) {
      this.logger.warn(
        `Could not list participants in ${roomName}: ${
          error instanceof Error ? error.message : error
        }`,
      );
      return false;
    }

    const participantCount = identities.length
      ? await this.userRepo.count({ where: { id: In(identities) } })
      : 0;

    const update: Partial<Lesson> = { participantCount };
    if (participantCount === 0) {
      update.lastParticipantLeftAt =
        lesson.lastParticipantLeftAt || new Date();
    } else {
      update.lastParticipantLeftAt = null;
    }
    await this.lessonRepo.update(lesson.id, update);

    const teacherUserId = lesson.teacher?.userId;
    const teacherPresent = Boolean(
      teacherUserId && identities.includes(teacherUserId),
    );
    const studentPresent = identities.some(
      (identity) => identity !== teacherUserId,
    );

    if (
      teacherPresent &&
      studentPresent &&
      lesson.status === LessonStatus.WAITING
    ) {
      await this.startRecording(lesson);
    }
    return true;
  }

  private async startRecording(lesson: Lesson) {
    const recordingObjectKey = `lessons/${lesson.id}/audio.ogg`;

    try {
      const active = await this.egressClient.listEgress({
        roomName: lesson.roomName,
        active: true,
      });
      if (active.length) {
        await this.lessonRepo.update(
          { id: lesson.id, status: LessonStatus.WAITING },
          {
            status: LessonStatus.ACTIVE,
            egressId: active[0].egressId,
            recordingObjectKey,
            startedAt: lesson.startedAt || new Date(),
            processingError: null,
          },
        );
        return;
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Could not reconcile egress for ${lesson.roomName}: ${message}`,
      );
      await this.lessonRepo.update(
        { id: lesson.id, status: LessonStatus.WAITING },
        { processingError: `Проверка сервиса записи недоступна: ${message}` },
      );
      return;
    }

    const claim = await this.lessonRepo.update(
      { id: lesson.id, status: LessonStatus.WAITING },
      {
        status: LessonStatus.STARTING,
        startedAt: new Date(),
        recordingObjectKey,
        processingError: null,
      },
    );
    if (!claim.affected) return;

    let startedEgressId: string | null = null;
    try {
      const output = new EncodedFileOutput({
        fileType: EncodedFileType.OGG,
        filepath: recordingObjectKey,
        output: {
          case: 's3',
          value: new S3Upload({
            accessKey: this.config.get<string>('storage.accessKey'),
            secret: this.config.get<string>('storage.secretKey'),
            region: this.config.get<string>('storage.region'),
            endpoint: this.config.get<string>('storage.egressEndpoint'),
            bucket: this.config.get<string>('storage.bucket'),
            forcePathStyle: true,
          }),
        },
      });

      const info = await this.egressClient.startRoomCompositeEgress(
        lesson.roomName,
        { file: output },
        { audioOnly: true },
      );
      startedEgressId = info.egressId;

      const activated = await this.lessonRepo.update(
        { id: lesson.id, status: LessonStatus.STARTING },
        {
          status: LessonStatus.ACTIVE,
          egressId: info.egressId,
          recordingObjectKey,
          startedAt: lesson.startedAt || new Date(),
        },
      );
      if (!activated.affected) {
        // Teacher (or empty-room) ended while egress was starting.
        const current = await this.lessonRepo.findOneBy({ id: lesson.id });
        try {
          const stopped = await this.egressClient.stopEgress(info.egressId);
          if (
            current?.status === LessonStatus.ENDING &&
            (stopped.status === EgressStatus.EGRESS_COMPLETE ||
              stopped.status === EgressStatus.EGRESS_FAILED ||
              stopped.status === EgressStatus.EGRESS_ABORTED ||
              stopped.status === EgressStatus.EGRESS_LIMIT_REACHED)
          ) {
            await this.lessonRepo.update(lesson.id, {
              egressId: info.egressId,
              recordingObjectKey,
            });
            await this.handleEgressEnded(
              info.egressId,
              stopped.status,
              stopped.error,
              lesson.roomName,
            );
          }
        } catch {
          if (current?.status === LessonStatus.ENDING) {
            await this.lessonRepo.update(
              { id: lesson.id, status: LessonStatus.ENDING },
              {
                status: LessonStatus.COMPLETED,
                egressId: null,
                processingError:
                  'Урок завершён до готовности записи',
              },
            );
          }
        }
        return;
      }
      this.logger.log(
        `Lesson ${lesson.id} started; egress ${info.egressId}`,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      if (startedEgressId) {
        try {
          await this.egressClient.stopEgress(startedEgressId);
        } catch {
          // Best effort cleanup; next retry reconciles active egresses.
        }
      }
      const rolledBack = await this.lessonRepo.update(
        { id: lesson.id, status: LessonStatus.STARTING },
        {
          status: LessonStatus.WAITING,
          startedAt: null,
          processingError: `Не удалось запустить запись: ${message}`,
        },
      );
      if (!rolledBack.affected) {
        // Already moved to ENDING — finish without recording
        const done = await this.lessonRepo.update(
          { id: lesson.id, status: LessonStatus.ENDING },
          {
            status: LessonStatus.COMPLETED,
            processingError: `Не удалось запустить запись: ${message}`,
          },
        );
        if (done.affected) {
          await this.lessons.markBookingsCompleted(lesson.slotId);
        }
      }
      this.logger.error(`Could not start recording: ${message}`);
    }
  }

  private async finishLesson(
    lesson: Lesson,
    reason: LessonEndReason,
    deleteRoom: boolean,
  ) {
    if (
      [
        LessonStatus.PROCESSING,
        LessonStatus.COMPLETED,
        LessonStatus.FAILED,
      ].includes(
        lesson.status,
      ) ||
      this.ending.has(lesson.id)
    ) {
      return;
    }

    this.ending.add(lesson.id);
    try {
      const fresh = await this.lessonRepo.findOneBy({ id: lesson.id });
      if (!fresh) return;
      if (
        [
          LessonStatus.PROCESSING,
          LessonStatus.COMPLETED,
          LessonStatus.FAILED,
        ].includes(fresh.status)
      ) {
        return;
      }

      if (!fresh.egressId) {
        // STARTING without egressId yet: park in ENDING until startRecording resolves
        if (fresh.status === LessonStatus.STARTING) {
          await this.lessonRepo.update(
            { id: fresh.id, status: LessonStatus.STARTING },
            {
              status: LessonStatus.ENDING,
              endedAt: new Date(),
              endReason: reason,
              participantCount: 0,
            },
          );
        } else {
          const completed = await this.lessonRepo.update(
            {
              id: fresh.id,
              status: In([
                LessonStatus.WAITING,
                LessonStatus.ACTIVE,
                LessonStatus.ENDING,
              ]),
            },
            {
              status: LessonStatus.COMPLETED,
              endedAt: new Date(),
              endReason: reason,
              participantCount: 0,
            },
          );
          if (!completed.affected) return;
        }
      } else {
        const ending = await this.lessonRepo.update(
          {
            id: fresh.id,
            status: In([
              LessonStatus.WAITING,
              LessonStatus.STARTING,
              LessonStatus.ACTIVE,
              LessonStatus.ENDING,
            ]),
          },
          {
            status: LessonStatus.ENDING,
            endedAt: fresh.endedAt || new Date(),
            endReason: reason,
            participantCount: 0,
          },
        );
        if (!ending.affected) return;

        let stoppedStatus: EgressStatus | null = null;
        try {
          const stopped = await this.egressClient.stopEgress(fresh.egressId);
          stoppedStatus = stopped.status;
        } catch (error) {
          this.logger.warn(
            `Could not stop egress ${fresh.egressId}: ${
              error instanceof Error ? error.message : error
            }`,
          );
        }
        if (
          stoppedStatus === EgressStatus.EGRESS_COMPLETE ||
          stoppedStatus === EgressStatus.EGRESS_FAILED ||
          stoppedStatus === EgressStatus.EGRESS_ABORTED ||
          stoppedStatus === EgressStatus.EGRESS_LIMIT_REACHED
        ) {
          await this.handleEgressEnded(
            fresh.egressId,
            stoppedStatus,
            undefined,
            fresh.roomName,
          );
        }
      }
      await this.lessons.markBookingsCompleted(fresh.slotId);

      if (deleteRoom) {
        try {
          await this.roomClient.deleteRoom(fresh.roomName);
        } catch {
          // The room may already be gone after the last participant left.
        }
      }
    } finally {
      this.ending.delete(lesson.id);
    }
  }

  private async handleEgressEnded(
    egressId: string,
    status: EgressStatus,
    error?: string,
    roomName?: string,
  ) {
    const lesson =
      (await this.lessons.findByEgressId(egressId)) ||
      (roomName
        ? await this.lessons.findByRoomName(roomName)
        : null);
    if (!lesson) return;
    if (
      [LessonStatus.COMPLETED, LessonStatus.FAILED].includes(
        lesson.status,
      )
    ) {
      return;
    }

    if (status === EgressStatus.EGRESS_COMPLETE) {
      if (lesson.status === LessonStatus.PROCESSING) return;
      await this.lessonRepo.update(
        {
          id: lesson.id,
          status: In([
            LessonStatus.WAITING,
            LessonStatus.STARTING,
            LessonStatus.ACTIVE,
            LessonStatus.ENDING,
          ]),
        },
        {
          status: LessonStatus.PROCESSING,
          egressId: lesson.egressId || egressId,
          endedAt: lesson.endedAt || new Date(),
          endReason: lesson.endReason || LessonEndReason.SYSTEM,
          participantCount: 0,
          nextProcessingAt: new Date(Date.now() + 5_000),
          processingLeaseId: null,
          processingError: null,
        },
      );
      await this.lessons.markBookingsCompleted(lesson.slotId);
      return;
    }

    if (
      status === EgressStatus.EGRESS_FAILED ||
      status === EgressStatus.EGRESS_ABORTED ||
      status === EgressStatus.EGRESS_LIMIT_REACHED
    ) {
      // If the lesson is still live, keep session alive and clear broken egress
      if (
        [
          LessonStatus.WAITING,
          LessonStatus.STARTING,
          LessonStatus.ACTIVE,
        ].includes(lesson.status)
      ) {
        await this.lessonRepo.update(
          {
            id: lesson.id,
            status: In([
              LessonStatus.WAITING,
              LessonStatus.STARTING,
              LessonStatus.ACTIVE,
            ]),
          },
          {
            status: LessonStatus.WAITING,
            egressId: null,
            recordingObjectKey: null,
            startedAt: null,
            processingError:
              error ||
              'Запись прервалась; урок продолжается без записи',
          },
        );
        return;
      }

      // Lesson was already ending — mark failed and clean up
      const failed = await this.lessonRepo.update(
        {
          id: lesson.id,
          status: In([LessonStatus.ENDING]),
        },
        {
          status: LessonStatus.FAILED,
          endedAt: lesson.endedAt || new Date(),
          endReason: lesson.endReason || LessonEndReason.SYSTEM,
          participantCount: 0,
          processingLeaseId: null,
          processingError:
            error || 'Запись урока завершилась с ошибкой',
        },
      );
      if (failed.affected) {
        await this.lessons.markBookingsCompleted(lesson.slotId);
        try {
          await this.roomClient.deleteRoom(lesson.roomName);
        } catch {
          // Room may already be closed.
        }
      }
    }
  }
}
