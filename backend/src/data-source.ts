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
  ],
  migrations: [InitialSchema1735776000000],
});
