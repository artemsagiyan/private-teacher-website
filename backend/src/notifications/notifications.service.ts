import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as nodemailer from 'nodemailer';
import { Notification, NotificationType } from './entities/notification.entity';
import { LessonReport } from '../lessons/entities/lesson.entity';
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

  async deliverLessonToFamily(input: {
    studentUserId?: string;
    parentEmail?: string | null;
    studentName: string;
    lessonId: string;
    startTime?: Date;
    report: LessonReport;
  }) {
    const when = input.startTime ? this.formatDate(input.startTime) : '';
    const link = `${this.configService.get<string>('frontendUrl')}/dashboard/lessons/${input.lessonId}`;
    const reportHtml = this.reportHtml(input.studentName, when, input.report, link);
    const reportText = this.reportText(input.studentName, when, input.report, link);

    if (input.studentUserId) {
      await this.create(
        input.studentUserId,
        NotificationType.LESSON_REPORT_READY,
        `Готов отчёт по уроку${when ? ` (${when})` : ''}`,
        input.lessonId,
      );
      await this.sendEmail(
        input.studentUserId,
        'Отчёт по уроку',
        reportText,
        reportHtml,
      );
    }

    if (input.parentEmail) {
      await this.sendEmailDirect(
        input.parentEmail,
        `Отчёт об уроке: ${input.studentName}`,
        reportText,
        reportHtml,
      );
    }

    await this.deliverHomework(input);
  }

  async deliverHomework(input: {
    studentUserId?: string;
    parentEmail?: string | null;
    studentName: string;
    lessonId: string;
    startTime?: Date;
    report: Pick<LessonReport, 'homework'>;
  }) {
    const homework = input.report.homework.filter((item) => item.trim());
    if (!homework.length) return;

    const when = input.startTime ? this.formatDate(input.startTime) : '';
    const link = `${this.configService.get<string>('frontendUrl')}/dashboard/lessons/${input.lessonId}`;
    const html = this.homeworkHtml(input.studentName, when, homework, link);
    const text = [
      `Домашнее задание для ${input.studentName}${when ? ` (${when})` : ''}:`,
      ...homework.map((item, index) => `${index + 1}. ${item}`),
      '',
      link,
    ].join('\n');

    if (input.studentUserId) {
      await this.create(
        input.studentUserId,
        NotificationType.HOMEWORK_ASSIGNED,
        `Домашнее задание: ${homework[0]}`,
        input.lessonId,
      );
      await this.sendEmail(
        input.studentUserId,
        'Домашнее задание',
        text,
        html,
      );
    }
    if (input.parentEmail) {
      await this.sendEmailDirect(
        input.parentEmail,
        `Домашнее задание: ${input.studentName}`,
        text,
        html,
      );
    }
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

  private reportText(
    studentName: string,
    when: string,
    report: LessonReport,
    link: string,
  ) {
    const lines = [
      `Отчёт об уроке: ${studentName}${when ? ` (${when})` : ''}`,
      '',
      report.summary,
      this.lines('Темы', report.topics),
      this.lines('Что получилось', report.achievements),
      this.lines('Сложности', report.difficulties),
      this.lines('Домашнее задание', report.homework),
      this.lines('К следующему уроку', report.recommendations),
      '',
      `Открыть в кабинете: ${link}`,
    ];
    return lines.filter((line) => line !== undefined).join('\n');
  }

  private lines(title: string, items: string[]) {
    if (!items.length) return '';
    return `\n${title}:\n${items.map((item) => `• ${item}`).join('\n')}`;
  }

  private reportHtml(
    studentName: string,
    when: string,
    report: LessonReport,
    link: string,
  ) {
    const section = (title: string, items: string[]) =>
      items.length
        ? `<h3>${title}</h3><ul>${items.map((item) => `<li>${this.escapeHtml(item)}</li>`).join('')}</ul>`
        : '';
    return this.wrapHtml(
      `Урок: ${this.escapeHtml(studentName)}`,
      `<p>${when ? this.escapeHtml(when) : ''}</p>
       <p>${this.escapeHtml(report.summary)}</p>
       ${section('Темы', report.topics)}
       ${section('Что получилось', report.achievements)}
       ${section('Сложности', report.difficulties)}
       ${section('Домашнее задание', report.homework)}
       ${section('К следующему уроку', report.recommendations)}
       <p><a href="${link}">Открыть отчёт на сайте</a></p>`,
    );
  }

  private homeworkHtml(
    studentName: string,
    when: string,
    homework: string[],
    link: string,
  ) {
    return this.wrapHtml(
      `Домашнее задание: ${this.escapeHtml(studentName)}`,
      `<p>${when ? this.escapeHtml(when) : ''}</p>
       <ol>${homework.map((item) => `<li>${this.escapeHtml(item)}</li>`).join('')}</ol>
       <p><a href="${link}">Открыть урок</a></p>`,
    );
  }

  private escapeHtml(value: string) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
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
