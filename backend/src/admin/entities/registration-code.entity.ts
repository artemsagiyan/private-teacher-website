import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('registration_codes')
export class RegistrationCode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  code: string;

  @Column({ default: false })
  isUsed: boolean;

  @Column({ nullable: true })
  usedByEmail: string;

  @Column()
  expiresAt: Date;

  @Column({ nullable: true })
  createdByAdminId: string;

  @CreateDateColumn()
  createdAt: Date;
}
