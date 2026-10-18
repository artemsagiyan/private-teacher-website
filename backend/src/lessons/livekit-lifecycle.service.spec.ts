import { LivekitLifecycleService } from './livekit-lifecycle.service';
import { LessonStatus } from './entities/lesson.entity';

describe('LivekitLifecycleService', () => {
  it('starts recording when a single authenticated participant joins', async () => {
    const lesson = {
      id: 'lesson-id',
      roomName: 'lesson-room',
      status: LessonStatus.WAITING,
      startedAt: null,
      lastParticipantLeftAt: null,
      teacher: { userId: 'teacher-user-id' },
    };
    const lessonRepo = { update: jest.fn().mockResolvedValue({ affected: 1 }) };
    const service = new LivekitLifecycleService(
      { get: jest.fn((key: string) => ({
        'livekit.apiKey': 'devkey',
        'livekit.apiSecret': 'devsecret',
        'livekit.url': 'http://localhost:7880',
      })[key]) } as any,
      { findByRoomName: jest.fn().mockResolvedValue(lesson) } as any,
      lessonRepo as any,
      { count: jest.fn().mockResolvedValue(1) } as any,
    );
    (service as any).roomClient = {
      listParticipants: jest.fn().mockResolvedValue([
        { identity: 'student-user-id' },
      ]),
    };
    const startRecording = jest.fn().mockResolvedValue(undefined);
    (service as any).startRecording = startRecording;

    await (service as any).reconcileParticipantCount('lesson-room');

    expect(lessonRepo.update).toHaveBeenCalledWith(
      'lesson-id',
      expect.objectContaining({
        participantCount: 1,
        startedAt: expect.any(Date),
      }),
    );
    expect(startRecording).toHaveBeenCalledWith(
      expect.objectContaining({ startedAt: expect.any(Date) }),
    );
  });

  it('ignores camera identities when reconciling participants', async () => {
    const lesson = {
      id: 'lesson-id',
      roomName: 'lesson-room',
      status: LessonStatus.ACTIVE,
      startedAt: new Date(),
      lastParticipantLeftAt: null,
    };
    const lessonRepo = { update: jest.fn().mockResolvedValue({ affected: 1 }) };
    const userRepo = {
      exists: jest.fn().mockImplementation(({ where }: any) =>
        Promise.resolve(where.id === 'student-id'),
      ),
    };
    const service = new LivekitLifecycleService(
      { get: jest.fn((key: string) => ({
        'livekit.apiKey': 'devkey',
        'livekit.apiSecret': 'devsecret',
        'livekit.url': 'http://localhost:7880',
      })[key]) } as any,
      { findByRoomName: jest.fn().mockResolvedValue(lesson) } as any,
      lessonRepo as any,
      userRepo as any,
    );
    (service as any).roomClient = {
      listParticipants: jest.fn().mockResolvedValue([
        { identity: 'camera-phone-1' },
        { identity: 'student-id' },
      ]),
    };

    await (service as any).reconcileParticipantCount('lesson-room');

    expect(userRepo.exists).toHaveBeenCalledTimes(1);
    expect(lessonRepo.update).toHaveBeenCalledWith(
      'lesson-id',
      expect.objectContaining({ participantCount: 1 }),
    );
  });
});
