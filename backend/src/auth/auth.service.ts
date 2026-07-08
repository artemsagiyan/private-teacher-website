import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/enums/user-role.enum';
import { Teacher } from '../teachers/entities/teacher.entity';
import { Student } from '../students/entities/student.entity';
import { RegistrationCode } from '../admin/entities/registration-code.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { RegisterStudentDto } from './dto/register-student.dto';
import { RegisterTeacherDto } from './dto/register-teacher.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Teacher)
    private teacherRepository: Repository<Teacher>,
    @InjectRepository(Student)
    private studentRepository: Repository<Student>,
    @InjectRepository(RegistrationCode)
    private registrationCodeRepository: Repository<RegistrationCode>,
    private jwtService: JwtService,
    private configService: ConfigService,
    private notificationsService: NotificationsService,
  ) {}

  async registerStudent(dto: RegisterStudentDto) {
    if (dto.password !== dto.passwordConfirm) {
      throw new BadRequestException('Пароли не совпадают');
    }
    const exists = await this.userRepository.findOne({ where: { email: dto.email } });
    if (exists) throw new ConflictException('Email уже зарегистрирован');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = this.userRepository.create({
      email: dto.email,
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone,
      passwordHash,
      role: UserRole.STUDENT,
      isEmailVerified: false,
    });
    await this.userRepository.save(user);

    const student = this.studentRepository.create({ userId: user.id });
    await this.studentRepository.save(student);

    await this.notificationsService.sendWelcomeEmail(user.email, user.firstName);

    return this.generateTokens(user);
  }

  async registerTeacher(dto: RegisterTeacherDto) {
    if (dto.password !== dto.passwordConfirm) {
      throw new BadRequestException('Пароли не совпадают');
    }

    const code = await this.registrationCodeRepository.findOne({
      where: { code: dto.registrationCode, isUsed: false },
    });
    if (!code || code.expiresAt < new Date()) {
      throw new BadRequestException('Код недействителен или истёк');
    }

    const exists = await this.userRepository.findOne({ where: { email: dto.email } });
    if (exists) throw new ConflictException('Email уже зарегистрирован');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = this.userRepository.create({
      email: dto.email,
      firstName: dto.firstName,
      lastName: dto.lastName,
      passwordHash,
      role: UserRole.TEACHER,
    });
    await this.userRepository.save(user);

    const teacher = this.teacherRepository.create({ userId: user.id });
    await this.teacherRepository.save(teacher);

    code.isUsed = true;
    code.usedByEmail = user.email;
    await this.registrationCodeRepository.save(code);

    return this.generateTokens(user);
  }

  async login(dto: LoginDto) {
    const user = await this.userRepository.findOne({
      where: { email: dto.email },
      select: ['id', 'email', 'passwordHash', 'role', 'isBlocked', 'firstName', 'lastName'],
    });
    if (!user) throw new UnauthorizedException('Неверный email или пароль');
    if (user.isBlocked) throw new UnauthorizedException('Аккаунт заблокирован');

    const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isMatch) throw new UnauthorizedException('Неверный email или пароль');

    return this.generateTokens(user);
  }

  async googleLogin(googleUser: {
    googleId: string;
    email: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string;
  }) {
    let user = await this.userRepository.findOne({ where: { email: googleUser.email } });

    if (!user) {
      user = this.userRepository.create({
        ...googleUser,
        role: UserRole.STUDENT,
        isEmailVerified: true,
      });
      await this.userRepository.save(user);

      const student = this.studentRepository.create({ userId: user.id });
      await this.studentRepository.save(student);
    } else if (!user.googleId) {
      user.googleId = googleUser.googleId;
      user.isEmailVerified = true;
      await this.userRepository.save(user);
    }

    if (user.isBlocked) throw new UnauthorizedException('Аккаунт заблокирован');

    return this.generateTokens(user);
  }

  async refreshTokens(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user || !user.refreshToken) throw new UnauthorizedException();
    return this.generateTokens(user);
  }

  async logout(userId: string) {
    await this.userRepository.update(userId, { refreshToken: null });
    return { message: 'Вышли из системы' };
  }

  private async generateTokens(user: User) {
    const payload = { sub: user.id, email: user.email, role: user.role };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('jwt.secret'),
      expiresIn: this.configService.get<string>('jwt.expiresIn'),
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('jwt.refreshSecret'),
      expiresIn: this.configService.get<string>('jwt.refreshExpiresIn'),
    });

    await this.userRepository.update(user.id, {
      refreshToken: await bcrypt.hash(refreshToken, 10),
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    };
  }
}
