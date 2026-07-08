import {
  Column,
  Entity,
  JoinColumn,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Student } from '../../students/entities/student.entity';
import { CalendarSlot } from '../../calendar/entities/calendar-slot.entity';

@Entity('teachers')
export class Teacher {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User, (user) => user.teacher, { onDelete: 'CASCADE' })
  @JoinColumn()
  user: User;

  @Column()
  userId: string;

  @Column({ nullable: true })
  bio: string;

  @Column({ nullable: true })
  subjects: string;

  @Column({ nullable: true, unique: true })
  inviteCode: string;

  @OneToMany(() => Student, (student) => student.teacher)
  students: Student[];

  @OneToMany(() => CalendarSlot, (slot) => slot.teacher)
  slots: CalendarSlot[];
}
