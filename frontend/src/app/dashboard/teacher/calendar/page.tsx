'use client';

import { useEffect, useMemo, useState } from 'react';
import type { DateSelectArg } from '@fullcalendar/core';
import { toast } from 'sonner';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  Repeat,
  Trash2,
  Users,
} from 'lucide-react';
import { api } from '@/lib/api';
import { CalendarSlot, LessonType } from '@/types';
import { cn, formatDateTime, getSlotColor } from '@/lib/utils';
import {
  CAL_HOURS_END,
  CAL_HOURS_START,
  RECURRING_WEEKS,
  SLOT_DURATION_MS,
  canJoinLesson,
  lessonTypeLabel,
  slotStatusLabel,
} from '@/lib/lesson';
import { useNow } from '@/lib/use-now';
import { LessonJoinLinks } from '@/components/lesson/lesson-join-links';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Segmented } from '@/components/ui/segmented';
import { EmptyState } from '@/components/ui/empty-state';
import { WeekCalendar } from '@/components/calendar/week-calendar';
import { CalendarLegend } from '@/components/calendar/calendar-legend';
import { CalendarPageHeader } from '@/components/calendar/calendar-page-header';
import { SidePanel } from '@/components/calendar/side-panel';

const DAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

function getWeekDays(baseDate: Date): Date[] {
  const d = new Date(baseDate);
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - (day - 1));
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(d);
    x.setDate(d.getDate() + i);
    return x;
  });
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function generateTimeSlots(
  existing: CalendarSlot[],
  selectedDay: Date | null,
) {
  if (!selectedDay) return [];
  const slots: { label: string; date: Date; busy: boolean }[] = [];
  for (let h = CAL_HOURS_START; h < CAL_HOURS_END; h++) {
    for (let m = 0; m < 60; m += 30) {
      const d = new Date(selectedDay);
      d.setHours(h, m, 0, 0);
      const label = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      const busy =
        d < new Date() ||
        existing.some((s) => {
          if (s.status === 'cancelled') return false;
          const ss = new Date(s.startTime);
          const se = new Date(s.endTime);
          return d >= ss && d < se;
        });
      slots.push({ label, date: d, busy });
    }
  }
  return slots;
}

