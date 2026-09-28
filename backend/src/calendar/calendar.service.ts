import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Between, DataSource, EntityManager, In, Not, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import {
  CalendarSlot,
  LessonType,
  SlotStatus,
} from './entities/calendar-slot.entity';
import { Teacher } from '../teachers/entities/teacher.entity';
import { Student } from '../students/entities/student.entity';
import { Booking, BookingStatus } from '../bookings/entities/booking.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateSlotDto } from './dto/create-slot.dto';
import { assertValidSlotRange, rangesOverlap } from './slot-overlap';

const RECURRING_WEEKS = 4;
const MS_PER_WEEK = 7 * 24 * 3600 * 1000;

@Injectable()
export class CalendarService {
  constructor(
    @InjectRepository(CalendarSlot)
    private slotRepository: Repository<CalendarSlot>,
    @InjectRepository(Teacher)
    private teacherRepository: Repository<Teacher>,
    @InjectRepository(Student)
    private studentRepository: Repository<Student>,
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
    @InjectDataSource()
    private dataSource: DataSource,
    private notificationsService: NotificationsService,
  ) {}

  async createSlot(teacherUserId: string, dto: CreateSlotDto) {
    const teacher = await this.teacherRepository.findOne({ where: { userId: teacherUserId } });
    if (!teacher) throw new NotFoundException('Преподаватель не найден');

    const start = new Date(dto.startTime);
    const end = new Date(dto.endTime);
    try {
      assertValidSlotRange(start, end);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Некорректный интервал',
      );
    }
    const capacity =
      dto.lessonType === LessonType.INDIVIDUAL ? 1 : dto.capacity;
    const duration = end.getTime() - start.getTime();
    const groupId = dto.isRecurring ? randomUUID() : null;

