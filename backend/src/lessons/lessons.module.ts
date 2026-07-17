import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from '../bookings/entities/booking.entity';
import { CalendarSlot } from '../calendar/entities/calendar-slot.entity';
import { Student } from '../students/entities/student.entity';
import { Teacher } from '../teachers/entities/teacher.entity';
import { User } from '../users/entities/user.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { Lesson } from './entities/lesson.entity';
import { LessonProcessingService } from './lesson-processing.service';
import { LessonsController } from './lessons.controller';
import { LessonsService } from './lessons.service';
import { LivekitLifecycleService } from './livekit-lifecycle.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Lesson,
      CalendarSlot,
      Booking,
      Teacher,
      Student,
      User,
    ]),
    NotificationsModule,
  ],
  controllers: [LessonsController],
  providers: [
    LessonsService,
    LivekitLifecycleService,
    LessonProcessingService,
  ],
  exports: [LessonsService, LivekitLifecycleService],
})
export class LessonsModule {}
