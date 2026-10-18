import { ReminderScheduler } from './reminder.scheduler';
import { HomeworkStatus } from '../learning/entities/learning.entity';

describe('ReminderScheduler homework deadlines', () => {
  it('claims a published assignment before notifying the student and parent', async () => {
    const dueAt = new Date(Date.now() + 24 * 60 * 60_000);
    const bookingRepo = { find: jest.fn().mockResolvedValue([]), update: jest.fn() };
    const homeworkRepo = {
      find: jest.fn().mockResolvedValue([
        {
          id: 'assignment-id',
          status: HomeworkStatus.PUBLISHED,
          dueAt,
          student: {
            userId: 'student-user-id',
            parentEmail: 'parent@example.com',
            user: { firstName: 'Иван', lastName: 'Иванов' },
          },
          lesson: { slot: { note: 'Уравнения' } },
        },
      ]),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const notifications = { notifyHomeworkDue: jest.fn().mockResolvedValue(undefined) };
    const scheduler = new ReminderScheduler(
      bookingRepo as any,
      homeworkRepo as any,
      notifications as any,
    );

    await scheduler.sendDueReminders();

    expect(homeworkRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: HomeworkStatus.PUBLISHED }),
      }),
    );
    expect(homeworkRepo.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'assignment-id' }),
      expect.objectContaining({ dueReminderSentAt: expect.any(Date) }),
    );
    expect(notifications.notifyHomeworkDue).toHaveBeenCalledWith(
      'student-user-id',
      'parent@example.com',
      'Иван Иванов',
      'assignment-id',
      'Уравнения',
      dueAt,
    );
  });

  it('does not send when another scheduler already claimed the assignment', async () => {
    const dueAt = new Date(Date.now() + 24 * 60 * 60_000);
    const bookingRepo = { find: jest.fn().mockResolvedValue([]), update: jest.fn() };
    const homeworkRepo = {
      find: jest.fn().mockResolvedValue([
        {
          id: 'assignment-id',
          status: HomeworkStatus.PUBLISHED,
          dueAt,
          student: { userId: 'student-user-id' },
        },
      ]),
      update: jest.fn().mockResolvedValue({ affected: 0 }),
    };
    const notifications = { notifyHomeworkDue: jest.fn() };
    const scheduler = new ReminderScheduler(
      bookingRepo as any,
      homeworkRepo as any,
      notifications as any,
    );

    await scheduler.sendDueReminders();

    expect(notifications.notifyHomeworkDue).not.toHaveBeenCalled();
  });
});
