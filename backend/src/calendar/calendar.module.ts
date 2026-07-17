import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CalendarSlot } from './entities/calendar-slot.entity';
import { Teacher } from '../teachers/entities/teacher.entity';
import { Student } from '../students/entities/student.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { CalendarService } from './calendar.service';
import { CalendarController } from './calendar.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CalendarSlot, Teacher, Student, Booking]),
    NotificationsModule,
  ],
  providers: [CalendarService],
  controllers: [CalendarController],
  exports: [CalendarService],
})
export class CalendarModule {}
