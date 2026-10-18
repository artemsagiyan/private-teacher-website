export type ExamTrack = 'oge' | 'ege_base' | 'ege_profile';
export type TopicAssessment = 'mastered' | 'practiced' | 'difficulty';
export type HomeworkStatus = 'draft' | 'published' | 'in_progress' | 'completed';

export interface LearningProfile {
  id: string;
  examTrack: ExamTrack;
  targetScore: number | null;
  curriculumRelease?: {
    id: string;
    year: number;
    version: string;
    title: string;
    sourceKind: 'demo' | 'imported';
  } | null;
}

export interface TopicProgress {
  id: string;
  code: string;
  title: string;
  section: string | null;
  position: number;
  mastery: number;
  evidenceCount: number;
  correctCount: number;
  attemptCount: number;
  state: 'unassessed' | 'mastered' | 'learning' | 'gap';
}

export interface LearningProgress {
  profile: LearningProfile | null;
  topics: TopicProgress[];
  assessedTopics: number;
  forecast?: { min: number; expected: number; max: number; label: string } | null;
  sectionForecasts?: Array<{
    section: string;
    min: number | null;
    expected: number | null;
    max: number | null;
    assessedTopics: number;
    topicCount: number;
  }>;
  history?: Array<{
    period: string;
    expected: number | null;
    assessedTopics: number;
    topicCount: number;
  }>;
}

export interface MockExamItem {
  taskId: string;
  externalId: string;
  topicId: string;
  topicCode: string;
  topicTitle: string;
  taskType: string;
  statement: string;
  acceptedAnswers?: string[];
  solution?: string | null;
  answer: string | null;
  status: 'pending' | 'correct' | 'incorrect' | 'needs_review';
}

export interface MockExam {
  id: string;
  studentId: string;
  teacherId: string;
  examTrack: ExamTrack;
  title: string;
  status: 'in_progress' | 'completed';
  durationMinutes: number;
  correctCount: number;
  gradedCount: number;
  score: number;
  startedAt: string | null;
  submittedAt: string | null;
  createdAt: string;
  items: MockExamItem[];
  student?: { id: string; user: { firstName: string; lastName: string } };
}

export interface HomeworkTask {
  id: string;
  externalId: string;
  taskType: string;
  difficulty: 'basic' | 'standard' | 'advanced';
  statement: string;
  acceptedAnswers?: string[];
  solution?: string | null;
  sourceUrl?: string | null;
  isDemo?: boolean;
  topic?: { id: string; code: string; title: string; section?: string | null };
}

export interface HomeworkItem {
  id: string;
  position: number;
  rationale: string;
  answer: string | null;
  status: 'pending' | 'correct' | 'incorrect' | 'needs_review';
  autoCorrect: boolean | null;
  teacherCorrect: boolean | null;
  task: HomeworkTask;
}

export interface HomeworkAssignment {
  id: string;
  lessonId: string;
  studentId: string;
  status: HomeworkStatus;
  dueAt: string | null;
  publishedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  generationDiagnostics?: Record<string, number>;
  lesson?: { id: string; slot?: { startTime: string; note?: string } };
  items: HomeworkItem[];
}

export interface LessonReview {
  id: string;
  lessonId: string;
  student: { id: string; user: { firstName: string; lastName: string } };
  status: 'draft' | 'published';
  summary: string;
  achievements: string[];
  recommendations: string[];
  rawTopics: string[];
  rawDifficulties: string[];
  revision: number;
  publishedAt?: string | null;
  topics: Array<{
    id: string;
    topicId: string;
    topic: { id: string; code: string; title: string; position: number };
    assessment: TopicAssessment;
    confidence: number;
    note: string | null;
  }>;
  mistakes: Array<{ id: string; topicId: string | null; description: string }>;
  curriculumTopics: Array<{ id: string; code: string; title: string; position: number }>;
  homework: HomeworkAssignment | null;
}
