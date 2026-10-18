import {
  CurriculumSourceKind,
  ExamTrack,
  TaskDifficulty,
} from './entities/curriculum.entity';

export interface CurriculumImportTask {
  externalId: string;
  topicCode: string;
  taskType: string;
  difficulty: TaskDifficulty;
  statement: string;
  acceptedAnswers: string[];
  solution?: string;
  sourceUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface CurriculumImportTopic {
  code: string;
  title: string;
  section?: string;
  aliases?: string[];
  position?: number;
}

export interface CurriculumImportPayload {
  schemaVersion: 1;
  examTrack: ExamTrack;
  year: number;
  version: string;
  title: string;
  sourceKind?: CurriculumSourceKind;
  metadata?: Record<string, unknown>;
  topics: CurriculumImportTopic[];
  tasks: CurriculumImportTask[];
}

export interface CurriculumImportPreview {
  payload: CurriculumImportPayload;
  stats: {
    topics: number;
    tasks: number;
    taskTypes: number;
    tasksWithoutAnswers: number;
  };
  warnings: string[];
  hash: string;
}
