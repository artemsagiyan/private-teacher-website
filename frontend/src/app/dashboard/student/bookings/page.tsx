'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { BookOpen, X, Clock, Calendar, Repeat } from 'lucide-react';
import { api } from '@/lib/api';
import { Booking } from '@/types';
import { formatDateTime } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const statusCfg: Record<string, { label: string; variant: any }> = {
  confirmed:            { label: 'Подтверждено',            variant: 'success' },
  cancelled_by_student: { label: 'Отменено вами',           variant: 'danger' },
  cancelled_by_teacher: { label: 'Отменено преподавателем', variant: 'danger' },
  completed:            { label: 'Завершено',               variant: 'secondary' },
};

function Skeleton({ className }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export default function StudentBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading]   = useState(true);

  const load = async () => {
    try { const d = await api.get<Booking[]>('/bookings/my'); setBookings(d); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleCancel = async (id: string, cancelSeries = false) => {
    try {
      await api.delete(`/bookings/${id}/student${cancelSeries ? '?cancelSeries=true' : ''}`);
      toast.success(cancelSeries ? 'Серия записей отменена' : 'Запись отменена');
      load();
    } catch (err: any) { toast.error(err.response?.data?.message || 'Не удалось отменить'); }
  };

  if (loading) return (
    <div className="space-y-4 animate-pulse max-w-2xl">
      <Skeleton className="h-8 w-40 rounded-lg" />
      <Skeleton className="h-64 rounded-2xl" />
      <Skeleton className="h-48 rounded-2xl" />
    </div>
  );

  const upcoming = bookings.filter((b) => b.status === 'confirmed' && new Date(b.slot.startTime) > new Date());
  const history  = bookings.filter((b) => !upcoming.includes(b));

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="text-xl font-semibold text-[rgb(var(--text))] tracking-tight">Мои занятия</h1>
        <p className="text-sm text-[rgb(var(--text-2))] mt-0.5">{bookings.length} всего</p>
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
            <p className="text-sm text-[rgb(var(--text-3))] py-4 text-center">Нет предстоящих занятий</p>
          ) : (
            <div className="space-y-2">
              {upcoming.map((b) => <BookingRow key={b.id} booking={b} onCancel={(series) => handleCancel(b.id, series)} showCancel />)}
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
            <p className="text-sm text-[rgb(var(--text-3))] py-4 text-center">История пуста</p>
          ) : (
            <div className="space-y-2">
              {history.map((b) => <BookingRow key={b.id} booking={b} />)}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function BookingRow({ booking, onCancel, showCancel }: { booking: Booking; onCancel?: (cancelSeries: boolean) => void; showCancel?: boolean }) {
  const cfg = statusCfg[booking.status] ?? { label: booking.status, variant: 'secondary' };
  const canCancel = showCancel && booking.status === 'confirmed'
    && (new Date(booking.slot.startTime).getTime() - Date.now()) / 3600000 >= 24;

  return (
    <div className={cn(
      'flex items-center justify-between p-3 rounded-xl transition-colors',
      booking.status === 'confirmed' ? 'bg-[rgb(var(--surface-2))]' : 'bg-[rgb(var(--surface-2))] opacity-70',
      'hover:bg-[rgb(var(--border)/0.3)]',
    )}>
      <div className="flex items-center gap-3">
        <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center shrink-0',
          booking.status === 'confirmed' ? 'icon-blue' : 'icon-orange'
        )}>
          <Clock className="h-4 w-4 text-white" />
        </div>
        <div>
          <p className="text-sm font-medium text-[rgb(var(--text))]">{formatDateTime(booking.slot.startTime)}</p>
          <p className="text-xs text-[rgb(var(--text-2))] flex items-center gap-1">
            {booking.slot.lessonType === 'individual' ? 'Индивидуальное' : 'Групповое'}
            {booking.isRecurring && <span className="text-violet-500 flex items-center gap-0.5"><Repeat className="h-2.5 w-2.5" />Регулярное</span>}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant={cfg.variant} dot={booking.status === 'confirmed'}>{cfg.label}</Badge>
        {canCancel && (
          <div className="flex gap-1">
            <button onClick={() => onCancel?.(false)} title="Отменить одно занятие" className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
              <X className="h-4 w-4 text-red-500" />
            </button>
            {booking.isRecurring && (
              <button onClick={() => onCancel?.(true)} title="Отменить всю серию" className="h-7 px-2 rounded-lg flex items-center gap-1 text-[0.65rem] text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                <Repeat className="h-3 w-3" />все
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
