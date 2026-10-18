import { VideoService } from './video.service';
import { LessonStatus } from '../lessons/entities/lesson.entity';
import { SlotStatus } from '../calendar/entities/calendar-slot.entity';

describe('VideoService', () => {
  it.each([
    ['a day before the scheduled start', 24 * 60 * 60_000],
    ['after the scheduled end', -24 * 60 * 60_000],
  ])('issues a token %s', async (_label, offset) => {
    const now = Date.now();
    const slot = {
      id: 'slot-id',
      status: SlotStatus.BOOKED,
      startTime: new Date(now + offset),
      endTime: new Date(now + offset + 60 * 60_000),
    };
    const lesson = { id: 'lesson-id', roomName: 'lesson-room', status: LessonStatus.WAITING };
    const config = {
      get: jest.fn((key: string) =>
        ({
          'livekit.apiKey': 'devkey',
          'livekit.apiSecret': 'devsecret',
          'livekit.publicUrl': 'ws://localhost:7880',
          'jwt.secret': 'test-camera-signing-secret',
        })[key],
      ),
    };
    const lessons = { ensureForSlot: jest.fn().mockResolvedValue(lesson) };
    const lifecycle = { ensureRoom: jest.fn().mockResolvedValue(undefined) };
    const service = new VideoService(
      config as any,
      { findOne: jest.fn().mockResolvedValue({ id: 'booking-id' }) } as any,
      { findOne: jest.fn().mockResolvedValue(slot) } as any,
      { findOne: jest.fn().mockResolvedValue({ id: 'student-id' }) } as any,
      {} as any,
      lessons as any,
      lifecycle as any,
    );

    const result = await service.getToken('student-user-id', 'student', 'slot-id');

    expect(result.lessonId).toBe('lesson-id');
    expect(lifecycle.ensureRoom).toHaveBeenCalledWith(lesson);
  });

  it('issues a reusable lesson camera link and camera-only publish token', async () => {
    const lesson = {
      id: 'lesson-id',
      teacherId: 'teacher-id',
      roomName: 'lesson-room',
      status: LessonStatus.ACTIVE,
    };
    const config = {
      get: jest.fn((key: string) =>
        ({
          'livekit.apiKey': 'devkey',
          'livekit.apiSecret': 'devsecret',
          'livekit.publicUrl': 'ws://localhost:7880',
          'jwt.secret': 'test-camera-signing-secret',
        })[key],
      ),
    };
    const lessons = {
      assertTeacherOwns: jest.fn().mockResolvedValue(lesson),
      findByRoomName: jest.fn().mockResolvedValue(lesson),
    };
    const lifecycle = { ensureRoom: jest.fn().mockResolvedValue(undefined) };
    const service = new VideoService(
      config as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      lessons as any,
      lifecycle as any,
    );

    const link = await service.createCameraLink(
      { id: 'teacher-user-id', role: 'teacher' } as any,
      lesson.id,
    );
    const camera = await service.consumeCameraLink(link.code);
    const reconnectedCamera = await service.consumeCameraLink(link.code);
    const claims = JSON.parse(
      Buffer.from(camera.token.split('.')[1], 'base64url').toString('utf8'),
    );

    expect(camera.url).toBe('ws://localhost:7880');
    expect(claims.video).toMatchObject({
      roomJoin: true,
      room: lesson.roomName,
      canPublish: true,
      canPublishSources: ['camera'],
      canSubscribe: false,
      canPublishData: false,
    });
    expect(reconnectedCamera.lessonId).toBe(lesson.id);
    expect(Date.parse(link.expiresAt) - Date.now()).toBeGreaterThan(
      7 * 60 * 60_000,
    );
  });

  it('rejects modified and expired camera links', async () => {
    const lesson = {
      id: 'lesson-id',
      teacherId: 'teacher-id',
      roomName: 'lesson-room',
      status: LessonStatus.ACTIVE,
    };
    const config = {
      get: jest.fn((key: string) =>
        ({
          'livekit.apiKey': 'devkey',
          'livekit.apiSecret': 'devsecret',
          'livekit.publicUrl': 'ws://localhost:7880',
          'jwt.secret': 'test-camera-signing-secret',
        })[key],
      ),
    };
    const lessons = {
      assertTeacherOwns: jest.fn().mockResolvedValue(lesson),
      findByRoomName: jest.fn().mockResolvedValue(lesson),
    };
    const lifecycle = { ensureRoom: jest.fn().mockResolvedValue(undefined) };
    const service = new VideoService(
      config as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      lessons as any,
      lifecycle as any,
    );

    const link = await service.createCameraLink(
      { id: 'teacher-user-id', role: 'teacher' } as any,
      lesson.id,
    );
    const [payload, signature] = link.code.split('.');
    const changedSignature = `${payload}.${signature.slice(0, -1)}${signature.endsWith('a') ? 'b' : 'a'}`;
    await expect(service.consumeCameraLink(changedSignature)).rejects.toThrow(
      'недействительна или устарела',
    );

    jest.useFakeTimers().setSystemTime(Date.now() + 9 * 60 * 60_000);
    await expect(service.consumeCameraLink(link.code)).rejects.toThrow(
      'недействительна или устарела',
    );
    jest.useRealTimers();
  });

  it('refuses a reusable camera link when its lesson ended', async () => {
    const lesson = {
      id: 'lesson-id',
      teacherId: 'teacher-id',
      roomName: 'lesson-room',
      status: LessonStatus.ACTIVE,
    };
    const config = {
      get: jest.fn((key: string) =>
        ({
          'livekit.apiKey': 'devkey',
          'livekit.apiSecret': 'devsecret',
          'livekit.publicUrl': 'ws://localhost:7880',
          'jwt.secret': 'test-camera-signing-secret',
        })[key],
      ),
    };
    const lessons = {
      assertTeacherOwns: jest.fn().mockResolvedValue(lesson),
      findByRoomName: jest.fn().mockResolvedValue({
        ...lesson,
        status: LessonStatus.COMPLETED,
      }),
    };
    const lifecycle = { ensureRoom: jest.fn().mockResolvedValue(undefined) };
    const service = new VideoService(
      config as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      lessons as any,
      lifecycle as any,
    );

    const link = await service.createCameraLink(
      { id: 'teacher-user-id', role: 'teacher' } as any,
      lesson.id,
    );
    await expect(service.consumeCameraLink(link.code)).rejects.toThrow(
      'Этот урок уже завершён',
    );
  });
});
