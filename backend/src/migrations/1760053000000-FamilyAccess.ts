import { MigrationInterface, QueryRunner } from 'typeorm';

export class FamilyAccess1760053000000 implements MigrationInterface {
  name = 'FamilyAccess1760053000000';
  async up(queryRunner: QueryRunner) {
    await queryRunner.query(`ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "familyAccessTokenHash" character varying UNIQUE`);
    await queryRunner.query(`ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "familyAccessTokenExpires" TIMESTAMPTZ`);
  }
  async down(queryRunner: QueryRunner) {
    await queryRunner.query(`ALTER TABLE "students" DROP COLUMN IF EXISTS "familyAccessTokenExpires"`);
    await queryRunner.query(`ALTER TABLE "students" DROP COLUMN IF EXISTS "familyAccessTokenHash"`);
  }
}
