import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from '../bookings/entities/booking.entity';
import { CurriculumModule } from '../curriculum/curriculum.module';
import {
  CurriculumTask,
  CurriculumTopic,
} from '../curriculum/entities/curriculum.entity';
import { Lesson } from '../lessons/entities/lesson.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { Student } from '../students/entities/student.entity';
import { Teacher } from '../teachers/entities/teacher.entity';
import {
  HomeworkAssignment,
  HomeworkItem,
  LearningEvidence,
  LessonLearningReview,
  LessonTopicFinding,
  StudentLearningProfile,
  StudentMistake,
  StudentTopicProgress,
} from './entities/learning.entity';
import { LearningController } from './learning.controller';
import { LearningService } from './learning.service';
import { ProgressService } from './progress.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CurriculumTopic,
      CurriculumTask,
      StudentLearningProfile,
      LessonLearningReview,
      LessonTopicFinding,
      StudentMistake,
      HomeworkAssignment,
      HomeworkItem,
      LearningEvidence,
      StudentTopicProgress,
      Student,
      Teacher,
      Booking,
      Lesson,
    ]),
    CurriculumModule,
    NotificationsModule,
  ],
  controllers: [LearningController],
  providers: [LearningService, ProgressService],
  exports: [LearningService, ProgressService],
})
export class LearningModule {}
