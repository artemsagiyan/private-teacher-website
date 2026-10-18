import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Student } from '../../students/entities/student.entity';
import { Teacher } from '../../teachers/entities/teacher.entity';

@Entity('family_messages')
@Index(['studentId', 'teacherId', 'createdAt'])
export class FamilyMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Student, { onDelete: 'CASCADE' })
  @JoinColumn()
  student: Student;

  @Column()
  studentId: string;

  @Column()
  teacherId: string;

  @ManyToOne(() => Teacher, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'teacherId' })
  teacher: Teacher;

  @Column({ type: 'varchar', length: 12 })
  senderType: 'parent' | 'teacher';

  @Column({ type: 'varchar', length: 120 })
  senderName: string;

  @Column({ type: 'text' })
  body: string;

  @CreateDateColumn()
  createdAt: Date;
}
