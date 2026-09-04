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
          ],
          migrations: [InitialSchema1735776000000],
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
  ],
})
export class AppModule {}
