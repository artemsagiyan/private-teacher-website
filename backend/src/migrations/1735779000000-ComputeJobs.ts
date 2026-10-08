import { MigrationInterface, QueryRunner } from 'typeorm';

export class ComputeJobs1735779000000 implements MigrationInterface {
  name = 'ComputeJobs1735779000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "compute_jobs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "lessonId" uuid NOT NULL,
        "status" character varying NOT NULL DEFAULT 'pending',
        "recordingObjectKey" character varying NOT NULL,
        "lessonNote" text,
        "error" text,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_compute_jobs" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_compute_jobs_lesson" UNIQUE ("lessonId")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "compute_jobs"`);
  }
}
