import { MigrationInterface, QueryRunner } from 'typeorm';

export class ComputeJobWorkerLeases1760057000000
  implements MigrationInterface
{
  name = 'ComputeJobWorkerLeases1760057000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "compute_jobs"
        ADD COLUMN IF NOT EXISTS "attempts" integer NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "leaseToken" character varying,
        ADD COLUMN IF NOT EXISTS "leaseExpiresAt" TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS "retryAt" TIMESTAMPTZ
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_compute_jobs_claim"
      ON "compute_jobs" ("status", "leaseExpiresAt", "createdAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_compute_jobs_claim"`,
    );
    await queryRunner.query(`
      ALTER TABLE "compute_jobs"
        DROP COLUMN IF EXISTS "leaseExpiresAt",
        DROP COLUMN IF EXISTS "leaseToken",
        DROP COLUMN IF EXISTS "retryAt",
        DROP COLUMN IF EXISTS "attempts"
    `);
  }
}
