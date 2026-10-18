import { LessonProcessingService } from './lesson-processing.service';
import { LessonStatus } from './entities/lesson.entity';
import { ComputeJobStatus } from './entities/compute-job.entity';

describe('LessonProcessingService local compute queue', () => {
  it('reopens a completed queue row when a lesson is processed again', async () => {
    const computeJobRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 'job-id',
        lessonId: 'lesson-id',
        status: ComputeJobStatus.COMPLETED,
      }),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const storage = {
      deleteObject: jest.fn().mockResolvedValue(undefined),
    };
    const lessonRepo = { update: jest.fn().mockResolvedValue({ affected: 1 }) };
    const service = new LessonProcessingService(
      {} as any,
      storage as any,
      {} as any,
      {} as any,
      lessonRepo as any,
      {} as any,
      {} as any,
      computeJobRepo as any,
      {} as any,
    );

    await (service as any).enqueueLocalComputeJob(
      {
        id: 'lesson-id',
        recordingObjectKey: 'lessons/lesson-id/recording.webm',
        slot: { note: 'Повторение' },
        status: LessonStatus.PROCESSING,
      },
      'lease-id',
    );

    expect(computeJobRepo.update).toHaveBeenCalledWith(
      'job-id',
      expect.objectContaining({
        status: ComputeJobStatus.PENDING,
        attempts: 0,
        leaseToken: null,
        retryAt: null,
      }),
    );
    expect(lessonRepo.update).toHaveBeenCalled();
  });

  it('claims one job and returns the authenticated recording endpoint', async () => {
    const claimed = {
      id: 'job-id',
      lessonId: 'lesson-id',
      lessonNote: 'Fractions',
    };
    const manager = {
      query: jest
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([claimed])
        .mockResolvedValueOnce([]),
    };
    const dataSource = {
      transaction: jest.fn((work) => work(manager)),
    };
    const service = new LessonProcessingService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      dataSource as any,
    );

    const result = await service.claimLocalComputeJob();

    expect(result).toEqual({
      ...claimed,
      leaseToken: expect.any(String),
      recordingPath: '/api/compute/jobs/job-id/recording',
      transcriptPath: '/api/compute/jobs/job-id/transcript',
    });
    expect(manager.query).toHaveBeenCalledTimes(3);
    expect(manager.query.mock.calls[1][0]).toContain('FOR UPDATE SKIP LOCKED');
  });

  it('returns no job when the queue is empty', async () => {
    const manager = {
      query: jest.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([]),
    };
    const service = new LessonProcessingService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      { transaction: (work) => work(manager) } as any,
    );

    await expect(service.claimLocalComputeJob()).resolves.toBeNull();
  });
});
