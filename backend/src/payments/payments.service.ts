import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Student } from '../students/entities/student.entity';
import { Teacher } from '../teachers/entities/teacher.entity';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/enums/user-role.enum';
import { CreatePaymentDto, UpdatePaymentDto } from './dto/payment.dto';
import { Payment, PaymentStatus } from './entities/payment.entity';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment) private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(Student) private readonly studentRepo: Repository<Student>,
    @InjectRepository(Teacher) private readonly teacherRepo: Repository<Teacher>,
    private readonly notifications: NotificationsService,
  ) {}

  async listForTeacher(user: User) {
    const teacher = await this.teacher(user);
    const rows = await this.paymentRepo.find({
      where: { teacherId: teacher.id },
      relations: ['student', 'student.user'],
      order: { dueAt: 'ASC', createdAt: 'DESC' },
    });
    return rows.map((row) => this.serialize(row));
  }

  async listForStudent(user: User) {
    const student = await this.student(user);
    const rows = await this.paymentRepo.find({
      where: { studentId: student.id },
      relations: ['teacher', 'teacher.user'],
      order: { dueAt: 'DESC', createdAt: 'DESC' },
    });
    return rows.map((row) => this.serialize(row));
  }

  async create(user: User, dto: CreatePaymentDto) {
    const teacher = await this.teacher(user);
    const student = await this.studentRepo.findOne({ where: { id: dto.studentId }, relations: ['user'] });
    if (!student || student.teacherId !== teacher.id) throw new ForbiddenException('Это не ваш ученик');
    const payment = this.paymentRepo.create({
      teacherId: teacher.id,
      studentId: student.id,
      amount: dto.amount.toFixed(2),
      dueAt: new Date(dto.dueAt),
      status: PaymentStatus.PENDING,
      description: dto.description?.trim() || null,
      externalId: dto.externalId?.trim() || null,
    });
    const saved = await this.paymentRepo.save(payment);
    if (student.userId) await this.notifications.notifyPaymentDue(student.userId, saved);
    return this.serialize(saved);
  }

  async update(user: User, id: string, dto: UpdatePaymentDto) {
    const teacher = await this.teacher(user);
    const payment = await this.paymentRepo.findOne({ where: { id }, relations: ['student', 'student.user'] });
    if (!payment) throw new NotFoundException('Платёж не найден');
    if (payment.teacherId !== teacher.id) throw new ForbiddenException();
    payment.status = dto.status;
    if (dto.dueAt !== undefined) payment.dueAt = new Date(dto.dueAt);
    if (dto.amount !== undefined) payment.amount = dto.amount.toFixed(2);
    if (dto.description !== undefined) payment.description = dto.description.trim() || null;
    payment.paidAt = dto.status === PaymentStatus.PAID ? payment.paidAt ?? new Date() : null;
    const saved = await this.paymentRepo.save(payment);
    if (dto.status === PaymentStatus.PAID && payment.student?.userId) await this.notifications.notifyPaymentPaid(payment.student.userId, saved);
    return this.serialize(saved);
  }

  @Cron(CronExpression.EVERY_HOUR)
  async markOverdue() {
    const overdue = await this.paymentRepo.find({ where: { status: PaymentStatus.PENDING }, relations: ['student', 'student.user'] });
    for (const payment of overdue) {
      if (payment.dueAt.getTime() >= Date.now()) continue;
      payment.status = PaymentStatus.OVERDUE;
      await this.paymentRepo.save(payment);
      if (payment.student?.userId) await this.notifications.notifyPaymentDue(payment.student.userId, payment);
    }
  }

  async listForStudentId(studentId: string) {
    const rows = await this.paymentRepo.find({ where: { studentId }, order: { dueAt: 'DESC', createdAt: 'DESC' } });
    return rows.map((row) => this.serialize(row));
  }

  private async teacher(user: User) {
    if (user.role !== UserRole.TEACHER) throw new ForbiddenException();
    const teacher = await this.teacherRepo.findOneBy({ userId: user.id });
    if (!teacher) throw new NotFoundException('Преподаватель не найден');
    return teacher;
  }

  private async student(user: User) {
    if (user.role !== UserRole.STUDENT) throw new ForbiddenException();
    const student = await this.studentRepo.findOneBy({ userId: user.id });
    if (!student) throw new NotFoundException('Ученик не найден');
    return student;
  }

  private serialize(payment: Payment) {
    return {
      id: payment.id,
      studentId: payment.studentId,
      teacherId: payment.teacherId,
      amount: Number(payment.amount),
      currency: payment.currency,
      dueAt: payment.dueAt,
      paidAt: payment.paidAt,
      status: payment.status,
      description: payment.description,
      externalId: payment.externalId,
      student: payment.student ? { id: payment.student.id, user: payment.student.user } : undefined,
      teacher: payment.teacher ? { id: payment.teacher.id, user: payment.teacher.user } : undefined,
      createdAt: payment.createdAt,
    };
  }
}
