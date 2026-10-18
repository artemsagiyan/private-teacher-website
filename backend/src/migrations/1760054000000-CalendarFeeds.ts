import { MigrationInterface, QueryRunner } from 'typeorm';

export class CalendarFeeds1760054000000 implements MigrationInterface {
  name = 'CalendarFeeds1760054000000';
  async up(queryRunner: QueryRunner) {
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "calendarFeedTokenHash" character varying`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_users_calendarFeedTokenHash" ON "users" ("calendarFeedTokenHash") WHERE "calendarFeedTokenHash" IS NOT NULL`);
  }
  async down(queryRunner: QueryRunner) {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_users_calendarFeedTokenHash"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "calendarFeedTokenHash"`);
  }
}
