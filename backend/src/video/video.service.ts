import {
  ForbiddenException,
  InternalServerErrorException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from 'crypto';
import { AccessToken, TrackSource } from 'livekit-server-sdk';
import { Booking, BookingStatus } from '../bookings/entities/booking.entity';
import {
  CalendarSlot,
  SlotStatus,
} from '../calendar/entities/calendar-slot.entity';
import { Student } from '../students/entities/student.entity';
import { Teacher } from '../teachers/entities/teacher.entity';
import { LessonsService } from '../lessons/lessons.service';
import { LivekitLifecycleService } from '../lessons/livekit-lifecycle.service';
import { LessonStatus } from '../lessons/entities/lesson.entity';
import { User } from '../users/entities/user.entity';

interface CameraLinkClaims {
  purpose: 'lesson-camera';
  lessonId: string;
  roomName: string;
  teacherId: string;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
}

@Injectable()
export class VideoService {
  private static readonly CAMERA_LINK_TTL_MS = 8 * 60 * 60_000;
  private static readonly CAMERA_TOKEN_TTL_SECONDS = 8 * 60 * 60;

  constructor(
    private config: ConfigService,
    @InjectRepository(Booking) private bookingRepo: Repository<Booking>,
    @InjectRepository(CalendarSlot) private slotRepo: Repository<CalendarSlot>,
    @InjectRepository(Student) private studentRepo: Repository<Student>,
    @InjectRepository(Teacher) private teacherRepo: Repository<Teacher>,
    private readonly lessons: LessonsService,
    private readonly lifecycle: LivekitLifecycleService,
  ) {}

  async getToken(userId: string, role: string, slotId: string) {
    const slot = await this.slotRepo.findOne({ where: { id: slotId } });
    if (!slot) throw new ForbiddenException('Слот не найден');
    if (slot.status === SlotStatus.CANCELLED) {
      throw new ForbiddenException('Этот урок отменён');
    }
    if (
      slot.status !== SlotStatus.AVAILABLE &&
      slot.status !== SlotStatus.BOOKED
    ) {
      throw new ForbiddenException('Слот недоступен для входа');
    }

    if (role === 'student') {
      const student = await this.studentRepo.findOne({ where: { userId } });
      if (!student) throw new ForbiddenException();
      const booking = await this.bookingRepo.findOne({
        where: {
          studentId: student.id,
          slotId,
          status: BookingStatus.CONFIRMED,
        },
      });
      if (!booking) {
        throw new ForbiddenException('Нет подтверждённой записи на этот урок');
      }
    } else if (role === 'teacher') {
      const teacher = await this.teacherRepo.findOne({ where: { userId } });
      if (!teacher) throw new ForbiddenException();
      if (slot.teacherId !== teacher.id) {
        throw new ForbiddenException('Этот слот не принадлежит вам');
      }
    } else {
      throw new ForbiddenException();
    }

    const apiKey = this.config.get<string>('livekit.apiKey');
    const apiSecret = this.config.get<string>('livekit.apiSecret');
    const lesson = await this.lessons.ensureForSlot(slotId);
    if (
      ![
        LessonStatus.WAITING,
        LessonStatus.STARTING,
        LessonStatus.ACTIVE,
      ].includes(lesson.status)
    ) {
      throw new ForbiddenException('Этот урок уже завершён');
    }

    await this.lifecycle.ensureRoom(lesson);

    const at = new AccessToken(apiKey, apiSecret, {
      identity: userId,
      ttl: 8 * 3600,
      metadata: JSON.stringify({
        lessonId: lesson.id,
        slotId,
        role,
      }),
    });
    at.addGrant({
      roomJoin: true,
      room: lesson.roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    return {
      token: await at.toJwt(),
      url: this.config.get<string>('livekit.publicUrl'),
      room: lesson.roomName,
      lessonId: lesson.id,
      lessonStatus: lesson.status,
    };
  }

  async createCameraLink(user: User, lessonId: string) {
    const lesson = await this.lessons.assertTeacherOwns(user, lessonId);
    if (
      ![
        LessonStatus.WAITING,
        LessonStatus.STARTING,
        LessonStatus.ACTIVE,
      ].includes(lesson.status)
    ) {
      throw new ForbiddenException(
        'Камеру можно подключить только к активному уроку',
      );
    }

    await this.lifecycle.ensureRoom(lesson);
    const issuedAt = Date.now();
    const expiresAt = issuedAt + VideoService.CAMERA_LINK_TTL_MS;
    const claims: CameraLinkClaims = {
      purpose: 'lesson-camera',
      lessonId: lesson.id,
      roomName: lesson.roomName,
      teacherId: lesson.teacherId,
      issuedAt,
      expiresAt,
      nonce: randomBytes(16).toString('base64url'),
    };
    const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
    const code = `${payload}.${this.signCameraLink(payload)}`;

    return {
      code,
      expiresAt: new Date(expiresAt).toISOString(),
    };
  }

  async consumeCameraLink(code: string) {
    const session = this.verifyCameraLink(code);

    const lesson = await this.lessons.findByRoomName(session.roomName);
    if (
      !lesson ||
      lesson.id !== session.lessonId ||
      lesson.teacherId !== session.teacherId ||
      ![
        LessonStatus.WAITING,
        LessonStatus.STARTING,
        LessonStatus.ACTIVE,
      ].includes(lesson.status)
    ) {
      throw new ForbiddenException('Этот урок уже завершён');
    }

    const apiKey = this.config.get<string>('livekit.apiKey');
    const apiSecret = this.config.get<string>('livekit.apiSecret');
    const at = new AccessToken(apiKey, apiSecret, {
      identity: `camera-${randomUUID()}`,
      name: 'Камера тетради',
      ttl: VideoService.CAMERA_TOKEN_TTL_SECONDS,
      metadata: JSON.stringify({
        lessonId: lesson.id,
        role: 'camera',
      }),
    });
    at.addGrant({
      roomJoin: true,
      room: lesson.roomName,
      canPublish: true,
      canPublishSources: [TrackSource.CAMERA],
      canSubscribe: false,
      canPublishData: false,
    });

    return {
      token: await at.toJwt(),
      url: this.config.get<string>('livekit.publicUrl'),
      lessonId: lesson.id,
      expiresAt: new Date(session.expiresAt).toISOString(),
    };
  }

  private signCameraLink(payload: string) {
    return createHmac('sha256', this.cameraLinkSecret())
      .update(payload)
      .digest('base64url');
  }

  private cameraLinkSecret() {
    const secret = this.config.get<string>('jwt.secret');
    if (!secret) {
      throw new InternalServerErrorException(
        'Настройки ссылки камеры недоступны',
      );
    }
    return secret;
  }

  private verifyCameraLink(code: string): CameraLinkClaims {
    if (typeof code !== 'string' || code.length > 1024) {
      throw new NotFoundException(
        'Ссылка камеры недействительна или устарела. Попросите преподавателя обновить QR-код',
      );
    }

    const [payload, signature, extra] = code.split('.');
    if (!payload || !signature || extra !== undefined) {
      throw new NotFoundException(
        'Ссылка камеры недействительна или устарела. Попросите преподавателя обновить QR-код',
      );
    }

    const expected = Buffer.from(this.signCameraLink(payload), 'base64url');
    let actual: Buffer;
    try {
      actual = Buffer.from(signature, 'base64url');
    } catch {
      throw new NotFoundException(
        'Ссылка камеры недействительна или устарела. Попросите преподавателя обновить QR-код',
      );
    }
    if (
      actual.length !== expected.length ||
      !timingSafeEqual(actual, expected)
    ) {
      throw new NotFoundException(
        'Ссылка камеры недействительна или устарела. Попросите преподавателя обновить QR-код',
      );
    }

    let claims: CameraLinkClaims;
    try {
      claims = JSON.parse(
        Buffer.from(payload, 'base64url').toString('utf8'),
      ) as CameraLinkClaims;
    } catch {
      throw new NotFoundException(
        'Ссылка камеры недействительна или устарела. Попросите преподавателя обновить QR-код',
      );
    }

    const now = Date.now();
    if (
      claims?.purpose !== 'lesson-camera' ||
      typeof claims.lessonId !== 'string' ||
      typeof claims.roomName !== 'string' ||
      typeof claims.teacherId !== 'string' ||
      typeof claims.issuedAt !== 'number' ||
      typeof claims.expiresAt !== 'number' ||
      typeof claims.nonce !== 'string' ||
      claims.issuedAt > now + 60_000 ||
      claims.expiresAt <= now ||
      claims.expiresAt <= claims.issuedAt ||
      claims.expiresAt - claims.issuedAt > VideoService.CAMERA_LINK_TTL_MS
    ) {
      throw new NotFoundException(
        'Ссылка камеры недействительна или устарела. Попросите преподавателя обновить QR-код',
      );
    }
    return claims;
  }
}
