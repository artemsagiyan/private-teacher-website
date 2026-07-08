'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Users, Calendar, BookOpen, Copy, Check, RefreshCw, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { Teacher, Booking } from '@/types';
import { formatDateTime, fullName } from '@/lib/utils';

function Skeleton({ className }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export default function TeacherDashboard() {
  const [teacher, setTeacher]       = useState<Teacher | null>(null);
  const [bookings, setBookings]     = useState<Booking[]>([]);
  const [copied, setCopied]         = useState(false);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<Teacher>('/teachers/me'),
      api.get<Booking[]>('/bookings/teacher'),
    ]).then(([t, b]) => { setTeacher(t); setBookings(b); })
      .finally(() => setLoading(false));
  }, []);

  const upcoming = bookings.filter(
    (b) => b.status === 'confirmed' && new Date(b.slot.startTime) > new Date(),
  );

  const generateCode = async () => {
    setGenerating(true);
    try {
      const data = await api.post<{ inviteCode: string }>('/teachers/invite-code');
      setTeacher((p) => p ? { ...p, inviteCode: data.inviteCode } : p);
      toast.success('Новый код сгенерирован');
    } finally { setGenerating(false); }
  };

  const copyCode = () => {
    if (!teacher?.inviteCode) return;
    navigator.clipboard.writeText(teacher.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Код скопирован');
  };

  if (loading) return (
    <div className="space-y-5 animate-pulse">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
      </div>
      <Skeleton className="h-36 rounded-2xl" />
      <Skeleton className="h-60 rounded-2xl" />
    </div>
  );

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold text-[rgb(var(--text))] tracking-tight">Кабинет преподавателя</h1>
        <p className="text-sm text-[rgb(var(--text-2))] mt-0.5">Ваши ученики, расписание и код приглашения</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { icon: Users,    iconClass: 'icon-blue',   label: 'Учеников',         value: teacher?.students?.length ?? 0 },
          { icon: Calendar, iconClass: 'icon-green',  label: 'Ближайших занятий', value: upcoming.length },
          { icon: BookOpen, iconClass: 'icon-violet', label: 'Всего записей',     value: bookings.length },
        ].map(({ icon: Icon, iconClass, label, value }) => (
          <Card key={label} className="hover:shadow-card-hover transition-shadow">
            <CardContent className="pt-5">
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-xl ${iconClass} flex items-center justify-center shrink-0`}>
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[rgb(var(--text))] leading-none">{value}</p>
                  <p className="text-xs text-[rgb(var(--text-2))] mt-1">{label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Invite code */}
      <Card>
        <CardHeader>
          <CardTitle>Код приглашения для учеников</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-[rgb(var(--text-2))] mb-4">
            Поделитесь кодом с учеником — он вставит его при регистрации, чтобы автоматически привязаться к вам.
          </p>
          {teacher?.inviteCode ? (
            <div className="flex items-center gap-2">
              <div className="flex-1 font-mono text-lg font-bold tracking-[0.2em] bg-[rgb(var(--surface-2))] rounded-xl px-4 py-3 text-center text-[rgb(var(--text))] border border-[rgb(var(--border))]">
                {teacher.inviteCode}
              </div>
              <Button size="icon" variant="outline" onClick={copyCode} title="Скопировать">
                {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
              </Button>
              <Button size="icon" variant="outline" onClick={generateCode} isLoading={generating} title="Обновить код">
                {!generating && <RefreshCw className="h-4 w-4" />}
              </Button>
            </div>
          ) : (
            <Button onClick={generateCode} isLoading={generating} variant="gradient">
              Сгенерировать код
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Upcoming lessons */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Ближайшие занятия</CardTitle>
            <Link href="/dashboard/teacher/calendar">
              <Button variant="outline" size="sm">Управление расписанием</Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {upcoming.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <div className="h-10 w-10 rounded-xl icon-blue flex items-center justify-center mb-3">
                <Calendar className="h-5 w-5 text-white" />
              </div>
              <p className="text-sm text-[rgb(var(--text-2))]">Нет предстоящих занятий</p>
              <Link href="/dashboard/teacher/calendar" className="mt-3">
                <Button size="sm">Создать слот</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {upcoming.slice(0, 5).map((b) => (
                <div key={b.id} className="flex items-center justify-between p-3 rounded-xl bg-[rgb(var(--surface-2))] hover:bg-[rgb(var(--border)/0.3)] transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg icon-blue flex items-center justify-center shrink-0">
                      <Clock className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[rgb(var(--text))]">{formatDateTime(b.slot.startTime)}</p>
                      <p className="text-xs text-[rgb(var(--text-2))]">{fullName(b.student?.user) || 'Ученик'}</p>
                    </div>
                  </div>
                  <Badge variant="success" dot>Подтверждено</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
