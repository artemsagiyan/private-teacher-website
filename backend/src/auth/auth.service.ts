import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { LessThan, Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/enums/user-role.enum';
import { Teacher } from '../teachers/entities/teacher.entity';
import { Student } from '../students/entities/student.entity';
import { RegistrationCode } from '../admin/entities/registration-code.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { RegisterStudentDto } from './dto/register-student.dto';
import { RegisterTeacherDto } from './dto/register-teacher.dto';
import { LoginDto } from './dto/login.dto';
import { OauthCode } from './entities/oauth-code.entity';
import { toPublicUser } from '../common/public-user';

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
    @InjectRepository(OauthCode)
    private oauthCodeRepository: Repository<OauthCode>,
    private jwtService: JwtService,
    private configService: ConfigService,
    private notificationsService: NotificationsService,
  ) {}

  async registerStudent(dto: RegisterStudentDto) {
    if (dto.password !== dto.passwordConfirm) {
      throw new BadRequestException('Пароли не совпадают');
    }
    const exists = await this.userRepository.findOne({
      where: { email: dto.email },
    });
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

    try {
      await this.notificationsService.sendWelcomeEmail(
        user.email,
        user.firstName,
      );
    } catch {
      // SMTP must never block signup
    }

    return this.generateTokens(user, true);
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

    const exists = await this.userRepository.findOne({
      where: { email: dto.email },
    });
    if (exists) throw new ConflictException('Email уже зарегистрирован');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = this.userRepository.create({
      email: dto.email,
      firstName: dto.firstName,
      lastName: dto.lastName,
      passwordHash,
      role: UserRole.TEACHER,
      isEmailVerified: false,
    });
    await this.userRepository.save(user);

    const teacher = this.teacherRepository.create({ userId: user.id });
    await this.teacherRepository.save(teacher);

    code.isUsed = true;
    code.usedByEmail = user.email;
    await this.registrationCodeRepository.save(code);

    return this.generateTokens(user, true);
  }

  async login(dto: LoginDto) {
    const user = await this.userRepository.findOne({
      where: { email: dto.email },
      select: [
        'id',
        'email',
        'passwordHash',
        'role',
        'isBlocked',
        'firstName',
        'lastName',
        'phone',
        'avatarUrl',
        'isEmailVerified',
        'createdAt',
      ],
    });
    if (!user?.passwordHash) {
      throw new UnauthorizedException('Неверный email или пароль');
    }
    if (user.isBlocked) throw new UnauthorizedException('Аккаунт заблокирован');

    const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isMatch) throw new UnauthorizedException('Неверный email или пароль');

    return this.generateTokens(user, true);
  }

  async googleLogin(googleUser: {
    googleId: string;
    email: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string;
  }) {
    if (!googleUser.email) {
      throw new BadRequestException('Google не вернул email');
    }

    let user = await this.userRepository.findOne({
      where: { email: googleUser.email },
      select: [
        'id',
        'email',
        'role',
        'isBlocked',
        'firstName',
        'lastName',
        'phone',
        'avatarUrl',
        'isEmailVerified',
        'googleId',
        'passwordHash',
        'createdAt',
      ],
    });

    if (!user) {
      user = this.userRepository.create({
        googleId: googleUser.googleId,
        email: googleUser.email,
        firstName: googleUser.firstName,
        lastName: googleUser.lastName,
        avatarUrl: googleUser.avatarUrl,
        role: UserRole.STUDENT,
        isEmailVerified: true,
      });
      await this.userRepository.save(user);

      const student = this.studentRepository.create({ userId: user.id });
      await this.studentRepository.save(student);
    } else {
      if (!user.googleId) user.googleId = googleUser.googleId;
      user.isEmailVerified = true;
      if (googleUser.avatarUrl && !user.avatarUrl) {
        user.avatarUrl = googleUser.avatarUrl;
      }
      await this.userRepository.save(user);
    }

    if (user.isBlocked) throw new UnauthorizedException('Аккаунт заблокирован');

    return this.generateTokens(user, Boolean(user.passwordHash));
  }

  async createOauthCode(userId: string) {
    await this.oauthCodeRepository.delete({
      expiresAt: LessThan(new Date()),
    });
    const raw = randomBytes(32).toString('hex');
    const row = this.oauthCodeRepository.create({
      userId,
      codeHash: await bcrypt.hash(raw, 8),
      expiresAt: new Date(Date.now() + 60_000),
    });
    await this.oauthCodeRepository.save(row);
    return raw;
  }

  async exchangeOauthCode(code: string) {
    const candidates = await this.oauthCodeRepository.find({
      where: {},
      order: { createdAt: 'DESC' },
      take: 20,
    });
    let match: OauthCode | null = null;
    for (const row of candidates) {
      if (row.expiresAt < new Date()) continue;
      if (await bcrypt.compare(code, row.codeHash)) {
        match = row;
        break;
      }
    }
    if (!match) throw new UnauthorizedException('Код входа недействителен');
    await this.oauthCodeRepository.delete({ id: match.id });

    const user = await this.userRepository.findOne({
      where: { id: match.userId },
      select: [
        'id',
        'email',
        'role',
        'isBlocked',
        'firstName',
        'lastName',
        'phone',
        'avatarUrl',
        'isEmailVerified',
        'passwordHash',
        'createdAt',
      ],
    });
    if (!user || user.isBlocked) throw new UnauthorizedException();
    return this.generateTokens(user, Boolean(user.passwordHash));
  }

  async refreshTokens(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: [
        'id',
        'email',
        'role',
        'isBlocked',
        'firstName',
        'lastName',
        'phone',
        'avatarUrl',
        'isEmailVerified',
        'passwordHash',
        'refreshToken',
        'createdAt',
      ],
    });
    if (!user || !user.refreshToken || user.isBlocked) {
      throw new UnauthorizedException();
    }
    return this.generateTokens(user, Boolean(user.passwordHash));
  }

  async logout(userId: string) {
    await this.userRepository.update(userId, { refreshToken: null });
    return { message: 'Вышли из системы' };
  }

  async forgotPassword(email: string) {
    const user = await this.userRepository.findOne({ where: { email } });
    if (user?.passwordHash !== undefined || user) {
      const raw = randomBytes(32).toString('hex');
      if (user) {
        await this.userRepository.update(user.id, {
          passwordResetToken: await bcrypt.hash(raw, 10),
          passwordResetExpires: new Date(Date.now() + 60 * 60 * 1000),
        });
        const frontend = this.configService.get<string>('frontendUrl');
        const link = `${frontend}/auth/reset-password?token=${raw}`;
        await this.notificationsService.sendPasswordResetEmail(
          user.email,
          link,
        );
      }
    }
    return {
      message:
        'Если аккаунт существует, мы отправили ссылку для сброса пароля',
    };
  }

  async resetPassword(token: string, password: string, passwordConfirm: string) {
    if (password !== passwordConfirm) {
      throw new BadRequestException('Пароли не совпадают');
    }
    const candidates = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordResetToken')
      .addSelect('user.passwordResetExpires')
      .where('user.passwordResetToken IS NOT NULL')
      .andWhere('user.passwordResetExpires > :now', { now: new Date() })
      .getMany();

    let user: User | null = null;
    for (const row of candidates) {
      if (
        row.passwordResetToken &&
        (await bcrypt.compare(token, row.passwordResetToken))
      ) {
        user = row;
        break;
      }
    }
    if (!user) throw new BadRequestException('Ссылка недействительна или истекла');

    await this.userRepository.update(user.id, {
      passwordHash: await bcrypt.hash(password, 12),
      passwordResetToken: null,
      passwordResetExpires: null,
      refreshToken: null,
    });
    return { message: 'Пароль обновлён. Войдите с новым паролем.' };
  }

  me(user: User) {
    return toPublicUser(user);
  }

  private async generateTokens(user: User, hasPassword: boolean) {
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
      user: toPublicUser(user, hasPassword),
    };
  }
}
