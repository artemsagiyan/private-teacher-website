'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ClipboardCheck, Printer, TrendingUp } from 'lucide-react';
import { api } from '@/lib/api';
import type { HomeworkAssignment, LearningProgress } from '@/types/learning';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SectionReadiness } from '@/components/learning/section-readiness';
import { ProgressHistory, ProgressPeriodFilter } from '@/components/learning/progress-history';
import { ProgressRose } from '@/components/learning/progress-rose';
import { FamilyChat } from '@/components/family/family-chat';

type Overview = LearningProgress & {
  student: {
    id: string;
    user: { firstName: string; lastName: string; email: string };
  };
  homework: HomeworkAssignment[];
};

export default function TeacherStudentAnalyticsPage() {
  const { studentId } = useParams<{ studentId: string }>();
  const [data, setData] = useState<Overview | null>(null);
  const [period, setPeriod] = useState('365');
  const [error, setError] = useState('');

  useEffect(() => {
    const query = period === 'all'
      ? ''
      : `?from=${encodeURIComponent(new Date(Date.now() - Number(period) * 86400_000).toISOString())}&to=${encodeURIComponent(new Date().toISOString())}`;
    api
      .get<Overview>(`/learning/students/${studentId}${query}`)
      .then((value) => {
        setData(value);
        setError('');
      })
      .catch((err) => setError(err.response?.data?.message || 'Не удалось загрузить ученика'));
  }, [period, studentId]);

  if (error) return <p className="text-sm text-rose-600">{error}</p>;
  if (!data) return <div className="skeleton h-72 max-w-5xl rounded-2xl" />;

  return (
    <div className="teacher-analytics mx-auto max-w-5xl space-y-5">
      <Link href="/dashboard/teacher/students" className="inline-flex items-center gap-1 text-sm text-[rgb(var(--text-2))]">
        <ArrowLeft className="h-4 w-4" />Все ученики
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[rgb(var(--text))]">
            {data.student.user.firstName} {data.student.user.lastName}
          </h1>
          <p className="mt-1 text-sm text-[rgb(var(--text-2))]">{data.student.user.email} · аналитический кабинет</p>
        </div>
        <Button type="button" size="sm" variant="outline" className="print-actions" onClick={() => window.print()}>
          <Printer className="h-4 w-4" />Сохранить в PDF
        </Button>
      </header>
      <div className="print-actions"><ProgressPeriodFilter period={period} onChange={setPeriod} /></div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Metric icon={TrendingUp} label="Оценено тем" value={`${data.assessedTopics} из ${data.topics.length}`} />
        <Metric icon={ClipboardCheck} label="Домашних заданий" value={String(data.homework.length)} />
        <Metric icon={TrendingUp} label="Освоение тем" value={data.forecast ? `${data.forecast.expected}%` : 'Нет данных'} />
      </div>
      <ProgressRose topics={data.topics} />
      <SectionReadiness sections={data.sectionForecasts} />
      <ProgressHistory history={data.history} />
      <FamilyChat studentId={studentId} />
      <Card>
        <CardHeader><CardTitle>Карта тем</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {data.topics.map((topic) => (
            <div key={topic.id}>
              <div className="mb-1 flex justify-between text-sm">
                <span>{topic.code} · {topic.title}</span>
                <span className="text-xs text-[rgb(var(--text-2))]">
                  {topic.evidenceCount ? `${Math.round(topic.mastery * 100)}%` : 'Не оценивалась'}
                </span>
              </div>
              <div className="h-2 rounded-full bg-[rgb(var(--surface-2))]">
                <div
                  className={`h-2 rounded-full ${topic.state === 'gap' ? 'bg-rose-500' : topic.state === 'mastered' ? 'bg-emerald-500' : 'bg-amber-500'}`}
                  style={{ width: `${topic.evidenceCount ? topic.mastery * 100 : 0}%` }}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Последние домашние задания</CardTitle></CardHeader>
        <CardContent>
          {data.homework.length ? (
            <div className="space-y-2">
              {data.homework.slice(0, 8).map((item) => (
                <div key={item.id} className="flex justify-between gap-3 rounded-lg border border-[rgb(var(--border))] p-3 text-sm">
                  <span>{item.lesson?.slot?.note || 'Домашнее задание'}</span>
                  <span className="text-xs text-[rgb(var(--text-2))]">{item.status} · {item.items.length} заданий</span>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-[rgb(var(--text-2))]">Домашних заданий пока нет.</p>}
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof TrendingUp;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 pt-5">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl icon-violet">
          <Icon className="h-5 w-5 text-white" />
        </span>
        <div>
          <p className="text-lg font-semibold">{value}</p>
          <p className="text-xs text-[rgb(var(--text-2))]">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
