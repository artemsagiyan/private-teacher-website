'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  BookOpen,
  CalendarDays,
  Clock,
  FileText,
  Repeat,
  Users,
} from 'lucide-react';
import { api } from '@/lib/api';
import { CalendarSlot, Booking } from '@/types';
import { formatDateTime, cn } from '@/lib/utils';
import {
  RECURRING_WEEKS,
  canJoinLesson,
  lessonTypeLabel,
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

type Mode = 'my' | 'book';

export default function StudentCalendarPage() {
  const now = useNow();
  const [mode, setMode] = useState<Mode>('my');
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const [freeSlots, setFreeSlots] = useState<CalendarSlot[]>([]);
  const [selected, setSelected] = useState<CalendarSlot | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [booking, setBooking] = useState(false);
  const [bookingType, setBookingType] = useState<'once' | 'recurring'>('once');
  const [loading, setLoading] = useState(true);

      const load = async () => {
    try {
      const [bookings, slots] = await Promise.all([
        api.get<Booking[]>('/bookings/upcoming'),
        api.get<CalendarSlot[]>('/calendar/student'),
      ]);
      setMyBookings(bookings ?? []);
      setFreeSlots(slots ?? []);
    } catch {
      toast.error('Не удалось загрузить расписание');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleBook = async () => {
    if (!selected) return;
    setBooking(true);
    try {
      await api.post('/bookings', {
        slotId: selected.id,
        isRecurring: bookingType === 'recurring' && selected.isRecurring,
      });
      toast.success(
        bookingType === 'recurring'
          ? 'Записаны на серию занятий'
          : 'Запись подтверждена',
      );
      setSelected(null);
      setMode('my');
      await load();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Ошибка записи');
    } finally {
      setBooking(false);
    }
  };

  const events = useMemo(() => {
    const myEvents = myBookings.map((b) => ({
      id: `booking-${b.id}`,
      title:
        b.slot.lessonType === 'individual' ? 'Моё занятие' : 'Групповое',
      start: b.slot.startTime,
      end: b.slot.endTime,
      backgroundColor: '#6366f1',
      borderColor: 'transparent',
      textColor: '#fff',
      classNames: ['my-booking-event'],
      extendedProps: { type: 'booking' as const, booking: b },
    }));

    const freeEvents = freeSlots
      .filter((s) => !myBookings.some((b) => b.slotId === s.id))
      .map((s) => ({
        id: `slot-${s.id}`,
        title: [
          s.lessonType === 'individual' ? 'Свободно' : 'Группа',
          s.isRecurring ? '↻' : '',
        ]
          .filter(Boolean)
          .join(' '),
        start: s.startTime,
        end: s.endTime,
        backgroundColor: '#10b981',
        borderColor: 'transparent',
        textColor: '#fff',
        extendedProps: { type: 'slot' as const, slot: s },
      }));

    if (mode === 'my') return myEvents;
    return [
      ...myEvents.map((e) => ({
        ...e,
        backgroundColor: '#818cf8',
        classNames: ['my-booking-dim'],
      })),
      ...freeEvents,
    ];
  }, [mode, myBookings, freeSlots]);

  return (
    <div className="space-y-4">
      <style>{`
        .my-booking-event { box-shadow: 0 0 12px rgb(99 102 241 / 0.35) !important; }
        .my-booking-dim { opacity: 0.55 !important; }
      `}</style>

      <CalendarPageHeader
        title="Расписание"
        description={
          mode === 'my'
            ? 'Ваши записанные занятия'
            : 'Выберите свободный слот преподавателя'
        }
        actions={
          <Segmented
            value={mode}
            onChange={(v) => {
              setMode(v);
              setSelected(null);
              setSelectedBooking(null);
            }}
            options={[
              {
                value: 'my',
                label: 'Моё',
                icon: <CalendarDays className="h-3.5 w-3.5" />,
              },
              {
                value: 'book',
                label: 'Записаться',
                icon: <BookOpen className="h-3.5 w-3.5" />,
              },
            ]}
          />
        }
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="xl:col-span-2">
          {loading ? (
            <div className="skeleton h-[560px] rounded-2xl" />
          ) : (
            <WeekCalendar
              events={events}
              onEventClick={(info) => {
                const { type, slot, booking: b } = info.event.extendedProps;
                if (type === 'slot') {
                  setSelected(slot);
                  setSelectedBooking(null);
                  setBookingType('once');
                } else if (type === 'booking') {
                  setSelectedBooking(b);
                  setSelected(null);
                }
              }}
            />
          )}
        </div>

        <div className="space-y-4 xl:sticky xl:top-6 xl:self-start">
          <CalendarLegend
            items={[
              { color: '#6366f1', label: 'Моё занятие', glow: true },
              ...(mode === 'book'
                ? [{ color: '#10b981', label: 'Свободный слот' }]
                : []),
            ]}
            showRecurringHint={mode === 'book'}
          />

          {mode === 'book' && !loading && freeSlots.length === 0 && (
            <EmptyState
              icon={Users}
              title="Нет свободных слотов"
              description="Привяжитесь к преподавателю по коду, чтобы видеть его расписание."
              action={
                <Link href="/dashboard/student/teacher">
                  <Button size="sm">Привязать преподавателя</Button>
                </Link>
              }
            />
          )}

          {selected && mode === 'book' ? (
            <SidePanel
              title="Запись на занятие"
              accent="success"
              onClose={() => setSelected(null)}
            >
              <MetaRow icon={Clock} text={formatDateTime(selected.startTime)} />
              <div className="flex items-center gap-2">
                <Users className="h-3.5 w-3.5 shrink-0 text-[rgb(var(--text-3))]" />
                <Badge variant="success">
                  {lessonTypeLabel(selected.lessonType)}
                </Badge>
              </div>
              {selected.isRecurring && (
                <MetaRow
                  icon={Repeat}
                  text="Слот из регулярной серии"
                  className="text-violet-600 dark:text-violet-400"
                />
              )}
              {selected.note && (
                <MetaRow icon={FileText} text={selected.note} />
              )}

              <div className="space-y-2">
                <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-[rgb(var(--text-3))]">
                  Тип записи
                </p>
                <Segmented
                  className="w-full [&>button]:flex-1"
                  value={bookingType}
                  onChange={setBookingType}
                  options={[
                    { value: 'once', label: 'Разовое' },
                    {
                      value: 'recurring',
                      label: 'Каждую неделю',
                      disabled: !selected.isRecurring,
                    },
                  ]}
                />
                {bookingType === 'recurring' && selected.isRecurring && (
                  <p className="flex items-center gap-1.5 text-xs text-violet-600 dark:text-violet-400">
                    <Repeat className="h-3 w-3" />
                    Запись на {RECURRING_WEEKS} ближайшие недели
                  </p>
                )}
              </div>

              <Button
                onClick={handleBook}
                isLoading={booking}
                className="w-full"
                variant={bookingType === 'recurring' ? 'gradient' : 'default'}
              >
                {bookingType === 'recurring'
                  ? 'Записаться на серию'
                  : 'Записаться'}
              </Button>
            </SidePanel>
          ) : selectedBooking ? (
            <SidePanel
              title="Ваше занятие"
              onClose={() => setSelectedBooking(null)}
            >
              <MetaRow
                icon={Clock}
                text={formatDateTime(selectedBooking.slot.startTime)}
              />
              <Badge variant="success" dot>
                Подтверждено
              </Badge>
              {selectedBooking.isRecurring && (
                <MetaRow
                  icon={Repeat}
                  text="Регулярная запись"
                  className="text-violet-600 dark:text-violet-400"
                />
              )}
              <LessonJoinLinks
                role="student"
                slotId={selectedBooking.slotId}
                startTime={selectedBooking.slot.startTime}
                endTime={selectedBooking.slot.endTime}
                now={now}
                layout="stack"
                showHint
              />
              <Link
                href="/dashboard/student/bookings"
                className="block text-center text-xs text-primary-600 hover:underline dark:text-primary-400"
              >
                Управление записями
              </Link>
            </SidePanel>
          ) : mode === 'book' ? (
            <Card>
              <CardContent className="pt-5">
                <EmptyState
                  icon={BookOpen}
                  title="Выберите свободный слот"
                  description="Зелёные блоки — доступное время. Нажмите, чтобы записаться разово или на серию."
                  className="py-6"
                />
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-5">
                <p className="mb-3 text-[0.65rem] font-semibold uppercase tracking-wider text-[rgb(var(--text-3))]">
                  Ближайшие
                </p>
                {myBookings.length === 0 ? (
                  <EmptyState
                    icon={CalendarDays}
                    title="Пока пусто"
                    description="Перейдите в режим «Записаться», чтобы выбрать время у преподавателя."
                    action={
                      <Button size="sm" onClick={() => setMode('book')}>
                        Записаться
                      </Button>
                    }
                    className="py-4"
                  />
                ) : (
                  <div className="space-y-2">
                    {myBookings.slice(0, 5).map((b) => {
                      const join = canJoinLesson(
                        b.slot.startTime,
                        b.slot.endTime,
                        now,
                      );
                      return (
                        <div
                          key={b.id}
                          className="flex w-full flex-col gap-2 rounded-xl bg-[rgb(var(--surface-2))] px-3 py-2.5"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedBooking(b);
                              setSelected(null);
                            }}
                            className="flex w-full items-center gap-2.5 text-left transition-colors"
                          >
                            <div className="icon-blue flex h-7 w-7 shrink-0 items-center justify-center rounded-md">
                              <Clock className="h-3 w-3 text-white" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-medium text-[rgb(var(--text))]">
                                {formatDateTime(b.slot.startTime)}
                              </p>
                              {b.isRecurring && (
                                <p className="flex items-center gap-1 text-[0.65rem] text-violet-500">
                                  <Repeat className="h-2.5 w-2.5" /> Регулярное
                                </p>
                              )}
                            </div>
                            {join && (
                              <span className="rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[0.65rem] font-medium text-emerald-600 dark:text-emerald-400">
                                Сейчас
                              </span>
                            )}
                          </button>
                          {join && (
                            <LessonJoinLinks
                              role="student"
                              slotId={b.slotId}
                              startTime={b.slot.startTime}
                              endTime={b.slot.endTime}
                              now={now}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function MetaRow({
  icon: Icon,
  text,
  className,
}: {
  icon: typeof Clock;
  text: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-start gap-2 text-sm text-[rgb(var(--text-2))]',
        className,
      )}
    >
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[rgb(var(--text-3))]" />
      <span>{text}</span>
    </div>
  );
}
