import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as nodemailer from 'nodemailer';
import { Notification, NotificationType } from './entities/notification.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private configService: ConfigService,
  ) {
    const user = this.configService.get<string>('smtp.user');
    const pass = this.configService.get<string>('smtp.pass');
    if (user && pass) {
      this.transporter = nodemailer.createTransport({
        host: this.configService.get<string>('smtp.host'),
        port: this.configService.get<number>('smtp.port'),
        auth: { user, pass },
      });
    }
  }

  async create(
    userId: string,
    type: NotificationType,
    message: string,
    relatedId?: string,
  ) {
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
    await this.notificationRepository.update(
      { userId, isRead: false },
      { isRead: true },
    );
  }

  async getUnreadCount(userId: string) {
    return this.notificationRepository.count({
      where: { userId, isRead: false },
    });
  }

  async notifyBookingConfirmed(userId: string, startTime: Date) {
    const message = `Запись подтверждена: ${this.formatDate(startTime)}`;
    await this.create(userId, NotificationType.BOOKING_CONFIRMED, message);
    await this.sendEmail(
      userId,
      'Запись подтверждена',
      message,
      this.wrapHtml('Запись подтверждена', `<p>${message}</p>`),
    );
  }

  async notifyBookingCancelled(userId: string, startTime: Date) {
    const message = `Занятие отменено: ${this.formatDate(startTime)}`;
    await this.create(userId, NotificationType.BOOKING_CANCELLED, message);
    await this.sendEmail(
      userId,
      'Занятие отменено',
      message,
      this.wrapHtml('Занятие отменено', `<p>${message}</p>`),
    );
  }

  async notifyTeacherBookingCancelledByStudent(
    teacherUserId: string,
    startTime: Date,
  ) {
    const message = `Ученик отменил занятие: ${this.formatDate(startTime)}`;
    await this.create(
      teacherUserId,
      NotificationType.BOOKING_CANCELLED,
      message,
    );
    await this.sendEmail(
      teacherUserId,
      'Ученик отменил занятие',
      message,
      this.wrapHtml('Отмена занятия', `<p>${message}</p>`),
    );
  }

  async notifyTeacherNewStudent(teacherUserId: string, studentName: string) {
    const message = `Новый ученик привязан к вам: ${studentName}`;
    await this.create(
      teacherUserId,
      NotificationType.TEACHER_INVITATION,
      message,
    );
  }

  async notifyTeacherNewBooking(teacherUserId: string, startTime: Date) {
    const message = `Новая запись на занятие: ${this.formatDate(startTime)}`;
    await this.create(
      teacherUserId,
      NotificationType.BOOKING_CONFIRMED,
      message,
    );
  }

  async notifyLessonReportReady(
    userId: string,
    lessonId: string,
    startTime?: Date,
  ) {
    const when = startTime ? ` (${this.formatDate(startTime)})` : '';
    const message = `Готов отчёт по уроку${when}`;
    await this.create(
      userId,
      NotificationType.LESSON_REPORT_READY,
      message,
      lessonId,
    );
    await this.sendEmail(
      userId,
      'Отчёт по уроку готов',
      message,
      this.wrapHtml('Отчёт готов', `<p>${message}</p>`),
    );
  }

  async notifyLessonFailed(userId: string, lessonId: string, reason?: string) {
    const message = reason
      ? `Не удалось обработать урок: ${reason}`
      : 'Не удалось обработать запись урока';
    await this.create(
      userId,
      NotificationType.LESSON_FAILED,
      message,
      lessonId,
    );
    await this.sendEmail(
      userId,
      'Обработка урока не удалась',
      message,
      this.wrapHtml('Ошибка обработки', `<p>${message}</p>`),
    );
  }

  async sendReminder24h(userId: string, startTime: Date) {
    const message = `Напоминание: занятие завтра в ${this.formatDate(startTime)}`;
    await this.create(userId, NotificationType.REMINDER_24H, message);
    await this.sendEmail(
      userId,
      'Напоминание о занятии',
      message,
      this.wrapHtml('Напоминание', `<p>${message}</p>`),
    );
  }

  async sendReminder1h(userId: string, startTime: Date) {
    const message = `Напоминание: занятие через 1 час — ${this.formatDate(startTime)}`;
    await this.create(userId, NotificationType.REMINDER_1H, message);
    await this.sendEmail(
      userId,
      'Занятие через 1 час',
      message,
      this.wrapHtml('Напоминание', `<p>${message}</p>`),
    );
  }

  async sendWelcomeEmail(email: string, firstName: string) {
    await this.sendEmailDirect(
      email,
      'Добро пожаловать на платформу!',
      `Привет, ${firstName}! Рады видеть вас на нашей платформе.`,
      this.wrapHtml(
        'Добро пожаловать',
        `<p>Привет, ${firstName}!</p><p>Рады видеть вас на нашей платформе.</p>`,
      ),
    );
  }

  async sendPasswordResetEmail(email: string, link: string) {
    await this.sendEmailDirect(
      email,
      'Сброс пароля',
      `Перейдите по ссылке, чтобы задать новый пароль: ${link}`,
      this.wrapHtml(
        'Сброс пароля',
        `<p>Перейдите по ссылке, чтобы задать новый пароль:</p><p><a href="${link}">${link}</a></p><p>Ссылка действует 1 час.</p>`,
      ),
    );
  }

  private async sendEmail(
    userId: string,
    subject: string,
    text: string,
    html?: string,
  ) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user?.email) {
      this.logger.warn(`No email for user ${userId}`);
      return;
    }
    await this.sendEmailDirect(user.email, subject, text, html);
  }

  private async sendEmailDirect(
    to: string,
    subject: string,
    text: string,
    html?: string,
  ) {
    const smtpDisabled = this.configService.get<boolean>('smtpDisabled');
    if (smtpDisabled || !this.transporter) {
      this.logger.log(`[EMAIL skipped] to=${to}: ${subject}`);
      return;
    }
    if (
      this.configService.get<string>('nodeEnv') === 'production' &&
      !this.configService.get<string>('smtp.user')
    ) {
      this.logger.error('SMTP is not configured in production');
      return;
    }
    try {
      await this.transporter.sendMail({
        from: this.configService.get<string>('smtp.from'),
        to,
        subject,
        text,
        html,
      });
    } catch (err) {
      this.logger.error('Failed to send email', err);
    }
  }

  private wrapHtml(title: string, body: string) {
    return `<!DOCTYPE html><html><body style="font-family:sans-serif;color:#111">
      <h2>${title}</h2>${body}
      <p style="color:#666;font-size:12px">TutorPlatform · easyphys.ru</p>
    </body></html>`;
  }

  formatDate(date: Date) {
    return new Intl.DateTimeFormat('ru-RU', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Europe/Moscow',
    }).format(date);
  }
}
