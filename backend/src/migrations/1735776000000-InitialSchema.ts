import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1735776000000 implements MigrationInterface {
  name = 'InitialSchema1735776000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "users_role_enum" AS ENUM ('admin', 'teacher', 'student');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "calendar_slots_status_enum" AS ENUM ('available', 'booked', 'unavailable', 'cancelled');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "calendar_slots_lessontype_enum" AS ENUM ('individual', 'group');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "bookings_status_enum" AS ENUM ('confirmed', 'cancelled_by_student', 'cancelled_by_teacher', 'completed');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "notifications_type_enum" AS ENUM (
          'booking_confirmed', 'booking_cancelled', 'schedule_changed',
          'reminder_24h', 'reminder_1h', 'teacher_invitation', 'lesson_report_ready',
          'lesson_failed'
        );
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "lessons_status_enum" AS ENUM (
          'waiting', 'starting', 'active', 'ending', 'processing', 'completed', 'failed'
        );
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "lessons_endreason_enum" AS ENUM ('teacher', 'empty_room', 'room_finished', 'system');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "role" "users_role_enum" NOT NULL DEFAULT 'student',
        "email" character varying NOT NULL,
        "passwordHash" character varying,
        "firstName" character varying,
        "lastName" character varying,
        "phone" character varying,
        "googleId" character varying,
        "isEmailVerified" boolean NOT NULL DEFAULT false,
        "emailVerificationToken" character varying,
        "refreshToken" character varying,
        "passwordResetToken" character varying,
        "passwordResetExpires" TIMESTAMPTZ,
        "isBlocked" boolean NOT NULL DEFAULT false,
        "avatarUrl" character varying,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_users_email" UNIQUE ("email")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "teachers" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "bio" character varying,
        "subjects" character varying,
        "inviteCode" character varying,
        CONSTRAINT "PK_teachers" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_teachers_inviteCode" UNIQUE ("inviteCode"),
        CONSTRAINT "UQ_teachers_userId" UNIQUE ("userId")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "students" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "teacherId" uuid,
        CONSTRAINT "PK_students" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_students_userId" UNIQUE ("userId")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "calendar_slots" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "teacherId" uuid NOT NULL,
        "startTime" TIMESTAMPTZ NOT NULL,
        "endTime" TIMESTAMPTZ NOT NULL,
        "status" "calendar_slots_status_enum" NOT NULL DEFAULT 'available',
        "lessonType" "calendar_slots_lessontype_enum" NOT NULL DEFAULT 'individual',
        "capacity" integer NOT NULL DEFAULT 1,
        "bookedCount" integer NOT NULL DEFAULT 0,
        "note" character varying,
        "isRecurring" boolean NOT NULL DEFAULT false,
        "recurringGroupId" character varying,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_calendar_slots" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "bookings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "studentId" uuid NOT NULL,
        "slotId" uuid NOT NULL,
        "status" "bookings_status_enum" NOT NULL DEFAULT 'confirmed',
        "cancellationReason" character varying,
        "isRecurring" boolean NOT NULL DEFAULT false,
        "recurringGroupId" character varying,
        "reminder24hSent" boolean NOT NULL DEFAULT false,
        "reminder1hSent" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_bookings" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "notifications" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "message" character varying NOT NULL,
        "type" "notifications_type_enum" NOT NULL,
        "isRead" boolean NOT NULL DEFAULT false,
        "relatedId" character varying,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notifications" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "registration_codes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "code" character varying NOT NULL,
        "isUsed" boolean NOT NULL DEFAULT false,
        "usedByEmail" character varying,
        "expiresAt" TIMESTAMP NOT NULL,
        "createdByAdminId" character varying,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_registration_codes" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_registration_codes_code" UNIQUE ("code")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "lessons" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "slotId" uuid NOT NULL,
        "teacherId" uuid NOT NULL,
        "roomName" character varying NOT NULL,
        "status" "lessons_status_enum" NOT NULL DEFAULT 'waiting',
        "participantCount" integer NOT NULL DEFAULT 0,
        "egressId" character varying,
        "recordingObjectKey" character varying,
        "boardObjectKey" character varying,
        "boardRevision" integer NOT NULL DEFAULT 0,
        "transcriptObjectKey" character varying,
        "reportObjectKey" character varying,
        "report" jsonb,
        "transcriptLanguage" character varying,
        "transcriptDurationSeconds" double precision,
        "startedAt" TIMESTAMP,
        "lastParticipantLeftAt" TIMESTAMP,
        "endedAt" TIMESTAMP,
        "endReason" "lessons_endreason_enum",
        "boardUpdatedAt" TIMESTAMP,
        "processingAttempts" integer NOT NULL DEFAULT 0,
        "nextProcessingAt" TIMESTAMP,
        "processingLeaseId" character varying,
        "processingError" text,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_lessons" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_lessons_slotId" UNIQUE ("slotId"),
        CONSTRAINT "UQ_lessons_roomName" UNIQUE ("roomName")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "oauth_codes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "codeHash" character varying NOT NULL,
        "userId" character varying NOT NULL,
        "expiresAt" TIMESTAMPTZ NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_oauth_codes" PRIMARY KEY ("id")
      )
    `);

    await this.addColumnIfMissing(
      queryRunner,
      'users',
      'passwordResetToken',
      'character varying',
    );
    await this.addColumnIfMissing(
      queryRunner,
      'users',
      'passwordResetExpires',
      'TIMESTAMPTZ',
    );
    await this.addColumnIfMissing(
      queryRunner,
      'bookings',
      'reminder24hSent',
      'boolean NOT NULL DEFAULT false',
    );
    await this.addColumnIfMissing(
      queryRunner,
      'bookings',
      'reminder1hSent',
      'boolean NOT NULL DEFAULT false',
    );

    await queryRunner.query(`
      ALTER TABLE "calendar_slots"
      ALTER COLUMN "startTime" TYPE TIMESTAMPTZ USING "startTime" AT TIME ZONE 'UTC'
    `).catch(() => undefined);
    await queryRunner.query(`
      ALTER TABLE "calendar_slots"
      ALTER COLUMN "endTime" TYPE TIMESTAMPTZ USING "endTime" AT TIME ZONE 'UTC'
    `).catch(() => undefined);

    await queryRunner.query(`
      ALTER TYPE "notifications_type_enum" ADD VALUE IF NOT EXISTS 'lesson_failed'
    `).catch(() => undefined);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "oauth_codes"`);
  }

  private async addColumnIfMissing(
    queryRunner: QueryRunner,
    table: string,
    column: string,
    typeSql: string,
  ) {
    await queryRunner.query(`
      ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "${column}" ${typeSql}
    `);
  }
}
