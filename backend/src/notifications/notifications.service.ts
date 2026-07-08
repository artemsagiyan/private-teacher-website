import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as nodemailer from 'nodemailer';
import { Notification, NotificationType } from './entities/notification.entity';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private transporter: nodemailer.Transporter;

  constructor(
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
    private configService: ConfigService,
  ) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('smtp.host'),
      port: this.configService.get<number>('smtp.port'),
      auth: {
        user: this.configService.get<string>('smtp.user'),
        pass: this.configService.get<string>('smtp.pass'),
      },
    });
  }

  async create(userId: string, type: NotificationType, message: string, relatedId?: string) {
    const notification = this.notificationRepository.create({
      userId,
      type,
      message,
      relatedId,
    });
    return this.notificationRepository.save(notification);
  }

  async getForUser(userId: string) {
    return this.notificationRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async markAsRead(userId: string, notificationId: string) {
    await this.notificationRepository.update(
      { id: notificationId, userId },
      { isRead: true },
    );
  }

  async markAllAsRead(userId: string) {
    await this.notificationRepository.update({ userId, isRead: false }, { isRead: true });
  }

  async getUnreadCount(userId: string) {
    return this.notificationRepository.count({ where: { userId, isRead: false } });
  }

  async notifyBookingConfirmed(userId: string, startTime: Date) {
    const message = `Запись подтверждена: ${this.formatDate(startTime)}`;
    await this.create(userId, NotificationType.BOOKING_CONFIRMED, message);
    await this.sendEmail(userId, 'Запись подтверждена', message);
  }

  async notifyBookingCancelled(userId: string, startTime: Date) {
    const message = `Занятие отменено: ${this.formatDate(startTime)}`;
    await this.create(userId, NotificationType.BOOKING_CANCELLED, message);
    await this.sendEmail(userId, 'Занятие отменено', message);
  }

  async notifyTeacherNewStudent(teacherUserId: string, studentName: string) {
    const message = `Новый ученик привязан к вам: ${studentName}`;
    await this.create(teacherUserId, NotificationType.TEACHER_INVITATION, message);
  }

  async notifyTeacherNewBooking(teacherUserId: string, startTime: Date) {
    const message = `Новая запись на занятие: ${this.formatDate(startTime)}`;
    await this.create(teacherUserId, NotificationType.BOOKING_CONFIRMED, message);
  }

  async sendReminder24h(userId: string, startTime: Date) {
    const message = `Напоминание: занятие завтра в ${this.formatDate(startTime)}`;
    await this.create(userId, NotificationType.REMINDER_24H, message);
    await this.sendEmail(userId, 'Напоминание о занятии', message);
  }

  async sendReminder1h(userId: string, startTime: Date) {
    const message = `Напоминание: занятие через 1 час — ${this.formatDate(startTime)}`;
    await this.create(userId, NotificationType.REMINDER_1H, message);
    await this.sendEmail(userId, 'Занятие через 1 час', message);
  }

  async sendWelcomeEmail(email: string, firstName: string) {
    await this.sendEmailDirect(
      email,
      'Добро пожаловать на платформу!',
      `Привет, ${firstName}! Рады видеть вас на нашей платформе.`,
    );
  }

  private async sendEmail(userId: string, subject: string, text: string) {
    this.logger.log(`[EMAIL] userId=${userId}: ${subject}`);
  }

  private async sendEmailDirect(to: string, subject: string, text: string) {
    try {
      await this.transporter.sendMail({
        from: this.configService.get<string>('smtp.from'),
        to,
        subject,
        text,
      });
    } catch (err) {
      this.logger.error('Failed to send email', err);
    }
  }

  private formatDate(date: Date) {
    return new Intl.DateTimeFormat('ru-RU', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  }
}
