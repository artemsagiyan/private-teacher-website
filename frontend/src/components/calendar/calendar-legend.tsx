import { Repeat } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export type LegendItem = {
  color: string;
  label: string;
  glow?: boolean;
};

export function CalendarLegend({
  items,
  showRecurringHint = false,
}: {
  items: LegendItem[];
  showRecurringHint?: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <p className="mb-3 text-[0.65rem] font-semibold uppercase tracking-wider text-[rgb(var(--text-3))]">
          Обозначения
        </p>
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.label} className="flex items-center gap-2.5">
              <span
                className="h-3 w-3 shrink-0 rounded-sm"
                style={{
                  background: item.color,
                  boxShadow: item.glow
                    ? `0 0 6px ${item.color}80`
                    : undefined,
                }}
              />
              <span className="text-xs text-[rgb(var(--text-2))]">{item.label}</span>
            </div>
          ))}
          {showRecurringHint && (
            <div className="mt-1 flex items-center gap-2.5 border-t border-[rgb(var(--border))] pt-2">
              <Repeat className="h-3 w-3 shrink-0 text-violet-500" />
              <span className="text-xs text-[rgb(var(--text-2))]">
                ↻ — регулярный слот
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
