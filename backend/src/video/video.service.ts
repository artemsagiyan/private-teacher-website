import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccessToken } from 'livekit-server-sdk';
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

@Injectable()
export class VideoService {
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

    const now = Date.now();
    const earlyMs =
      this.config.get<number>('livekit.joinEarlyMinutes') * 60_000;
    const lateMs =
      this.config.get<number>('livekit.joinLateMinutes') * 60_000;
    const start = new Date(slot.startTime).getTime();
    const end = new Date(slot.endTime).getTime();

    // For live lessons allow stay; for waiting enforce join window
    if (lesson.status === LessonStatus.WAITING) {
      if (now < start - earlyMs) {
        throw new ForbiddenException(
          `Войти в урок можно за ${this.config.get<number>('livekit.joinEarlyMinutes')} минут до начала`,
        );
      }
      if (now > end + lateMs) {
        throw new ForbiddenException('Время входа в этот урок истекло');
      }
    }

    await this.lifecycle.ensureRoom(lesson);

    const remainingMs = Math.max(5 * 60_000, end + lateMs - now);
    const ttlSeconds = Math.min(Math.ceil(remainingMs / 1000), 8 * 3600);

    const at = new AccessToken(apiKey, apiSecret, {
      identity: userId,
      ttl: ttlSeconds,
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
      room: lesson.roomName,
      lessonId: lesson.id,
      lessonStatus: lesson.status,
    };
  }
}
