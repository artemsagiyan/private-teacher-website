'use client';

import { useEffect, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import ruLocale from '@fullcalendar/core/locales/ru';
import { toast } from 'sonner';
import { Plus, Clock, Users, Trash2, X, Repeat, ChevronLeft, ChevronRight, Video } from 'lucide-react';
import { api } from '@/lib/api';
import { CalendarSlot, LessonType } from '@/types';
import { getSlotColor, formatDateTime } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// ─── Time picker helpers ─────────────────────────────────────────────────────

const DAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const HOURS_START = 8;
const HOURS_END   = 22;

function getWeekDays(baseDate: Date): Date[] {
  const d = new Date(baseDate);
  const day = d.getDay() || 7; // Mon=1..Sun=7
  d.setDate(d.getDate() - (day - 1));
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(d);
    x.setDate(d.getDate() + i);
    return x;
  });
}

function formatDayNum(d: Date) { return d.getDate(); }
function formatMonth(d: Date) {
  return d.toLocaleString('ru', { month: 'short' });
}
function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth() === b.getMonth() &&
         a.getDate() === b.getDate();
}

function generateTimeSlots(existing: CalendarSlot[], selectedDay: Date | null): { label: string; date: Date; busy: boolean }[] {
  if (!selectedDay) return [];
  const slots: { label: string; date: Date; busy: boolean }[] = [];
  for (let h = HOURS_START; h < HOURS_END; h++) {
    for (let m = 0; m < 60; m += 30) {
      const d = new Date(selectedDay);
      d.setHours(h, m, 0, 0);
      const label = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      const busy = d < new Date() || existing.some((s) => {
        const ss = new Date(s.startTime);
        const se = new Date(s.endTime);
        return d >= ss && d < se;
      });
      slots.push({ label, date: d, busy });
    }
  }
  return slots;
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function TeacherCalendarPage() {
  const router = useRouter();
  const [slots, setSlots]         = useState<CalendarSlot[]>([]);
  const [selected, setSelected]   = useState<CalendarSlot | null>(null);
  const [creating, setCreating]   = useState(false);
  const [saving, setSaving]       = useState(false);
  const calendarRef               = useRef<any>(null);

  // Time picker state
  const [pickerWeekBase, setPickerWeekBase] = useState(new Date());
  const [pickerDay, setPickerDay]           = useState<Date | null>(null);
  const [startSlot, setStartSlot]           = useState<Date | null>(null);
  const [lessonType, setLessonType]         = useState<LessonType>('individual');
  const [capacity, setCapacity]             = useState(1);
  const [note, setNote]                     = useState('');
  const [isRecurring, setIsRecurring]       = useState(false);

  const load = async () => {
    const d = await api.get<CalendarSlot[]>('/calendar/teacher');
    setSlots(d);
  };
  useEffect(() => { load(); }, []);

  const weekDays = getWeekDays(pickerWeekBase);
  const timeSlots = generateTimeSlots(slots, pickerDay);

  const prevPickerWeek = () => {
    const d = new Date(pickerWeekBase);
    d.setDate(d.getDate() - 7);
    setPickerWeekBase(d);
    setPickerDay(null);
    setStartSlot(null);
  };
  const nextPickerWeek = () => {
    const d = new Date(pickerWeekBase);
    d.setDate(d.getDate() + 7);
    setPickerWeekBase(d);
    setPickerDay(null);
    setStartSlot(null);
  };

  const handleCreate = async () => {
    if (!startSlot) { toast.error('Выберите время'); return; }
    setSaving(true);
    try {
      const end = new Date(startSlot.getTime() + 60 * 60 * 1000);
      await api.post('/calendar/slots', {
        startTime: startSlot.toISOString(),
        endTime: end.toISOString(),
        lessonType,
        capacity,
        note: note || undefined,
        isRecurring,
      });
      toast.success(isRecurring ? 'Серия слотов создана на 4 недели' : 'Слот создан');
      setCreating(false);
      setPickerDay(null);
      setStartSlot(null);
      setNote('');
      setIsRecurring(false);
      load();
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
      await api.delete(`/calendar/slots/${selected.id}${cancelSeries ? '?cancelSeries=true' : ''}`);
      toast.success(cancelSeries ? 'Серия отменена' : 'Слот отменён');
      setSelected(null);
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Ошибка');
    }
  };

  const events = slots.map((s) => ({
    id: s.id,
    title: [
      s.lessonType === 'individual' ? 'Инд.' : 'Гр.',
      `${s.bookedCount}/${s.capacity}`,
      s.isRecurring ? '↻' : '',
    ].filter(Boolean).join(' '),
    start: s.startTime,
    end: s.endTime,
    backgroundColor: getSlotColor(s.status),
    borderColor: 'transparent',
    textColor: '#fff',
    extendedProps: { slot: s },
  }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[rgb(var(--text))] tracking-tight">Управление расписанием</h1>
          <p className="text-sm text-[rgb(var(--text-2))] mt-0.5">Создавайте разовые или еженедельные слоты</p>
        </div>
        <Button size="sm" variant="gradient" onClick={() => { setCreating(true); setSelected(null); }}>
          <Plus className="h-4 w-4" /> Новый слот
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Calendar */}
        <div className="lg:col-span-2 bg-[rgb(var(--surface))] rounded-2xl border border-[rgb(var(--border))] p-4 shadow-card">
          <FullCalendar
            ref={calendarRef}
            plugins={[timeGridPlugin, interactionPlugin]}
            initialView="timeGridWeek"
            locale={ruLocale}
            firstDay={1}
            headerToolbar={{ left: 'prev,next today', center: 'title', right: '' }}
            buttonText={{ today: 'Сегодня' }}
            dayHeaderContent={(args) => {
              const wd = args.date.toLocaleDateString('ru', { weekday: 'short' }).toUpperCase();
              return { html: `<div class="cal-day-header"><span class="cal-weekday">${wd}</span><span class="cal-daynum${args.isToday ? ' cal-today' : ''}">${args.date.getDate()}</span></div>` };
            }}
            events={events}
            eventClick={(info) => { setSelected(info.event.extendedProps.slot); setCreating(false); }}
            height="auto"
            slotMinTime="08:00:00"
            slotMaxTime="22:00:00"
            slotDuration="00:30:00"
            slotLabelInterval="01:00:00"
            allDaySlot={false}
            nowIndicator
          />
        </div>

        {/* Right panel */}
        <div className="space-y-4">

          {/* Create form with time picker */}
          {creating && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Новый слот</CardTitle>
                  <button
                    onClick={() => setCreating(false)}
                    className="h-6 w-6 rounded-md flex items-center justify-center hover:bg-[rgb(var(--surface-2))] text-[rgb(var(--text-3))] transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">

                {/* Week navigator */}
                <div>
                  <p className="text-xs font-medium text-[rgb(var(--text-2))] uppercase tracking-wide mb-2">Выберите день</p>
                  <div className="flex items-center gap-1 mb-2">
                    <button onClick={prevPickerWeek} className="h-6 w-6 rounded flex items-center justify-center hover:bg-[rgb(var(--surface-2))] text-[rgb(var(--text-2))]">
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    <span className="flex-1 text-center text-xs text-[rgb(var(--text-2))]">
                      {weekDays[0].toLocaleString('ru', { day: 'numeric', month: 'short' })} –{' '}
                      {weekDays[6].toLocaleString('ru', { day: 'numeric', month: 'short' })}
                    </span>
                    <button onClick={nextPickerWeek} className="h-6 w-6 rounded flex items-center justify-center hover:bg-[rgb(var(--surface-2))] text-[rgb(var(--text-2))]">
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {weekDays.map((day, i) => {
                      const isPast = day < new Date(new Date().setHours(0,0,0,0));
                      const isSelected = pickerDay && isSameDay(day, pickerDay);
                      return (
                        <button
                          key={i}
                          disabled={isPast}
                          onClick={() => { setPickerDay(day); setStartSlot(null); }}
                          className={cn(
                            'flex flex-col items-center py-1.5 rounded-lg text-center transition-all text-[0.65rem]',
                            isSelected
                              ? 'bg-primary-600 text-white'
                              : isPast
                              ? 'text-[rgb(var(--text-3))] opacity-40 cursor-not-allowed'
                              : 'hover:bg-[rgb(var(--surface-2))] text-[rgb(var(--text-2))]',
                          )}
                        >
                          <span className="font-medium">{DAYS_SHORT[i]}</span>
                          <span className={cn('font-bold text-xs mt-0.5', !isSelected && !isPast && isSameDay(day, new Date()) && 'text-primary-500')}>
                            {formatDayNum(day)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Time grid */}
                {pickerDay && (
                  <div>
                    <p className="text-xs font-medium text-[rgb(var(--text-2))] uppercase tracking-wide mb-2">
                      Начало занятия
                    </p>
                    <div className="grid grid-cols-4 gap-1 max-h-48 overflow-y-auto pr-1">
                      {timeSlots.map((ts) => {
                        const isChosen = startSlot && ts.date.getTime() === startSlot.getTime();
                        return (
                          <button
                            key={ts.label}
                            disabled={ts.busy}
                            onClick={() => setStartSlot(ts.date)}
                            className={cn(
                              'py-1.5 rounded-lg text-[0.72rem] font-medium border transition-all',
                              isChosen
                                ? 'bg-primary-600 text-white border-primary-600'
                                : ts.busy
                                ? 'border-transparent bg-[rgb(var(--surface-2))] text-[rgb(var(--text-3))] opacity-40 cursor-not-allowed'
                                : 'border-[rgb(var(--border))] text-[rgb(var(--text-2))] hover:bg-[rgb(var(--surface-2))] hover:border-primary-300',
                            )}
                          >
                            {ts.label}
                          </button>
                        );
                      })}
                    </div>
                    {startSlot && (
                      <p className="text-xs text-primary-600 dark:text-primary-400 mt-2 font-medium">
                        Занятие: {startSlot.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })} –{' '}
                        {new Date(startSlot.getTime() + 3600000).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                  </div>
                )}

                {/* Lesson type */}
                <div>
                  <p className="text-xs font-medium text-[rgb(var(--text-2))] uppercase tracking-wide mb-2">Тип занятия</p>
                  <div className="grid grid-cols-2 gap-2">
                    {(['individual', 'group'] as LessonType[]).map((t) => (
                      <button
                        key={t}
                        onClick={() => setLessonType(t)}
                        className={cn(
                          'py-1.5 rounded-lg text-xs font-medium border transition-all',
                          lessonType === t
                            ? 'bg-primary-600 text-white border-primary-600'
                            : 'border-[rgb(var(--border))] text-[rgb(var(--text-2))] hover:bg-[rgb(var(--surface-2))]',
                        )}
                      >
                        {t === 'individual' ? 'Индивидуальное' : 'Групповое'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Capacity */}
                <div>
                  <p className="text-xs font-medium text-[rgb(var(--text-2))] uppercase tracking-wide mb-2">Мест: {capacity}</p>
                  <input
                    type="range"
                    min={1}
                    max={lessonType === 'individual' ? 1 : 10}
                    value={capacity}
                    onChange={(e) => setCapacity(+e.target.value)}
                    className="w-full accent-primary-600"
                  />
                </div>

                {/* Recurring toggle */}
                <button
                  onClick={() => setIsRecurring((v) => !v)}
                  className={cn(
                    'w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all',
                    isRecurring
                      ? 'border-violet-400 bg-violet-50 dark:bg-violet-900/15'
                      : 'border-[rgb(var(--border))] hover:bg-[rgb(var(--surface-2))]',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Repeat className={cn('h-4 w-4', isRecurring ? 'text-violet-600' : 'text-[rgb(var(--text-3))]')} />
                    <div className="text-left">
                      <p className={cn('text-xs font-medium', isRecurring ? 'text-violet-700 dark:text-violet-300' : 'text-[rgb(var(--text))]')}>
                        Повторять каждую неделю
                      </p>
                      {isRecurring && (
                        <p className="text-[0.65rem] text-violet-500">Создастся 4 слота подряд</p>
                      )}
                    </div>
                  </div>
                  <div className={cn('h-4 w-7 rounded-full transition-colors relative', isRecurring ? 'bg-violet-500' : 'bg-[rgb(var(--border))]')}>
                    <span className={cn('absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all shadow-sm', isRecurring ? 'left-3.5' : 'left-0.5')} />
                  </div>
                </button>

                {/* Note */}
                <div>
                  <p className="text-xs font-medium text-[rgb(var(--text-2))] uppercase tracking-wide mb-1.5">Заметка</p>
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Необязательно..."
                    className="w-full text-sm bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-lg px-3 py-2 text-[rgb(var(--text))] placeholder:text-[rgb(var(--text-3))] focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500 transition-all"
                  />
                </div>

                <Button
                  onClick={handleCreate}
                  isLoading={saving}
                  className="w-full"
                  variant={isRecurring ? 'gradient' : 'default'}
                  disabled={!startSlot}
                >
                  {isRecurring ? 'Создать серию слотов' : 'Создать слот'}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Selected slot info */}
          {selected && !creating && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Слот</CardTitle>
                  <button
                    onClick={() => setSelected(null)}
                    className="h-6 w-6 rounded-md flex items-center justify-center hover:bg-[rgb(var(--surface-2))] text-[rgb(var(--text-3))] transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-[rgb(var(--text-2))]">
                    <Clock className="h-3.5 w-3.5 text-[rgb(var(--text-3))] shrink-0" />
                    {formatDateTime(selected.startTime)}
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-3.5 w-3.5 text-[rgb(var(--text-3))] shrink-0" />
                    <span className="text-[rgb(var(--text-2))]">{selected.bookedCount}/{selected.capacity} мест</span>
                  </div>
                  {selected.isRecurring && (
                    <div className="flex items-center gap-2">
                      <Repeat className="h-3.5 w-3.5 text-violet-500 shrink-0" />
                      <span className="text-xs text-violet-600 dark:text-violet-400">Регулярный слот</span>
                    </div>
                  )}
                  <Badge
                    variant={selected.status === 'available' ? 'success' : selected.status === 'booked' ? 'default' : 'danger'}
                    dot
                  >
                    {selected.status === 'available' ? 'Свободно' : selected.status === 'booked' ? 'Заполнено' : 'Отменено'}
                  </Badge>
                  {selected.note && <p className="text-[rgb(var(--text-3))] text-xs">{selected.note}</p>}
                </div>

                {(() => {
                  if (selected.status === 'cancelled') return null;
                  const now = Date.now();
                  const start = new Date(selected.startTime).getTime();
                  const end = new Date(selected.endTime).getTime();
                  // Match backend: early 30m before start, late 120m after end
                  const canJoin =
                    now >= start - 30 * 60_000 && now <= end + 120 * 60_000;
                  return canJoin ? (
                    <Button
                      className="w-full bg-emerald-500 hover:bg-emerald-600 text-white"
                      size="sm"
                      onClick={() => router.push(`/dashboard/teacher/lesson/${selected.id}`)}
                    >
                      <Video className="h-3.5 w-3.5" /> Войти в урок
                    </Button>
                  ) : null;
                })()}

                {selected.status === 'available' && (
                  <div className="space-y-2 pt-1">
                    <Button variant="destructive" size="sm" className="w-full" onClick={() => handleDelete(false)}>
                      <Trash2 className="h-3.5 w-3.5" /> Отменить этот слот
                    </Button>
                    {selected.isRecurring && (
                      <Button variant="outline" size="sm" className="w-full text-red-500 hover:text-red-600 hover:border-red-300" onClick={() => handleDelete(true)}>
                        <Repeat className="h-3.5 w-3.5" /> Отменить всю серию
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Legend */}
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs text-[rgb(var(--text-3))] mb-3 font-medium uppercase tracking-wide">Обозначения</p>
              <div className="space-y-2">
                {[
                  { color: '#10b981', label: 'Свободно' },
                  { color: '#6366f1', label: 'Занято' },
                  { color: '#ef4444', label: 'Отменено' },
                ].map((l) => (
                  <div key={l.label} className="flex items-center gap-2.5">
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: l.color }} />
                    <span className="text-xs text-[rgb(var(--text-2))]">{l.label}</span>
                  </div>
                ))}
                <div className="flex items-center gap-2.5 pt-1 border-t border-[rgb(var(--border))] mt-1">
                  <Repeat className="h-3 w-3 text-violet-500 shrink-0" />
                  <span className="text-xs text-[rgb(var(--text-2))]">↻ — регулярный слот</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
