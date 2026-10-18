import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Between,
  EntityManager,
  MoreThanOrEqual,
  LessThanOrEqual,
  Repository,
} from 'typeorm';
import { CurriculumTopic } from '../curriculum/entities/curriculum.entity';
import { calculateMastery } from './learning.algorithms';
import {
  HomeworkItem,
  LearningEvidence,
  LearningEvidenceSource,
  LessonLearningReview,
  LessonTopicFinding,
  StudentLearningProfile,
  StudentTopicProgress,
  TopicAssessment,
} from './entities/learning.entity';

@Injectable()
export class ProgressService {
  constructor(
    @InjectRepository(StudentLearningProfile)
    private readonly profileRepo: Repository<StudentLearningProfile>,
    @InjectRepository(CurriculumTopic)
    private readonly topicRepo: Repository<CurriculumTopic>,
    @InjectRepository(StudentTopicProgress)
    private readonly progressRepo: Repository<StudentTopicProgress>,
    @InjectRepository(LearningEvidence)
    private readonly evidenceRepo: Repository<LearningEvidence>,
  ) {}

  async forStudent(studentId: string, period?: { from?: Date; to?: Date }) {
    const profile = await this.profileRepo.findOne({
      where: { studentId },
      relations: ['curriculumRelease'],
    });
    if (!profile?.curriculumReleaseId) {
      return { profile: profile ?? null, topics: [], assessedTopics: 0 };
    }
    const evidenceWhere: Record<string, unknown> = { studentId };
    if (period?.from && period?.to) {
      evidenceWhere.createdAt = Between(period.from, period.to);
    } else if (period?.from) {
      evidenceWhere.createdAt = MoreThanOrEqual(period.from);
    } else if (period?.to) {
      evidenceWhere.createdAt = LessThanOrEqual(period.to);
    }
    const hasPeriod = Boolean(period?.from || period?.to);
    const [topics, progress, evidence] = await Promise.all([
      this.topicRepo.find({
        where: { releaseId: profile.curriculumReleaseId },
        order: { position: 'ASC', code: 'ASC' },
      }),
      this.progressRepo.find({ where: { studentId } }),
      this.evidenceRepo.find({
        where: evidenceWhere as any,
        order: { createdAt: 'ASC' },
      }),
    ]);
    const byTopic = new Map(progress.map((item) => [item.topicId, item]));
    const evidenceByTopic = new Map<string, LearningEvidence[]>();
    for (const item of evidence) {
      const rows = evidenceByTopic.get(item.topicId) ?? [];
      rows.push(item);
      evidenceByTopic.set(item.topicId, rows);
    }
    const calculatedByTopic = new Map(
      [...evidenceByTopic.entries()].map(([topicId, rows]) => [
        topicId,
        calculateMastery(rows),
      ]),
    );
    const result = topics.map((topic) => {
      const item = hasPeriod
        ? calculatedByTopic.get(topic.id)
        : byTopic.get(topic.id) ?? calculatedByTopic.get(topic.id);
      return {
        id: topic.id,
        code: topic.code,
        title: topic.title,
        section: topic.section,
        position: topic.position,
        mastery: item?.mastery ?? 0,
        evidenceCount: item?.evidenceCount ?? 0,
        correctCount: item?.correctCount ?? 0,
        attemptCount: item?.attemptCount ?? 0,
        state: !item?.evidenceCount
          ? 'unassessed'
          : item.mastery >= 0.75
            ? 'mastered'
            : item.mastery >= 0.45
              ? 'learning'
              : 'gap',
      };
    });
    const assessed = result.filter((item) => item.evidenceCount > 0);
    const readiness = assessed.length
      ? assessed.reduce((sum, item) => sum + item.mastery, 0) / assessed.length
      : null;
    const coverage = topics.length ? assessed.length / topics.length : 0;
    const spread = readiness === null ? 0 : Math.round(25 - coverage * 10);
    const expected = readiness === null ? null : Math.round(readiness * 100);
    const sectionForecasts = [
      ...result.reduce(
        (groups, topic) => {
          const section = topic.section?.trim() || 'Без раздела';
          const rows = groups.get(section) ?? [];
          rows.push(topic);
          groups.set(section, rows);
          return groups;
        },
        new Map<string, typeof result>(),
      ),
    ].map(([section, rows]) => {
      const sectionAssessed = rows.filter((item) => item.evidenceCount > 0);
      const sectionReadiness = sectionAssessed.length
        ? sectionAssessed.reduce((sum, item) => sum + item.mastery, 0) /
          sectionAssessed.length
        : null;
      const sectionCoverage = rows.length
        ? sectionAssessed.length / rows.length
        : 0;
      const sectionExpected =
        sectionReadiness === null
          ? null
          : Math.round(sectionReadiness * 100);
      const sectionSpread =
        sectionExpected === null
          ? 0
          : Math.round(25 - sectionCoverage * 10);
      return {
        section,
        expected: sectionExpected,
        min:
          sectionExpected === null
            ? null
            : Math.max(0, sectionExpected - sectionSpread),
        max:
          sectionExpected === null
            ? null
            : Math.min(100, sectionExpected + sectionSpread),
        assessedTopics: sectionAssessed.length,
        topicCount: rows.length,
      };
    });
    return {
      profile: {
        id: profile.id,
        examTrack: profile.examTrack,
        targetScore: profile.targetScore,
        curriculumRelease: profile.curriculumRelease,
      },
      topics: result,
      assessedTopics: assessed.length,
      forecast:
        expected === null
          ? null
          : {
              min: Math.max(0, expected - spread),
              expected,
              max: Math.min(100, expected + spread),
              label: 'Оценка готовности по данным о пройденных темах',
            },
      sectionForecasts,
      history: this.history(topics, evidence),
    };
  }

