import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Booking, BookingStatus } from '../bookings/entities/booking.entity';
import {
  CurriculumSourceKind,
  CurriculumTask,
  CurriculumTopic,
} from '../curriculum/entities/curriculum.entity';
import { CurriculumService } from '../curriculum/curriculum.service';
import { Lesson, LessonReport } from '../lessons/entities/lesson.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { StorageService } from '../storage/storage.service';
import { Student } from '../students/entities/student.entity';
import { Teacher } from '../teachers/entities/teacher.entity';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/enums/user-role.enum';
import {
  GradeHomeworkItemDto,
  SubmitHomeworkDto,
  UpdateHomeworkDraftDto,
  UpdateLearningProfileDto,
  UpdateLessonReviewDto,
} from './dto/learning.dto';
import {
  HomeworkAssignment,
  HomeworkItem,
  HomeworkItemStatus,
  HomeworkStatus,
  LessonLearningReview,
  LessonReviewStatus,
  LessonTopicFinding,
  StudentLearningProfile,
  StudentMistake,
  StudentTopicProgress,
  TopicAssessment,
} from './entities/learning.entity';
import {
  answerMatches,
  matchTopicLabels,
  selectHomeworkTasks,
} from './learning.algorithms';
import { ProgressService } from './progress.service';

@Injectable()
export class LearningService {
  private readonly logger = new Logger(LearningService.name);

  constructor(
    @InjectRepository(StudentLearningProfile)
    private readonly profileRepo: Repository<StudentLearningProfile>,
    @InjectRepository(LessonLearningReview)
    private readonly reviewRepo: Repository<LessonLearningReview>,
    @InjectRepository(LessonTopicFinding)
    private readonly findingRepo: Repository<LessonTopicFinding>,
    @InjectRepository(StudentMistake)
    private readonly mistakeRepo: Repository<StudentMistake>,
    @InjectRepository(HomeworkAssignment)
    private readonly assignmentRepo: Repository<HomeworkAssignment>,
    @InjectRepository(HomeworkItem)
    private readonly itemRepo: Repository<HomeworkItem>,
    @InjectRepository(StudentTopicProgress)
    private readonly progressRepo: Repository<StudentTopicProgress>,
    @InjectRepository(CurriculumTopic)
    private readonly topicRepo: Repository<CurriculumTopic>,
    @InjectRepository(CurriculumTask)
    private readonly taskRepo: Repository<CurriculumTask>,
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(Teacher)
    private readonly teacherRepo: Repository<Teacher>,
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(Lesson)
    private readonly lessonRepo: Repository<Lesson>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly curriculum: CurriculumService,
    private readonly progress: ProgressService,
    private readonly notifications: NotificationsService,
    private readonly storage: StorageService,
  ) {}

  async getMyProfile(user: User) {
    const student = await this.studentForUser(user);
    return this.profileRepo.findOne({
      where: { studentId: student.id },
      relations: ['curriculumRelease'],
    });
  }

  async updateMyProfile(user: User, dto: UpdateLearningProfileDto) {
    const student = await this.studentForUser(user);
    const release = await this.curriculum.getActiveRelease(dto.examTrack);
    const existing = await this.profileRepo.findOne({
      where: { studentId: student.id },
    });
    const profile = this.profileRepo.create({
      ...(existing ?? {}),
      studentId: student.id,
      examTrack: dto.examTrack,
      curriculumReleaseId: release.id,
      targetScore: dto.targetScore ?? null,
    });
    await this.profileRepo.save(profile);
    return this.getMyProfile(user);
  }

  async getMyProgress(
    user: User,
    period?: { from?: Date; to?: Date },
  ) {
    const student = await this.studentForUser(user);
    return this.progress.forStudent(student.id, period);
  }

  async getStudentOverview(
    user: User,
    studentId: string,
    period?: { from?: Date; to?: Date },
  ) {
    const student = await this.teacherStudent(user, studentId);
    const [progress, homework] = await Promise.all([
      this.progress.forStudent(student.id, period),
      this.listAssignments(student.id, true),
    ]);
    return {
      student: {
        id: student.id,
        parentName: student.parentName,
        parentEmail: student.parentEmail,
        user: student.user,
      },
      ...progress,
      homework,
    };
  }

