import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export type SectionReadinessValue = {
  section: string;
  min: number | null;
  expected: number | null;
  max: number | null;
  assessedTopics: number;
  topicCount: number;
};

export function SectionReadiness({
  sections,
}: {
  sections?: SectionReadinessValue[];
}) {
  if (!sections?.length) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>По разделам экзамена</CardTitle>
        <p className="mt-1 text-xs text-[rgb(var(--text-3))]">
          Это доля освоения тем, а не прогноз экзаменационного балла. Для каждого
          раздела показано, сколько тем уже оценено.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {sections.map((item) => (
          <div key={item.section}>
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-[rgb(var(--text))]">
                {item.section}
              </span>
              <span className="text-xs text-[rgb(var(--text-2))]">
                {item.expected === null
                  ? 'Пока нет данных'
                  : `${item.min}–${item.max}% · ориентир ${item.expected}%`}
                {' · '}
                {item.assessedTopics} из {item.topicCount} тем
              </span>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full bg-[rgb(var(--surface-2))]"
              role="meter"
              aria-label={`Освоение тем раздела ${item.section}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={item.expected ?? 0}
            >
              <div
                className="h-full rounded-full bg-primary-500 transition-[width]"
                style={{ width: `${item.expected ?? 0}%` }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
