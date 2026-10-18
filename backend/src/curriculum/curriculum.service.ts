import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { DataSource, Repository } from 'typeorm';
import {
  CurriculumRelease,
  CurriculumSourceKind,
  CurriculumTask,
  CurriculumTopic,
  ExamTrack,
  TaskDifficulty,
} from './entities/curriculum.entity';
import {
  CurriculumImportPayload,
  CurriculumImportPreview,
} from './curriculum.types';
import { buildDemoCurricula } from './fixtures/math-demo.v1';

@Injectable()
export class CurriculumService {
  constructor(
    @InjectRepository(CurriculumRelease)
    private readonly releaseRepo: Repository<CurriculumRelease>,
    @InjectRepository(CurriculumTopic)
    private readonly topicRepo: Repository<CurriculumTopic>,
    @InjectRepository(CurriculumTask)
    private readonly taskRepo: Repository<CurriculumTask>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async listReleases() {
    const releases = await this.releaseRepo.find({
      relations: ['topics', 'tasks'],
      order: { examTrack: 'ASC', year: 'DESC', createdAt: 'DESC' },
    });
    return releases.map(({ topics, tasks, ...release }) => ({
      ...release,
      topicCount: topics?.length ?? 0,
      taskCount: tasks?.length ?? 0,
    }));
  }

  async listTopics(releaseId: string) {
    const release = await this.releaseRepo.findOneBy({ id: releaseId });
    if (!release) throw new NotFoundException('Версия кодификатора не найдена');
    return this.topicRepo.find({
      where: { releaseId },
      order: { position: 'ASC', code: 'ASC' },
    });
  }

  async getActiveRelease(examTrack: ExamTrack, withTasks = false) {
    const release = await this.releaseRepo.findOne({
      where: { examTrack, isActive: true },
      relations: withTasks ? ['topics', 'tasks', 'tasks.topic'] : ['topics'],
      order: { year: 'DESC', createdAt: 'DESC' },
    });
    if (!release) {
      throw new NotFoundException(
        `Для трека ${examTrack} нет активного кодификатора`,
      );
    }
    return release;
  }

  async activate(releaseId: string) {
    return this.dataSource.transaction(async (manager) => {
      const release = await manager.findOne(CurriculumRelease, {
        where: { id: releaseId },
      });
      if (!release) {
        throw new NotFoundException('Версия кодификатора не найдена');
      }
      await manager.update(
        CurriculumRelease,
        { examTrack: release.examTrack, isActive: true },
        { isActive: false },
      );
      release.isActive = true;
      return manager.save(release);
    });
  }

  parseFile(buffer: Buffer, filename: string): CurriculumImportPayload {
    if (!buffer?.length) throw new BadRequestException('Файл пуст');
    if (buffer.length > 5 * 1024 * 1024) {
      throw new BadRequestException('Максимальный размер файла — 5 МБ');
    }
    const text = buffer.toString('utf8').replace(/^\uFEFF/, '');
    if (filename.toLowerCase().endsWith('.csv')) {
      return this.parseCsv(text);
    }
    try {
      return JSON.parse(text) as CurriculumImportPayload;
    } catch {
      throw new BadRequestException('Некорректный JSON');
    }
  }

  preview(payload: CurriculumImportPayload): CurriculumImportPreview {
    const normalized = this.normalize(payload);
    const errors: string[] = [];
    const warnings: string[] = [];
    if (normalized.schemaVersion !== 1) {
      errors.push('Поддерживается только schemaVersion=1');
    }
    if (!Object.values(ExamTrack).includes(normalized.examTrack)) {
      errors.push('Неизвестный examTrack');
    }
    if (!Number.isInteger(normalized.year) || normalized.year < 2020 || normalized.year > 2100) {
      errors.push('year должен быть целым числом от 2020 до 2100');
    }
    if (!normalized.version) errors.push('version обязателен');
    if (!normalized.title) errors.push('title обязателен');
    if (!normalized.topics.length) errors.push('Нужна хотя бы одна тема');
    if (!normalized.tasks.length) errors.push('Нужно хотя бы одно задание');

    const topicCodes = new Set<string>();
    for (const topic of normalized.topics) {
      if (!topic.code || !topic.title) {
        errors.push('У каждой темы обязательны code и title');
      }
      if (topicCodes.has(topic.code)) {
        errors.push(`Дублируется код темы ${topic.code}`);
      }
      topicCodes.add(topic.code);
    }
    const taskIds = new Set<string>();
    for (const task of normalized.tasks) {
      if (!task.externalId || !task.statement || !task.taskType) {
        errors.push('У каждого задания обязательны externalId, taskType и statement');
      }
      if (taskIds.has(task.externalId)) {
        errors.push(`Дублируется externalId ${task.externalId}`);
      }
      taskIds.add(task.externalId);
      if (!topicCodes.has(task.topicCode)) {
        errors.push(
          `Задание ${task.externalId} ссылается на неизвестную тему ${task.topicCode}`,
        );
      }
      if (!Object.values(TaskDifficulty).includes(task.difficulty)) {
        errors.push(`Некорректная сложность у задания ${task.externalId}`);
      }
    }
    if (normalized.topics.length < 15 || normalized.topics.length > 20) {
      warnings.push('Для «розы ветров» рекомендуется 15–20 тем');
    }
    if (normalized.tasks.length < 20) {
      warnings.push('Для одного полного ДЗ требуется минимум 20 заданий');
    }
    const taskTypes = new Set(normalized.tasks.map((task) => task.taskType));
    if (taskTypes.size < 5) {
      warnings.push('Для разнообразного ДЗ рекомендуется минимум 5 типов заданий');
    }
    const tasksWithoutAnswers = normalized.tasks.filter(
      (task) => !task.acceptedAnswers.length,
    ).length;
    if (tasksWithoutAnswers) {
      warnings.push(
        `${tasksWithoutAnswers} заданий без автоответа будут требовать проверки преподавателя`,
      );
    }
    if (errors.length) {
      throw new BadRequestException({
        message: 'Файл кодификатора не прошёл проверку',
        errors: [...new Set(errors)],
        warnings,
      });
    }
    const hash = createHash('sha256')
      .update(JSON.stringify(normalized))
      .digest('hex');
    return {
      payload: normalized,
      stats: {
        topics: normalized.topics.length,
        tasks: normalized.tasks.length,
        taskTypes: taskTypes.size,
        tasksWithoutAnswers,
      },
      warnings,
      hash,
    };
  }

  async importPayload(payload: CurriculumImportPayload, dryRun = false) {
    const preview = this.preview(payload);
    if (dryRun) {
      return { dryRun: true, ...preview.stats, warnings: preview.warnings };
    }
    const existing = await this.releaseRepo.findOne({
      where: {
        examTrack: preview.payload.examTrack,
        year: preview.payload.year,
        version: preview.payload.version,
      },
      relations: ['topics', 'tasks'],
    });
    if (existing) {
      if (existing.metadata?.importHash === preview.hash) {
        return {
          dryRun: false,
          idempotent: true,
          releaseId: existing.id,
          topicCount: existing.topics.length,
          taskCount: existing.tasks.length,
          warnings: preview.warnings,
        };
      }
      throw new ConflictException(
        'Версия уже существует с другим содержимым. Укажите новую version.',
      );
    }

    const release = await this.dataSource.transaction(async (manager) => {
      const created = manager.create(CurriculumRelease, {
        examTrack: preview.payload.examTrack,
        year: preview.payload.year,
        version: preview.payload.version,
        title: preview.payload.title,
        sourceKind:
          preview.payload.sourceKind ?? CurriculumSourceKind.IMPORTED,
        metadata: {
          ...(preview.payload.metadata ?? {}),
          importHash: preview.hash,
        },
        isActive: false,
      });
      const savedRelease = await manager.save(created);
      const topicMap = new Map<string, CurriculumTopic>();
      for (const input of preview.payload.topics) {
        const topic = await manager.save(
          manager.create(CurriculumTopic, {
            releaseId: savedRelease.id,
            code: input.code,
            title: input.title,
            section: input.section ?? null,
            aliases: input.aliases ?? [],
            position: input.position ?? 0,
          }),
        );
        topicMap.set(input.code, topic);
      }
      const tasks = preview.payload.tasks.map((input) =>
        manager.create(CurriculumTask, {
          releaseId: savedRelease.id,
          topicId: topicMap.get(input.topicCode)!.id,
          externalId: input.externalId,
          taskType: input.taskType,
          difficulty: input.difficulty,
          statement: input.statement,
          acceptedAnswers: input.acceptedAnswers,
          solution: input.solution ?? null,
          sourceUrl: input.sourceUrl ?? null,
          isDemo:
            preview.payload.sourceKind === CurriculumSourceKind.DEMO,
          metadata: input.metadata ?? {},
        }),
      );
      await manager.save(tasks, { chunk: 250 });
      return savedRelease;
    });
    return {
      dryRun: false,
      idempotent: false,
      releaseId: release.id,
      topicCount: preview.stats.topics,
      taskCount: preview.stats.tasks,
      warnings: preview.warnings,
    };
  }

  async importDemo(activate = true) {
    const results: unknown[] = [];
    for (const payload of buildDemoCurricula()) {
      const result = await this.importPayload(payload);
      const releaseId = (result as { releaseId: string }).releaseId;
      if (activate) await this.activate(releaseId);
      results.push(result);
    }
    return results;
  }

  private normalize(payload: CurriculumImportPayload): CurriculumImportPayload {
    const clean = (value: unknown) =>
      typeof value === 'string' ? value.trim() : '';
    return {
      schemaVersion: Number(payload?.schemaVersion) as 1,
      examTrack: clean(payload?.examTrack) as ExamTrack,
      year: Number(payload?.year),
      version: clean(payload?.version),
      title: clean(payload?.title),
      sourceKind:
        payload?.sourceKind &&
        Object.values(CurriculumSourceKind).includes(payload.sourceKind)
          ? payload.sourceKind
          : CurriculumSourceKind.IMPORTED,
      metadata:
        payload?.metadata && typeof payload.metadata === 'object'
          ? payload.metadata
          : {},
      topics: Array.isArray(payload?.topics)
        ? payload.topics.map((topic, index) => ({
            code: clean(topic?.code),
            title: clean(topic?.title),
            section: clean(topic?.section) || undefined,
            aliases: Array.isArray(topic?.aliases)
              ? topic.aliases.map(clean).filter(Boolean)
              : [],
            position: Number.isFinite(Number(topic?.position))
              ? Number(topic.position)
              : index + 1,
          }))
        : [],
      tasks: Array.isArray(payload?.tasks)
        ? payload.tasks.map((task) => ({
            externalId: clean(task?.externalId),
            topicCode: clean(task?.topicCode),
            taskType: clean(task?.taskType),
            difficulty: clean(task?.difficulty) as TaskDifficulty,
            statement: clean(task?.statement),
            acceptedAnswers: Array.isArray(task?.acceptedAnswers)
              ? task.acceptedAnswers.map((item) => clean(item)).filter(Boolean)
              : [],
            solution: clean(task?.solution) || undefined,
            sourceUrl: clean(task?.sourceUrl) || undefined,
            metadata:
              task?.metadata && typeof task.metadata === 'object'
                ? task.metadata
                : {},
          }))
        : [],
    };
  }

  private parseCsv(text: string): CurriculumImportPayload {
    const rows = this.csvRows(text).filter((row) =>
      row.some((value) => value.trim()),
    );
    if (rows.length < 2) {
      throw new BadRequestException('CSV не содержит данных');
    }
    const headers = rows[0].map((item) => item.trim());
    const records = rows.slice(1).map((row) =>
      Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])),
    );
    const first = records[0];
    const topics = new Map<
      string,
      { code: string; title: string; section?: string; aliases: string[]; position: number }
    >();
    const tasks = records.map((row, index) => {
      const topicCode = row.topicCode?.trim();
      if (topicCode && !topics.has(topicCode)) {
        topics.set(topicCode, {
          code: topicCode,
          title: row.topicTitle?.trim(),
          section: row.section?.trim() || undefined,
          aliases: this.splitList(row.topicAliases),
          position: Number(row.topicPosition || topics.size + 1),
        });
      }
      let metadata: Record<string, unknown> = {};
      if (row.metadata?.trim()) {
        try {
          metadata = JSON.parse(row.metadata);
        } catch {
          throw new BadRequestException(
            `Некорректный metadata JSON в строке ${index + 2}`,
          );
        }
      }
      return {
        externalId: row.externalId?.trim(),
        topicCode,
        taskType: row.taskType?.trim(),
        difficulty: row.difficulty?.trim() as TaskDifficulty,
        statement: row.statement?.trim(),
        acceptedAnswers: this.splitList(row.acceptedAnswers),
        solution: row.solution?.trim() || undefined,
        sourceUrl: row.sourceUrl?.trim() || undefined,
        metadata,
      };
    });
    return {
      schemaVersion: 1,
      examTrack: first.examTrack?.trim() as ExamTrack,
      year: Number(first.year),
      version: first.version?.trim(),
      title: first.title?.trim(),
      sourceKind:
        (first.sourceKind?.trim() as CurriculumSourceKind) ||
        CurriculumSourceKind.IMPORTED,
      topics: [...topics.values()],
      tasks,
    };
  }

  private splitList(value?: string) {
    return (value ?? '')
      .split('|')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private csvRows(text: string) {
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = '';
    let quoted = false;
    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];
      if (char === '"') {
        if (quoted && text[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = !quoted;
        }
      } else if (char === ',' && !quoted) {
        row.push(cell);
        cell = '';
      } else if ((char === '\n' || char === '\r') && !quoted) {
        if (char === '\r' && text[index + 1] === '\n') index += 1;
        row.push(cell);
        rows.push(row);
        row = [];
        cell = '';
      } else {
        cell += char;
      }
    }
    if (quoted) throw new BadRequestException('Незакрытая кавычка в CSV');
    if (cell.length || row.length) {
      row.push(cell);
      rows.push(row);
    }
    return rows;
  }
}
