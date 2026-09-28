import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { Booking, BookingStatus } from './entities/booking.entity';
import {
  CalendarSlot,
  SlotStatus,
} from '../calendar/entities/calendar-slot.entity';
import { Student } from '../students/entities/student.entity';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class BookingsService {
  constructor(
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
    @InjectRepository(CalendarSlot)
    private slotRepository: Repository<CalendarSlot>,
    @InjectRepository(Student)
    private studentRepository: Repository<Student>,
    @InjectDataSource()
    private dataSource: DataSource,
    private notificationsService: NotificationsService,
    private config: ConfigService,
  ) {}

  async createBooking(
    studentUserId: string,
    slotId: string,
    isRecurring = false,
  ) {
    const student = await this.studentRepository.findOne({
      where: { userId: studentUserId },
    });
    if (!student) throw new NotFoundException('Ученик не найден');
    if (!student.teacherId) {
      throw new BadRequestException('Сначала привяжитесь к преподавателю');
    }

    const created = await this.dataSource.transaction(async (manager) => {
      // Lock only the slot row. FOR UPDATE + LEFT JOIN (relations) fails on Postgres.
      const lockedSlot = await manager.findOne(CalendarSlot, {
        where: { id: slotId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!lockedSlot) throw new NotFoundException('Слот не найден');
      const slot = await manager.findOne(CalendarSlot, {
        where: { id: slotId },
        relations: ['teacher', 'teacher.user'],
      });
      if (!slot) throw new NotFoundException('Слот не найден');
      if (slot.teacherId !== student.teacherId) {
        throw new ForbiddenException(
          'Можно записаться только к своему преподавателю',
        );
      }
      if (slot.status !== SlotStatus.AVAILABLE) {
        throw new BadRequestException('Слот недоступен для записи');
      }

      const now = new Date();
      if (!isRecurring && slot.startTime <= now) {
        throw new BadRequestException('Нельзя записаться на прошедший слот');
      }

      let slotsToBook: CalendarSlot[] = [slot];
      if (isRecurring && slot.recurringGroupId) {
        const series = await manager.find(CalendarSlot, {
          where: { recurringGroupId: slot.recurringGroupId },
          relations: ['teacher', 'teacher.user'],
        });
        slotsToBook = series.filter(
          (s) => s.status === SlotStatus.AVAILABLE && s.startTime > now,
        );
      }

      const groupId =
        isRecurring && slotsToBook.length > 1 ? randomUUID() : null;
      const rows: Booking[] = [];

      for (const s of slotsToBook) {
        const locked = await manager.findOne(CalendarSlot, {
          where: { id: s.id },
          lock: { mode: 'pessimistic_write' },
        });
        if (!locked) continue;
        if (locked.status !== SlotStatus.AVAILABLE) continue;
        if (locked.bookedCount >= locked.capacity) continue;
        if (locked.teacherId !== student.teacherId) continue;
        if (locked.startTime <= new Date()) continue;

        const alreadyBooked = await manager.findOne(Booking, {
          where: {
            studentId: student.id,
            slotId: locked.id,
            status: BookingStatus.CONFIRMED,
          },
        });
        if (alreadyBooked) continue;

        const booking = manager.create(Booking, {
          studentId: student.id,
          slotId: locked.id,
          status: BookingStatus.CONFIRMED,
          isRecurring: groupId !== null,
          recurringGroupId: groupId,
        });
        await manager.save(booking);

        locked.bookedCount += 1;
        if (locked.bookedCount >= locked.capacity) {
          locked.status = SlotStatus.BOOKED;
        }
        await manager.save(locked);
        rows.push(booking);
      }

      if (!rows.length) {
        throw new BadRequestException('Нет свободных мест');
      }
      return { rows, slot };
    });

    await this.notificationsService.notifyBookingConfirmed(
      studentUserId,
      created.slot.startTime,
    );
    if (created.slot.teacher?.userId) {
      await this.notificationsService.notifyTeacherNewBooking(
        created.slot.teacher.userId,
        created.slot.startTime,
      );
    }

    return created.rows[0] ?? created.rows;
  }

  async cancelByStudent(
    studentUserId: string,
    bookingId: string,
    cancelSeries = false,
  ) {
    const student = await this.studentRepository.findOne({
      where: { userId: studentUserId },
    });
    if (!student) throw new NotFoundException('Ученик не найден');

    const slot = await this.dataSource.transaction(async (manager) => {
      const booking = await manager.findOne(Booking, {
        where: { id: bookingId },
        relations: ['slot', 'slot.teacher'],
      });
      if (!booking) throw new NotFoundException('Запись не найдена');
      if (booking.studentId !== student.id) throw new ForbiddenException();
      if (booking.status !== BookingStatus.CONFIRMED) {
        throw new BadRequestException('Запись уже отменена');
      }

      const primary = booking.slot;
      const hoursUntil = (primary.startTime.getTime() - Date.now()) / 3600000;
      if (hoursUntil < 24) {
        throw new BadRequestException(
          'Отмена возможна не позже чем за 24 часа до занятия',
        );
      }

      let bookingsToCancel: Booking[] = [booking];
      if (cancelSeries && booking.recurringGroupId) {
        bookingsToCancel = await manager.find(Booking, {
          where: {
            recurringGroupId: booking.recurringGroupId,
            studentId: student.id,
            status: BookingStatus.CONFIRMED,
          },
          relations: ['slot'],
        });
      }

      for (const b of bookingsToCancel) {
        const hrs = (b.slot.startTime.getTime() - Date.now()) / 3600000;
        if (hrs < 24) continue;
        await this.releaseConfirmedBooking(
          manager,
          b.id,
          BookingStatus.CANCELLED_BY_STUDENT,
        );
      }
      return primary;
    });

    await this.notificationsService.notifyBookingCancelled(
      studentUserId,
      slot.startTime,
    );
    if (slot.teacher?.userId) {
      await this.notificationsService.notifyTeacherBookingCancelledByStudent(
        slot.teacher.userId,
        slot.startTime,
      );
    }
    return {
      message: cancelSeries ? 'Серия записей отменена' : 'Запись отменена',
    };
  }

  async cancelByTeacher(teacherUserId: string, bookingId: string) {
    const booking = await this.bookingRepository.findOne({
      where: { id: bookingId },
      relations: ['slot', 'slot.teacher', 'student'],
    });
    if (!booking) throw new NotFoundException('Запись не найдена');
    if (booking.slot.teacher?.userId !== teacherUserId) {
      throw new ForbiddenException();
    }

    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new BadRequestException('Запись уже отменена');
    }

    const slot = await this.dataSource.transaction(async (manager) => {
      await this.releaseConfirmedBooking(
        manager,
        booking.id,
        BookingStatus.CANCELLED_BY_TEACHER,
      );
      return booking.slot;
    });

    await this.notificationsService.notifyBookingCancelled(
      booking.student.userId,
      slot.startTime,
    );
    return { message: 'Запись отменена преподавателем' };
  }

  private async releaseConfirmedBooking(
    manager: EntityManager,
    bookingId: string,
    nextStatus: BookingStatus,
  ) {
    const updated = await manager.update(
      Booking,
      { id: bookingId, status: BookingStatus.CONFIRMED },
      { status: nextStatus },
    );
    if (!updated.affected) return;

    const booking = await manager.findOne(Booking, { where: { id: bookingId } });
    if (!booking) return;
    const locked = await manager.findOne(CalendarSlot, {
      where: { id: booking.slotId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!locked) return;
    locked.bookedCount = Math.max(0, locked.bookedCount - 1);
    if (
      locked.status === SlotStatus.BOOKED &&
      locked.bookedCount < locked.capacity
    ) {
      locked.status = SlotStatus.AVAILABLE;
    }
    await manager.save(locked);
  }

  async getStudentBookings(studentUserId: string) {
    const student = await this.studentRepository.findOne({
      where: { userId: studentUserId },
    });
    if (!student) return [];
    return this.bookingRepository.find({
      where: { studentId: student.id },
      relations: ['slot', 'slot.lesson', 'slot.teacher', 'slot.teacher.user'],
      order: { createdAt: 'DESC' },
    });
  }

  async getUpcomingStudentBookings(studentUserId: string) {
    const student = await this.studentRepository.findOne({
      where: { userId: studentUserId },
    });
    if (!student) return [];
    const bookings = await this.bookingRepository.find({
      where: { studentId: student.id, status: BookingStatus.CONFIRMED },
      relations: ['slot', 'slot.lesson'],
    });
    const lateMs =
      (this.config.get<number>('livekit.joinLateMinutes') ?? 120) * 60_000;
    const cutoff = Date.now() - lateMs;
    return bookings
      .filter((b) => new Date(b.slot.endTime).getTime() >= cutoff)
      .sort(
        (a, b) =>
          new Date(a.slot.startTime).getTime() -
          new Date(b.slot.startTime).getTime(),
      );
  }

  async getTeacherBookings(teacherUserId: string) {
    return this.bookingRepository
      .createQueryBuilder('booking')
      .leftJoinAndSelect('booking.slot', 'slot')
      .leftJoinAndSelect('slot.lesson', 'lesson')
      .leftJoinAndSelect('slot.teacher', 'teacher')
      .leftJoinAndSelect('teacher.user', 'teacherUser')
      .leftJoinAndSelect('booking.student', 'student')
      .leftJoinAndSelect('student.user', 'studentUser')
      .where('teacherUser.id = :teacherUserId', { teacherUserId })
      .orderBy('slot.startTime', 'DESC')
      .getMany();
  }
}
