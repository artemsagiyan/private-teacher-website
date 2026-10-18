import { MigrationInterface, QueryRunner } from 'typeorm';

export class FamilyMessaging1760056000000 implements MigrationInterface {
  name = 'FamilyMessaging1760056000000';

  async up(queryRunner: QueryRunner) {
    await queryRunner.query(
      `ALTER TYPE "notifications_type_enum" ADD VALUE IF NOT EXISTS 'family_message'`,
    );
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "family_messages" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "studentId" uuid NOT NULL,
        "teacherId" uuid NOT NULL,
        "senderType" character varying(12) NOT NULL,
        "senderName" character varying(120) NOT NULL,
        "body" text NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_family_messages" PRIMARY KEY ("id"),
        CONSTRAINT "FK_family_messages_student" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_family_messages_teacher" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_family_messages_sender" CHECK ("senderType" IN ('parent', 'teacher'))
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_family_messages_conversation" ON "family_messages" ("studentId", "teacherId", "createdAt")`,
    );
  }

  async down(queryRunner: QueryRunner) {
    await queryRunner.query(`DROP TABLE IF EXISTS "family_messages"`);
  }
}