  async createDraftsForLesson(lesson: Lesson, report: LessonReport) {
    const bookings = await this.bookingRepo.find({
      where: {
        slotId: lesson.slotId,
        status: In([BookingStatus.CONFIRMED, BookingStatus.COMPLETED]),
      },
      relations: ['student', 'student.user'],
    });
    const created: LessonLearningReview[] = [];
    for (const booking of bookings) {
      let draft: LessonLearningReview | null = null;
      try {
        draft = await this.ensureDraft(lesson, booking.student, report);
        if (draft) {
          created.push(draft);
          const homework = await this.assignmentRepo.findOneBy({
            reviewId: draft.id,
          });
          if (!homework) {
            const profile = await this.profileRepo.findOne({
              where: { studentId: booking.studentId },
              relations: ['curriculumRelease'],
            });
            const teacher =
              lesson.teacher ??
              (lesson.teacherId
                ? await this.teacherRepo.findOneBy({ id: lesson.teacherId })
                : null);
            if (
              teacher?.userId &&
              profile?.curriculumRelease?.sourceKind ===
                CurriculumSourceKind.IMPORTED
            ) {
              await this.generateHomework(
                { id: teacher.userId, role: UserRole.TEACHER } as User,
                lesson.id,
                booking.studentId,
              );
            }
          }
        }
      } catch (error) {
        this.logger.warn(
          `Не удалось создать черновик разбора урока ${lesson.id} для ученика ${booking.studentId}: ${
            error instanceof Error ? error.message : error
          }`,
        );
      }

      // The automatic report is available immediately after processing. A
      // teacher can still refine and publish the draft later; publication
      // sends the edited version again. Delivery failures must not prevent the
      // lesson itself from reaching COMPLETED.
      if (!draft?.familyDeliveredAt) {
        try {
          await this.notifications.deliverLessonToFamily({
            studentUserId: booking.student.userId,
            parentEmail: booking.student.parentEmail,
            studentName: this.studentName(booking.student),
            lessonId: lesson.id,
            startTime: lesson.slot?.startTime,
            report,
            forecast: await this.familyForecast(booking.studentId),
          });
          if (draft) {
            await this.reviewRepo.update(draft.id, {
              familyDeliveredAt: new Date(),
            });
          }
        } catch (error) {
          this.logger.warn(
            `Не удалось доставить автоматический отчёт по уроку ${lesson.id} ученику ${booking.studentId}: ${
              error instanceof Error ? error.message : error
            }`,
          );
        }
      }
    }
    return created;
  }

  async getReview(user: User, lessonId: string, studentId?: string) {
    const context = await this.reviewContext(user, lessonId, studentId);
    let review = await this.loadReview(lessonId, context.student.id);
    if (!review) {
      review = await this.ensureDraft(
        context.lesson,
        context.student,
        context.lesson.report,
      );
    }
    if (!review) {
      throw new BadRequestException(
        'У ученика не выбран экзаменационный трек',
      );
    }
    return this.reviewResponse(review);
  }

  async practiceForLesson(user: User, lessonId: string, refresh = false) {
    const review = (await this.getReview(user, lessonId)) as any;
    let assignment = review.homework;
    if (refresh || !assignment?.items?.length) {
      assignment = await this.generateHomework(user, lessonId);
    }
    return {
      assignmentId: assignment.id,
      summary:
        'Задания выбраны из активного каталога по подтверждённым темам и пробелам ученика',
      generatedAt: assignment.createdAt,
      diagnostics: assignment.generationDiagnostics,
      items: assignment.items.map((item: any) => ({
        title: item.task?.topic?.title || 'Задача',
        task: item.task?.statement || '',
        reason: item.rationale || '',
      })),
    };
  }

  async liveAssist(user: User, lessonId: string, context = '', boardText = '') {
    // Live assistance is called repeatedly while a lesson is running. Avoid
    // loading the full review graph (homework, mistakes and progress) for each
    // five-second audio/board update; that made the helper appear unavailable
    // under load and failed whenever a draft had not been created yet.
    const lessonContext = await this.reviewContext(user, lessonId);
    const profile = await this.profileRepo.findOne({
      where: { studentId: lessonContext.student.id },
    });
    if (!profile?.curriculumReleaseId) {
      return {
        topic: null,
        confidence: 0,
        suggestion: null,
        reason: 'У ученика не выбран экзаменационный трек',
      };
    }
    const available = await this.topicRepo.find({
      where: { releaseId: profile.curriculumReleaseId },
      order: { position: 'ASC', code: 'ASC' },
      take: 300,
    });
    const liveContext = `${String(context).slice(0, 3000)} ${String(boardText).slice(0, 10000)}`;
    const normalized = liveContext.toLocaleLowerCase('ru-RU');
    const topic = available.find((item) =>
      [item.title, ...(item.aliases ?? [])].some((label) =>
        normalized.includes(String(label).toLocaleLowerCase('ru-RU')),
      ),
    ) || matchTopicLabels([liveContext], available)
      .sort((a, b) => b.confidence - a.confidence)[0]?.topic;
    if (!topic) {
      return { topic: null, confidence: 0, suggestion: null, reason: 'Недостаточно данных для определения темы' };
    }
    const tasks = await this.taskRepo.find({ where: { topicId: topic.id }, relations: ['topic'], take: 10 });
    const task = tasks.find((item) => item.difficulty === 'basic') ?? tasks[0];
    return {
      topic: { id: topic.id, title: topic.title },
      confidence: normalized.includes(String(topic.title).toLocaleLowerCase('ru-RU')) ? 0.9 : 0.35,
      suggestion: task ? { id: task.id, title: task.topic?.title || topic.title, task: task.statement, reason: 'Подходит к текущей теме урока' } : null,
      reason: task ? 'Анализирует текущий контекст и выбирает следующую задачу из каталога' : 'Для темы пока нет задач в каталоге',
    };
  }

