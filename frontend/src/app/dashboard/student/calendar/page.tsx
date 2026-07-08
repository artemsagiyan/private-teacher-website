'use client';

import { useEffect, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import ruLocale from '@fullcalendar/core/locales/ru';
import { toast } from 'sonner';
import { Clock, Users, FileText, X, CalendarDays, Repeat, BookOpen } from 'lucide-react';
import { api } from '@/lib/api';
import { CalendarSlot, Booking } from '@/types';
import { formatDateTime } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type Mode = 'my' | 'teacher';

export default function StudentCalendarPage() {
  const [mode, setMode]             = useState<Mode>('my');
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const [freeSlots, setFreeSlots]   = useState<CalendarSlot[]>([]);
  const [selected, setSelected]     = useState<CalendarSlot | null>(null);
  const [booking, setBooking]       = useState(false);
  const [bookingType, setBookingType] = useState<'once' | 'recurring'>('once');
  const calendarRef = useRef<any>(null);

  const loadMyBookings = async () => {
    try {
      const data = await api.get<Booking[]>('/bookings/upcoming');
      setMyBookings(data ?? []);
    } catch { toast.error('Не удалось загрузить расписание'); }
  };

  const loadFreeSlots = async () => {
    try {
      const data = await api.get<CalendarSlot[]>('/calendar/student');
      setFreeSlots(data ?? []);
    } catch {}
  };

  useEffect(() => {
    loadMyBookings();
    loadFreeSlots();
  }, []);

  const handleBook = async () => {
    if (!selected) return;
    setBooking(true);
    try {
      await api.post('/bookings', {
        slotId: selected.id,
        isRecurring: bookingType === 'recurring' && selected.isRecurring,
      });
      toast.success(bookingType === 'recurring' ? 'Записаны на серию занятий!' : 'Запись подтверждена!');
      setSelected(null);
      setMode('my');
      await loadMyBookings();
      await loadFreeSlots();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Ошибка записи');
    } finally {
      setBooking(false);
    }
  };

  // My booking events — bright, with glow
  const myEvents = myBookings.map((b) => ({
    id: `booking-${b.id}`,
    title: b.slot.lessonType === 'individual' ? 'Занятие' : 'Групповое',
    start: b.slot.startTime,
    end: b.slot.endTime,
    backgroundColor: '#6366f1',
    borderColor: 'transparent',
    textColor: '#fff',
    classNames: ['my-booking-event'],
    extendedProps: { type: 'booking', booking: b },
  }));

  // Teacher's free slot events — green, shown only in teacher mode
  const freeEvents = freeSlots
    .filter((s) => !myBookings.some((b) => b.slotId === s.id))
    .map((s) => ({
      id: `slot-${s.id}`,
      title: s.isRecurring
        ? `${s.lessonType === 'individual' ? 'Инд.' : 'Гр.'} ↻`
        : s.lessonType === 'individual' ? 'Инд.' : 'Гр.',
      start: s.startTime,
      end: s.endTime,
      backgroundColor: '#10b981',
      borderColor: 'transparent',
      textColor: '#fff',
      opacity: 0.85,
      extendedProps: { type: 'slot', slot: s },
    }));

  const events = mode === 'my'
    ? myEvents
    : [
        ...myEvents.map((e) => ({ ...e, backgroundColor: '#818cf8', classNames: ['my-booking-dim'] })),
        ...freeEvents,
      ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[rgb(var(--text))] tracking-tight">Расписание</h1>
          <p className="text-sm text-[rgb(var(--text-2))] mt-0.5">
            {mode === 'my' ? 'Ваши записанные занятия' : 'Доступные слоты преподавателя'}
          </p>
        </div>

        {/* Mode toggle */}
        <div className="flex gap-2 p-1 rounded-xl bg-[rgb(var(--surface-2))] border border-[rgb(var(--border))]">
          <button
            onClick={() => { setMode('my'); setSelected(null); }}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200',
              mode === 'my'
                ? 'bg-[rgb(var(--surface))] text-[rgb(var(--text))] shadow-card'
                : 'text-[rgb(var(--text-2))] hover:text-[rgb(var(--text))]',
            )}
          >
            <CalendarDays className="h-3.5 w-3.5" />
            Моё расписание
          </button>
          <button
            onClick={() => { setMode('teacher'); setSelected(null); }}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200',
              mode === 'teacher'
                ? 'bg-[rgb(var(--surface))] text-[rgb(var(--text))] shadow-card'
                : 'text-[rgb(var(--text-2))] hover:text-[rgb(var(--text))]',
            )}
          >
            <BookOpen className="h-3.5 w-3.5" />
            Записаться к преподавателю
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Calendar */}
        <div className="lg:col-span-2 bg-[rgb(var(--surface))] rounded-2xl border border-[rgb(var(--border))] p-4 shadow-card">
          <style>{`
            .my-booking-event { box-shadow: 0 0 12px rgb(99 102 241 / 0.4) !important; }
            .my-booking-dim { opacity: 0.5 !important; }
            .fc-timegrid-event-harness { transition: opacity 200ms; }
          `}</style>
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
            eventClick={(info) => {
              const { type, slot } = info.event.extendedProps;
              if (type === 'slot') {
                setSelected(slot);
                setBookingType('once');
              } else {
                toast.info('Это ваше занятие');
              }
            }}
            height="auto"
            slotMinTime="08:00:00"
            slotMaxTime="22:00:00"
            slotDuration="00:30:00"
            slotLabelInterval="01:00:00"
            allDaySlot={false}
            nowIndicator
          />
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Legend */}
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-[rgb(var(--text-3))] mb-3 font-medium uppercase tracking-wide">Обозначения</p>
              <div className="space-y-2">
                <div className="flex items-center gap-2.5">
                  <span className="h-3 w-3 rounded-sm shrink-0" style={{ background: '#6366f1', boxShadow: '0 0 6px rgba(99,102,241,0.5)' }} />
                  <span className="text-xs text-[rgb(var(--text-2))]">Моё занятие</span>
                </div>
                {mode === 'teacher' && (
                  <div className="flex items-center gap-2.5">
                    <span className="h-3 w-3 rounded-sm shrink-0 bg-emerald-500" />
                    <span className="text-xs text-[rgb(var(--text-2))]">Свободный слот</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Slot booking panel */}
          {selected && mode === 'teacher' ? (
            <Card className="border-emerald-200 dark:border-emerald-800/40">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Запись на занятие</CardTitle>
                  <button
                    onClick={() => setSelected(null)}
                    className="h-6 w-6 rounded-md flex items-center justify-center hover:bg-[rgb(var(--surface-2))] text-[rgb(var(--text-3))] transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-[rgb(var(--text-2))]">
                    <Clock className="h-3.5 w-3.5 text-[rgb(var(--text-3))] shrink-0" />
                    {formatDateTime(selected.startTime)}
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-3.5 w-3.5 text-[rgb(var(--text-3))] shrink-0" />
                    <Badge variant="success">
                      {selected.lessonType === 'individual' ? 'Индивидуальное' : 'Групповое'}
                    </Badge>
                  </div>
                  {selected.isRecurring && (
                    <div className="flex items-center gap-2">
                      <Repeat className="h-3.5 w-3.5 text-violet-500 shrink-0" />
                      <span className="text-xs text-violet-600 dark:text-violet-400">Слот из регулярной серии</span>
                    </div>
                  )}
                  {selected.note && (
                    <div className="flex items-start gap-2 text-sm text-[rgb(var(--text-2))]">
                      <FileText className="h-3.5 w-3.5 text-[rgb(var(--text-3))] shrink-0 mt-0.5" />
                      {selected.note}
                    </div>
                  )}
                </div>

                {/* Booking type selector */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-[rgb(var(--text-2))] uppercase tracking-wide">Тип записи</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setBookingType('once')}
                      className={cn(
                        'py-2 px-3 rounded-lg text-xs font-medium border transition-all',
                        bookingType === 'once'
                          ? 'bg-primary-600 text-white border-primary-600'
                          : 'border-[rgb(var(--border))] text-[rgb(var(--text-2))] hover:bg-[rgb(var(--surface-2))]',
                      )}
                    >
                      Разовое
                    </button>
                    <button
                      onClick={() => setBookingType('recurring')}
                      disabled={!selected.isRecurring}
                      title={!selected.isRecurring ? 'Этот слот не регулярный' : ''}
                      className={cn(
                        'py-2 px-3 rounded-lg text-xs font-medium border transition-all',
                        bookingType === 'recurring'
                          ? 'bg-violet-600 text-white border-violet-600'
                          : 'border-[rgb(var(--border))] text-[rgb(var(--text-2))] hover:bg-[rgb(var(--surface-2))]',
                        !selected.isRecurring && 'opacity-40 cursor-not-allowed',
                      )}
                    >
                      Каждую неделю
                    </button>
                  </div>
                  {bookingType === 'recurring' && selected.isRecurring && (
                    <p className="text-xs text-violet-600 dark:text-violet-400 flex items-center gap-1.5">
                      <Repeat className="h-3 w-3" />
                      Запись создастся на 4 ближайших недели
                    </p>
                  )}
                </div>

                <Button
                  onClick={handleBook}
                  isLoading={booking}
                  className="w-full"
                  variant={bookingType === 'recurring' ? 'gradient' : 'default'}
                >
                  {bookingType === 'recurring' ? 'Записаться на серию' : 'Записаться'}
                </Button>
              </CardContent>
            </Card>
          ) : mode === 'teacher' ? (
            <Card>
              <CardContent className="pt-5">
                <p className="text-xs text-[rgb(var(--text-3))] mb-4 font-medium uppercase tracking-wide">Как записаться</p>
                <ol className="space-y-2 text-xs text-[rgb(var(--text-2))]">
                  <li className="flex gap-2"><span className="text-emerald-500 font-bold shrink-0">1.</span>Нажмите на зелёный свободный слот</li>
                  <li className="flex gap-2"><span className="text-emerald-500 font-bold shrink-0">2.</span>Выберите тип: разовое или еженедельно</li>
                  <li className="flex gap-2"><span className="text-emerald-500 font-bold shrink-0">3.</span>Подтвердите запись</li>
                </ol>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-5">
                <p className="text-xs text-[rgb(var(--text-3))] mb-3 font-medium uppercase tracking-wide">Ближайшие занятия</p>
                {myBookings.length === 0 ? (
                  <p className="text-xs text-[rgb(var(--text-2))] text-center py-4">Нет запланированных занятий</p>
                ) : (
                  <div className="space-y-2">
                    {myBookings.slice(0, 4).map((b) => (
                      <div key={b.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-[rgb(var(--surface-2))]">
                        <div className="h-6 w-6 rounded-md icon-blue flex items-center justify-center shrink-0">
                          <Clock className="h-3 w-3 text-white" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-[rgb(var(--text))] truncate">{formatDateTime(b.slot.startTime)}</p>
                          {b.isRecurring && (
                            <p className="text-[0.65rem] text-violet-500 flex items-center gap-1"><Repeat className="h-2.5 w-2.5" />Регулярное</p>
                          )}
                        </div>
                      </div>
                    ))}
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
