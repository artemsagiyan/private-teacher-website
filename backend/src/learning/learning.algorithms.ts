import {
  CurriculumTask,
  CurriculumTopic,
  TaskDifficulty,
} from '../curriculum/entities/curriculum.entity';

export interface EvidenceValue {
  score: number;
  weight: number;
  sourceType?: string;
}

export interface HomeworkSelection {
  task: CurriculumTask;
  rationale: string;
}

export function calculateMastery(evidence: EvidenceValue[]) {
  const valid = evidence.filter(
    (item) =>
      Number.isFinite(item.score) &&
      Number.isFinite(item.weight) &&
      item.weight > 0,
  );
  const weighted = valid.reduce(
    (sum, item) => sum + clamp(item.score, 0, 1) * item.weight,
    1,
  );
  const totalWeight = valid.reduce((sum, item) => sum + item.weight, 2);
  return {
    mastery: weighted / totalWeight,
    evidenceCount: valid.length,
    correctCount: valid.filter((item) => item.score >= 0.75).length,
    attemptCount: valid.filter((item) =>
      ['homework', 'mock_exam'].includes(item.sourceType ?? ''),
    ).length,
  };
}

export function selectHomeworkTasks(input: {
  tasks: CurriculumTask[];
  weakTopicIds: string[];
  currentTopicIds: string[];
  masteryByTopic: Map<string, number>;
  recentTaskIds?: Set<string>;
  count?: number;
  weakRatio?: number;
}): {
  items: HomeworkSelection[];
  diagnostics: {
    requested: number;
    selected: number;
    weakSelected: number;
    weakRatio: number;
    taskTypes: number;
    recentTasksReused: number;
  };
} {
  const count = input.count ?? 20;
  const desiredWeak = Math.ceil(count * (input.weakRatio ?? 0.7));
  const weak = new Set(input.weakTopicIds);
  const current = new Set(input.currentTopicIds);
  const recent = input.recentTaskIds ?? new Set<string>();
  const unique = [...new Map(input.tasks.map((task) => [task.id, task])).values()];
  if (unique.length < count) {
    throw new Error(
      `В активном каталоге только ${unique.length} уникальных заданий, требуется ${count}`,
    );
  }
  const fresh = unique.filter((task) => !recent.has(task.id));
  const candidates = fresh.length >= count ? fresh : unique;
  const sorted = [...candidates].sort((a, b) => {
    const weakDiff = Number(weak.has(b.topicId)) - Number(weak.has(a.topicId));
    if (weakDiff) return weakDiff;
    const currentDiff =
      Number(current.has(b.topicId)) - Number(current.has(a.topicId));
    if (currentDiff) return currentDiff;
    const difficultyDiff =
      difficultyDistance(a, input.masteryByTopic.get(a.topicId)) -
      difficultyDistance(b, input.masteryByTopic.get(b.topicId));
    if (difficultyDiff) return difficultyDiff;
    return a.externalId.localeCompare(b.externalId, 'ru');
  });

  const selected: CurriculumTask[] = [];
  const selectedIds = new Set<string>();
  const availableTypes = [...new Set(sorted.map((task) => task.taskType))];
  for (const type of availableTypes.slice(0, Math.min(5, count))) {
    const task =
      sorted.find(
        (candidate) =>
          candidate.taskType === type &&
          weak.has(candidate.topicId) &&
          !selectedIds.has(candidate.id),
      ) ??
      sorted.find(
        (candidate) =>
          candidate.taskType === type && !selectedIds.has(candidate.id),
      );
    if (task) add(task);
  }

  for (const task of sorted) {
    if (selected.length >= count) break;
    const weakSelected = selected.filter((item) => weak.has(item.topicId)).length;
    if (weakSelected >= desiredWeak || !weak.has(task.topicId)) continue;
    add(task);
  }
  for (const task of sorted) {
    if (selected.length >= count) break;
    add(task);
  }

  const weakSelected = selected.filter((item) => weak.has(item.topicId)).length;
  return {
    items: selected.map((task) => ({
      task,
      rationale: weak.has(task.topicId)
        ? 'Закрывает подтверждённый пробел'
        : current.has(task.topicId)
          ? 'Закрепляет тему последнего урока'
          : 'Поддерживает общий уровень по экзаменационному треку',
    })),
    diagnostics: {
      requested: count,
      selected: selected.length,
      weakSelected,
      weakRatio: selected.length ? weakSelected / selected.length : 0,
      taskTypes: new Set(selected.map((task) => task.taskType)).size,
      recentTasksReused: selected.filter((task) => recent.has(task.id)).length,
    },
  };

  function add(task: CurriculumTask) {
    if (selectedIds.has(task.id) || selected.length >= count) return;
    selectedIds.add(task.id);
    selected.push(task);
  }
}

