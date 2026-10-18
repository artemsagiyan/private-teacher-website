import { MigrationInterface, QueryRunner } from 'typeorm';

export class MockExams1760052000000 implements MigrationInterface {
  name = 'MockExams1760052000000';
  async up(queryRunner: QueryRunner) {
    await queryRunner.query(`ALTER TYPE "learning_evidence_sourcetype_enum" ADD VALUE IF NOT EXISTS 'mock_exam'`);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "mock_exams_status_enum" AS ENUM ('in_progress', 'completed');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "mock_exams" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "studentId" uuid NOT NULL,
        "teacherId" uuid NOT NULL,
        "examTrack" "curriculum_releases_examtrack_enum" NOT NULL,
        "title" character varying NOT NULL,
        "status" "mock_exams_status_enum" NOT NULL DEFAULT 'in_progress',
        "durationMinutes" integer NOT NULL DEFAULT 60,
        "items" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "correctCount" integer NOT NULL DEFAULT 0,
        "score" integer NOT NULL DEFAULT 0,
        "startedAt" TIMESTAMPTZ,
        "submittedAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_mock_exams" PRIMARY KEY ("id"),
        CONSTRAINT "FK_mock_exams_student" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_mock_exams_teacher" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_mock_exams_student_created" ON "mock_exams" ("studentId", "createdAt")`);
  }
  async down(queryRunner: QueryRunner) {
    await queryRunner.query(`DROP TABLE IF EXISTS "mock_exams"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "mock_exams_status_enum"`);
  }
}
