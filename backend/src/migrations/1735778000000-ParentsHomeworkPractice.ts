import { MigrationInterface, QueryRunner } from 'typeorm';

export class ParentsHomeworkPractice1735778000000
  implements MigrationInterface
{
  name = 'ParentsHomeworkPractice1735778000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "students"
      ADD COLUMN IF NOT EXISTS "parentName" character varying,
      ADD COLUMN IF NOT EXISTS "parentEmail" character varying
    `);
    await queryRunner.query(`
      ALTER TABLE "lessons"
      ADD COLUMN IF NOT EXISTS "practicePlan" jsonb
    `);
    await queryRunner.query(`
      ALTER TYPE "notifications_type_enum" ADD VALUE IF NOT EXISTS 'homework_assigned'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "students" DROP COLUMN IF EXISTS "parentEmail"
    `);
    await queryRunner.query(`
      ALTER TABLE "students" DROP COLUMN IF EXISTS "parentName"
    `);
    await queryRunner.query(`
      ALTER TABLE "lessons" DROP COLUMN IF EXISTS "practicePlan"
    `);
  }
}
