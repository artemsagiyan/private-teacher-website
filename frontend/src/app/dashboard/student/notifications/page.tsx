'use client';

import { useEffect, useState } from 'react';
import { Bell, CheckCheck, Calendar, BookOpen, Info } from 'lucide-react';
import { api } from '@/lib/api';
import { Notification } from '@/types';
import { timeAgo } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const typeIcon: Record<string, { icon: any; iconClass: string }> = {
  booking_confirmed:   { icon: BookOpen,  iconClass: 'icon-green' },
  booking_cancelled:   { icon: BookOpen,  iconClass: 'icon-red' },
  reminder_24h:        { icon: Calendar,  iconClass: 'icon-blue' },
  reminder_1h:         { icon: Calendar,  iconClass: 'icon-orange' },
  teacher_invitation:  { icon: Bell,      iconClass: 'icon-violet' },
  lesson_report_ready: { icon: BookOpen,  iconClass: 'icon-green' },
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const data = await api.get<Notification[]>('/notifications');
    setNotifications(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const markAll = async () => { await api.patch('/notifications/read-all'); load(); };
  const markOne = async (id: string) => { await api.patch(`/notifications/${id}/read`); load(); };

  const unread = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[rgb(var(--text))] tracking-tight">Уведомления</h1>
          {unread > 0 && <p className="text-sm text-[rgb(var(--text-2))] mt-0.5">{unread} непрочитанных</p>}
        </div>
        {unread > 0 && (
          <Button size="sm" variant="outline" onClick={markAll}>
            <CheckCheck className="h-3.5 w-3.5" /> Прочитать все
          </Button>
        )}
      </div>

      <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] overflow-hidden shadow-card">
        {loading ? (
          <div className="p-5 space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex gap-3">
                <div className="skeleton h-8 w-8 rounded-lg shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-3 rounded w-3/4" />
                  <div className="skeleton h-2.5 rounded w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <div className="h-12 w-12 rounded-2xl icon-violet flex items-center justify-center mb-3 opacity-60">
              <Bell className="h-6 w-6 text-white" />
            </div>
            <p className="text-sm font-medium text-[rgb(var(--text))]">Уведомлений нет</p>
            <p className="text-xs text-[rgb(var(--text-2))] mt-1">Здесь будут появляться напоминания о занятиях</p>
          </div>
        ) : (
          <div>
            {notifications.map((n, i) => {
              const cfg = typeIcon[n.type] ?? { icon: Info, iconClass: 'icon-blue' };
              const Icon = cfg.icon;
              return (
                <div
                  key={n.id}
                  onClick={() => !n.isRead && markOne(n.id)}
                  className={cn(
                    'flex items-start gap-3 px-4 py-3.5 cursor-pointer transition-colors',
                    i < notifications.length - 1 && 'border-b border-[rgb(var(--border))]',
                    !n.isRead
                      ? 'bg-primary-50/40 dark:bg-primary-900/8 hover:bg-primary-50/60 dark:hover:bg-primary-900/12'
                      : 'hover:bg-[rgb(var(--surface-2))]',
                  )}
                >
                  <div className={`h-8 w-8 rounded-lg ${cfg.iconClass} flex items-center justify-center shrink-0 mt-0.5 opacity-${n.isRead ? '50' : '100'}`}>
                    <Icon className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-sm leading-snug', n.isRead ? 'text-[rgb(var(--text-2))]' : 'text-[rgb(var(--text))] font-medium')}>
                      {n.message}
                    </p>
                    <p className="text-xs text-[rgb(var(--text-3))] mt-1">{timeAgo(n.createdAt)}</p>
                  </div>
                  {!n.isRead && (
                    <span className="h-2 w-2 rounded-full bg-primary-500 shrink-0 mt-2" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
