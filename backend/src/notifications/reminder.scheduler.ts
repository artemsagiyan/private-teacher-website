import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booking, BookingStatus } from '../bookings/entities/booking.entity';
import { NotificationsService } from './notifications.service';

@Injectable()
export class ReminderScheduler {
  private readonly logger = new Logger(ReminderScheduler.name);

  constructor(
    @InjectRepository(Booking)
    private bookingRepo: Repository<Booking>,
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
        await this.notifications.sendReminder24h(userId, start);
        booking.reminder24hSent = true;
        await this.bookingRepo.save(booking);
      }

      if (
        !booking.reminder1hSent &&
        start >= window1Start &&
        start <= window1End
      ) {
        await this.notifications.sendReminder1h(userId, start);
        booking.reminder1hSent = true;
        await this.bookingRepo.save(booking);
      }
    }
  }
}
