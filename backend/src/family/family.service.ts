import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'crypto';
import { In, Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/enums/user-role.enum';
import { Student } from '../students/entities/student.entity';
import { Booking, BookingStatus } from '../bookings/entities/booking.entity';
import { Lesson } from '../lessons/entities/lesson.entity';
import { HomeworkAssignment, HomeworkStatus } from '../learning/entities/learning.entity';
import { ProgressService } from '../learning/progress.service';
import { PaymentsService } from '../payments/payments.service';
import { NotificationsService } from '../notifications/notifications.service';
import { FamilyMessage } from './entities/family-message.entity';

@Injectable()
export class FamilyService {
  private readonly logger = new Logger(FamilyService.name);

  constructor(
    @InjectRepository(Student) private readonly studentRepo: Repository<Student>,
    @InjectRepository(Booking) private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(HomeworkAssignment) private readonly homeworkRepo: Repository<HomeworkAssignment>,
    @InjectRepository(FamilyMessage) private readonly messageRepo: Repository<FamilyMessage>,
    private readonly progress: ProgressService,
    private readonly payments: PaymentsService,
    private readonly notifications: NotificationsService,
  ) {}

  async createAccess(user: User, frontendUrl: string) {
    if (user.role !== UserRole.STUDENT) throw new ForbiddenException();
    const student = await this.studentRepo.findOneBy({ userId: user.id });
    if (!student) throw new NotFoundException('Ученик не найден');
    const token = randomBytes(32).toString('base64url');
    student.familyAccessTokenHash = this.hash(token);
    student.familyAccessTokenExpires = new Date(Date.now() + 90 * 24 * 3600_000);
    await this.studentRepo.save(student);
    return { token, expiresAt: student.familyAccessTokenExpires, url: `${frontendUrl.replace(/\/$/, '')}/family/${token}` };
  }

  async getByToken(
    token: string,
    period?: { from?: Date; to?: Date },
  ) {
    if (!token || token.length < 30) throw new UnauthorizedException('Ссылка недействительна');
    const student = await this.familyStudent(token);
    const [progress, lessons, homework, payments, messages] = await Promise.all([
      this.progress.forStudent(student.id, period),
      this.lessons(student.id),
      this.homework(student.id),
      this.payments.listForStudentId(student.id),
      this.listMessages(student.id, student.teacherId),
    ]);
    return {
      student: { id: student.id, name: `${student.user?.firstName ?? ''} ${student.user?.lastName ?? ''}`.trim(), parentName: student.parentName },
      teacher: student.teacher ? { name: `${student.teacher.user?.firstName ?? ''} ${student.teacher.user?.lastName ?? ''}`.trim(), subjects: student.teacher.subjects, bio: student.teacher.bio } : null,
      progress,
      lessons,
      homework,
      payments,
      messages,
      accessExpiresAt: student.familyAccessTokenExpires,
    };
  }

  async familyMessages(token: string) {
    const student = await this.familyStudent(token);
    if (!student.teacherId) return [];
    return this.listMessages(student.id, student.teacherId);
  }

  async sendFamilyMessage(token: string, body: string) {
    const student = await this.familyStudent(token);
    if (!student.teacher?.userId || !student.teacherId) {
      throw new BadRequestException('К ученику пока не привязан преподаватель');
    }
    const message = await this.messageRepo.save(
      this.messageRepo.create({
        studentId: student.id,
        teacherId: student.teacherId,
        senderType: 'parent',
        senderName: student.parentName?.trim() || 'Родитель',
        body: this.cleanMessage(body),
      }),
    );
    try {
      await this.notifications.notifyFamilyMessage(
        student.teacher.userId,
        null,
        'родителя',
        message.id,
      );
    } catch (error) {
      this.logger.warn(`Could not notify teacher about family message: ${this.errorMessage(error)}`);
    }
    return this.messageView(message);
  }

  async teacherMessages(user: User, studentId: string) {
    const student = await this.teacherStudent(user, studentId);
    const rows = await this.messageRepo.find({
      where: { studentId: student.id, teacherId: student.teacherId },
      order: { createdAt: 'DESC' },
      take: 100,
    });
    return rows.reverse().map((row) => this.messageView(row));
  }

  async sendTeacherMessage(user: User, studentId: string, body: string) {
    const student = await this.teacherStudent(user, studentId);
    const senderName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || 'Преподаватель';
    const message = await this.messageRepo.save(
      this.messageRepo.create({
        studentId: student.id,
        teacherId: student.teacherId,
        senderType: 'teacher',
        senderName,
        body: this.cleanMessage(body),
      }),
    );
    try {
      await this.notifications.notifyFamilyMessage(
        student.userId,
        student.parentEmail,
        'преподавателя',
        message.id,
      );
    } catch (error) {
      this.logger.warn(`Could not notify family about teacher message: ${this.errorMessage(error)}`);
    }
    return this.messageView(message);
  }

  private async familyStudent(token: string) {
    if (!token || token.length < 30) {
      throw new UnauthorizedException('Ссылка недействительна');
    }
    const student = await this.studentRepo
      .createQueryBuilder('student')
      .addSelect(['student.familyAccessTokenHash', 'student.familyAccessTokenExpires'])
      .where('student.familyAccessTokenHash = :hash', { hash: this.hash(token) })
      .leftJoinAndSelect('student.user', 'user')
      .leftJoinAndSelect('student.teacher', 'teacher')
      .leftJoinAndSelect('teacher.user', 'teacherUser')
      .getOne();
    if (
      !student ||
      !student.familyAccessTokenExpires ||
      student.familyAccessTokenExpires.getTime() < Date.now()
    ) {
      throw new UnauthorizedException('Ссылка недействительна или истекла');
    }
    return student;
  }

  private async listMessages(studentId: string, teacherId: string | null) {
    if (!teacherId) return [];
    const rows = await this.messageRepo.find({
      where: { studentId, teacherId },
      order: { createdAt: 'DESC' },
      take: 100,
    });
    return rows.reverse().map((row) => this.messageView(row));
  }

  private async teacherStudent(user: User, studentId: string) {
    if (user.role !== UserRole.TEACHER) throw new ForbiddenException();
    const student = await this.studentRepo.findOne({
      where: { id: studentId },
      relations: ['user', 'teacher', 'teacher.user'],
    });
    if (!student) throw new NotFoundException('Ученик не найден');
    if (student.teacher?.userId !== user.id) throw new ForbiddenException();
    return student;
  }

  private cleanMessage(value: string) {
    const message = String(value ?? '').trim();
    if (!message || message.length > 3000) {
      throw new BadRequestException('Сообщение должно содержать от 1 до 3000 символов');
    }
    return message;
  }

  private messageView(message: FamilyMessage) {
    return {
      id: message.id,
      senderType: message.senderType,
      senderName: message.senderName,
      body: message.body,
      createdAt: message.createdAt,
    };
  }

  private async lessons(studentId: string) {
    const bookings = await this.bookingRepo.find({
      where: {
        studentId,
        status: In([BookingStatus.CONFIRMED, BookingStatus.COMPLETED]),
      },
      relations: ['slot', 'slot.lesson'],
      order: { createdAt: 'DESC' },
      take: 200,
    });
    const now = Date.now();
    return bookings
      .filter((booking) => booking.slot)
      .map((booking) => {
        const lesson = booking.slot.lesson as Partial<Lesson> | undefined;
        const attended = Boolean(
          lesson?.startedAt || lesson?.participantCount > 0,
        );
        const future = booking.slot.startTime.getTime() > now;
        return {
          id: booking.id,
          lessonId: lesson?.id ?? null,
          date: booking.slot.startTime,
          note: booking.slot.note,
          bookingStatus: booking.status,
          lessonStatus: lesson?.status ?? null,
          attendanceStatus: attended
            ? 'attended'
            : future
              ? 'scheduled'
              : 'not_attended',
          report: lesson?.report ?? null,
        };
      })
      .sort((left, right) => right.date.getTime() - left.date.getTime());
  }

  private async homework(studentId: string) {
    const rows = await this.homeworkRepo.find({ where: { studentId, status: In([HomeworkStatus.PUBLISHED, HomeworkStatus.IN_PROGRESS, HomeworkStatus.COMPLETED]) }, relations: ['lesson', 'lesson.slot', 'items', 'items.task', 'items.task.topic'], order: { createdAt: 'DESC' }, take: 20 });
    return rows.map((assignment) => ({ id: assignment.id, status: assignment.status, dueAt: assignment.dueAt, completedAt: assignment.completedAt, title: assignment.lesson?.slot?.note || 'Домашнее задание', total: assignment.items.length, completed: assignment.items.filter((item) => ['correct', 'incorrect', 'needs_review'].includes(item.status)).length }));
  }

  private hash(value: string) { return createHash('sha256').update(value).digest('hex'); }

  private errorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }
}
