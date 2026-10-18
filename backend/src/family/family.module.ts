import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from '../bookings/entities/booking.entity';
import { LearningModule } from '../learning/learning.module';
import { HomeworkAssignment } from '../learning/entities/learning.entity';
import { Lesson } from '../lessons/entities/lesson.entity';
import { PaymentsModule } from '../payments/payments.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { Student } from '../students/entities/student.entity';
import { FamilyController } from './family.controller';
import { FamilyMessage } from './entities/family-message.entity';
import { FamilyService } from './family.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Student,
      Booking,
      Lesson,
      HomeworkAssignment,
      FamilyMessage,
    ]),
    LearningModule,
    PaymentsModule,
    NotificationsModule,
  ],
  controllers: [FamilyController],
  providers: [FamilyService],
})
export class FamilyModule {}
