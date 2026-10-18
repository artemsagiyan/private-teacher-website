'use client';

import { useEffect, useState } from 'react';
import { BookOpen, CalendarDays, CircleDollarSign, Download, Printer, TrendingUp } from 'lucide-react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ProgressRose } from '@/components/learning/progress-rose';
import { SectionReadiness } from '@/components/learning/section-readiness';
import { ProgressHistory, ProgressPeriodFilter } from '@/components/learning/progress-history';
import { FamilyChat } from '@/components/family/family-chat';
import type { TopicProgress } from '@/types/learning';

type FamilyData = {
  student: { id: string; name: string; parentName: string | null };
  teacher: { name: string; subjects?: string; bio?: string } | null;
  progress: {
    profile: any;
    topics: TopicProgress[];
    assessedTopics: number;
    forecast?: { min: number; expected: number; max: number } | null;
    sectionForecasts?: Array<{
      section: string;
      min: number | null;
      expected: number | null;
      max: number | null;
      assessedTopics: number;
      topicCount: number;
    }>;
    history?: Array<{
      period: string;
      expected: number | null;
      assessedTopics: number;
      topicCount: number;
    }>;
  };
  lessons: Array<{
    id: string;
    lessonId: string | null;
    date: string;
    bookingStatus: string;
    lessonStatus: string | null;
    attendanceStatus: 'attended' | 'scheduled' | 'not_attended';
    note: string;
    report: {
      summary: string;
      topics: string[];
      achievements: string[];
      difficulties: string[];
      homework: string[];
      recommendations: string[];
    } | null;
  }>;
  homework: Array<{ id: string; status: string; dueAt: string; title: string; total: number; completed: number }>;
  payments: Array<{ id: string; amount: number; currency: string; dueAt: string; paidAt: string | null; status: string; description: string | null }>;
  accessExpiresAt: string;
};

