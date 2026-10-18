import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum ComputeJobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Entity('compute_jobs')
@Index('IDX_compute_jobs_claim', ['status', 'leaseExpiresAt', 'createdAt'])
export class ComputeJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  lessonId: string;

  @Column({ default: ComputeJobStatus.PENDING })
  status: ComputeJobStatus;

  @Column()
  recordingObjectKey: string;

  @Column({ type: 'text', nullable: true })
  lessonNote: string | null;

  @Column({ type: 'text', nullable: true })
  error: string | null;

  @Column({ type: 'integer', default: 0 })
  attempts: number;

  @Column({ nullable: true })
  leaseToken: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  leaseExpiresAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  retryAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
