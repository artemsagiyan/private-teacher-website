import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/enums/user-role.enum';
import { Teacher } from '../teachers/entities/teacher.entity';
import { Student } from '../students/entities/student.entity';
import { RegistrationCode } from '../admin/entities/registration-code.entity';

@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Teacher) private teacherRepo: Repository<Teacher>,
    @InjectRepository(Student) private studentRepo: Repository<Student>,
    @InjectRepository(RegistrationCode)
    private codeRepo: Repository<RegistrationCode>,
    private config: ConfigService,
  ) {}

  async onModuleInit() {
    await this.bootstrapProdAdmin();
    if (!this.config.get<boolean>('enableSeed')) return;
    await this.seedAdmin();
    await this.seedTeacher();
    await this.seedStudent();
    await this.seedTeacherCode();
  }

  private async bootstrapProdAdmin() {
    const email = this.config.get<string>('adminBootstrap.email');
    const password = this.config.get<string>('adminBootstrap.password');
    if (!email || !password) return;

    const exists = await this.userRepo.findOne({ where: { email } });
    if (exists) return;

    const user = this.userRepo.create({
      email,
      firstName: 'Admin',
      lastName: 'Platform',
      passwordHash: await bcrypt.hash(password, 12),
      role: UserRole.ADMIN,
      isEmailVerified: true,
    });
    await this.userRepo.save(user);
    this.logger.log(`Bootstrap admin created: ${email}`);
  }

  private async seedAdmin() {
    const exists = await this.userRepo.findOne({
      where: { email: 'admin@tutor.local' },
    });
    if (exists) return;

    const user = this.userRepo.create({
      email: 'admin@tutor.local',
      firstName: 'Admin',
      lastName: 'Platform',
      passwordHash: await bcrypt.hash('Admin12345', 12),
      role: UserRole.ADMIN,
      isEmailVerified: true,
    });
    await this.userRepo.save(user);
    this.logger.log('Dev admin created: admin@tutor.local');
  }

  private async seedTeacher() {
    const exists = await this.userRepo.findOne({
      where: { email: 'teacher@tutor.local' },
    });
    if (exists) return;

    const user = this.userRepo.create({
      email: 'teacher@tutor.local',
      firstName: 'Анна',
      lastName: 'Смирнова',
      passwordHash: await bcrypt.hash('Teacher12345', 12),
      role: UserRole.TEACHER,
      isEmailVerified: true,
    });
    await this.userRepo.save(user);

    const teacher = this.teacherRepo.create({
      userId: user.id,
      bio: 'Преподаватель математики и физики',
      subjects: 'Математика, Физика',
      inviteCode: 'DEMO1234',
    });
    await this.teacherRepo.save(teacher);
    this.logger.log('Dev teacher created: teacher@tutor.local (invite DEMO1234)');
  }

  private async seedStudent() {
    const exists = await this.userRepo.findOne({
      where: { email: 'student@tutor.local' },
    });
    if (exists) return;

    const user = this.userRepo.create({
      email: 'student@tutor.local',
      firstName: 'Иван',
      lastName: 'Иванов',
      passwordHash: await bcrypt.hash('Student12345', 12),
      role: UserRole.STUDENT,
      isEmailVerified: true,
    });
    await this.userRepo.save(user);

    const teacher = await this.teacherRepo.findOne({
      where: { inviteCode: 'DEMO1234' },
    });

    const student = this.studentRepo.create({
      userId: user.id,
      teacherId: teacher?.id ?? null,
    });
    await this.studentRepo.save(student);
    this.logger.log('Dev student created: student@tutor.local');
  }

  private async seedTeacherCode() {
    const exists = await this.codeRepo.findOne({
      where: { code: 'NEWTEACHER' },
    });
    if (exists) return;

    const code = this.codeRepo.create({
      code: 'NEWTEACHER',
      expiresAt: new Date(Date.now() + 365 * 24 * 3600 * 1000),
    });
    await this.codeRepo.save(code);
    this.logger.log('Dev teacher registration code: NEWTEACHER');
  }
}
