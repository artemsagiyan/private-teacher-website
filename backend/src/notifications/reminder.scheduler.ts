import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, IsNull, Repository } from 'typeorm';
import { Booking, BookingStatus } from '../bookings/entities/booking.entity';
import { HomeworkAssignment, HomeworkStatus } from '../learning/entities/learning.entity';
import { NotificationsService } from './notifications.service';

@Injectable()
export class ReminderScheduler {
  private readonly logger = new Logger(ReminderScheduler.name);

  constructor(
    @InjectRepository(Booking)
    private bookingRepo: Repository<Booking>,
    @InjectRepository(HomeworkAssignment)
    private homeworkRepo: Repository<HomeworkAssignment>,
    private notifications: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async sendDueReminders() {
    const now = Date.now();
    const window24Start = new Date(now + 23 * 3600_000);
    const window24End = new Date(now + 25 * 3600_000);
    const window1Start = new Date(now + 50 * 60_000);
    const window1End = new Date(now + 70 * 60_000);

    const upcoming = await this.bookingRepo.find({
      where: { status: BookingStatus.CONFIRMED },
      relations: ['slot', 'student'],
    });

    for (const booking of upcoming) {
      const start = booking.slot?.startTime;
      if (!start) continue;
      const userId = booking.student?.userId;
      if (!userId) continue;

      if (
        !booking.reminder24hSent &&
        start >= window24Start &&
        start <= window24End
      ) {
        await this.claimAndSend(booking.id, 'reminder24hSent', () =>
          this.notifications.sendReminder24h(userId, start),
        );
      }

      if (
        !booking.reminder1hSent &&
        start >= window1Start &&
        start <= window1End
      ) {
        await this.claimAndSend(booking.id, 'reminder1hSent', () =>
          this.notifications.sendReminder1h(userId, start),
        );
      }
    }

    await this.sendHomeworkReminders(now);
  }

  private async sendHomeworkReminders(now: number) {
    const windowStart = new Date(now + 23 * 3600_000);
    const windowEnd = new Date(now + 25 * 3600_000);
    const assignments = await this.homeworkRepo.find({
      where: {
        status: HomeworkStatus.PUBLISHED,
        dueAt: Between(windowStart, windowEnd),
        dueReminderSentAt: IsNull(),
      },
      relations: ['student', 'student.user', 'lesson', 'lesson.slot'],
      take: 500,
    });
    for (const assignment of assignments) {
      const dueAt = assignment.dueAt;
      const student = assignment.student;
      if (!dueAt || !student?.userId) continue;
      const reminderClaimedAt = new Date();
      const claimed = await this.homeworkRepo.update(
        {
          id: assignment.id,
          status: HomeworkStatus.PUBLISHED,
          dueReminderSentAt: IsNull(),
        },
        { dueReminderSentAt: reminderClaimedAt },
      );
      if (!claimed.affected) continue;
      const title = assignment.lesson?.slot?.note || 'Домашнее задание';
      try {
        await this.notifications.notifyHomeworkDue(
          student.userId,
          student.parentEmail,
          `${student.user?.firstName ?? ''} ${student.user?.lastName ?? ''}`.trim() || 'ученик',
          assignment.id,
          title,
          dueAt,
        );
      } catch (error) {
        await this.homeworkRepo.update(
          { id: assignment.id, dueReminderSentAt: reminderClaimedAt },
          { dueReminderSentAt: null },
        );
        this.logger.warn(
          `Homework deadline reminder failed for ${assignment.id}: ${
            error instanceof Error ? error.message : error
          }`,
        );
      }
    }
  }

  private async claimAndSend(
    bookingId: string,
    flag: 'reminder24hSent' | 'reminder1hSent',
    send: () => Promise<unknown>,
  ) {
    const claimed = await this.bookingRepo.update(
      { id: bookingId, [flag]: false, status: BookingStatus.CONFIRMED },
      { [flag]: true },
    );
    if (!claimed.affected) return;
    try {
      await send();
    } catch (error) {
      await this.bookingRepo.update({ id: bookingId }, { [flag]: false });
      this.logger.warn(
        `Reminder ${flag} failed for ${bookingId}: ${
          error instanceof Error ? error.message : error
        }`,
      );
    }
  }
}
