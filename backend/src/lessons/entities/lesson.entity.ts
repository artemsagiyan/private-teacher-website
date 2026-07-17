import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CalendarSlot } from '../../calendar/entities/calendar-slot.entity';
import { Teacher } from '../../teachers/entities/teacher.entity';

export enum LessonStatus {
  WAITING = 'waiting',
  STARTING = 'starting',
  ACTIVE = 'active',
  ENDING = 'ending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum LessonEndReason {
  TEACHER = 'teacher',
  EMPTY_ROOM = 'empty_room',
  ROOM_FINISHED = 'room_finished',
  SYSTEM = 'system',
}

export interface LessonReport {
  summary: string;
  topics: string[];
  achievements: string[];
  difficulties: string[];
  homework: string[];
  recommendations: string[];
  keyMoments: Array<{ time?: string; description: string }>;
}

@Entity('lessons')
export class Lesson {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => CalendarSlot, { onDelete: 'CASCADE' })
  @JoinColumn()
  slot: CalendarSlot;

  @Column({ unique: true })
  slotId: string;

  @ManyToOne(() => Teacher, { onDelete: 'CASCADE' })
  @JoinColumn()
  teacher: Teacher;

  @Column()
  teacherId: string;

  @Column({ unique: true })
  roomName: string;

  @Column({
    type: 'enum',
    enum: LessonStatus,
    default: LessonStatus.WAITING,
  })
  status: LessonStatus;

  @Column({ default: 0 })
  participantCount: number;

  @Column({ nullable: true })
  egressId: string;

  @Column({ nullable: true })
  recordingObjectKey: string;

  @Column({ nullable: true })
  boardObjectKey: string;

  @Column({ default: 0 })
  boardRevision: number;

  @Column({ nullable: true })
  transcriptObjectKey: string;

  @Column({ nullable: true })
  reportObjectKey: string;

  @Column({ type: 'jsonb', nullable: true })
  report: LessonReport;

  @Column({ nullable: true })
  transcriptLanguage: string;

  @Column({ type: 'float', nullable: true })
  transcriptDurationSeconds: number;

  @Column({ type: 'timestamp', nullable: true })
  startedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastParticipantLeftAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  endedAt: Date;

  @Column({
    type: 'enum',
    enum: LessonEndReason,
    nullable: true,
  })
  endReason: LessonEndReason;

  @Column({ type: 'timestamp', nullable: true })
  boardUpdatedAt: Date;

  @Column({ default: 0 })
  processingAttempts: number;

  @Column({ type: 'timestamp', nullable: true })
  nextProcessingAt: Date;

  @Column({ nullable: true })
  processingLeaseId: string;

  @Column({ type: 'text', nullable: true })
  processingError: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
