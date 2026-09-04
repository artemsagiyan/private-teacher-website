import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { RegisterStudentDto } from './register-student.dto';
import { RegisterTeacherDto } from './register-teacher.dto';

const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

async function parse<T extends object>(cls: new () => T, body: object) {
  return pipe.transform(body, { type: 'body', metatype: cls }) as Promise<T>;
}

describe('register DTOs (frontend payload)', () => {
  const studentBody = {
    firstName: 'Иван',
    lastName: 'Иванов',
    email: 'ivan@example.com',
    phone: '',
    password: 'Password123',
    passwordConfirm: 'Password123',
  };

  it('accepts the student form payload including empty phone', async () => {
    const dto = await parse(RegisterStudentDto, studentBody);
    expect(dto.email).toBe('ivan@example.com');
    expect(dto.phone).toBeUndefined();
    expect(dto.passwordConfirm).toBe('Password123');
  });

  it('rejects extra fields (forbidNonWhitelisted)', async () => {
    await expect(
      parse(RegisterStudentDto, { ...studentBody, extra: true }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects short password', async () => {
    await expect(
      parse(RegisterStudentDto, { ...studentBody, password: 'short' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts teacher payload with registrationCode', async () => {
    const dto = await parse(RegisterTeacherDto, {
      firstName: 'Анна',
      lastName: 'Смирнова',
      email: 'anna@example.com',
      password: 'Password123',
      passwordConfirm: 'Password123',
      registrationCode: 'NEWTEACHER',
    });
    expect(dto.registrationCode).toBe('NEWTEACHER');
  });
});
