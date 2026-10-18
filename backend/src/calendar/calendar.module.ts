import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CalendarSlot } from './entities/calendar-slot.entity';
import { Teacher } from '../teachers/entities/teacher.entity';
import { Student } from '../students/entities/student.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { CalendarService } from './calendar.service';
import { CalendarController } from './calendar.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { User } from '../users/entities/user.entity';
import { CalendarFeedController } from './calendar-feed.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([CalendarSlot, Teacher, Student, Booking, User]),
    NotificationsModule,
  ],
  providers: [CalendarService],
  controllers: [CalendarController, CalendarFeedController],
  exports: [CalendarService],
})
export class CalendarModule {}
