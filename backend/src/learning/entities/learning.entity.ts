import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Lesson } from '../../lessons/entities/lesson.entity';
import { Student } from '../../students/entities/student.entity';
import { User } from '../../users/entities/user.entity';
import {
  CurriculumRelease,
  CurriculumTask,
  CurriculumTopic,
  ExamTrack,
} from '../../curriculum/entities/curriculum.entity';

export enum LessonReviewStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
}

export enum TopicAssessment {
  MASTERED = 'mastered',
  PRACTICED = 'practiced',
  DIFFICULTY = 'difficulty',
}

export enum HomeworkStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
}

export enum HomeworkItemStatus {
  PENDING = 'pending',
  CORRECT = 'correct',
  INCORRECT = 'incorrect',
  NEEDS_REVIEW = 'needs_review',
}

export enum LearningEvidenceSource {
  LESSON = 'lesson',
  HOMEWORK = 'homework',
  MOCK_EXAM = 'mock_exam',
}

@Entity('student_learning_profiles')
export class StudentLearningProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => Student, { onDelete: 'CASCADE' })
  @JoinColumn()
  student: Student;

  @Column({ unique: true })
  studentId: string;

  @Column({ type: 'enum', enum: ExamTrack })
  examTrack: ExamTrack;

  @ManyToOne(() => CurriculumRelease, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn()
  curriculumRelease: CurriculumRelease | null;

  @Column({ nullable: true })
  curriculumReleaseId: string | null;

  @Column({ type: 'int', nullable: true })
  targetScore: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('lesson_learning_reviews')
@Index(['lessonId', 'studentId'], { unique: true })
export class LessonLearningReview {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Lesson, { onDelete: 'CASCADE' })
  @JoinColumn()
  lesson: Lesson;

  @Column()
  lessonId: string;

  @ManyToOne(() => Student, { onDelete: 'CASCADE' })
  @JoinColumn()
  student: Student;

  @Column()
  studentId: string;

  @Column({
    type: 'enum',
    enum: LessonReviewStatus,
    default: LessonReviewStatus.DRAFT,
  })
  status: LessonReviewStatus;

  @Column({ type: 'text', default: '' })
  summary: string;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  achievements: string[];

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  recommendations: string[];

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  rawTopics: string[];

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  rawDifficulties: string[];

  @Column({ type: 'int', default: 1 })
  revision: number;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'publishedByUserId' })
  publishedBy: User | null;

  @Column({ nullable: true })
  publishedByUserId: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  familyDeliveredAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => LessonTopicFinding, (finding) => finding.review)
  topics: LessonTopicFinding[];

  @OneToMany(() => StudentMistake, (mistake) => mistake.review)
  mistakes: StudentMistake[];

  @OneToOne(() => HomeworkAssignment, (assignment) => assignment.review)
  // The related class is declared below; keeping the emitted design type
  // independent avoids a runtime temporal-dead-zone during TypeORM startup.
  homework: any;
}

@Entity('lesson_topic_findings')
@Index(['reviewId', 'topicId'], { unique: true })
export class LessonTopicFinding {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => LessonLearningReview, (review) => review.topics, {
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  review: LessonLearningReview;

  @Column()
  reviewId: string;

  @ManyToOne(() => CurriculumTopic, { onDelete: 'CASCADE' })
  @JoinColumn()
  topic: CurriculumTopic;

  @Column()
  topicId: string;

  @Column({
    type: 'enum',
    enum: TopicAssessment,
    default: TopicAssessment.PRACTICED,
  })
  assessment: TopicAssessment;

  @Column({ type: 'float', default: 1 })
  confidence: number;

  @Column({ type: 'text', nullable: true })
  note: string | null;
}

@Entity('student_mistakes')
@Index(['studentId', 'topicId', 'resolved'])
export class StudentMistake {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => LessonLearningReview, (review) => review.mistakes, {
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  review: LessonLearningReview;

  @Column()
  reviewId: string;

  @ManyToOne(() => Student, { onDelete: 'CASCADE' })
  @JoinColumn()
  student: Student;

