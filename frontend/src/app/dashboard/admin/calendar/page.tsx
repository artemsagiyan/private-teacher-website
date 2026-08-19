'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { api } from '@/lib/api';
import { CalendarSlot } from '@/types';
import { fullName, getSlotColor } from '@/lib/utils';
import { lessonTypeLabel, slotStatusLabel } from '@/lib/lesson';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { WeekCalendar } from '@/components/calendar/week-calendar';
import { CalendarLegend } from '@/components/calendar/calendar-legend';
import { CalendarPageHeader } from '@/components/calendar/calendar-page-header';
import { SidePanel } from '@/components/calendar/side-panel';
import { formatDateTime } from '@/lib/utils';

export default function AdminCalendarPage() {
  const [slots, setSlots] = useState<CalendarSlot[]>([]);
  const [selected, setSelected] = useState<CalendarSlot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<CalendarSlot[]>('/calendar/all')
      .then((data) => setSlots(data ?? []))
      .finally(() => setLoading(false));
  }, []);

  const events = useMemo(
    () =>
      slots.map((s) => {
        const teacherName = s.teacher
          ? fullName(s.teacher.user ?? undefined)
          : '';
        return {
          id: s.id,
          title: [
            teacherName || (s.lessonType === 'individual' ? 'Инд.' : 'Гр.'),
            s.isRecurring ? '↻' : '',
          ]
            .filter(Boolean)
            .join(' '),
          start: s.startTime,
          end: s.endTime,
          backgroundColor: getSlotColor(s.status),
          borderColor: 'transparent',
          textColor: '#fff',
          extendedProps: { slot: s },
        };
      }),
    [slots],
  );

  return (
    <div className="space-y-5">
      <CalendarPageHeader
        title="Все занятия"
        description="Сводный календарь платформы"
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="xl:col-span-2">
          {loading ? (
            <div className="skeleton h-[560px] rounded-2xl" />
          ) : slots.length === 0 ? (
            <Card>
              <CardContent>
                <EmptyState
                  icon={CalendarDays}
                  title="Слотов пока нет"
                  description="Когда преподаватели создадут расписание, оно появится здесь."
                />
              </CardContent>
            </Card>
          ) : (
            <WeekCalendar
              events={events}
              onEventClick={(info) =>
                setSelected(info.event.extendedProps.slot)
              }
            />
          )}
        </div>

        <div className="space-y-4 xl:sticky xl:top-6 xl:self-start">
          <CalendarLegend
            items={[
              { color: '#10b981', label: 'Свободно' },
              { color: '#6366f1', label: 'Занято' },
              { color: '#ef4444', label: 'Отменено' },
            ]}
            showRecurringHint
          />

          {selected ? (
            <SidePanel title="Слот" onClose={() => setSelected(null)}>
              <p className="text-sm text-[rgb(var(--text-2))]">
                {formatDateTime(selected.startTime)}
              </p>
              <p className="text-sm text-[rgb(var(--text))]">
                {selected.teacher
                  ? fullName(selected.teacher.user ?? undefined) ||
                    'Преподаватель'
                  : 'Преподаватель не указан'}
              </p>
              <p className="text-xs text-[rgb(var(--text-3))]">
                {lessonTypeLabel(selected.lessonType)} ·{' '}
                {selected.bookedCount ?? 0}/{selected.capacity} мест
              </p>
              <Badge
                variant={
                  selected.status === 'available'
                    ? 'success'
                    : selected.status === 'booked'
                      ? 'default'
                      : 'danger'
                }
                dot
              >
                {slotStatusLabel(selected.status)}
              </Badge>
              {selected.note && (
                <p className="text-xs text-[rgb(var(--text-3))]">
                  {selected.note}
                </p>
              )}
            </SidePanel>
          ) : (
            <Card>
              <CardContent className="pt-5">
                <EmptyState
                  icon={CalendarDays}
                  title="Выберите слот"
                  description="Нажмите на событие, чтобы увидеть преподавателя и статус."
                  className="py-4"
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
