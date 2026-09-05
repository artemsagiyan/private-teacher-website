'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { BookOpen, X, Clock, Calendar, Repeat, Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { Booking } from '@/types';
import { formatDateTime, cn } from '@/lib/utils';
import {
  canCancelBooking,
  canJoinLesson,
  isUpcomingOrLive,
  lessonTypeLabel,
} from '@/lib/lesson';
import { useNow } from '@/lib/use-now';
import { LessonJoinLinks } from '@/components/lesson/lesson-join-links';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';

const statusCfg: Record<string, { label: string; variant: any }> = {
  confirmed: { label: 'Подтверждено', variant: 'success' },
  cancelled_by_student: { label: 'Отменено вами', variant: 'danger' },
  cancelled_by_teacher: { label: 'Отменено преподавателем', variant: 'danger' },
  completed: { label: 'Завершено', variant: 'secondary' },
};

export default function StudentBookingsPage() {
  const now = useNow();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const d = await api.get<Booking[]>('/bookings/my');
      setBookings(d);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleCancel = async (id: string, cancelSeries = false) => {
    const msg = cancelSeries
      ? 'Отменить всю серию записей?'
      : 'Отменить эту запись?';
    if (!confirm(msg)) return;
    try {
      await api.delete(
        `/bookings/${id}/student${cancelSeries ? '?cancelSeries=true' : ''}`,
      );
      toast.success(
        cancelSeries ? 'Серия записей отменена' : 'Запись отменена',
      );
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Не удалось отменить');
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl space-y-4 animate-pulse">
        <div className="skeleton h-8 w-40 rounded-lg" />
        <div className="skeleton h-64 rounded-2xl" />
        <div className="skeleton h-48 rounded-2xl" />
      </div>
    );
  }

  const upcoming = bookings.filter(
    (b) =>
      b.status === 'confirmed' &&
      isUpcomingOrLive(b.slot.startTime, b.slot.endTime, now),
  );
  const history = bookings.filter((b) => !upcoming.includes(b));

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-[rgb(var(--text))]">
            Мои занятия
          </h1>
          <p className="mt-0.5 text-sm text-[rgb(var(--text-2))]">
            {upcoming.length} предстоящих · {bookings.length} всего
          </p>
        </div>
        <Link href="/dashboard/student/calendar">
          <Button size="sm" variant="gradient">
            <Plus className="h-3.5 w-3.5" /> Записаться
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-[rgb(var(--text-3))]" />
            Предстоящие ({upcoming.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {upcoming.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title="Нет предстоящих занятий"
              description="Выберите свободный слот в расписании преподавателя."
              action={
                <Link href="/dashboard/student/calendar">
                  <Button size="sm">Открыть расписание</Button>
                </Link>
              }
              className="py-6"
            />
          ) : (
            <div className="space-y-2">
              {upcoming.map((b) => (
                <BookingRow
                  key={b.id}
                  booking={b}
                  now={now}
                  onCancel={(series) => handleCancel(b.id, series)}
                  showCancel
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-[rgb(var(--text-3))]" />
            История ({history.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="История пуста"
              description="Завершённые и отменённые занятия появятся здесь."
              className="py-6"
            />
          ) : (
            <div className="space-y-2">
              {history.map((b) => (
                <BookingRow key={b.id} booking={b} now={now} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function BookingRow({
  booking,
  now,
  onCancel,
  showCancel,
}: {
  booking: Booking;
  now: number;
  onCancel?: (cancelSeries: boolean) => void;
  showCancel?: boolean;
}) {
  const cfg = statusCfg[booking.status] ?? {
    label: booking.status,
    variant: 'secondary',
  };
  const canCancel =
    showCancel &&
    booking.status === 'confirmed' &&
    canCancelBooking(booking.slot.startTime, now);
  const canJoin =
    booking.status === 'confirmed' &&
    canJoinLesson(booking.slot.startTime, booking.slot.endTime, now);

  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-xl p-3 transition-colors sm:flex-row sm:items-center sm:justify-between',
        booking.status === 'confirmed'
          ? 'bg-[rgb(var(--surface-2))]'
          : 'bg-[rgb(var(--surface-2))] opacity-70',
        'hover:bg-[rgb(var(--border)/0.3)]',
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
            booking.status === 'confirmed' ? 'icon-blue' : 'icon-orange',
          )}
        >
          <Clock className="h-4 w-4 text-white" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-[rgb(var(--text))]">
            {formatDateTime(booking.slot.startTime)}
          </p>
          <p className="flex flex-wrap items-center gap-1 text-xs text-[rgb(var(--text-2))]">
            {lessonTypeLabel(booking.slot.lessonType)}
            {booking.isRecurring && (
              <span className="flex items-center gap-0.5 text-violet-500">
                <Repeat className="h-2.5 w-2.5" />
                Регулярное
              </span>
            )}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        <Badge variant={cfg.variant} dot={booking.status === 'confirmed'}>
          {cfg.label}
        </Badge>
        {canJoin && (
          <LessonJoinLinks
            role="student"
            slotId={booking.slotId}
            startTime={booking.slot.startTime}
            endTime={booking.slot.endTime}
            now={now}
          />
        )}
        {canCancel && (
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => onCancel?.(false)}
              title="Отменить одно занятие"
              className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <X className="h-4 w-4 text-red-500" />
            </button>
            {booking.isRecurring && (
              <button
                type="button"
                onClick={() => onCancel?.(true)}
                title="Отменить всю серию"
                className="flex h-7 items-center gap-1 rounded-lg px-2 text-[0.65rem] text-red-400 transition-colors hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <Repeat className="h-3 w-3" />
                все
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