  @Column()
  studentId: string;

  @ManyToOne(() => CurriculumTopic, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn()
  topic: CurriculumTopic | null;

  @Column({ nullable: true })
  topicId: string | null;

  @Column({ type: 'text' })
  description: string;

  @Column({ default: false })
  resolved: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}

@Entity('homework_assignments')
@Index(['studentId', 'status', 'createdAt'])
export class HomeworkAssignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => LessonLearningReview, (review) => review.homework, {
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  review: LessonLearningReview;

  @Column({ unique: true })
  reviewId: string;

  @ManyToOne(() => Lesson, { onDelete: 'CASCADE' })
  @JoinColumn()
  lesson: Lesson;

  @Column()
  lessonId: string;

  @ManyToOne(() => Student, { onDelete: 'CASCADE' })
  @JoinColumn()
  student: Student;

  @Column()
  studentId: string;

  @Column({
    type: 'enum',
    enum: HomeworkStatus,
    default: HomeworkStatus.DRAFT,
  })
  status: HomeworkStatus;

  @Column({ type: 'timestamptz', nullable: true })
  dueAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  dueReminderSentAt: Date | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  generationDiagnostics: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => HomeworkItem, (item) => item.assignment)
  items: HomeworkItem[];
}

@Entity('homework_items')
@Index(['assignmentId', 'taskId'], { unique: true })
@Index(['assignmentId', 'position'], { unique: true })
export class HomeworkItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => HomeworkAssignment, (assignment) => assignment.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  assignment: HomeworkAssignment;

  @Column()
  assignmentId: string;

  @ManyToOne(() => CurriculumTask, { onDelete: 'RESTRICT' })
  @JoinColumn()
  task: CurriculumTask;

  @Column()
  taskId: string;

  @Column({ type: 'int' })
  position: number;

  @Column({ type: 'text', default: '' })
  rationale: string;

  @Column({ type: 'text', nullable: true })
  answer: string | null;

  @Column({
    type: 'enum',
    enum: HomeworkItemStatus,
    default: HomeworkItemStatus.PENDING,
  })
  status: HomeworkItemStatus;

  @Column({ type: 'boolean', nullable: true })
  autoCorrect: boolean | null;

  @Column({ type: 'boolean', nullable: true })
  teacherCorrect: boolean | null;

  @Column({ type: 'timestamptz', nullable: true })
  answeredAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  gradedAt: Date | null;
}

@Entity('learning_evidence')
@Index(['sourceType', 'sourceId', 'topicId'], { unique: true })
@Index(['studentId', 'topicId', 'createdAt'])
export class LearningEvidence {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Student, { onDelete: 'CASCADE' })
  @JoinColumn()
  student: Student;

  @Column()
  studentId: string;

  @ManyToOne(() => CurriculumTopic, { onDelete: 'CASCADE' })
  @JoinColumn()
  topic: CurriculumTopic;

  @Column()
  topicId: string;

  @Column({ type: 'enum', enum: LearningEvidenceSource })
  sourceType: LearningEvidenceSource;

  @Column()
  sourceId: string;

  @Column({ type: 'float' })
  score: number;

  @Column({ type: 'float', default: 1 })
  weight: number;

  @CreateDateColumn()
  createdAt: Date;
}

@Entity('student_topic_progress')
@Index(['studentId', 'topicId'], { unique: true })
export class StudentTopicProgress {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Student, { onDelete: 'CASCADE' })
  @JoinColumn()
  student: Student;

  @Column()
  studentId: string;

  @ManyToOne(() => CurriculumTopic, { onDelete: 'CASCADE' })
  @JoinColumn()
  topic: CurriculumTopic;

  @Column()
  topicId: string;

  @Column({ type: 'float', default: 0.5 })
  mastery: number;

  @Column({ type: 'int', default: 0 })
  evidenceCount: number;

  @Column({ type: 'int', default: 0 })
  correctCount: number;

  @Column({ type: 'int', default: 0 })
  attemptCount: number;

  @UpdateDateColumn()
  updatedAt: Date;
}
