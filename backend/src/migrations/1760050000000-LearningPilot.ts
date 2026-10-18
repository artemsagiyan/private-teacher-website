import { MigrationInterface, QueryRunner } from 'typeorm';

export class LearningPilot1760050000000 implements MigrationInterface {
  name = 'LearningPilot1760050000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const enums: Array<[string, string]> = [
      ['curriculum_releases_examtrack_enum', "'oge', 'ege_base', 'ege_profile'"],
      ['curriculum_releases_sourcekind_enum', "'demo', 'imported'"],
      ['curriculum_tasks_difficulty_enum', "'basic', 'standard', 'advanced'"],
      ['student_learning_profiles_examtrack_enum', "'oge', 'ege_base', 'ege_profile'"],
      ['lesson_learning_reviews_status_enum', "'draft', 'published'"],
      ['lesson_topic_findings_assessment_enum', "'mastered', 'practiced', 'difficulty'"],
      ['homework_assignments_status_enum', "'draft', 'published', 'in_progress', 'completed'"],
      ['homework_items_status_enum', "'pending', 'correct', 'incorrect', 'needs_review'"],
      ['learning_evidence_sourcetype_enum', "'lesson', 'homework', 'mock_exam'"],
    ];
    for (const [name, values] of enums) {
      await queryRunner.query(`
        DO $$ BEGIN
          CREATE TYPE "${name}" AS ENUM (${values});
        EXCEPTION WHEN duplicate_object THEN null;
        END $$;
      `);
    }

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "curriculum_releases" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "examTrack" "curriculum_releases_examtrack_enum" NOT NULL,
        "year" integer NOT NULL,
        "version" character varying NOT NULL,
        "title" character varying NOT NULL,
        "sourceKind" "curriculum_releases_sourcekind_enum" NOT NULL DEFAULT 'imported',
        "isActive" boolean NOT NULL DEFAULT false,
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_curriculum_releases" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_curriculum_release_version" UNIQUE ("examTrack", "year", "version")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "curriculum_topics" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "releaseId" uuid NOT NULL,
        "code" character varying NOT NULL,
        "title" character varying NOT NULL,
        "section" character varying,
        "aliases" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "position" integer NOT NULL DEFAULT 0,
        CONSTRAINT "PK_curriculum_topics" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_curriculum_topic_code" UNIQUE ("releaseId", "code"),
        CONSTRAINT "FK_curriculum_topic_release" FOREIGN KEY ("releaseId")
          REFERENCES "curriculum_releases"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "curriculum_tasks" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "releaseId" uuid NOT NULL,
        "topicId" uuid NOT NULL,
        "externalId" character varying NOT NULL,
        "taskType" character varying NOT NULL,
        "difficulty" "curriculum_tasks_difficulty_enum" NOT NULL DEFAULT 'standard',
        "statement" text NOT NULL,
        "acceptedAnswers" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "solution" text,
        "sourceUrl" character varying,
        "isDemo" boolean NOT NULL DEFAULT false,
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        CONSTRAINT "PK_curriculum_tasks" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_curriculum_task_external" UNIQUE ("releaseId", "externalId"),
        CONSTRAINT "FK_curriculum_task_release" FOREIGN KEY ("releaseId")
          REFERENCES "curriculum_releases"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_curriculum_task_topic" FOREIGN KEY ("topicId")
          REFERENCES "curriculum_topics"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_curriculum_topic_position"
      ON "curriculum_topics" ("releaseId", "position")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_curriculum_task_topic_difficulty"
      ON "curriculum_tasks" ("releaseId", "topicId", "difficulty")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_curriculum_task_type"
      ON "curriculum_tasks" ("releaseId", "taskType")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "student_learning_profiles" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "studentId" uuid NOT NULL,
        "examTrack" "student_learning_profiles_examtrack_enum" NOT NULL,
        "curriculumReleaseId" uuid,
        "targetScore" integer,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_student_learning_profiles" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_student_learning_profile_student" UNIQUE ("studentId"),
        CONSTRAINT "FK_learning_profile_student" FOREIGN KEY ("studentId")
          REFERENCES "students"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_learning_profile_release" FOREIGN KEY ("curriculumReleaseId")
          REFERENCES "curriculum_releases"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "lesson_learning_reviews" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "lessonId" uuid NOT NULL,
        "studentId" uuid NOT NULL,
        "status" "lesson_learning_reviews_status_enum" NOT NULL DEFAULT 'draft',
        "summary" text NOT NULL DEFAULT '',
        "achievements" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "recommendations" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "rawTopics" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "rawDifficulties" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "revision" integer NOT NULL DEFAULT 1,
        "publishedByUserId" uuid,
        "publishedAt" TIMESTAMPTZ,
        "familyDeliveredAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_lesson_learning_reviews" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_lesson_review_student" UNIQUE ("lessonId", "studentId"),
        CONSTRAINT "FK_lesson_review_lesson" FOREIGN KEY ("lessonId")
          REFERENCES "lessons"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_lesson_review_student" FOREIGN KEY ("studentId")
          REFERENCES "students"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_lesson_review_publisher" FOREIGN KEY ("publishedByUserId")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "lesson_topic_findings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "reviewId" uuid NOT NULL,
        "topicId" uuid NOT NULL,
        "assessment" "lesson_topic_findings_assessment_enum" NOT NULL DEFAULT 'practiced',
        "confidence" double precision NOT NULL DEFAULT 1,
        "note" text,
        CONSTRAINT "PK_lesson_topic_findings" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_lesson_topic_finding" UNIQUE ("reviewId", "topicId"),
        CONSTRAINT "FK_lesson_topic_review" FOREIGN KEY ("reviewId")
          REFERENCES "lesson_learning_reviews"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_lesson_topic_topic" FOREIGN KEY ("topicId")
          REFERENCES "curriculum_topics"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "student_mistakes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "reviewId" uuid NOT NULL,
        "studentId" uuid NOT NULL,
        "topicId" uuid,
        "description" text NOT NULL,
        "resolved" boolean NOT NULL DEFAULT false,
        "resolvedAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_student_mistakes" PRIMARY KEY ("id"),
        CONSTRAINT "FK_student_mistake_review" FOREIGN KEY ("reviewId")
          REFERENCES "lesson_learning_reviews"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_student_mistake_student" FOREIGN KEY ("studentId")
          REFERENCES "students"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_student_mistake_topic" FOREIGN KEY ("topicId")
          REFERENCES "curriculum_topics"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_student_mistake_open"
      ON "student_mistakes" ("studentId", "topicId", "resolved")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "homework_assignments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "reviewId" uuid NOT NULL,
        "lessonId" uuid NOT NULL,
        "studentId" uuid NOT NULL,
        "status" "homework_assignments_status_enum" NOT NULL DEFAULT 'draft',
        "dueAt" TIMESTAMPTZ,
        "publishedAt" TIMESTAMPTZ,
        "completedAt" TIMESTAMPTZ,
        "generationDiagnostics" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_homework_assignments" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_homework_assignment_review" UNIQUE ("reviewId"),
        CONSTRAINT "FK_homework_review" FOREIGN KEY ("reviewId")
          REFERENCES "lesson_learning_reviews"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_homework_lesson" FOREIGN KEY ("lessonId")
          REFERENCES "lessons"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_homework_student" FOREIGN KEY ("studentId")
          REFERENCES "students"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_homework_student_status"
      ON "homework_assignments" ("studentId", "status", "createdAt")
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "homework_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "assignmentId" uuid NOT NULL,
        "taskId" uuid NOT NULL,
        "position" integer NOT NULL,
        "rationale" text NOT NULL DEFAULT '',
        "answer" text,
        "status" "homework_items_status_enum" NOT NULL DEFAULT 'pending',
        "autoCorrect" boolean,
        "teacherCorrect" boolean,
        "answeredAt" TIMESTAMPTZ,
        "gradedAt" TIMESTAMPTZ,
        CONSTRAINT "PK_homework_items" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_homework_item_task" UNIQUE ("assignmentId", "taskId"),
        CONSTRAINT "UQ_homework_item_position" UNIQUE ("assignmentId", "position"),
        CONSTRAINT "FK_homework_item_assignment" FOREIGN KEY ("assignmentId")
          REFERENCES "homework_assignments"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_homework_item_task" FOREIGN KEY ("taskId")
          REFERENCES "curriculum_tasks"("id") ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "learning_evidence" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "studentId" uuid NOT NULL,
        "topicId" uuid NOT NULL,
        "sourceType" "learning_evidence_sourcetype_enum" NOT NULL,
        "sourceId" character varying NOT NULL,
        "score" double precision NOT NULL,
        "weight" double precision NOT NULL DEFAULT 1,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_learning_evidence" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_learning_evidence_source" UNIQUE ("sourceType", "sourceId", "topicId"),
        CONSTRAINT "FK_learning_evidence_student" FOREIGN KEY ("studentId")
          REFERENCES "students"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_learning_evidence_topic" FOREIGN KEY ("topicId")
          REFERENCES "curriculum_topics"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_learning_evidence_student_topic"
      ON "learning_evidence" ("studentId", "topicId", "createdAt")
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "student_topic_progress" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "studentId" uuid NOT NULL,
        "topicId" uuid NOT NULL,
        "mastery" double precision NOT NULL DEFAULT 0.5,
        "evidenceCount" integer NOT NULL DEFAULT 0,
        "correctCount" integer NOT NULL DEFAULT 0,
        "attemptCount" integer NOT NULL DEFAULT 0,
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_student_topic_progress" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_student_topic_progress" UNIQUE ("studentId", "topicId"),
        CONSTRAINT "FK_student_progress_student" FOREIGN KEY ("studentId")
          REFERENCES "students"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_student_progress_topic" FOREIGN KEY ("topicId")
          REFERENCES "curriculum_topics"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "calendar_slots"
      ADD COLUMN IF NOT EXISTS "teacherReminder24hSent" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "teacherReminder1hSent" boolean NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "calendar_slots"
      DROP COLUMN IF EXISTS "teacherReminder1hSent",
      DROP COLUMN IF EXISTS "teacherReminder24hSent"
    `);
    for (const table of [
      'student_topic_progress',
      'learning_evidence',
      'homework_items',
      'homework_assignments',
      'student_mistakes',
      'lesson_topic_findings',
      'lesson_learning_reviews',
      'student_learning_profiles',
      'curriculum_tasks',
      'curriculum_topics',
      'curriculum_releases',
    ]) {
      await queryRunner.query(`DROP TABLE IF EXISTS "${table}" CASCADE`);
    }
    for (const type of [
      'learning_evidence_sourcetype_enum',
      'homework_items_status_enum',
      'homework_assignments_status_enum',
      'lesson_topic_findings_assessment_enum',
      'lesson_learning_reviews_status_enum',
      'student_learning_profiles_examtrack_enum',
      'curriculum_tasks_difficulty_enum',
      'curriculum_releases_sourcekind_enum',
      'curriculum_releases_examtrack_enum',
    ]) {
      await queryRunner.query(`DROP TYPE IF EXISTS "${type}"`);
    }
  }
}
