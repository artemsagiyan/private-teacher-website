import { LessonProcessingService } from './lesson-processing.service';
import { LessonStatus } from './entities/lesson.entity';

describe('LessonProcessingService', () => {
  it('transcribes a saved recording, generates a report, and persists both artifacts', async () => {
    const storage = {
      exists: jest.fn().mockResolvedValue(true),
      presignedGetUrl: jest.fn().mockResolvedValue('https://storage.test/audio.ogg'),
      putText: jest.fn().mockResolvedValue(undefined),
      putJson: jest.fn().mockResolvedValue(undefined),
    };
    const lessonRepo = {
      exists: jest.fn().mockResolvedValue(true),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const lessons = { markBookingsCompleted: jest.fn().mockResolvedValue(undefined) };
    const notifications = {
      notifyLessonReportReady: jest.fn().mockResolvedValue(undefined),
    };
    const learning = {
      createDraftsForLesson: jest.fn().mockResolvedValue(undefined),
    };
    const configValues: Record<string, string | number> = {
      'compute.mode': 'local',
      'compute.apiUrl': '',
      'transcription.url': 'http://transcriber.test',
      'transcription.language': 'ru',
      'ollama.url': 'http://ollama.test',
      'ollama.model': 'qwen2.5:3b',
      'ollama.contextWindow': 8192,
    };
    const service = new LessonProcessingService(
      { get: jest.fn((key: string) => configValues[key]) } as any,
      storage as any,
      lessons as any,
      notifications as any,
      lessonRepo as any,
      {} as any,
      learning as any,
    );
    const report = {
      summary: 'Решали уравнения с дробями.',
      topics: ['Уравнения с дробями'],
      achievements: ['Ученик решил уравнение самостоятельно'],
      difficulties: [],
      homework: ['Решить задачи 1–3'],
      recommendations: ['Повторить проверку решения'],
      keyMoments: [{ time: '00:12:00', description: 'Самостоятельное решение' }],
    };
    const originalFetch = global.fetch;
    const fetchMock = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/transcribe')) {
        return new Response(
          JSON.stringify({
            text: 'Решим уравнение с дробями. На дом задачи с первого по третий номер.',
            language: 'ru',
            duration: 1800,
            segments: [
              { start: 12, end: 20, text: 'Решим уравнение с дробями.' },
              { start: 1750, end: 1760, text: 'На дом задачи с первого по третий номер.' },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (url.endsWith('/api/generate')) {
        return new Response(JSON.stringify({ response: JSON.stringify(report) }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`Unexpected URL in report processing test: ${url}`);
    });
    global.fetch = fetchMock as any;
    const lesson = {
      id: 'lesson-audio-id',
      slotId: 'slot-id',
      status: LessonStatus.PROCESSING,
      startedAt: new Date(),
      endedAt: new Date(),
      recordingObjectKey: 'lessons/lesson-audio-id/audio.ogg',
      transcriptObjectKey: null,
      transcriptLanguage: null,
      transcriptDurationSeconds: null,
      processingAttempts: 0,
      teacher: { userId: 'teacher-user-id' },
      slot: { note: 'Обыкновенные дроби', startTime: new Date() },
    };

    try {
      await (service as any).processOne(lesson, 'lease-id');
    } finally {
      global.fetch = originalFetch;
    }

    expect(storage.presignedGetUrl).toHaveBeenCalledWith(
      'lessons/lesson-audio-id/audio.ogg',
      4 * 60 * 60,
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(storage.putText).toHaveBeenCalledWith(
      'lessons/lesson-audio-id/transcript.txt',
      '[00:00:12] Решим уравнение с дробями.\n[00:29:10] На дом задачи с первого по третий номер.',
    );
    expect(storage.putJson).toHaveBeenCalledWith(
      'lessons/lesson-audio-id/report.json',
      expect.objectContaining({ summary: report.summary, homework: report.homework }),
    );
    expect(lessonRepo.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: LessonStatus.PROCESSING }),
      expect.objectContaining({
        status: LessonStatus.COMPLETED,
        reportObjectKey: 'lessons/lesson-audio-id/report.json',
        transcriptObjectKey: 'lessons/lesson-audio-id/transcript.txt',
        report: expect.objectContaining({ summary: report.summary }),
      }),
    );
    expect(lessons.markBookingsCompleted).toHaveBeenCalledWith('slot-id');
    expect(notifications.notifyLessonReportReady).toHaveBeenCalledWith(
      'teacher-user-id',
      'lesson-audio-id',
      lesson.slot.startTime,
    );
  });

  it('creates a report when a participant visited but no recording was saved', async () => {
    const storage = {
      putJson: jest.fn().mockResolvedValue(undefined),
    };
    const lessonRepo = {
      exists: jest.fn().mockResolvedValue(true),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const lessons = { markBookingsCompleted: jest.fn().mockResolvedValue(undefined) };
    const notifications = {
      notifyLessonReportReady: jest.fn().mockResolvedValue(undefined),
    };
    const learning = {
      createDraftsForLesson: jest.fn().mockResolvedValue(undefined),
    };
    const service = new LessonProcessingService(
      { get: jest.fn().mockReturnValue('') } as any,
      storage as any,
      lessons as any,
      notifications as any,
      lessonRepo as any,
      {} as any,
      learning as any,
    );
    const lesson = {
      id: 'lesson-id',
      slotId: 'slot-id',
      status: LessonStatus.PROCESSING,
      startedAt: new Date(),
      endedAt: new Date(),
      recordingObjectKey: null,
      transcriptObjectKey: null,
      transcriptLanguage: null,
      transcriptDurationSeconds: null,
      processingAttempts: 0,
      teacher: { userId: 'teacher-user-id' },
      slot: { note: null, startTime: new Date() },
    };

    await (service as any).processOne(lesson, 'lease-id');

    expect(storage.putJson).toHaveBeenCalledWith(
      'lessons/lesson-id/report.json',
      expect.objectContaining({
        summary: expect.stringContaining('В урок зашли'),
      }),
    );
    expect(lessonRepo.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: LessonStatus.PROCESSING }),
      expect.objectContaining({
        status: LessonStatus.COMPLETED,
        reportObjectKey: 'lessons/lesson-id/report.json',
      }),
    );
  });

  it('still creates a report after repeated processing failures when the lesson was visited', async () => {
    const builder: any = {};
    builder.update = jest.fn().mockReturnValue(builder);
    builder.set = jest.fn().mockReturnValue(builder);
    builder.where = jest.fn().mockReturnValue(builder);
    builder.andWhere = jest.fn().mockReturnValue(builder);
    builder.execute = jest.fn().mockResolvedValue({ affected: 1 });

    const storage = { putJson: jest.fn().mockResolvedValue(undefined) };
    const lessonRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(builder),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const lessons = { markBookingsCompleted: jest.fn().mockResolvedValue(undefined) };
    const notifications = {
      notifyLessonReportReady: jest.fn().mockResolvedValue(undefined),
    };
    const learning = {
      createDraftsForLesson: jest.fn().mockResolvedValue(undefined),
    };
    const service = new LessonProcessingService(
      { get: jest.fn().mockReturnValue('') } as any,
      storage as any,
      lessons as any,
      notifications as any,
      lessonRepo as any,
      {} as any,
      learning as any,
    );
    (service as any).processOne = jest
      .fn()
      .mockRejectedValue(new Error('transcription unavailable'));
    const lesson = {
      id: 'lesson-id',
      slotId: 'slot-id',
      status: LessonStatus.PROCESSING,
      startedAt: new Date(),
      endedAt: new Date(),
      participantCount: 0,
      processingAttempts: 9,
      teacher: { userId: 'teacher-user-id' },
      slot: { startTime: new Date() },
    };

    await (service as any).processOneSafely(lesson);

    expect(storage.putJson).toHaveBeenCalledWith(
      'lessons/lesson-id/report.json',
      expect.objectContaining({
        summary: expect.stringContaining('Урок посещали'),
      }),
    );
    expect(lessonRepo.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: LessonStatus.PROCESSING,
        processingLeaseId: expect.any(String),
      }),
      expect.objectContaining({
        status: LessonStatus.COMPLETED,
        reportObjectKey: 'lessons/lesson-id/report.json',
      }),
    );
  });
});
