import type { TopicProgress } from '@/types/learning';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const SIZE = 320;
const CENTER = SIZE / 2;
const RADIUS = 116;

export function ProgressRose({
  topics,
  title = 'Роза ветров · прогресс по темам',
}: {
  topics: TopicProgress[];
  title?: string;
}) {
  const measured = topics.filter((topic) => topic.evidenceCount > 0);
  const points = topics.map((topic, index) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * index) / Math.max(topics.length, 1);
    const value = topic.evidenceCount > 0 ? clamp(topic.mastery, 0, 1) : 0;
    return {
      ...topic,
      x: CENTER + Math.cos(angle) * RADIUS * value,
      y: CENTER + Math.sin(angle) * RADIUS * value,
      axisX: CENTER + Math.cos(angle) * RADIUS,
      axisY: CENTER + Math.sin(angle) * RADIUS,
    };
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <p className="mt-1 text-xs text-[rgb(var(--text-3))]">
          {measured.length} из {topics.length} тем оценено. Неоценённые темы
          показаны в центре, это не означает нулевой уровень знаний.
        </p>
      </CardHeader>
      <CardContent>
        {topics.length ? (
          <div className="grid items-center gap-5 lg:grid-cols-[minmax(260px,360px)_minmax(0,1fr)]">
            <svg
              viewBox={`0 0 ${SIZE} ${SIZE}`}
              role="img"
              aria-label={`Роза ветров: освоено ${measured.length} из ${topics.length} тем`}
              className="mx-auto w-full max-w-[360px] overflow-visible text-[rgb(var(--text-3))]"
            >
              <title>{title}</title>
              {[0.25, 0.5, 0.75, 1].map((scale) => (
                <circle
                  key={scale}
                  cx={CENTER}
                  cy={CENTER}
                  r={RADIUS * scale}
                  fill="none"
                  stroke="currentColor"
                  strokeOpacity="0.2"
                  strokeWidth="1"
                />
              ))}
              {points.map((point) => (
                <line
                  key={`${point.id}-axis`}
                  x1={CENTER}
                  y1={CENTER}
                  x2={point.axisX}
                  y2={point.axisY}
                  stroke="currentColor"
                  strokeOpacity="0.2"
                  strokeWidth="1"
                />
              ))}
              {measured.length > 0 && (
                <polygon
                  points={points.map((point) => `${point.x},${point.y}`).join(' ')}
                  fill="rgb(var(--primary) / 0.18)"
                  stroke="rgb(var(--primary))"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
              )}
              {points.map((point) => (
                <circle
                  key={point.id}
                  cx={point.x}
                  cy={point.y}
                  r={point.evidenceCount ? 4 : 2.5}
                  fill={topicColor(point)}
                  stroke="rgb(var(--surface))"
                  strokeWidth="1.5"
                >
                  <title>
                    {point.code} · {point.title}: {point.evidenceCount ? `${Math.round(point.mastery * 100)}%` : 'не оценивалась'}
                  </title>
                </circle>
              ))}
            </svg>

            <ul className="grid gap-x-5 gap-y-3 sm:grid-cols-2">
              {topics.map((topic) => (
                <li key={topic.id} className="flex min-w-0 items-start gap-2">
                  <span
                    className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: topicColor(topic) }}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 text-xs leading-5">
                    <span className="mr-1 text-[rgb(var(--text-3))]">{topic.code}</span>
                    <span className="text-[rgb(var(--text))]">{topic.title}</span>
                    <span className="ml-1 text-[rgb(var(--text-2))]">
                      {topic.evidenceCount ? `${Math.round(topic.mastery * 100)}%` : 'Не оценивалась'}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-[rgb(var(--text-2))]">В активном каталоге нет тем.</p>
        )}
      </CardContent>
    </Card>
  );
}

function topicColor(topic: TopicProgress) {
  if (!topic.evidenceCount) return 'rgb(var(--text-3) / 0.55)';
  if (topic.state === 'mastered') return 'rgb(16 155 95)';
  if (topic.state === 'gap') return 'rgb(220 65 82)';
  return 'rgb(224 154 44)';
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
