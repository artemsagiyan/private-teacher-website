import { DataSource } from 'typeorm';
import { User } from './users/entities/user.entity';
import { Teacher } from './teachers/entities/teacher.entity';
import { Student } from './students/entities/student.entity';
import { CalendarSlot } from './calendar/entities/calendar-slot.entity';
import { Booking } from './bookings/entities/booking.entity';
import { Notification } from './notifications/entities/notification.entity';
import { RegistrationCode } from './admin/entities/registration-code.entity';
import { Lesson } from './lessons/entities/lesson.entity';
import { OauthCode } from './auth/entities/oauth-code.entity';
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
import { Payment } from './payments/entities/payment.entity';
import { Payments1760051000000 } from './migrations/1760051000000-Payments';
import { MockExam } from './mock-exams/entities/mock-exam.entity';
import { MockExams1760052000000 } from './migrations/1760052000000-MockExams';
import { FamilyAccess1760053000000 } from './migrations/1760053000000-FamilyAccess';
import { CalendarFeeds1760054000000 } from './migrations/1760054000000-CalendarFeeds';
import { HomeworkDueReminders1760055000000 } from './migrations/1760055000000-HomeworkDueReminders';
import { FamilyMessage } from './family/entities/family-message.entity';
import { FamilyMessaging1760056000000 } from './migrations/1760056000000-FamilyMessaging';
import { ComputeJob } from './lessons/entities/compute-job.entity';
import { ComputeJobs1735779000000 } from './migrations/1735779000000-ComputeJobs';
import { ComputeJobWorkerLeases1760057000000 } from './migrations/1760057000000-ComputeJobWorkerLeases';

export default new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5433', 10),
  username: process.env.DATABASE_USER || 'postgres',
  password: process.env.DATABASE_PASSWORD || 'postgres',
  database: process.env.DATABASE_NAME || 'tutor_platform',
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
});
