import { FamilyService } from './family.service';
import { BookingStatus } from '../bookings/entities/booking.entity';

describe('FamilyService', () => {
  it('shows every booked lesson, including visits without a lesson report', async () => {
    const today = Date.now();
    const bookings = [
      {
        id: 'visited-booking',
        status: BookingStatus.COMPLETED,
        slot: {
          startTime: new Date(today - 2 * 24 * 60 * 60_000),
          note: 'Уравнения',
          lesson: {
            id: 'visited-lesson',
            status: 'completed',
            startedAt: new Date(today - 2 * 24 * 60 * 60_000),
            participantCount: 0,
            report: { summary: 'Повторили уравнения' },
          },
        },
      },
      {
        id: 'missed-booking',
        status: BookingStatus.COMPLETED,
        slot: {
          startTime: new Date(today - 24 * 60 * 60_000),
          note: 'Геометрия',
          lesson: undefined,
        },
      },
      {
        id: 'upcoming-booking',
        status: BookingStatus.CONFIRMED,
        slot: {
          startTime: new Date(today + 24 * 60 * 60_000),
          note: 'Вероятность',
          lesson: undefined,
        },
      },
    ];
    const bookingRepo = { find: jest.fn().mockResolvedValue(bookings) };
    const service = new FamilyService(
      {} as any,
      bookingRepo as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const result = await (service as any).lessons('student-id');

    expect(bookingRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        relations: ['slot', 'slot.lesson'],
        take: 200,
      }),
    );
    expect(result).toHaveLength(3);
    expect(result.map((item: any) => item.id)).toEqual([
      'upcoming-booking',
      'missed-booking',
      'visited-booking',
    ]);
    expect(result.find((item: any) => item.id === 'visited-booking')).toEqual(
      expect.objectContaining({
        lessonId: 'visited-lesson',
        attendanceStatus: 'attended',
        report: { summary: 'Повторили уравнения' },
      }),
    );
    expect(result.find((item: any) => item.id === 'missed-booking')).toEqual(
      expect.objectContaining({
        lessonId: null,
        attendanceStatus: 'not_attended',
        report: null,
      }),
    );
    expect(result.find((item: any) => item.id === 'upcoming-booking')).toEqual(
      expect.objectContaining({
        attendanceStatus: 'scheduled',
        report: null,
      }),
    );
  });

  it('keeps family messages scoped to the teacher-owned student', async () => {
    const message = {
      id: 'message-id',
      senderType: 'teacher',
      senderName: 'Анна Учитель',
      body: 'До встречи на уроке',
      createdAt: new Date('2026-10-11T10:00:00Z'),
    };
    const messageRepo = {
      create: jest.fn().mockReturnValue(message),
      save: jest.fn().mockResolvedValue(message),
    };
    const notifications = { notifyFamilyMessage: jest.fn().mockResolvedValue(undefined) };
    const studentRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 'student-id',
        teacherId: 'teacher-id',
        teacher: { userId: 'teacher-user-id' },
        userId: 'student-user-id',
        parentEmail: 'parent@example.com',
      }),
    };
    const service = new FamilyService(
      studentRepo as any,
      {} as any,
      {} as any,
      messageRepo as any,
      {} as any,
      {} as any,
      notifications as any,
    );

    const result = await service.sendTeacherMessage(
      {
        id: 'teacher-user-id',
        role: 'teacher',
        firstName: 'Анна',
        lastName: 'Учитель',
      } as any,
      'student-id',
      '  До встречи на уроке  ',
    );

    expect(result).toEqual(message);
    expect(messageRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        studentId: 'student-id',
        teacherId: 'teacher-id',
        senderType: 'teacher',
        body: 'До встречи на уроке',
      }),
    );
    expect(notifications.notifyFamilyMessage).toHaveBeenCalledWith(
      'student-user-id',
      'parent@example.com',
      'преподавателя',
      'message-id',
    );
  });
});
