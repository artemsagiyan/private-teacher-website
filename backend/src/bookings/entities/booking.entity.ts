import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Student } from '../../students/entities/student.entity';
import { CalendarSlot } from '../../calendar/entities/calendar-slot.entity';

export enum BookingStatus {
  CONFIRMED = 'confirmed',
  CANCELLED_BY_STUDENT = 'cancelled_by_student',
  CANCELLED_BY_TEACHER = 'cancelled_by_teacher',
  COMPLETED = 'completed',
}

@Entity('bookings')
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Student, (student) => student.bookings, { onDelete: 'CASCADE' })
  @JoinColumn()
  student: Student;

  @Column()
  studentId: string;

  @ManyToOne(() => CalendarSlot, (slot) => slot.bookings, { onDelete: 'CASCADE' })
  @JoinColumn()
  slot: CalendarSlot;

  @Column()
  slotId: string;

  @Column({ type: 'enum', enum: BookingStatus, default: BookingStatus.CONFIRMED })
  status: BookingStatus;

  @Column({ nullable: true })
  cancellationReason: string;

  @Column({ default: false })
  isRecurring: boolean;

  @Column({ nullable: true })
  recurringGroupId: string;

  @Column({ default: false })
  reminder24hSent: boolean;

  @Column({ default: false })
  reminder1hSent: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
