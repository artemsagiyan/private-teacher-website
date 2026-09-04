import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum NotificationType {
  BOOKING_CONFIRMED = 'booking_confirmed',
  BOOKING_CANCELLED = 'booking_cancelled',
  SCHEDULE_CHANGED = 'schedule_changed',
  REMINDER_24H = 'reminder_24h',
  REMINDER_1H = 'reminder_1h',
  TEACHER_INVITATION = 'teacher_invitation',
  LESSON_REPORT_READY = 'lesson_report_ready',
  LESSON_FAILED = 'lesson_failed',
}

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn()
  user: User;

  @Column()
  userId: string;

  @Column()
  message: string;

  @Column({ type: 'enum', enum: NotificationType })
  type: NotificationType;

  @Column({ default: false })
  isRead: boolean;

  @Column({ nullable: true })
  relatedId: string;

  @CreateDateColumn()
  createdAt: Date;
}
