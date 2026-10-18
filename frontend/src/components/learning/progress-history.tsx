import { CalendarDays } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { LearningProgress } from '@/types/learning';

export function ProgressPeriodFilter({
  period,
  onChange,
}: {
  period: string;
  onChange: (period: string) => void;
}) {
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-5">
        <div className="flex items-center gap-2 text-sm font-medium text-[rgb(var(--text))]">
          <CalendarDays className="h-4 w-4 text-primary-500" />
          Период динамики
        </div>
        <select
          value={period}
          onChange={(event) => onChange(event.target.value)}
          aria-label="Период динамики прогресса"
          className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 py-2 text-sm text-[rgb(var(--text))]"
        >
          <option value="30">Последние 30 дней</option>
          <option value="90">Последние 90 дней</option>
          <option value="365">Последний год</option>
          <option value="all">Всё время</option>
        </select>
      </CardContent>
    </Card>
  );
}

export function ProgressHistory({
  history,
}: {
  history?: LearningProgress['history'];
}) {
  if (!history?.length) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Динамика «было → стало»</CardTitle>
        <p className="mt-1 text-xs text-[rgb(var(--text-3))]">
          Накопленная оценка освоения тем по месяцам выбранного периода.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {history.map((item, index) => {
          const previous = history[index - 1]?.expected;
          const trend =
            previous !== null && previous !== undefined && item.expected !== null
              ? item.expected - previous
              : null;
          return (
            <div key={item.period} className="flex items-center gap-3 text-sm">
              <span className="w-20 shrink-0 text-xs text-[rgb(var(--text-2))]">
                {formatPeriod(item.period)}
              </span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-[rgb(var(--surface-2))]">
                <div
                  className="h-full rounded-full bg-primary-500 transition-[width]"
                  style={{ width: `${item.expected ?? 0}%` }}
                />
              </div>
              <span className="w-24 text-right text-xs text-[rgb(var(--text-2))]">
                {item.expected === null ? 'Нет данных' : `${item.expected}%`}
                {trend !== null && (
                  <span className={trend >= 0 ? 'ml-1 text-emerald-600' : 'ml-1 text-rose-600'}>
                    {trend >= 0 ? '+' : ''}{trend}
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function formatPeriod(value: string) {
  const [year, month] = value.split('-');
  return new Intl.DateTimeFormat('ru-RU', {
    month: 'short',
    year: 'numeric',
  }).format(new Date(Number(year), Number(month) - 1, 1));
}