  async updateReview(
    user: User,
    lessonId: string,
    studentId: string | undefined,
    dto: UpdateLessonReviewDto,
  ) {
    const context = await this.reviewContext(user, lessonId, studentId);
    const review = await this.loadReview(lessonId, context.student.id);
    if (!review) throw new NotFoundException('Черновик разбора не найден');
    if (review.status !== LessonReviewStatus.DRAFT) {
      throw new ConflictException('Опубликованный разбор нельзя изменить');
    }
    const profile = await this.requireProfile(context.student.id);
    const topicIds = [...new Set(dto.topics.map((item) => item.topicId))];
    const topics = topicIds.length
      ? await this.topicRepo.findBy({
          id: In(topicIds),
          releaseId: profile.curriculumReleaseId,
        })
      : [];
    if (topics.length !== topicIds.length) {
      throw new BadRequestException(
        'Некоторые темы не относятся к кодификатору ученика',
      );
    }
    const mistakeTopicIds = [
      ...new Set(
        dto.mistakes
          .map((item) => item.topicId)
          .filter((id): id is string => !!id),
      ),
    ];
    if (
      mistakeTopicIds.some((id) => !topicIds.includes(id)) &&
      mistakeTopicIds.length
    ) {
      const allowed = await this.topicRepo.countBy({
        id: In(mistakeTopicIds),
        releaseId: profile.curriculumReleaseId,
      });
      if (allowed !== mistakeTopicIds.length) {
        throw new BadRequestException('Ошибка привязана к чужому кодификатору');
      }
    }

    await this.dataSource.transaction(async (manager) => {
      const locked = await manager.findOne(LessonLearningReview, {
        where: { id: review.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked) throw new NotFoundException('Черновик разбора не найден');
      if (locked.status !== LessonReviewStatus.DRAFT) {
        throw new ConflictException('Разбор уже опубликован');
      }
      if (locked.revision !== dto.revision) {
        throw new ConflictException({
          message: 'Разбор изменён в другой вкладке',
          currentRevision: locked.revision,
        });
      }
      locked.summary = dto.summary.trim();
      locked.achievements = this.cleanStrings(dto.achievements);
      locked.recommendations = this.cleanStrings(dto.recommendations);
      locked.revision += 1;
      await manager.save(locked);
      await manager.delete(LessonTopicFinding, { reviewId: locked.id });
      await manager.delete(StudentMistake, { reviewId: locked.id });
      if (dto.topics.length) {
        await manager.save(
          dto.topics.map((item) =>
            manager.create(LessonTopicFinding, {
              reviewId: locked.id,
              topicId: item.topicId,
              assessment: item.assessment,
              confidence: item.confidence ?? 1,
              note: item.note?.trim() || null,
            }),
          ),
        );
      }
      const mistakes = dto.mistakes
        .map((item) => ({
          topicId: item.topicId ?? null,
          description: item.description.trim(),
        }))
        .filter((item) => item.description);
      if (mistakes.length) {
        await manager.save(
          mistakes.map((item) =>
            manager.create(StudentMistake, {
              reviewId: locked.id,
              studentId: locked.studentId,
              topicId: item.topicId,
              description: item.description,
              resolved: false,
            }),
          ),
        );
      }
    });
    return this.getReview(user, lessonId, context.student.id);
  }

  async generateHomework(
    user: User,
    lessonId: string,
    studentId?: string,
  ) {
    const context = await this.reviewContext(user, lessonId, studentId);
    const review = await this.loadReview(lessonId, context.student.id);
    if (!review) throw new NotFoundException('Сначала сохраните разбор урока');
    if (review.status !== LessonReviewStatus.DRAFT) {
      throw new ConflictException('Разбор уже опубликован');
    }
    const profile = await this.requireProfile(context.student.id);
    if (profile.curriculumRelease?.sourceKind === CurriculumSourceKind.DEMO) {
      throw new BadRequestException(
        'Активен демонстрационный набор. Для выдачи ДЗ загрузите проверенный каталог ФИПИ.',
      );
    }
    const tasks = await this.taskRepo.find({
      where: { releaseId: profile.curriculumReleaseId },
      relations: ['topic'],
    });
    const progressRows = await this.progressRepo.find({
      where: { studentId: context.student.id },
    });
    const masteryByTopic = new Map(
      progressRows.map((item) => [item.topicId, item.mastery]),
    );
    const openMistakes = await this.mistakeRepo.find({
      where: { studentId: context.student.id, resolved: false },
    });
    const weakTopicIds = [
      ...new Set([
        ...review.topics
          .filter((item) => item.assessment === TopicAssessment.DIFFICULTY)
          .map((item) => item.topicId),
        ...openMistakes
          .map((item) => item.topicId)
          .filter((id): id is string => !!id),
        ...progressRows
          .filter((item) => item.evidenceCount > 0 && item.mastery < 0.45)
          .map((item) => item.topicId),
      ]),
    ];
    const currentTopicIds = review.topics.map((item) => item.topicId);
    if (!weakTopicIds.length) {
      weakTopicIds.push(...currentTopicIds.slice(0, 5));
    }
    const recentRows = await this.itemRepo
      .createQueryBuilder('item')
      .innerJoin('item.assignment', 'assignment')
      .where('assignment.studentId = :studentId', {
        studentId: context.student.id,
      })
      .andWhere('assignment.status IN (:...statuses)', {
        statuses: [
          HomeworkStatus.PUBLISHED,
          HomeworkStatus.IN_PROGRESS,
          HomeworkStatus.COMPLETED,
        ],
      })
      .select(['item.taskId'])
      .orderBy('assignment.createdAt', 'DESC')
      .take(100)
      .getMany();
    let selection;
    try {
      selection = selectHomeworkTasks({
        tasks,
        weakTopicIds,
        currentTopicIds,
        masteryByTopic,
        recentTaskIds: new Set(recentRows.map((item) => item.taskId)),
        count: 20,
        weakRatio: 0.7,
      });
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Не удалось подобрать задания',
      );
    }

    const assignmentId = await this.dataSource.transaction(async (manager) => {
      let assignment = await manager.findOne(HomeworkAssignment, {
        where: { reviewId: review.id },
      });
      if (assignment && assignment.status !== HomeworkStatus.DRAFT) {
        throw new ConflictException('Домашнее задание уже опубликовано');
      }
      assignment =
        assignment ??
        manager.create(HomeworkAssignment, {
          reviewId: review.id,
          lessonId,
          studentId: context.student.id,
          status: HomeworkStatus.DRAFT,
        });
      assignment.dueAt =
        assignment.dueAt ?? new Date(Date.now() + 7 * 24 * 3600_000);
      assignment.generationDiagnostics = selection.diagnostics;
      assignment = await manager.save(assignment);
      await manager.delete(HomeworkItem, { assignmentId: assignment.id });
      await manager.save(
        selection.items.map((item, index) =>
          manager.create(HomeworkItem, {
            assignmentId: assignment.id,
            taskId: item.task.id,
            position: index + 1,
            rationale: item.rationale,
          }),
        ),
      );
      return assignment.id;
    });
    return this.serializeAssignment(
      await this.assignmentById(assignmentId),
      true,
    );
  }

  async updateHomeworkDraft(
    user: User,
    assignmentId: string,
    dto: UpdateHomeworkDraftDto,
  ) {
    const assignment = await this.assignmentForTeacher(user, assignmentId);
    if (assignment.status !== HomeworkStatus.DRAFT) {
      throw new ConflictException('Опубликованное ДЗ нельзя изменить');
    }
    const taskIds = dto.items.map((item) => item.taskId);
    if (new Set(taskIds).size !== taskIds.length) {
      throw new BadRequestException('Одно задание нельзя добавить дважды');
    }
    const profile = await this.requireProfile(assignment.studentId);
    const tasks = await this.taskRepo.findBy({
      id: In(taskIds),
      releaseId: profile.curriculumReleaseId,
    });
    if (tasks.length !== taskIds.length) {
      throw new BadRequestException(
        'Некоторые задания не относятся к активному каталогу ученика',
      );
    }
    await this.dataSource.transaction(async (manager) => {
      await manager.delete(HomeworkItem, { assignmentId });
      await manager.save(
        dto.items.map((item, index) =>
          manager.create(HomeworkItem, {
            assignmentId,
            taskId: item.taskId,
            position: index + 1,
            rationale: item.rationale?.trim() || '',
          }),
        ),
      );
      if (dto.dueAt !== undefined) {
        await manager.update(
          HomeworkAssignment,
          { id: assignmentId },
          { dueAt: dto.dueAt ? new Date(dto.dueAt) : null },
        );
      }
    });
    return this.serializeAssignment(
      await this.assignmentById(assignmentId),
      true,
    );
  }

  async publishReview(
    user: User,
    lessonId: string,
    studentId?: string,
  ) {
    const context = await this.reviewContext(user, lessonId, studentId);
    const existing = await this.loadReview(lessonId, context.student.id);
    if (!existing) throw new NotFoundException('Черновик разбора не найден');
    let shouldDeliver = false;
    let shouldDeliverHomework = false;
    let report: LessonReport;
    let assignmentId: string;

    await this.dataSource.transaction(async (manager) => {
      const review = await manager.findOne(LessonLearningReview, {
        where: { id: existing.id },
        relations: [
          'topics',
          'topics.topic',
          'mistakes',
          'homework',
          'homework.items',
          'homework.items.task',
        ],
        lock: { mode: 'pessimistic_write' },
      });
      if (!review) throw new NotFoundException('Черновик разбора не найден');
      const assignment = review.homework;
      if (!assignment) {
        throw new BadRequestException('Сначала сформируйте домашнее задание');
      }
      if ((assignment.items?.length ?? 0) < 20) {
        throw new BadRequestException(
          'Перед публикацией в ДЗ должно быть не менее 20 заданий',
        );
      }
      if (
        new Set(assignment.items.map((item) => item.task.taskType)).size < 5
      ) {
        throw new BadRequestException(
          'Перед публикацией в ДЗ должно быть не менее 5 типов заданий',
        );
      }
      assignmentId = assignment.id;
      report = {
        summary: review.summary,
        topics: review.topics.map((item) => item.topic.title),
        achievements: review.achievements,
        difficulties: review.mistakes.map((item) => item.description),
        homework: assignment.items
          .sort((a, b) => a.position - b.position)
          .map((item) => item.task.statement),
        recommendations: review.recommendations,
        keyMoments: context.lesson.report?.keyMoments ?? [],
      };
      if (review.status === LessonReviewStatus.DRAFT) {
        shouldDeliverHomework = true;
        review.status = LessonReviewStatus.PUBLISHED;
        review.publishedAt = new Date();
        review.publishedByUserId = user.id;
        assignment.status = HomeworkStatus.PUBLISHED;
        assignment.publishedAt = new Date();
        await manager.save(assignment);
        await this.progress.replaceLessonEvidence(
          manager,
          review,
          review.topics,
        );
      }
      if (!review.familyDeliveredAt) {
        review.familyDeliveredAt = new Date();
        shouldDeliver = true;
      }
      await manager.save(review);
      await manager.update(Lesson, { id: lessonId }, { report });
    });

    if (context.lesson.reportObjectKey) {
      try {
        await this.storage.putJson(context.lesson.reportObjectKey, report);
      } catch (error) {
        this.logger.warn(
          `Не удалось обновить JSON-отчёт ${lessonId}: ${
            error instanceof Error ? error.message : error
          }`,
        );
      }
    }
    if (shouldDeliver) {
      try {
        await this.notifications.deliverLessonToFamily({
          studentUserId: context.student.userId,
          parentEmail: context.student.parentEmail,
          studentName: this.studentName(context.student),
          lessonId,
          startTime: context.lesson.slot?.startTime,
          report,
          forecast: await this.familyForecast(context.student.id),
        });
      } catch (error) {
        await this.reviewRepo.update(existing.id, { familyDeliveredAt: null });
        throw error;
      }
    } else if (shouldDeliverHomework) {
      await this.notifications.deliverHomework({
        studentUserId: context.student.userId,
        parentEmail: context.student.parentEmail,
        studentName: this.studentName(context.student),
        lessonId,
        startTime: context.lesson.slot?.startTime,
        report,
      });
    }
    return {
      idempotent:
        existing.status === LessonReviewStatus.PUBLISHED && !shouldDeliver,
      assignmentId,
      review: await this.getReview(user, lessonId, context.student.id),
    };
  }

  async listMyHomework(user: User) {
    const student = await this.studentForUser(user);
    return this.listAssignments(student.id, false);
  }

  async getHomework(user: User, assignmentId: string) {
    const assignment = await this.assignmentById(assignmentId);
    await this.assertAssignmentAccess(user, assignment);
    if (
      user.role === UserRole.STUDENT &&
      assignment.status === HomeworkStatus.DRAFT
    ) {
      throw new ForbiddenException();
    }
    return this.serializeAssignment(
      assignment,
      user.role !== UserRole.STUDENT,
    );
  }

  async submitHomework(
    user: User,
    assignmentId: string,
    dto: SubmitHomeworkDto,
  ) {
    const student = await this.studentForUser(user);
    const assignment = await this.assignmentById(assignmentId);
    if (assignment.studentId !== student.id) throw new ForbiddenException();
    if (
      ![HomeworkStatus.PUBLISHED, HomeworkStatus.IN_PROGRESS].includes(
        assignment.status,
      )
    ) {
      throw new ConflictException('Это ДЗ нельзя отправить');
    }
    const answerByItem = new Map(
      dto.answers.map((item) => [item.itemId, item.answer.trim()]),
    );
    if (
      [...answerByItem.keys()].some(
        (id) => !assignment.items.some((item) => item.id === id),
      )
    ) {
      throw new BadRequestException('Ответ относится к другому ДЗ');
    }
    await this.dataSource.transaction(async (manager) => {
      for (const item of assignment.items) {
        if (!answerByItem.has(item.id)) continue;
        const answer = answerByItem.get(item.id)!;
        const correct = answerMatches(answer, item.task.acceptedAnswers ?? []);
        item.answer = answer;
        item.answeredAt = new Date();
        item.autoCorrect = correct;
        item.teacherCorrect = null;
        item.status =
          correct === null
            ? HomeworkItemStatus.NEEDS_REVIEW
            : correct
              ? HomeworkItemStatus.CORRECT
              : HomeworkItemStatus.INCORRECT;
        await manager.save(item);
        if (correct !== null) {
          await this.progress.recordHomeworkEvidence(manager, {
            item,
            studentId: student.id,
            topicId: item.task.topicId,
            correct,
          });
        }
      }
      const refreshed = await manager.find(HomeworkItem, {
        where: { assignmentId },
      });
      const complete = refreshed.every((item) =>
        [HomeworkItemStatus.CORRECT, HomeworkItemStatus.INCORRECT].includes(
          item.status,
        ),
      );
      await manager.update(
        HomeworkAssignment,
        { id: assignmentId },
        {
          status: complete
            ? HomeworkStatus.COMPLETED
            : HomeworkStatus.IN_PROGRESS,
          completedAt: complete ? new Date() : null,
        },
      );
    });
    return this.getHomework(user, assignmentId);
  }

  async gradeHomeworkItem(
    user: User,
    itemId: string,
    dto: GradeHomeworkItemDto,
  ) {
    const item = await this.itemRepo.findOne({
      where: { id: itemId },
      relations: ['task', 'assignment', 'assignment.student'],
    });
    if (!item) throw new NotFoundException('Задание не найдено');
    const teacher = await this.teacherForUser(user);
    if (item.assignment.student.teacherId !== teacher.id) {
      throw new ForbiddenException();
    }
    if (!item.answer) {
      throw new BadRequestException('Ученик ещё не отправил ответ');
    }
    await this.dataSource.transaction(async (manager) => {
      item.teacherCorrect = dto.teacherCorrect;
      item.gradedAt = new Date();
      item.status = dto.teacherCorrect
        ? HomeworkItemStatus.CORRECT
        : HomeworkItemStatus.INCORRECT;
      await manager.save(item);
      await this.progress.recordHomeworkEvidence(manager, {
        item,
        studentId: item.assignment.studentId,
        topicId: item.task.topicId,
        correct: dto.teacherCorrect,
      });
      const remaining = await manager.count(HomeworkItem, {
        where: {
          assignmentId: item.assignmentId,
          status: In([
            HomeworkItemStatus.PENDING,
            HomeworkItemStatus.NEEDS_REVIEW,
          ]),
        },
      });
      if (!remaining) {
        await manager.update(
          HomeworkAssignment,
          { id: item.assignmentId },
          { status: HomeworkStatus.COMPLETED, completedAt: new Date() },
        );
      }
    });
    return this.serializeAssignment(
      await this.assignmentById(item.assignmentId),
      true,
    );
  }

  private async ensureDraft(
    lesson: Lesson,
    student: Student,
    report?: LessonReport | null,
  ) {
    const existing = await this.loadReview(lesson.id, student.id);
    if (existing) return existing;
    const profile = await this.profileRepo.findOne({
      where: { studentId: student.id },
    });
    if (!profile) return null;
    if (!profile.curriculumReleaseId) {
      const release = await this.curriculum.getActiveRelease(profile.examTrack);
      profile.curriculumReleaseId = release.id;
      await this.profileRepo.save(profile);
    }
    const topics = await this.topicRepo.find({
      where: { releaseId: profile.curriculumReleaseId },
      order: { position: 'ASC' },
    });
    const topicMatches = matchTopicLabels(report?.topics ?? [], topics);
    const difficultyMatches = matchTopicLabels(
      report?.difficulties ?? [],
      topics,
    );
    const difficultyIds = new Set(
      difficultyMatches.map((item) => item.topic.id),
    );
    try {
      const reviewId = await this.dataSource.transaction(async (manager) => {
        const review = await manager.save(
          manager.create(LessonLearningReview, {
            lessonId: lesson.id,
            studentId: student.id,
            summary: report?.summary ?? '',
            achievements: report?.achievements ?? [],
            recommendations: report?.recommendations ?? [],
            rawTopics: report?.topics ?? [],
            rawDifficulties: report?.difficulties ?? [],
          }),
        );
        const combined = new Map<
          string,
          { topic: CurriculumTopic; confidence: number }
        >();
        for (const match of [...topicMatches, ...difficultyMatches]) {
          const previous = combined.get(match.topic.id);
          if (!previous || previous.confidence < match.confidence) {
            combined.set(match.topic.id, match);
          }
        }
        const findings = combined.size
          ? await manager.save(
              [...combined.values()].map((match) =>
                manager.create(LessonTopicFinding, {
                  reviewId: review.id,
                  topicId: match.topic.id,
                  assessment: difficultyIds.has(match.topic.id)
                    ? TopicAssessment.DIFFICULTY
                    : TopicAssessment.PRACTICED,
                  confidence: match.confidence,
                  note: null,
                }),
              ),
            )
          : [];
        await this.progress.replaceLessonEvidence(manager, review, findings);
        const mistakes = (report?.difficulties ?? [])
          .map((description) => {
            const match = matchTopicLabels([description], topics)[0];
            return {
              description: description.trim(),
              topicId: match?.topic.id ?? null,
            };
          })
          .filter((item) => item.description);
        if (mistakes.length) {
          await manager.save(
            mistakes.map((item) =>
              manager.create(StudentMistake, {
                reviewId: review.id,
                studentId: student.id,
                topicId: item.topicId,
                description: item.description,
              }),
            ),
          );
        }
        return review.id;
      });
      return this.reviewRepo.findOneByOrFail({ id: reviewId });
    } catch (error: any) {
      if (error?.code === '23505') {
        return this.loadReview(lesson.id, student.id);
      }
      throw error;
    }
  }

  private async reviewContext(
    user: User,
    lessonId: string,
    studentId?: string,
  ) {
    const teacher = await this.teacherForUser(user);
    const lesson = await this.lessonRepo.findOne({
      where: { id: lessonId, teacherId: teacher.id },
      relations: ['slot'],
    });
    if (!lesson) {
      throw new ForbiddenException('Этот урок не принадлежит вам');
    }
    const bookings = await this.bookingRepo.find({
      where: {
        slotId: lesson.slotId,
        status: In([BookingStatus.CONFIRMED, BookingStatus.COMPLETED]),
      },
      relations: ['student', 'student.user'],
    });
    const booking = studentId
      ? bookings.find((item) => item.studentId === studentId)
      : bookings[0];
    if (!booking) {
      throw new NotFoundException('Ученик для этого урока не найден');
    }
    return { teacher, lesson, student: booking.student };
  }

  private loadReview(lessonId: string, studentId: string) {
    return this.reviewRepo.findOne({
      where: { lessonId, studentId },
      relations: [
        'student',
        'student.user',
        'lesson',
        'lesson.slot',
        'topics',
        'topics.topic',
        'mistakes',
        'mistakes.topic',
        'homework',
        'homework.items',
        'homework.items.task',
        'homework.items.task.topic',
      ],
    });
  }

  private async reviewResponse(review: LessonLearningReview) {
    const profile = await this.requireProfile(review.studentId);
    const curriculumTopics = await this.topicRepo.find({
      where: { releaseId: profile.curriculumReleaseId },
      order: { position: 'ASC', code: 'ASC' },
    });
    return {
      id: review.id,
      lessonId: review.lessonId,
      student: {
        id: review.student.id,
        user: review.student.user,
      },
      status: review.status,
      summary: review.summary,
      achievements: review.achievements,
      recommendations: review.recommendations,
      rawTopics: review.rawTopics,
      rawDifficulties: review.rawDifficulties,
      revision: review.revision,
      publishedAt: review.publishedAt,
      familyDeliveredAt: review.familyDeliveredAt,
      topics: review.topics
        .sort((a, b) => a.topic.position - b.topic.position)
        .map((item) => ({
          id: item.id,
          topicId: item.topicId,
          topic: item.topic,
          assessment: item.assessment,
          confidence: item.confidence,
          note: item.note,
        })),
      mistakes: review.mistakes.map((item) => ({
        id: item.id,
        topicId: item.topicId,
        topic: item.topic,
        description: item.description,
      })),
      curriculumTopics,
      homework: review.homework
        ? this.serializeAssignment(review.homework, true)
        : null,
    };
  }

  private async assignmentForTeacher(user: User, assignmentId: string) {
    const assignment = await this.assignmentById(assignmentId);
    const teacher = await this.teacherForUser(user);
    const student = await this.studentRepo.findOneBy({
      id: assignment.studentId,
    });
    if (!student || student.teacherId !== teacher.id) {
      throw new ForbiddenException();
    }
    return assignment;
  }

  private async assignmentById(assignmentId: string) {
    const assignment = await this.assignmentRepo.findOne({
      where: { id: assignmentId },
      relations: [
        'lesson',
        'lesson.slot',
        'student',
        'student.user',
        'items',
        'items.task',
        'items.task.topic',
      ],
    });
    if (!assignment) throw new NotFoundException('Домашнее задание не найдено');
    return assignment;
  }

  private async listAssignments(studentId: string, teacherView: boolean) {
    const rows = await this.assignmentRepo.find({
      where: teacherView
        ? { studentId }
        : {
            studentId,
            status: In([
              HomeworkStatus.PUBLISHED,
              HomeworkStatus.IN_PROGRESS,
              HomeworkStatus.COMPLETED,
            ]),
          },
      relations: ['lesson', 'lesson.slot', 'items', 'items.task', 'items.task.topic'],
      order: { createdAt: 'DESC' },
    });
    return rows.map((item) => this.serializeAssignment(item, teacherView));
  }

  private serializeAssignment(
    assignment: HomeworkAssignment,
    includeAnswers: boolean,
  ) {
    return {
      id: assignment.id,
      lessonId: assignment.lessonId,
      studentId: assignment.studentId,
      status: assignment.status,
      dueAt: assignment.dueAt,
      publishedAt: assignment.publishedAt,
      completedAt: assignment.completedAt,
      createdAt: assignment.createdAt,
      generationDiagnostics: assignment.generationDiagnostics,
      lesson: assignment.lesson
        ? { id: assignment.lesson.id, slot: assignment.lesson.slot }
        : undefined,
      items: [...(assignment.items ?? [])]
        .sort((a, b) => a.position - b.position)
        .map((item) => ({
          id: item.id,
          position: item.position,
          rationale: item.rationale,
          answer: item.answer,
          status: item.status,
          autoCorrect: item.autoCorrect,
          teacherCorrect: item.teacherCorrect,
          answeredAt: item.answeredAt,
          gradedAt: item.gradedAt,
          task: item.task
            ? {
                id: item.task.id,
                externalId: item.task.externalId,
                taskType: item.task.taskType,
                difficulty: item.task.difficulty,
                statement: item.task.statement,
                topic: item.task.topic,
                sourceUrl: item.task.sourceUrl,
                isDemo: item.task.isDemo,
                ...(includeAnswers
                  ? {
                      acceptedAnswers: item.task.acceptedAnswers,
                      solution: item.task.solution,
                    }
                  : {}),
              }
            : undefined,
        })),
    };
  }

  private async assertAssignmentAccess(
    user: User,
    assignment: HomeworkAssignment,
  ) {
    if (user.role === UserRole.ADMIN) return;
    if (user.role === UserRole.STUDENT) {
      const student = await this.studentForUser(user);
      if (student.id === assignment.studentId) return;
    }
    if (user.role === UserRole.TEACHER) {
      const teacher = await this.teacherForUser(user);
      const student = await this.studentRepo.findOneBy({
        id: assignment.studentId,
      });
      if (student?.teacherId === teacher.id) return;
    }
    throw new ForbiddenException();
  }

  private async requireProfile(studentId: string) {
    const profile = await this.profileRepo.findOne({
      where: { studentId },
      relations: ['curriculumRelease'],
    });
    if (!profile) {
      throw new BadRequestException(
        'Сначала выберите экзаменационный трек ученика',
      );
    }
    if (!profile.curriculumReleaseId) {
      const release = await this.curriculum.getActiveRelease(profile.examTrack);
      profile.curriculumReleaseId = release.id;
      await this.profileRepo.save(profile);
    }
    return profile;
  }

  private async studentForUser(user: User) {
    if (user.role !== UserRole.STUDENT) throw new ForbiddenException();
    const student = await this.studentRepo.findOne({
      where: { userId: user.id },
      relations: ['user'],
    });
    if (!student) throw new NotFoundException('Ученик не найден');
    return student;
  }

  private async teacherForUser(user: User) {
    if (user.role !== UserRole.TEACHER) throw new ForbiddenException();
    const teacher = await this.teacherRepo.findOne({
      where: { userId: user.id },
    });
    if (!teacher) throw new NotFoundException('Преподаватель не найден');
    return teacher;
  }

  private async teacherStudent(user: User, studentId: string) {
    const teacher = await this.teacherForUser(user);
    const student = await this.studentRepo.findOne({
      where: { id: studentId, teacherId: teacher.id },
      relations: ['user'],
    });
    if (!student) throw new ForbiddenException('Это не ваш ученик');
    return student;
  }

  private studentName(student: Student) {
    const name =
      `${student.user?.firstName ?? ''} ${student.user?.lastName ?? ''}`.trim();
    return name || 'ученик';
  }

  private async familyForecast(studentId: string) {
    try {
      const progress = await this.progress.forStudent(studentId);
      return progress.forecast ?? null;
    } catch (error) {
      this.logger.warn(
        `Не удалось добавить ориентир по прогрессу ученика ${studentId} в отчёт: ${error instanceof Error ? error.message : error}`,
      );
      return null;
    }
  }

  private cleanStrings(values: string[]) {
    return values.map((item) => item.trim()).filter(Boolean);
  }
}
