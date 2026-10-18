import { ProgressService } from './progress.service';

describe('ProgressService', () => {
  it('reports section readiness with topic coverage rather than claiming exam scores', async () => {
    const profile = {
      studentId: 'student-id',
      curriculumReleaseId: 'release-id',
      curriculumRelease: { sourceKind: 'imported' },
      examTrack: 'ege_profile',
      targetScore: 80,
    };
    const profileRepo = { findOne: jest.fn().mockResolvedValue(profile) };
    const topicRepo = {
      find: jest.fn().mockResolvedValue([
        { id: 'alg-1', code: 'A1', title: 'Уравнения', section: 'Алгебра' },
        { id: 'alg-2', code: 'A2', title: 'Функции', section: 'Алгебра' },
        { id: 'geo-1', code: 'G1', title: 'Планиметрия', section: 'Геометрия' },
      ]),
    };
    const progressRepo = {
      find: jest.fn().mockResolvedValue([
        { topicId: 'alg-1', mastery: 0.8, evidenceCount: 2, correctCount: 2, attemptCount: 2 },
        { topicId: 'geo-1', mastery: 0.4, evidenceCount: 1, correctCount: 0, attemptCount: 1 },
      ]),
    };
    const evidenceRepo = { find: jest.fn().mockResolvedValue([]) };
    const service = new ProgressService(
      profileRepo as any,
      topicRepo as any,
      progressRepo as any,
      evidenceRepo as any,
    );

    const result = await service.forStudent('student-id');

    expect(result.sectionForecasts).toEqual([
      {
        section: 'Алгебра',
        min: 60,
        expected: 80,
        max: 100,
        assessedTopics: 1,
        topicCount: 2,
      },
      {
        section: 'Геометрия',
        min: 25,
        expected: 40,
        max: 55,
        assessedTopics: 1,
        topicCount: 1,
      },
    ]);
    expect(result.forecast.label).toContain('готовности');
  });

  it('builds a cumulative monthly history and applies a period filter', async () => {
    const profileRepo = {
      findOne: jest.fn().mockResolvedValue({
        studentId: 'student-id',
        curriculumReleaseId: 'release-id',
        curriculumRelease: { sourceKind: 'imported' },
      }),
    };
    const topicRepo = {
      find: jest.fn().mockResolvedValue([
        { id: 'topic-id', code: 'A1', title: 'Уравнения', section: 'Алгебра' },
      ]),
    };
    const progressRepo = { find: jest.fn().mockResolvedValue([]) };
    const evidenceRepo = {
      find: jest.fn().mockResolvedValue([
        {
          topicId: 'topic-id',
          score: 0.25,
          weight: 1,
          sourceType: 'lesson',
          createdAt: new Date('2026-01-10T12:00:00Z'),
        },
        {
          topicId: 'topic-id',
          score: 1,
          weight: 1,
          sourceType: 'homework',
          createdAt: new Date('2026-02-10T12:00:00Z'),
        },
      ]),
    };
    const service = new ProgressService(
      profileRepo as any,
      topicRepo as any,
      progressRepo as any,
      evidenceRepo as any,
    );

    const result = await service.forStudent('student-id', {
      from: new Date('2026-01-01T00:00:00Z'),
      to: new Date('2026-02-28T23:59:59Z'),
    });

    expect(result.topics[0].evidenceCount).toBe(2);
    expect(result.history).toEqual([
      { period: '2026-01', expected: 42, assessedTopics: 1, topicCount: 1 },
      { period: '2026-02', expected: 56, assessedTopics: 1, topicCount: 1 },
    ]);
  });
});
