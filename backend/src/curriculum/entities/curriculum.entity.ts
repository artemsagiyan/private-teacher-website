import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum ExamTrack {
  OGE = 'oge',
  EGE_BASE = 'ege_base',
  EGE_PROFILE = 'ege_profile',
}

export enum CurriculumSourceKind {
  DEMO = 'demo',
  IMPORTED = 'imported',
}

export enum TaskDifficulty {
  BASIC = 'basic',
  STANDARD = 'standard',
  ADVANCED = 'advanced',
}

@Entity('curriculum_releases')
@Index(['examTrack', 'year', 'version'], { unique: true })
export class CurriculumRelease {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: ExamTrack })
  examTrack: ExamTrack;

  @Column({ type: 'int' })
  year: number;

  @Column()
  version: string;

  @Column()
  title: string;

  @Column({
    type: 'enum',
    enum: CurriculumSourceKind,
    default: CurriculumSourceKind.IMPORTED,
  })
  sourceKind: CurriculumSourceKind;

  @Column({ default: false })
  isActive: boolean;

  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => CurriculumTopic, (topic) => topic.release)
  topics: CurriculumTopic[];

  @OneToMany(() => CurriculumTask, (task) => task.release)
  tasks: CurriculumTask[];
}

@Entity('curriculum_topics')
@Index(['releaseId', 'code'], { unique: true })
@Index(['releaseId', 'position'])
export class CurriculumTopic {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => CurriculumRelease, (release) => release.topics, {
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  release: CurriculumRelease;

  @Column()
  releaseId: string;

  @Column()
  code: string;

  @Column()
  title: string;

  @Column({ nullable: true })
  section: string | null;

  @Column({ type: 'jsonb', default: [] })
  aliases: string[];

  @Column({ type: 'int', default: 0 })
  position: number;

  @OneToMany(() => CurriculumTask, (task) => task.topic)
  tasks: CurriculumTask[];
}

@Entity('curriculum_tasks')
@Index(['releaseId', 'externalId'], { unique: true })
@Index(['releaseId', 'topicId', 'difficulty'])
@Index(['releaseId', 'taskType'])
export class CurriculumTask {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => CurriculumRelease, (release) => release.tasks, {
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  release: CurriculumRelease;

  @Column()
  releaseId: string;

  @ManyToOne(() => CurriculumTopic, (topic) => topic.tasks, {
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  topic: CurriculumTopic;

  @Column()
  topicId: string;

  @Column()
  externalId: string;

  @Column()
  taskType: string;

  @Column({
    type: 'enum',
    enum: TaskDifficulty,
    default: TaskDifficulty.STANDARD,
  })
  difficulty: TaskDifficulty;

  @Column({ type: 'text' })
  statement: string;

  @Column({ type: 'jsonb', default: [] })
  acceptedAnswers: string[];

  @Column({ type: 'text', nullable: true })
  solution: string | null;

  @Column({ nullable: true })
  sourceUrl: string | null;

  @Column({ default: false })
  isDemo: boolean;

  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, unknown>;
}
