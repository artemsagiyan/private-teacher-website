import { MigrationInterface, QueryRunner } from 'typeorm';

export class Payments1760051000000 implements MigrationInterface {
  name = 'Payments1760051000000';

  async up(queryRunner: QueryRunner) {
    await queryRunner.query(`ALTER TYPE "notifications_type_enum" ADD VALUE IF NOT EXISTS 'payment_due'`);
    await queryRunner.query(`ALTER TYPE "notifications_type_enum" ADD VALUE IF NOT EXISTS 'payment_paid'`);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "payments_status_enum" AS ENUM ('pending', 'paid', 'overdue', 'cancelled');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "teacherId" uuid NOT NULL,
        "studentId" uuid NOT NULL,
        "amount" numeric(12,2) NOT NULL,
        "currency" character varying NOT NULL DEFAULT 'RUB',
        "dueAt" TIMESTAMPTZ NOT NULL,
        "paidAt" TIMESTAMPTZ,
        "status" "payments_status_enum" NOT NULL DEFAULT 'pending',
        "description" character varying,
        "externalId" character varying,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_payments" PRIMARY KEY ("id"),
        CONSTRAINT "FK_payments_teacher" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_payments_student" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_payments_student_due" ON "payments" ("studentId", "dueAt")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_payments_teacher_due" ON "payments" ("teacherId", "dueAt")`);
  }

  async down(queryRunner: QueryRunner) {
    await queryRunner.query(`DROP TABLE IF EXISTS "payments"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "payments_status_enum"`);
  }
}