export default function FamilyDashboard() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<FamilyData | null>(null);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState('365');

  useEffect(() => {
    const query = period === 'all'
      ? ''
      : `?from=${encodeURIComponent(new Date(Date.now() - Number(period) * 86400_000).toISOString())}&to=${encodeURIComponent(new Date().toISOString())}`;
    api
      .get<FamilyData>(`/family/${token}${query}`)
      .then((value) => {
        setData(value);
        setError('');
      })
      .catch((err) =>
        setError(
          err.response?.data?.message || 'Ссылка недействительна или истекла',
        ),
      );
  }, [period, token]);

  if (error) {
    return (
      <main className="mx-auto max-w-xl p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <h1 className="text-xl font-semibold">Доступ закрыт</h1>
            <p className="mt-2 text-sm text-[rgb(var(--text-2))]">
              {error}. Попросите ученика создать новую ссылку для родителя.
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="mx-auto max-w-5xl p-6">
        <div className="skeleton h-48 rounded-2xl" />
      </main>
    );
  }

  const exportReport = () => window.print();
  const pastLessons = data.lessons.filter(
    (lesson) => new Date(lesson.date).getTime() <= Date.now(),
  );
  const attendedLessons = pastLessons.filter(
    (lesson) => lesson.attendanceStatus === 'attended',
  ).length;

  return (
    <main className="family-report mx-auto max-w-5xl space-y-5 p-5 md:p-8">
      <header className="rounded-2xl bg-[rgb(var(--surface))] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs text-[rgb(var(--text-3))]">ТвойМатПлан · кабинет семьи</p>
            <h1 className="mt-2 text-2xl font-bold text-[rgb(var(--text))]">
              Прогресс {data.student.name}
            </h1>
            <p className="mt-1 text-sm text-[rgb(var(--text-2))]">
              Преподаватель: {data.teacher?.name || 'не привязан'}
              {data.teacher?.subjects ? ` · ${data.teacher.subjects}` : ''}
            </p>
          </div>
          <div className="family-report-actions flex gap-2">
            <Button type="button" size="sm" variant="outline" onClick={exportReport}>
              <Printer className="h-4 w-4" />
              Сохранить в PDF
            </Button>
            <a href="#lessons" className="hidden sm:block">
              <Button type="button" size="sm" variant="ghost">
                <Download className="h-4 w-4" />
                К отчётам
              </Button>
            </a>
          </div>
        </div>
      </header>

      <ProgressPeriodFilter period={period} onChange={setPeriod} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric icon={TrendingUp} label="Тем оценено" value={`${data.progress.assessedTopics} из ${data.progress.topics.length}`} />
        <Metric icon={CalendarDays} label="Посещено прошедших занятий" value={pastLessons.length ? `${attendedLessons} из ${pastLessons.length}` : 'Нет прошедших'} />
        <Metric icon={BookOpen} label="Домашних заданий" value={String(data.homework.length)} />
        <Metric
          icon={CircleDollarSign}
          label="Оплачено"
          value={`${data.payments.filter((p) => p.status === 'paid').reduce((n, p) => n + p.amount, 0).toLocaleString('ru-RU')} ₽`}
        />
      </div>

      {data.progress.forecast && (
        <Card>
          <CardHeader><CardTitle>Ориентир по текущему прогрессу</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-[rgb(var(--text))]">
              {data.progress.forecast.min}–{data.progress.forecast.max}%
            </p>
            <p className="mt-1 text-xs text-[rgb(var(--text-3))]">
              Оценка освоения изученных тем, не официальный балл экзамена.
            </p>
          </CardContent>
        </Card>
      )}

      <ProgressRose topics={data.progress.topics} />
      <SectionReadiness sections={data.progress.sectionForecasts} />
      <ProgressHistory history={data.progress.history} />
      {data.teacher && <FamilyChat token={token} />}

      <Card id="lessons">
        <CardHeader><CardTitle className="flex items-center gap-2"><CalendarDays className="h-4 w-4" />Занятия и отчёты</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.lessons.length ? data.lessons.map((lesson) => (
              <article key={lesson.id} className="rounded-xl border border-[rgb(var(--border))] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-[rgb(var(--text-3))]">
                    {lesson.date ? new Date(lesson.date).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' }) : ''} · {lesson.note || 'Занятие'}
                  </p>
                  <span className={`rounded-full px-2 py-1 text-[0.7rem] font-medium ${attendanceClass(lesson.attendanceStatus)}`}>
                    {attendanceLabel(lesson.attendanceStatus)}
                  </span>
                </div>
                {lesson.report ? (
                  <>
                    <p className="mt-2 text-sm font-medium">{lesson.report.summary}</p>
                    <Detail label="Темы" items={lesson.report.topics} />
                    <Detail label="Что получилось" items={lesson.report.achievements} />
                    <Detail label="Сложности" items={lesson.report.difficulties} />
                    <Detail label="Домашнее задание" items={lesson.report.homework} />
                    <Detail label="Рекомендации" items={lesson.report.recommendations} />
                  </>
                ) : (
                  <p className="mt-2 text-sm text-[rgb(var(--text-2))]">
                    {familyReportMessage(lesson)}
                  </p>
                )}
              </article>
            )) : <p className="text-sm text-[rgb(var(--text-2))]">Занятий пока нет.</p>}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Домашние задания</CardTitle></CardHeader>
          <CardContent>
            {data.homework.length ? (
              <div className="space-y-2">
                {data.homework.map((item) => (
                  <div key={item.id} className="rounded-lg border border-[rgb(var(--border))] p-3">
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="mt-1 text-xs text-[rgb(var(--text-2))]">
                      Выполнено {item.completed} из {item.total}{item.dueAt ? ` · срок ${new Date(item.dueAt).toLocaleDateString('ru-RU')}` : ''}
                    </p>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-[rgb(var(--text-2))]">Нет опубликованных заданий.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Оплаты</CardTitle></CardHeader>
          <CardContent>
            {data.payments.length ? (
              <div className="space-y-2">
                {data.payments.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-[rgb(var(--border))] p-3">
                    <div>
                      <p className="text-sm font-medium">{item.description || 'Занятие'} · {item.amount.toLocaleString('ru-RU')} ₽</p>
                      <p className="mt-1 text-xs text-[rgb(var(--text-2))]">Срок {new Date(item.dueAt).toLocaleDateString('ru-RU')}</p>
                    </div>
                    <span className="text-xs">{paymentStatus(item.status)}</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-[rgb(var(--text-2))]">Начислений нет.</p>}
          </CardContent>
        </Card>
      </div>

      <p className="text-center text-xs text-[rgb(var(--text-3))] family-report-actions">
        Приватная ссылка действует до {new Date(data.accessExpiresAt).toLocaleDateString('ru-RU')}.
      </p>
    </main>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof TrendingUp; label: string; value: string }) {
  return <Card><CardContent className="flex items-center gap-3 pt-5"><span className="flex h-10 w-10 items-center justify-center rounded-xl icon-blue"><Icon className="h-5 w-5 text-white" /></span><div><p className="text-lg font-semibold">{value}</p><p className="text-xs text-[rgb(var(--text-2))]">{label}</p></div></CardContent></Card>;
}

function Detail({ label, items }: { label: string; items?: string[] }) {
  return items?.length ? <p className="mt-2 text-xs leading-5 text-[rgb(var(--text-2))]"><strong>{label}:</strong> {items.join(' · ')}</p> : null;
}

function paymentStatus(status: string) {
  return ({ paid: 'Оплачено', overdue: 'Просрочено', pending: 'Ожидается', cancelled: 'Отменено' } as Record<string, string>)[status] || status;
}

function attendanceLabel(status: FamilyData['lessons'][number]['attendanceStatus']) {
  return ({ attended: 'Посещено', scheduled: 'Запланировано', not_attended: 'Не посещено' })[status];
}

function attendanceClass(status: FamilyData['lessons'][number]['attendanceStatus']) {
  return ({
    attended: 'bg-emerald-500/15 text-emerald-700',
    scheduled: 'bg-amber-500/15 text-amber-700',
    not_attended: 'bg-[rgb(var(--surface-2))] text-[rgb(var(--text-2))]',
  })[status];
}

function familyReportMessage(lesson: FamilyData['lessons'][number]) {
  if (lesson.attendanceStatus === 'scheduled') return 'Занятие запланировано.';
  if (lesson.attendanceStatus === 'not_attended') return 'Захода в урок не было.';
  if (lesson.lessonStatus === 'failed') {
    return 'Не удалось сформировать отчёт. Преподаватель уведомлён.';
  }
  if (lesson.lessonStatus === 'processing') return 'Отчёт формируется.';
  return 'Отчёт пока недоступен.';
}
