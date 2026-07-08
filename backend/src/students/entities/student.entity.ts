import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Teacher } from '../../teachers/entities/teacher.entity';
import { Booking } from '../../bookings/entities/booking.entity';

@Entity('students')
export class Student {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User, (user) => user.student, { onDelete: 'CASCADE' })
  @JoinColumn()
  user: User;

  @Column()
  userId: string;

  @ManyToOne(() => Teacher, (teacher) => teacher.students, { nullable: true })
  @JoinColumn()
  teacher: Teacher;

  @Column({ nullable: true })
  teacherId: string;

  @OneToMany(() => Booking, (booking) => booking.student)
  bookings: Booking[];
}