export function matchTopicLabels(labels: string[], topics: CurriculumTopic[]) {
  const matched = new Map<string, { topic: CurriculumTopic; confidence: number }>();
  for (const label of labels) {
    const normalizedLabel = normalizeWords(label);
    if (!normalizedLabel.length) continue;
    let best: { topic: CurriculumTopic; confidence: number } | null = null;
    for (const topic of topics) {
      const candidates = [topic.title, ...(topic.aliases ?? [])];
      const confidence = Math.max(
        ...candidates.map((candidate) =>
          similarity(normalizedLabel, normalizeWords(candidate)),
        ),
      );
      if (!best || confidence > best.confidence) {
        best = { topic, confidence };
      }
    }
    if (best && best.confidence >= 0.38) {
      const previous = matched.get(best.topic.id);
      if (!previous || previous.confidence < best.confidence) {
        matched.set(best.topic.id, best);
      }
    }
  }
  return [...matched.values()];
}

export function normalizeAnswer(value: string) {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('ru-RU')
    .replace(/[−–—]/g, '-')
    .replace(/,/g, '.')
    .replace(/\s+/g, '')
    .replace(/[;.]$/, '');
}

export function answerMatches(answer: string, acceptedAnswers: string[]) {
  const normalized = normalizeAnswer(answer);
  if (!normalized) return false;
  if (!acceptedAnswers.length) return null;
  const numeric = Number(normalized);
  return acceptedAnswers.some((candidate) => {
    const expected = normalizeAnswer(candidate);
    if (normalized === expected) return true;
    const expectedNumeric = Number(expected);
    return (
      Number.isFinite(numeric) &&
      Number.isFinite(expectedNumeric) &&
      Math.abs(numeric - expectedNumeric) <=
        Math.max(1e-9, Math.abs(expectedNumeric) * 1e-9)
    );
  });
}

function difficultyDistance(task: CurriculumTask, mastery = 0.5) {
  const expected =
    mastery < 0.4
      ? TaskDifficulty.BASIC
      : mastery < 0.72
        ? TaskDifficulty.STANDARD
        : TaskDifficulty.ADVANCED;
  const rank = {
    [TaskDifficulty.BASIC]: 0,
    [TaskDifficulty.STANDARD]: 1,
    [TaskDifficulty.ADVANCED]: 2,
  };
  return Math.abs(rank[task.difficulty] - rank[expected]);
}

function normalizeWords(value: string) {
  return String(value ?? '')
    .toLocaleLowerCase('ru-RU')
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]+/gi, ' ')
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 2);
}

function similarity(left: string[], right: string[]) {
  if (!left.length || !right.length) return 0;
  const a = new Set(left);
  const b = new Set(right);
  const intersection = [...a].filter((word) => b.has(word)).length;
  const overlap = intersection / Math.min(a.size, b.size);
  const phraseA = left.join(' ');
  const phraseB = right.join(' ');
  if (phraseA.includes(phraseB) || phraseB.includes(phraseA)) {
    return Math.max(0.75, overlap);
  }
  return overlap;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
