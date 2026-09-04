import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('oauth_codes')
export class OauthCode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  codeHash: string;

  @Column()
  userId: string;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
