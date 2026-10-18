import { CurriculumSourceKind } from '../curriculum/entities/curriculum.entity';
import { LessonReviewStatus } from './entities/learning.entity';
import { LearningService } from './learning.service';

describe('LearningService lesson reports', () => {
  function createService(sourceKind: CurriculumSourceKind) {
    const draft = {
      id: 'review-id',
      familyDeliveredAt: null,
    };
    const booking = {
      studentId: 'student-id',
      student: {
        id: 'student-id',
        userId: 'student-user-id',
        parentEmail: 'parent@example.com',
        user: { firstName: 'Иван', lastName: 'Иванов' },
      },
    };
    const bookingRepo = { find: jest.fn().mockResolvedValue([booking]) };
    const assignmentRepo = { findOneBy: jest.fn().mockResolvedValue(null) };
    const profileRepo = {
      findOne: jest
        .fn()
        .mockResolvedValue({ curriculumRelease: { sourceKind } }),
    };
    const reviewRepo = { update: jest.fn().mockResolvedValue(undefined) };
    const notifications = {
      deliverLessonToFamily: jest.fn().mockResolvedValue(undefined),
    };
    const service = new LearningService(
      profileRepo as any,
      reviewRepo as any,
      {} as any,
      {} as any,
      assignmentRepo as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      bookingRepo as any,
      {} as any,
      {} as any,
      {} as any,
      { forStudent: jest.fn().mockResolvedValue({ forecast: null }) } as any,
      notifications as any,
      {} as any,
    );
    jest.spyOn(service as any, 'ensureDraft').mockResolvedValue(draft);
    const generateHomework = jest
      .spyOn(service, 'generateHomework')
      .mockResolvedValue({} as any);
    return {
      service,
      draft,
      booking,
      assignmentRepo,
      profileRepo,
      reviewRepo,
      notifications,
      generateHomework,
    };
  }

  const lesson = {
    id: 'lesson-id',
    slotId: 'slot-id',
    teacherId: 'teacher-id',
    teacher: { userId: 'teacher-user-id' },
    slot: { startTime: new Date() },
  } as any;
  const report = {
    summary: 'Повторили уравнения',
    topics: [],
    achievements: [],
    difficulties: [],
    homework: [],
    recommendations: [],
    keyMoments: [],
  };

  it('delivers an automatic report even while the teacher can still review it', async () => {
    const context = createService(CurriculumSourceKind.DEMO);

    const drafts = await context.service.createDraftsForLesson(lesson, report);

    expect(drafts).toEqual([context.draft]);
    expect(context.notifications.deliverLessonToFamily).toHaveBeenCalledWith(
      expect.objectContaining({
        studentUserId: 'student-user-id',
        parentEmail: 'parent@example.com',
        lessonId: 'lesson-id',
        report,
      }),
    );
    expect(context.reviewRepo.update).toHaveBeenCalledWith('review-id', {
      familyDeliveredAt: expect.any(Date),
    });
    expect(context.generateHomework).not.toHaveBeenCalled();
  });

  it('generates homework only from an imported curriculum catalogue', async () => {
    const context = createService(CurriculumSourceKind.IMPORTED);

    await context.service.createDraftsForLesson(lesson, report);

    expect(context.profileRepo.findOne).toHaveBeenCalledWith({
      where: { studentId: 'student-id' },
      relations: ['curriculumRelease'],
    });
    expect(context.generateHomework).toHaveBeenCalledWith(
      { id: 'teacher-user-id', role: 'teacher' },
      'lesson-id',
      'student-id',
    );
  });

  it('skips reports already delivered and keeps independent lesson records', async () => {
    const context = createService(CurriculumSourceKind.IMPORTED);
    context.draft.familyDeliveredAt = new Date();
    context.assignmentRepo.findOneBy.mockResolvedValue({ id: 'assignment-id' });

    const drafts = await context.service.createDraftsForLesson(lesson, report);

    expect(drafts).toEqual([context.draft]);
    expect(context.notifications.deliverLessonToFamily).not.toHaveBeenCalled();
    expect(context.profileRepo.findOne).not.toHaveBeenCalled();
  });

  it('refuses to build learner homework from demonstration task data', async () => {
    const profileRepo = {
      findOne: jest.fn().mockResolvedValue({
        curriculumReleaseId: 'demo-release',
        curriculumRelease: { sourceKind: CurriculumSourceKind.DEMO },
      }),
    };
    const progressRepo = { find: jest.fn().mockResolvedValue([]) };
    const taskRepo = { find: jest.fn() };
    const service = new LearningService(
      profileRepo as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      progressRepo as any,
      {} as any,
      taskRepo as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    jest.spyOn(service as any, 'reviewContext').mockResolvedValue({
      student: { id: 'student-id' },
      lesson,
    });
    jest.spyOn(service as any, 'loadReview').mockResolvedValue({
      id: 'review-id',
      status: LessonReviewStatus.DRAFT,
      topics: [],
    });

    await expect(
      service.generateHomework({ id: 'teacher-user-id', role: 'teacher' } as any, 'lesson-id'),
    ).rejects.toThrow('демонстрационный набор');
    expect(taskRepo.find).not.toHaveBeenCalled();
  });
});
