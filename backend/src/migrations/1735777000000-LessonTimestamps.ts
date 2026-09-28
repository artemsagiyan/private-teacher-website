import { MigrationInterface, QueryRunner } from 'typeorm';

export class LessonTimestamps1735777000000 implements MigrationInterface {
  name = 'LessonTimestamps1735777000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const column of [
      'startedAt',
      'lastParticipantLeftAt',
      'endedAt',
      'boardUpdatedAt',
      'nextProcessingAt',
    ]) {
      await queryRunner.query(`
        ALTER TABLE "lessons"
        ALTER COLUMN "${column}" TYPE TIMESTAMPTZ
        USING "${column}" AT TIME ZONE 'UTC'
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const column of [
      'startedAt',
      'lastParticipantLeftAt',
      'endedAt',
      'boardUpdatedAt',
      'nextProcessingAt',
    ]) {
      await queryRunner.query(`
        ALTER TABLE "lessons"
        ALTER COLUMN "${column}" TYPE TIMESTAMP
        USING "${column}" AT TIME ZONE 'UTC'
      `);
    }
  }
}
