import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import configuration from './config/configuration';
import { User } from './users/entities/user.entity';
import { Teacher } from './teachers/entities/teacher.entity';
import { Student } from './students/entities/student.entity';
import { CalendarSlot } from './calendar/entities/calendar-slot.entity';
import { Booking } from './bookings/entities/booking.entity';
import { Notification } from './notifications/entities/notification.entity';
import { RegistrationCode } from './admin/entities/registration-code.entity';
import { OauthCode } from './auth/entities/oauth-code.entity';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { TeachersModule } from './teachers/teachers.module';
import { StudentsModule } from './students/students.module';
import { CalendarModule } from './calendar/calendar.module';
import { BookingsModule } from './bookings/bookings.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AdminModule } from './admin/admin.module';
import { SeedModule } from './seed/seed.module';
import { VideoModule } from './video/video.module';
import { Lesson } from './lessons/entities/lesson.entity';
import { LessonsModule } from './lessons/lessons.module';
import { StorageModule } from './storage/storage.module';
import { HealthModule } from './health/health.module';
import { InitialSchema1735776000000 } from './migrations/1735776000000-InitialSchema';
import { LessonTimestamps1735777000000 } from './migrations/1735777000000-LessonTimestamps';
import { ParentsHomeworkPractice1735778000000 } from './migrations/1735778000000-ParentsHomeworkPractice';
import {
  CurriculumRelease,
  CurriculumTask,
  CurriculumTopic,
} from './curriculum/entities/curriculum.entity';
import {
  HomeworkAssignment,
  HomeworkItem,
  LearningEvidence,
  LessonLearningReview,
  LessonTopicFinding,
  StudentLearningProfile,
  StudentMistake,
  StudentTopicProgress,
} from './learning/entities/learning.entity';
import { LearningPilot1760050000000 } from './migrations/1760050000000-LearningPilot';
import { CurriculumModule } from './curriculum/curriculum.module';
import { LearningModule } from './learning/learning.module';
import { Payment } from './payments/entities/payment.entity';
import { PaymentsModule } from './payments/payments.module';
import { Payments1760051000000 } from './migrations/1760051000000-Payments';
import { MockExam } from './mock-exams/entities/mock-exam.entity';
import { MockExamsModule } from './mock-exams/mock-exams.module';
import { MockExams1760052000000 } from './migrations/1760052000000-MockExams';
import { FamilyAccess1760053000000 } from './migrations/1760053000000-FamilyAccess';
import { FamilyModule } from './family/family.module';
import { CalendarFeeds1760054000000 } from './migrations/1760054000000-CalendarFeeds';
import { HomeworkDueReminders1760055000000 } from './migrations/1760055000000-HomeworkDueReminders';
import { FamilyMessaging1760056000000 } from './migrations/1760056000000-FamilyMessaging';
import { FamilyMessage } from './family/entities/family-message.entity';
import { ComputeJob } from './lessons/entities/compute-job.entity';
import { ComputeJobs1735779000000 } from './migrations/1735779000000-ComputeJobs';
import { ComputeJobWorkerLeases1760057000000 } from './migrations/1760057000000-ComputeJobWorkerLeases';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: 60_000, limit: 60 }],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isProd = config.get<string>('nodeEnv') === 'production';
        return {
          type: 'postgres' as const,
          host: config.get<string>('database.host'),
          port: config.get<number>('database.port'),
          username: config.get<string>('database.user'),
          password: config.get<string>('database.password'),
          database: config.get<string>('database.name'),
          entities: [
            User,
            Teacher,
            Student,
            CalendarSlot,
            Booking,
            Notification,
            RegistrationCode,
            Lesson,
            OauthCode,
            CurriculumRelease,
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
            Payment,
            MockExam,
            FamilyMessage,
            ComputeJob,
          ],
          migrations: [
            InitialSchema1735776000000,
            LessonTimestamps1735777000000,
            ParentsHomeworkPractice1735778000000,
            ComputeJobs1735779000000,
            LearningPilot1760050000000,
            Payments1760051000000,
            MockExams1760052000000,
            FamilyAccess1760053000000,
            CalendarFeeds1760054000000,
            HomeworkDueReminders1760055000000,
            FamilyMessaging1760056000000,
            ComputeJobWorkerLeases1760057000000,
          ],
          migrationsRun: isProd,
          synchronize: !isProd,
          logging: config.get<string>('nodeEnv') === 'development',
        };
      },
    }),
    ScheduleModule.forRoot(),
    AuthModule,
    UsersModule,
    TeachersModule,
    StudentsModule,
    CalendarModule,
    BookingsModule,
    NotificationsModule,
    AdminModule,
    SeedModule,
    StorageModule,
    LessonsModule,
    VideoModule,
    HealthModule,
    CurriculumModule,
    LearningModule,
    PaymentsModule,
    MockExamsModule,
    FamilyModule,
  ],
})
export class AppModule {}
