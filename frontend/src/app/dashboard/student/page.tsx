'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Calendar, BookOpen, Users, Clock, ArrowRight, Sparkles, Video } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { Booking, Teacher } from '@/types';
import { formatDateTime, fullName } from '@/lib/utils';
import { canJoinLesson, lessonTypeLabel } from '@/lib/lesson';
import { toast } from 'sonner';

export default function StudentDashboard() {
  const router = useRouter();
  const [upcoming, setUpcoming] = useState<Booking[]>([]);
  const [teacher, setTeacher]   = useState<Teacher | null>(null);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<Booking[]>('/bookings/upcoming'),
      api.get<Teacher | null>('/students/teacher'),
    ])
      .then(([bookings, t]) => {
        setUpcoming(bookings ?? []);
        setTeacher(t);
      })
      .catch(() => {
        toast.error('Не удалось загрузить главную');
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="skeleton h-8 w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-24" />)}
        </div>
        <div className="skeleton h-48" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[rgb(var(--text))] tracking-tight">Личный кабинет</h1>
          <p className="text-sm text-[rgb(var(--text-2))] mt-0.5">Обзор активности</p>
        </div>
        {teacher && (
          <Link href="/dashboard/student/calendar">
            <Button size="sm" variant="gradient">
              <Sparkles className="h-3.5 w-3.5" />
              Записаться
            </Button>
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={Calendar} iconClass="icon-blue"   label="Ближайших занятий" value={upcoming.length} />
        <StatCard icon={Users}    iconClass="icon-violet" label="Преподаватель"      value={teacher ? (fullName(teacher.user ?? undefined) || '—') : 'Не привязан'} />
        <StatCard icon={BookOpen} iconClass="icon-green"  label="Статус"             value={teacher ? 'Активен' : 'Нет преп.'} />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Ближайшие занятия</CardTitle>
            <Link href="/dashboard/student/bookings" className="text-xs text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1">
              Все <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {upcoming.length === 0 ? (
            <div className="text-center py-10">
              <div className="h-12 w-12 rounded-2xl icon-blue mx-auto mb-4 flex items-center justify-center opacity-30">
                <Calendar className="h-6 w-6 text-white" />
              </div>
              <p className="text-sm text-[rgb(var(--text-2))] mb-4">Нет запланированных занятий</p>
              {teacher && (
                <Link href="/dashboard/student/calendar">
                  <Button size="sm">Записаться на занятие</Button>
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {upcoming.slice(0, 5).map((booking) => {
                const join = canJoinLesson(booking.slot.startTime, booking.slot.endTime);
                return (
                  <div key={booking.id} className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-[rgb(var(--surface-2))] hover:bg-[rgb(var(--border)/0.4)] transition-colors">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="h-8 w-8 rounded-lg icon-blue flex items-center justify-center shrink-0">
                        <Clock className="h-4 w-4 text-white" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[rgb(var(--text))]">{formatDateTime(booking.slot.startTime)}</p>
                        <p className="text-xs text-[rgb(var(--text-2))]">
                          {lessonTypeLabel(booking.slot.lessonType)}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {join ? (
                        <Button
                          size="sm"
                          className="bg-emerald-500 text-white hover:bg-emerald-600"
                          onClick={() => router.push(`/dashboard/student/lesson/${booking.slotId}`)}
                        >
                          <Video className="h-3.5 w-3.5" /> Войти
                        </Button>
                      ) : (
                        <Badge variant="success" dot>Подтверждено</Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Мой преподаватель</CardTitle></CardHeader>
        <CardContent>
          {teacher ? (
            <div className="flex items-center gap-4">
              <div className="h-11 w-11 rounded-xl icon-violet flex items-center justify-center text-white text-sm font-bold shrink-0">
                {teacher.user?.firstName?.[0]}{teacher.user?.lastName?.[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[rgb(var(--text))] text-sm">{fullName(teacher.user ?? undefined)}</p>
                <p className="text-xs text-[rgb(var(--text-2))] truncate">{teacher.subjects || 'Предметы не указаны'}</p>
              </div>
              <Link href="/dashboard/student/teacher">
                <Button size="icon-sm" variant="ghost"><ArrowRight className="h-4 w-4" /></Button>
              </Link>
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-sm text-[rgb(var(--text-2))] mb-4">Вы ещё не привязаны к преподавателю</p>
              <Link href="/dashboard/student/teacher"><Button size="sm">Привязать преподавателя</Button></Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon: Icon, iconClass, label, value }: {
  icon: any; iconClass: string; label: string; value: string | number;
}) {
  return (
    <div className="bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-2xl p-5 shadow-card hover:shadow-card-hover transition-shadow duration-200">
      <div className="flex items-start gap-3">
        <div className={`h-9 w-9 rounded-xl ${iconClass} flex items-center justify-center shrink-0`}>
          <Icon style={{ width: '1.1rem', height: '1.1rem' }} className="text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-xl font-bold text-[rgb(var(--text))] leading-tight truncate">{value}</p>
          <p className="text-xs text-[rgb(var(--text-2))] mt-0.5">{label}</p>
        </div>
      </div>
    </div>
  );
}