export default function TeacherCalendarPage() {
  const now = useNow();
  const [slots, setSlots] = useState<CalendarSlot[]>([]);
  const [selected, setSelected] = useState<CalendarSlot | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const [pickerWeekBase, setPickerWeekBase] = useState(new Date());
  const [pickerDay, setPickerDay] = useState<Date | null>(null);
  const [startSlot, setStartSlot] = useState<Date | null>(null);
  const [lessonType, setLessonType] = useState<LessonType>('individual');
  const [capacity, setCapacity] = useState(1);
  const [note, setNote] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);

  const load = async () => {
    try {
      const data = await api.get<CalendarSlot[]>('/calendar/teacher');
      setSlots(data ?? []);
    } catch {
      toast.error('Не удалось загрузить слоты');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const weekDays = getWeekDays(pickerWeekBase);
  const timeSlots = generateTimeSlots(slots, pickerDay);

  const openCreate = (day?: Date, start?: Date) => {
    setCreating(true);
    setSelected(null);
    if (day) {
      setPickerDay(day);
      setPickerWeekBase(day);
    }
    if (start) setStartSlot(start);
  };

  const handleCreate = async () => {
    if (!startSlot) {
      toast.error('Выберите время');
      return;
    }
    setSaving(true);
    try {
      const end = new Date(startSlot.getTime() + SLOT_DURATION_MS);
      await api.post('/calendar/slots', {
        startTime: startSlot.toISOString(),
        endTime: end.toISOString(),
        lessonType,
        capacity: lessonType === 'individual' ? 1 : capacity,
        note: note || undefined,
        isRecurring,
      });
      toast.success(
        isRecurring
          ? `Серия слотов создана на ${RECURRING_WEEKS} недели`
          : 'Слот создан',
      );
      setCreating(false);
      setPickerDay(null);
      setStartSlot(null);
      setNote('');
      setIsRecurring(false);
      setLessonType('individual');
      setCapacity(1);
      await load();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Ошибка');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (cancelSeries = false) => {
    if (!selected) return;
    const msg = cancelSeries
      ? 'Отменить всю серию слотов?'
      : 'Отменить этот слот?';
    if (!confirm(msg)) return;
    try {
      await api.delete(
        `/calendar/slots/${selected.id}${cancelSeries ? '?cancelSeries=true' : ''}`,
      );
      toast.success(cancelSeries ? 'Серия отменена' : 'Слот отменён');
      setSelected(null);
      await load();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Ошибка');
    }
  };

  const onDateSelect = (info: DateSelectArg) => {
    const start = info.start;
    if (start < new Date()) {
      toast.error('Нельзя создать слот в прошлом');
      info.view.calendar.unselect();
      return;
    }
    openCreate(start, start);
    info.view.calendar.unselect();
  };

  const events = useMemo(
    () =>
      slots.map((s) => ({
        id: s.id,
        title: [
          s.lessonType === 'individual' ? 'Инд.' : 'Гр.',
          `${s.bookedCount ?? 0}/${s.capacity}`,
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
      })),
    [slots],
  );

  const joinable =
    selected &&
    selected.status !== 'cancelled' &&
    canJoinLesson(selected.startTime, selected.endTime, now);

  return (
    <div className="space-y-5">
      <CalendarPageHeader
        title="Расписание"
        description="Создавайте слоты и управляйте записью учеников"
        actions={
          <Button
            size="sm"
            variant="gradient"
            onClick={() => openCreate()}
          >
            <Plus className="h-4 w-4" /> Новый слот
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="xl:col-span-2">
          {loading ? (
            <div className="skeleton h-[560px] rounded-2xl" />
          ) : (
            <WeekCalendar
              events={events}
              selectable
              onDateSelect={onDateSelect}
              onEventClick={(info) => {
                setSelected(info.event.extendedProps.slot);
                setCreating(false);
              }}
            />
          )}
          <p className="mt-2 text-xs text-[rgb(var(--text-3))]">
            Подсказка: выделите время на календаре или нажмите «Новый слот»
          </p>
        </div>

        <div className="space-y-4 xl:sticky xl:top-6 xl:self-start">
          {creating && (
            <SidePanel title="Новый слот" onClose={() => setCreating(false)}>
              <div>
                <p className="mb-2 text-[0.65rem] font-semibold uppercase tracking-wider text-[rgb(var(--text-3))]">
                  День
                </p>
                <div className="mb-2 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date(pickerWeekBase);
                      d.setDate(d.getDate() - 7);
                      setPickerWeekBase(d);
                      setPickerDay(null);
                      setStartSlot(null);
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-[rgb(var(--text-2))] hover:bg-[rgb(var(--surface-2))]"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <span className="flex-1 text-center text-xs text-[rgb(var(--text-2))]">
                    {weekDays[0].toLocaleString('ru', {
                      day: 'numeric',
                      month: 'short',
                    })}{' '}
                    –{' '}
                    {weekDays[6].toLocaleString('ru', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date(pickerWeekBase);
                      d.setDate(d.getDate() + 7);
                      setPickerWeekBase(d);
                      setPickerDay(null);
                      setStartSlot(null);
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-[rgb(var(--text-2))] hover:bg-[rgb(var(--surface-2))]"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {weekDays.map((day, i) => {
                    const isPast =
                      day < new Date(new Date().setHours(0, 0, 0, 0));
                    const isSelected = pickerDay && isSameDay(day, pickerDay);
                    return (
                      <button
                        key={i}
                        type="button"
                        disabled={isPast}
                        onClick={() => {
                          setPickerDay(day);
                          setStartSlot(null);
                        }}
                        className={cn(
                          'flex flex-col items-center rounded-lg py-1.5 text-center text-[0.65rem] transition-all',
                          isSelected
                            ? 'bg-primary-600 text-white'
                            : isPast
                              ? 'cursor-not-allowed text-[rgb(var(--text-3))] opacity-40'
                              : 'text-[rgb(var(--text-2))] hover:bg-[rgb(var(--surface-2))]',
                        )}
                      >
                        <span className="font-medium">{DAYS_SHORT[i]}</span>
                        <span
                          className={cn(
                            'mt-0.5 text-xs font-bold',
                            !isSelected &&
                              !isPast &&
                              isSameDay(day, new Date()) &&
                              'text-primary-500',
                          )}
                        >
                          {day.getDate()}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {pickerDay && (
                <div>
                  <p className="mb-2 text-[0.65rem] font-semibold uppercase tracking-wider text-[rgb(var(--text-3))]">
                    Начало (1 час)
                  </p>
                  <div className="grid max-h-44 grid-cols-4 gap-1 overflow-y-auto pr-1">
                    {timeSlots.map((ts) => {
                      const isChosen =
                        startSlot &&
                        ts.date.getTime() === startSlot.getTime();
                      return (
                        <button
                          key={ts.label}
                          type="button"
                          disabled={ts.busy}
                          onClick={() => setStartSlot(ts.date)}
                          className={cn(
                            'rounded-lg border py-1.5 text-[0.72rem] font-medium transition-all',
                            isChosen
                              ? 'border-primary-600 bg-primary-600 text-white'
                              : ts.busy
                                ? 'cursor-not-allowed border-transparent bg-[rgb(var(--surface-2))] text-[rgb(var(--text-3))] opacity-40'
                                : 'border-[rgb(var(--border))] text-[rgb(var(--text-2))] hover:border-primary-300 hover:bg-[rgb(var(--surface-2))]',
                          )}
                        >
                          {ts.label}
                        </button>
                      );
                    })}
                  </div>
                  {startSlot && (
                    <p className="mt-2 text-xs font-medium text-primary-600 dark:text-primary-400">
                      {startSlot.toLocaleTimeString('ru', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}{' '}
                      –{' '}
                      {new Date(
                        startSlot.getTime() + SLOT_DURATION_MS,
                      ).toLocaleTimeString('ru', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  )}
                </div>
              )}

              <div>
                <p className="mb-2 text-[0.65rem] font-semibold uppercase tracking-wider text-[rgb(var(--text-3))]">
                  Тип
                </p>
                <Segmented
                  className="w-full [&>button]:flex-1"
                  value={lessonType}
                  onChange={(t) => {
                    setLessonType(t);
                    if (t === 'individual') setCapacity(1);
                  }}
                  options={[
                    { value: 'individual', label: 'Индивидуальное' },
                    { value: 'group', label: 'Групповое' },
                  ]}
                />
              </div>

              {lessonType === 'group' && (
                <div>
                  <p className="mb-2 text-[0.65rem] font-semibold uppercase tracking-wider text-[rgb(var(--text-3))]">
                    Мест: {capacity}
                  </p>
                  <input
                    type="range"
                    min={2}
                    max={10}
                    value={capacity}
                    onChange={(e) => setCapacity(+e.target.value)}
                    className="w-full accent-primary-600"
                  />
                </div>
              )}

              <button
                type="button"
                onClick={() => setIsRecurring((v) => !v)}
                className={cn(
                  'flex w-full items-center justify-between rounded-xl border px-3 py-2.5 transition-all',
                  isRecurring
                    ? 'border-violet-400 bg-violet-50 dark:bg-violet-900/15'
                    : 'border-[rgb(var(--border))] hover:bg-[rgb(var(--surface-2))]',
                )}
              >
                <div className="flex items-center gap-2 text-left">
                  <Repeat
                    className={cn(
                      'h-4 w-4',
                      isRecurring
                        ? 'text-violet-600'
                        : 'text-[rgb(var(--text-3))]',
                    )}
                  />
                  <div>
                    <p
                      className={cn(
                        'text-xs font-medium',
                        isRecurring
                          ? 'text-violet-700 dark:text-violet-300'
                          : 'text-[rgb(var(--text))]',
                      )}
                    >
                      Каждую неделю
                    </p>
                    {isRecurring && (
                      <p className="text-[0.65rem] text-violet-500">
                        {RECURRING_WEEKS} слота подряд
                      </p>
                    )}
                  </div>
                </div>
                <div
                  className={cn(
                    'relative h-4 w-7 rounded-full transition-colors',
                    isRecurring ? 'bg-violet-500' : 'bg-[rgb(var(--border))]',
                  )}
                >
                  <span
                    className={cn(
                      'absolute top-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-all',
                      isRecurring ? 'left-3.5' : 'left-0.5',
                    )}
                  />
                </div>
              </button>

              <div>
                <p className="mb-1.5 text-[0.65rem] font-semibold uppercase tracking-wider text-[rgb(var(--text-3))]">
                  Заметка
                </p>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Тема или комментарий…"
                  className="w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 py-2 text-sm text-[rgb(var(--text))] placeholder:text-[rgb(var(--text-3))] focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
                />
              </div>

              <Button
                onClick={handleCreate}
                isLoading={saving}
                className="w-full"
                variant={isRecurring ? 'gradient' : 'default'}
                disabled={!startSlot}
              >
                {isRecurring ? 'Создать серию' : 'Создать слот'}
              </Button>
            </SidePanel>
          )}

          {selected && !creating && (
            <SidePanel title="Слот" onClose={() => setSelected(null)}>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-[rgb(var(--text-2))]">
                  <Clock className="h-3.5 w-3.5 shrink-0 text-[rgb(var(--text-3))]" />
                  {formatDateTime(selected.startTime)}
                </div>
                <div className="flex items-center gap-2 text-[rgb(var(--text-2))]">
                  <Users className="h-3.5 w-3.5 shrink-0 text-[rgb(var(--text-3))]" />
                  {lessonTypeLabel(selected.lessonType)} ·{' '}
                  {selected.bookedCount ?? 0}/{selected.capacity} мест
                </div>
                {selected.isRecurring && (
                  <div className="flex items-center gap-2 text-xs text-violet-600 dark:text-violet-400">
                    <Repeat className="h-3.5 w-3.5" /> Регулярный слот
                  </div>
                )}
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
                {selected.status === 'available' && (
                  <div className="space-y-2">
                    <input
                      defaultValue={selected.note ?? ''}
                      key={selected.id}
                      id="edit-note"
                      placeholder="Заметка"
                      className="w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 py-2 text-sm"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={async () => {
                        const input = document.getElementById(
                          'edit-note',
                        ) as HTMLInputElement | null;
                        try {
                          await api.patch(`/calendar/slots/${selected.id}`, {
                            note: input?.value || '',
                            startTime: selected.startTime,
                            endTime: selected.endTime,
                            lessonType: selected.lessonType,
                            capacity: selected.capacity,
                          });
                          toast.success('Слот обновлён');
                          await load();
                        } catch (err: any) {
                          toast.error(
                            err.response?.data?.message || 'Не удалось сохранить',
                          );
                        }
                      }}
                    >
                      Сохранить заметку
                    </Button>
                  </div>
                )}
              </div>

              {selected.status !== 'cancelled' && (
                <LessonJoinLinks
                  role="teacher"
                  slotId={selected.id}
                  startTime={selected.startTime}
                  endTime={selected.endTime}
                  now={now}
                  layout="stack"
                  showHint={!joinable}
                />
              )}

              {selected.status === 'available' && (
                <div className="space-y-2 pt-1">
                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full"
                    onClick={() => handleDelete(false)}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Отменить слот
                  </Button>
                  {selected.isRecurring && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-red-500 hover:border-red-300 hover:text-red-600"
                      onClick={() => handleDelete(true)}
                    >
                      <Repeat className="h-3.5 w-3.5" /> Отменить всю серию
                    </Button>
                  )}
                </div>
              )}
            </SidePanel>
          )}

          {!creating && !selected && (
            <Card>
              <CardContent className="pt-5">
                <EmptyState
                  icon={Plus}
                  title="Создайте слот"
                  description="Нажмите «Новый слот» или выделите интервал на календаре — ученики смогут записаться."
                  action={
                    <Button size="sm" onClick={() => openCreate()}>
                      <Plus className="h-3.5 w-3.5" /> Создать
                    </Button>
                  }
                  className="py-4"
                />
              </CardContent>
            </Card>
          )}

          <CalendarLegend
            items={[
              { color: '#10b981', label: 'Свободно' },
              { color: '#6366f1', label: 'Занято' },
              { color: '#ef4444', label: 'Отменено' },
            ]}
            showRecurringHint
          />
        </div>
      </div>
    </div>
  );
}
