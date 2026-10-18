import { Column, CreateDateColumn, Entity, Index, ManyToOne, JoinColumn, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Student } from '../../students/entities/student.entity';
import { Teacher } from '../../teachers/entities/teacher.entity';
import { ExamTrack } from '../../curriculum/entities/curriculum.entity';

export enum MockExamStatus { IN_PROGRESS = 'in_progress', COMPLETED = 'completed' }

export interface MockExamItem {
  taskId: string;
  externalId: string;
  topicId: string;
  topicCode: string;
  topicTitle: string;
  taskType: string;
  statement: string;
  acceptedAnswers: string[];
  solution?: string | null;
  answer?: string | null;
  status: 'pending' | 'correct' | 'incorrect' | 'needs_review';
}

@Entity('mock_exams')
@Index(['studentId', 'createdAt'])
export class MockExam {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Student, { onDelete: 'CASCADE' })
  @JoinColumn()
  student: Student;

  @Column()
  studentId: string;

  @ManyToOne(() => Teacher, { onDelete: 'CASCADE' })
  @JoinColumn()
  teacher: Teacher;

  @Column()
  teacherId: string;

  @Column({ type: 'enum', enum: ExamTrack })
  examTrack: ExamTrack;

  @Column()
  title: string;

  @Column({ type: 'enum', enum: MockExamStatus, default: MockExamStatus.IN_PROGRESS })
  status: MockExamStatus;

  @Column({ type: 'int', default: 60 })
  durationMinutes: number;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  items: MockExamItem[];

  @Column({ type: 'int', default: 0 })
  correctCount: number;

  @Column({ type: 'int', default: 0 })
  score: number;

  @Column({ type: 'timestamptz', nullable: true })
  startedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  submittedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
