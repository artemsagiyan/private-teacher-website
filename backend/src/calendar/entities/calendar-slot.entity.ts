import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Teacher } from '../../teachers/entities/teacher.entity';
import { Booking } from '../../bookings/entities/booking.entity';

export enum SlotStatus {
  AVAILABLE = 'available',
  BOOKED = 'booked',
  UNAVAILABLE = 'unavailable',
  CANCELLED = 'cancelled',
}

export enum LessonType {
  INDIVIDUAL = 'individual',
  GROUP = 'group',
}

@Entity('calendar_slots')
export class CalendarSlot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Teacher, (teacher) => teacher.slots, { onDelete: 'CASCADE' })
  @JoinColumn()
  teacher: Teacher;

  @Column()
  teacherId: string;

  @Column({ type: 'timestamptz' })
  startTime: Date;

  @Column({ type: 'timestamptz' })
  endTime: Date;

  @Column({ type: 'enum', enum: SlotStatus, default: SlotStatus.AVAILABLE })
  status: SlotStatus;

  @Column({ type: 'enum', enum: LessonType, default: LessonType.INDIVIDUAL })
  lessonType: LessonType;

  @Column({ default: 1 })
  capacity: number;

  @Column({ default: 0 })
  bookedCount: number;

  @Column({ nullable: true })
  note: string;

  @Column({ default: false })
  isRecurring: boolean;

  @Column({ nullable: true })
  recurringGroupId: string;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => Booking, (booking) => booking.slot)
  bookings: Booking[];
}