    const occurrences: Array<{ start: Date; end: Date }> = [{ start, end }];
    if (dto.isRecurring) {
      for (let w = 1; w < RECURRING_WEEKS; w++) {
        const s = new Date(start.getTime() + w * MS_PER_WEEK);
        occurrences.push({ start: s, end: new Date(s.getTime() + duration) });
      }
    }
    return this.withTeacherLock(teacher.id, async (manager) => {
      await this.assertNoOverlap(manager, teacher.id, occurrences);

      const buildSlot = (s: Date, e: Date) =>
        manager.create(CalendarSlot, {
          teacherId: teacher.id,
          startTime: s,
          endTime: e,
          lessonType: dto.lessonType,
          capacity,
          note: dto.note,
          status: SlotStatus.AVAILABLE,
          isRecurring: dto.isRecurring ?? false,
          recurringGroupId: groupId,
        });

      const firstSlot = buildSlot(start, end);
      await manager.save(firstSlot);

      if (dto.isRecurring) {
        const siblings: CalendarSlot[] = [];
        for (let w = 1; w < RECURRING_WEEKS; w++) {
          const s = new Date(start.getTime() + w * MS_PER_WEEK);
          const e = new Date(s.getTime() + duration);
          siblings.push(buildSlot(s, e));
        }
        await manager.save(siblings);
      }

      return firstSlot;
    });
  }

  private withTeacherLock<T>(
    teacherId: string,
    fn: (manager: EntityManager) => Promise<T>,
  ) {
    return this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `calendar:${teacherId}`,
      ]);
      return fn(manager);
    });
  }

  private async assertNoOverlap(
    manager: EntityManager,
    teacherId: string,
    ranges: Array<{ start: Date; end: Date }>,
    ignoreSlotId?: string,
  ) {
    const existing = await manager.find(CalendarSlot, {
      where: {
        teacherId,
        status: Not(SlotStatus.CANCELLED),
      },
    });
    for (const range of ranges) {
      const conflict = existing.find(
        (slot) =>
          slot.id !== ignoreSlotId &&
          rangesOverlap(range.start, range.end, slot.startTime, slot.endTime),
      );
      if (conflict) {
        throw new BadRequestException(
          'На это время уже есть другой слот',
        );
      }
    }
  }

  async updateSlot(teacherUserId: string, slotId: string, data: Partial<CreateSlotDto>) {
    const teacher = await this.teacherRepository.findOne({
      where: { userId: teacherUserId },
    });
    if (!teacher) throw new NotFoundException('Преподаватель не найден');
    return this.withTeacherLock(teacher.id, async (manager) => {
      const slot = await manager.findOne(CalendarSlot, { where: { id: slotId } });
      if (!slot) throw new NotFoundException('Слот не найден');
      if (slot.teacherId !== teacher.id) throw new ForbiddenException();
      if (slot.status === SlotStatus.CANCELLED) {
        throw new BadRequestException('Слот уже отменён');
      }

      const nextStart = data.startTime
        ? new Date(data.startTime)
        : slot.startTime;
      const nextEnd = data.endTime ? new Date(data.endTime) : slot.endTime;
      try {
        assertValidSlotRange(nextStart, nextEnd);
      } catch (error) {
        throw new BadRequestException(
          error instanceof Error ? error.message : 'Некорректный интервал',
        );
      }
      await this.assertNoOverlap(
        manager,
        teacher.id,
        [{ start: nextStart, end: nextEnd }],
        slot.id,
      );

      const lessonType = data.lessonType ?? slot.lessonType;
      const capacity =
        lessonType === LessonType.INDIVIDUAL
          ? 1
          : (data.capacity ?? slot.capacity);
      if (capacity < slot.bookedCount) {
        throw new BadRequestException(
          'Вместимость не может быть меньше числа записей',
        );
      }

      Object.assign(slot, {
        startTime: nextStart,
        endTime: nextEnd,
        lessonType,
        capacity,
        status:
          slot.bookedCount >= capacity
            ? SlotStatus.BOOKED
            : SlotStatus.AVAILABLE,
        ...(data.note !== undefined && { note: data.note }),
      });
      return manager.save(slot);
    });
  }

  async deleteSlot(teacherUserId: string, slotId: string, cancelSeries = false) {
    const teacher = await this.teacherRepository.findOne({
      where: { userId: teacherUserId },
    });
    if (!teacher) throw new NotFoundException('Преподаватель не найден');
    const slot = await this.slotRepository.findOne({
      where: { id: slotId },
      relations: ['bookings', 'bookings.student', 'bookings.student.user'],
    });
    if (!slot) throw new NotFoundException('Слот не найден');
    if (slot.teacherId !== teacher.id) throw new ForbiddenException();

    const slotsToCancel: CalendarSlot[] = [slot];

    if (cancelSeries && slot.recurringGroupId) {
      const siblings = await this.slotRepository.find({
        where: { recurringGroupId: slot.recurringGroupId },
        relations: ['bookings', 'bookings.student'],
      });
      slotsToCancel.push(...siblings.filter((s) => s.id !== slot.id));
    }

    for (const s of slotsToCancel) {
      s.status = SlotStatus.CANCELLED;
      await this.slotRepository.save(s);

      const confirmedBookings = (s.bookings ?? []).filter(
        (b) => b.status === BookingStatus.CONFIRMED,
      );

      await this.bookingRepository.update(
        {
          slotId: s.id,
          status: In([BookingStatus.CONFIRMED]),
        },
        { status: BookingStatus.CANCELLED_BY_TEACHER },
      );

      for (const booking of confirmedBookings) {
        if (booking.student?.userId) {
          await this.notificationsService.notifyBookingCancelled(
            booking.student.userId,
            s.startTime,
          );
        }
      }
    }

    return { message: cancelSeries ? 'Серия слотов отменена' : 'Слот отменён' };
  }

  async getTeacherSlots(teacherUserId: string, from?: string, to?: string) {
    const teacher = await this.teacherRepository.findOne({ where: { userId: teacherUserId } });
    if (!teacher) throw new NotFoundException('Преподаватель не найден');

    const where: any = { teacherId: teacher.id };
    if (from && to) where.startTime = Between(new Date(from), new Date(to));

    return this.slotRepository.find({
      where,
      order: { startTime: 'ASC' },
      relations: ['bookings', 'lesson'],
    });
  }

  async getStudentSlots(studentUserId: string, from?: string, to?: string) {
    const student = await this.studentRepository.findOne({ where: { userId: studentUserId } });
    if (!student?.teacherId) return [];

    const where: any = { teacherId: student.teacherId, status: SlotStatus.AVAILABLE };
    if (from && to) where.startTime = Between(new Date(from), new Date(to));

    return this.slotRepository.find({ where, order: { startTime: 'ASC' } });
  }

  async getAllSlots(from?: string, to?: string) {
    const where: any = {};
    if (from && to) where.startTime = Between(new Date(from), new Date(to));
    return this.slotRepository.find({
      where,
      relations: ['teacher', 'teacher.user'],
      order: { startTime: 'ASC' },
    });
  }
}