  private history(
    topics: CurriculumTopic[],
    selectedEvidence: LearningEvidence[],
  ) {
    if (!selectedEvidence.length) return [];
    const periods = new Set<string>();
    for (const item of selectedEvidence) {
      const date = new Date(item.createdAt);
      const period = `${date.getUTCFullYear()}-${String(
        date.getUTCMonth() + 1,
      ).padStart(2, '0')}`;
      periods.add(period);
    }
    const cumulative = new Map<string, LearningEvidence[]>();
    let cursor = 0;
    const sortedEvidence = [...selectedEvidence].sort(
      (left, right) =>
        new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
    );
    return [...periods].sort().map((period) => {
      while (cursor < sortedEvidence.length) {
        const row = sortedEvidence[cursor];
        const date = new Date(row.createdAt);
        const rowPeriod = `${date.getUTCFullYear()}-${String(
          date.getUTCMonth() + 1,
        ).padStart(2, '0')}`;
        if (rowPeriod > period) break;
        const topicRows = cumulative.get(row.topicId) ?? [];
        topicRows.push(row);
        cumulative.set(row.topicId, topicRows);
        cursor += 1;
      }
      const assessed = topics
        .map((topic) => {
          const topicEvidence = cumulative.get(topic.id) ?? [];
          return topicEvidence.length
            ? calculateMastery(topicEvidence).mastery
            : null;
        })
        .filter((value): value is number => value !== null);
      const expected = assessed.length
        ? Math.round(
            (assessed.reduce((sum, value) => sum + value, 0) /
              assessed.length) *
              100,
          )
        : null;
      return {
        period,
        expected,
        assessedTopics: assessed.length,
        topicCount: topics.length,
      };
    });
  }

  async replaceLessonEvidence(
    manager: EntityManager,
    review: LessonLearningReview,
    findings: LessonTopicFinding[],
  ) {
    await manager.delete(LearningEvidence, {
      sourceType: LearningEvidenceSource.LESSON,
      sourceId: review.id,
    });
    if (findings.length) {
      await manager.save(
        findings.map((finding) =>
          manager.create(LearningEvidence, {
            studentId: review.studentId,
            topicId: finding.topicId,
            sourceType: LearningEvidenceSource.LESSON,
            sourceId: review.id,
            score: this.lessonScore(finding.assessment),
            weight: Math.max(0.25, Math.min(1, finding.confidence || 1)),
          }),
        ),
      );
    }
    await this.recompute(
      manager,
      review.studentId,
      findings.map((item) => item.topicId),
    );
  }

  async recordHomeworkEvidence(
    manager: EntityManager,
    input: {
      item: HomeworkItem;
      studentId: string;
      topicId: string;
      correct: boolean;
    },
  ) {
    const existing = await manager.findOne(LearningEvidence, {
      where: {
        sourceType: LearningEvidenceSource.HOMEWORK,
        sourceId: input.item.id,
        topicId: input.topicId,
      },
    });
    const evidence =
      existing ??
      manager.create(LearningEvidence, {
        studentId: input.studentId,
        topicId: input.topicId,
        sourceType: LearningEvidenceSource.HOMEWORK,
        sourceId: input.item.id,
      });
    evidence.score = input.correct ? 1 : 0;
    evidence.weight = 1.5;
    await manager.save(evidence);
    await this.recompute(manager, input.studentId, [input.topicId]);
  }

  async recordMockEvidence(
    manager: EntityManager,
    input: {
      studentId: string;
      topicId: string;
      sourceId: string;
      correct: boolean;
    },
  ) {
    const existing = await manager.findOne(LearningEvidence, {
      where: {
        sourceType: LearningEvidenceSource.MOCK_EXAM,
        sourceId: input.sourceId,
        topicId: input.topicId,
      },
    });
    const evidence =
      existing ??
      manager.create(LearningEvidence, {
        studentId: input.studentId,
        topicId: input.topicId,
        sourceType: LearningEvidenceSource.MOCK_EXAM,
        sourceId: input.sourceId,
      });
    evidence.score = input.correct ? 1 : 0;
    evidence.weight = 1;
    await manager.save(evidence);
    await this.recompute(manager, input.studentId, [input.topicId]);
  }

  private async recompute(
    manager: EntityManager,
    studentId: string,
    topicIds: string[],
  ) {
    for (const topicId of [...new Set(topicIds)]) {
      const evidence = await manager.find(LearningEvidence, {
        where: { studentId, topicId },
      });
      const calculated = calculateMastery(evidence);
      const existing = await manager.findOne(StudentTopicProgress, {
        where: { studentId, topicId },
      });
      await manager.save(
        manager.create(StudentTopicProgress, {
          ...(existing ?? {}),
          studentId,
          topicId,
          ...calculated,
        }),
      );
    }
  }

  private lessonScore(assessment: TopicAssessment) {
    if (assessment === TopicAssessment.MASTERED) return 0.9;
    if (assessment === TopicAssessment.DIFFICULTY) return 0.25;
    return 0.65;
  }
}
