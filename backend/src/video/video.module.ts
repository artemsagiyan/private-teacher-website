import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VideoController } from './video.controller';
import { VideoService } from './video.service';
import { Booking } from '../bookings/entities/booking.entity';
import { CalendarSlot } from '../calendar/entities/calendar-slot.entity';
import { Student } from '../students/entities/student.entity';
import { Teacher } from '../teachers/entities/teacher.entity';
import { LessonsModule } from '../lessons/lessons.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Booking, CalendarSlot, Student, Teacher]),
    LessonsModule,
  ],
  controllers: [VideoController],
  providers: [VideoService],
})
export class VideoModule {}
