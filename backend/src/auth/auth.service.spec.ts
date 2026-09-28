import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { UserRole } from '../users/enums/user-role.enum';

function repoMock(overrides: Record<string, unknown> = {}) {
  return {
    findOne: jest.fn(),
    create: jest.fn((value) => ({ id: 'generated-id', ...value })),
    save: jest.fn(async (value) => ({ id: value.id ?? 'generated-id', ...value })),
    update: jest.fn(),
    createQueryBuilder: jest.fn(),
    ...overrides,
  };
}

function queryBuilder(affected = 1) {
  const builder = {
    update: jest.fn(),
    set: jest.fn(),
    where: jest.fn(),
    andWhere: jest.fn(),
    execute: jest.fn(async () => ({ affected })),
  };
  builder.update.mockReturnValue(builder);
  builder.set.mockReturnValue(builder);
  builder.where.mockReturnValue(builder);
  builder.andWhere.mockReturnValue(builder);
  return builder;
}

describe('AuthService registration', () => {
  let service: AuthService;
  let users: ReturnType<typeof repoMock>;
  let teachers: ReturnType<typeof repoMock>;
  let students: ReturnType<typeof repoMock>;
  let codes: ReturnType<typeof repoMock>;
  let oauth: ReturnType<typeof repoMock>;
  let claim: ReturnType<typeof queryBuilder>;
  let jwt: { sign: jest.Mock };
  let notifications: { sendWelcomeEmail: jest.Mock };

  beforeEach(() => {
    users = repoMock();
    teachers = repoMock();
    students = repoMock();
    codes = repoMock();
    oauth = repoMock();
    claim = queryBuilder(1);
    (users as { manager?: unknown }).manager = {
      transaction: async (fn: (em: unknown) => Promise<unknown>) =>
        fn({
          findOne: users.findOne,
          create: (_entity: unknown, value: object) => users.create(value),
          save: users.save,
          createQueryBuilder: () => claim,
        }),
    };
    jwt = { sign: jest.fn().mockReturnValue('signed-token') };
    notifications = {
      sendWelcomeEmail: jest.fn().mockResolvedValue(undefined),
    };
    const config = {
      get: (key: string) =>
        ({
          'jwt.secret': 'secret',
          'jwt.expiresIn': '15m',
          'jwt.refreshSecret': 'refresh',
          'jwt.refreshExpiresIn': '7d',
          frontendUrl: 'http://localhost:3000',
        })[key],
    };

    service = new AuthService(
      users as any,
      teachers as any,
      students as any,
      codes as any,
      oauth as any,
      jwt as unknown as JwtService,
      config as any,
      notifications as any,
    );
  });

  const studentDto = {
    firstName: 'Иван',
    lastName: 'Иванов',
    email: 'ivan@example.com',
    phone: '',
    password: 'Password123',
    passwordConfirm: 'Password123',
  };

  it('registers a student and returns tokens', async () => {
    users.findOne.mockResolvedValue(null);

    const result = await service.registerStudent(studentDto);

    expect(users.save).toHaveBeenCalled();
    expect(notifications.sendWelcomeEmail).toHaveBeenCalledWith(
      'ivan@example.com',
      'Иван',
    );
    expect(result.accessToken).toBe('signed-token');
    expect(result.refreshToken).toBe('signed-token');
    expect(result.user.email).toBe('ivan@example.com');
    expect(result.user.role).toBe(UserRole.STUDENT);
    expect(result.user.hasPassword).toBe(true);
  });

  it('still registers if welcome email fails', async () => {
    users.findOne.mockResolvedValue(null);
    notifications.sendWelcomeEmail.mockRejectedValue(new Error('SMTP down'));

    const result = await service.registerStudent(studentDto);

    expect(result.accessToken).toBe('signed-token');
    expect(users.save).toHaveBeenCalled();
  });

  it('rejects mismatched passwords', async () => {
    await expect(
      service.registerStudent({
        ...studentDto,
        passwordConfirm: 'other',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(users.save).not.toHaveBeenCalled();
  });

  it('rejects duplicate email', async () => {
    users.findOne.mockResolvedValue({ id: 'existing' });
    await expect(service.registerStudent(studentDto)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('rejects teacher registration with missing/expired code', async () => {
    claim.execute.mockResolvedValue({ affected: 0 });
    await expect(
      service.registerTeacher({
        firstName: 'Анна',
        lastName: 'Смирнова',
        email: 'anna@example.com',
        password: 'Password123',
        passwordConfirm: 'Password123',
        registrationCode: 'BADCODE',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('registers a teacher with a valid code', async () => {
    users.findOne.mockResolvedValue(null);

    const result = await service.registerTeacher({
      firstName: 'Анна',
      lastName: 'Смирнова',
      email: 'anna@example.com',
      password: 'Password123',
      passwordConfirm: 'Password123',
      registrationCode: 'NEWTEACHER',
    });

    expect(users.save).toHaveBeenCalled();
    expect(result.user.role).toBe(UserRole.TEACHER);
  });

  it('login rejects blocked users', async () => {
    users.findOne.mockResolvedValue({
      id: 'u1',
      email: 'a@b.c',
      passwordHash: await (await import('bcryptjs')).hash('Password123', 4),
      isBlocked: true,
      role: UserRole.STUDENT,
    });
    await expect(
      service.login({ email: 'a@b.c', password: 'Password123' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
