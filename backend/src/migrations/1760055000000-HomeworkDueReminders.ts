import { MigrationInterface, QueryRunner } from 'typeorm';

export class HomeworkDueReminders1760055000000 implements MigrationInterface {
  name = 'HomeworkDueReminders1760055000000';

  async up(queryRunner: QueryRunner) {
    await queryRunner.query(
      `ALTER TYPE "notifications_type_enum" ADD VALUE IF NOT EXISTS 'homework_due'`,
    );
    await queryRunner.query(
      `ALTER TABLE "homework_assignments" ADD COLUMN IF NOT EXISTS "dueReminderSentAt" TIMESTAMPTZ`,
    );
  }

  async down(queryRunner: QueryRunner) {
    await queryRunner.query(
      `ALTER TABLE "homework_assignments" DROP COLUMN IF EXISTS "dueReminderSentAt"`,
    );
    // PostgreSQL cannot remove an enum value safely during a rollback without
    // rebuilding the type. Keeping the value is safer for existing notifications.
  }
}
