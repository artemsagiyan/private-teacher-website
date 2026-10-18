'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, BookOpen, Target, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SectionReadiness } from '@/components/learning/section-readiness';
import { ProgressRose } from '@/components/learning/progress-rose';
import { ProgressHistory, ProgressPeriodFilter } from '@/components/learning/progress-history';
import type { ExamTrack, LearningProgress } from '@/types/learning';

const tracks: Array<{ value: ExamTrack; label: string }> = [
  { value: 'oge', label: 'ОГЭ по математике' },
  { value: 'ege_base', label: 'ЕГЭ, базовый уровень' },
  { value: 'ege_profile', label: 'ЕГЭ, профильный уровень' },
];

const stateLabels = {
  unassessed: 'Пока нет данных',
  mastered: 'Уверенно',
  learning: 'В работе',
  gap: 'Нужно повторить',
};

export default function StudentProgressPage() {
  const [data, setData] = useState<LearningProgress | null>(null);
  const [track, setTrack] = useState<ExamTrack>('ege_profile');
  const [target, setTarget] = useState('80');
  const [period, setPeriod] = useState('365');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const query = period === 'all'
      ? ''
      : `?from=${encodeURIComponent(new Date(Date.now() - Number(period) * 86400_000).toISOString())}&to=${encodeURIComponent(new Date().toISOString())}`;
    const value = await api.get<LearningProgress>(`/learning/progress${query}`);
    setData(value);
    if (value.profile) {
      setTrack(value.profile.examTrack);
      setTarget(value.profile.targetScore?.toString() ?? '');
    }
  }, [period]);

  useEffect(() => {
    load().catch(() => toast.error('Не удалось загрузить прогресс')).finally(() => setLoading(false));
  }, [load]);

  const saveProfile = async () => {
    setSaving(true);
    try {
      await api.patch('/learning/profile', {
        examTrack: track,
        targetScore: target ? Number(target) : null,
      });
      await load();
      toast.success('Цель подготовки сохранена');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Не удалось сохранить цель');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="skeleton h-72 max-w-4xl rounded-2xl" />;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header>
        <h1 className="text-xl font-semibold text-[rgb(var(--text))]">Прогресс подготовки</h1>
        <p className="mt-1 text-sm text-[rgb(var(--text-2))]">Темы, над которыми вы уже работали на уроках и в домашних заданиях.</p>
      </header>

      <ProgressPeriodFilter period={period} onChange={setPeriod} />

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Target className="h-4 w-4 text-primary-500" />Цель подготовки</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1 space-y-1.5 text-sm font-medium">
            Экзамен
            <select value={track} onChange={(event) => setTrack(event.target.value as ExamTrack)} className="w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 py-2.5 text-sm text-[rgb(var(--text))]">
              {tracks.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <label className="w-full space-y-1.5 text-sm font-medium sm:w-40">
            Целевой балл
            <input type="number" min={1} max={100} value={target} onChange={(event) => setTarget(event.target.value)} className="w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 py-2.5 text-sm text-[rgb(var(--text))]" />
          </label>
          <Button onClick={saveProfile} isLoading={saving}>Сохранить</Button>
        </CardContent>
      </Card>

      {!data?.profile ? (
        <Card><CardContent className="py-8 text-center text-sm text-[rgb(var(--text-2))]">Выберите экзамен и сохраните цель, чтобы начать отслеживать темы.</CardContent></Card>
      ) : (
        <>
          {data.profile.curriculumRelease?.sourceKind === 'demo' && (
            <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800">
              Сейчас используется демонстрационный набор заданий. Администратор может загрузить актуальный каталог ФИПИ.
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-3">
            <Metric icon={BookOpen} label="Оценено тем" value={`${data.assessedTopics} из ${data.topics.length}`} />
            <Metric icon={TrendingUp} label="Средняя оценка освоения" value={data.forecast ? `${data.forecast.expected}%` : 'Пока нет данных'} />
            <Metric icon={Target} label="Цель" value={data.profile.targetScore ? `${data.profile.targetScore} баллов` : 'Не задана'} />
          </div>

          {data.forecast && (
            <Card>
            <CardHeader><CardTitle>Роза ветров · освоение изученных тем</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div><p className="text-3xl font-bold text-[rgb(var(--text))]">{data.forecast.min}–{data.forecast.max}%</p><p className="mt-1 text-sm text-[rgb(var(--text-2))]">Ожидаемый уровень освоения — {data.forecast.expected}%</p></div>
                  <Link href="/dashboard/student/mock-exams"><Button variant="outline">Проверить себя <ArrowRight className="ml-1 h-4 w-4" /></Button></Link>
                </div>
                <p className="mt-3 text-xs text-[rgb(var(--text-3))]">Это ориентир по оценённым темам, а не официальный пересчёт первичных баллов экзамена.</p>
              </CardContent>
            </Card>
          )}

          <ProgressRose topics={data.topics} />
          <SectionReadiness sections={data.sectionForecasts} />
          <ProgressHistory history={data.history} />

          <Card>
            <CardHeader>
              <CardTitle>Роза ветров · карта тем</CardTitle>
              <p className="mt-1 text-xs text-[rgb(var(--text-3))]">
                Красный — требуется повторение, жёлтый — тема в работе, зелёный — освоена.
                Оценка обновляется по результатам уроков, домашних заданий и пробников.
              </p>
            </CardHeader>
            <CardContent>
              {data.topics.length ? <div className="space-y-4">{data.topics.map((topic) => (
                <div key={topic.id}>
                  <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                    <div className="min-w-0"><span className="mr-2 text-xs text-[rgb(var(--text-3))]">{topic.code}</span><span className="font-medium text-[rgb(var(--text))]">{topic.title}</span></div>
                    <span className="shrink-0 text-xs text-[rgb(var(--text-2))]">{topic.evidenceCount ? `${Math.round(topic.mastery * 100)}% · ` : ''}{stateLabels[topic.state]}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[rgb(var(--surface-2))]"><div className={`h-full rounded-full ${topic.state === 'mastered' ? 'bg-emerald-500' : topic.state === 'gap' ? 'bg-rose-500' : 'bg-amber-500'}`} style={{ width: `${Math.max(topic.evidenceCount ? 5 : 0, topic.mastery * 100)}%` }} /></div>
                </div>
              ))}</div> : <p className="text-sm text-[rgb(var(--text-2))]">В выбранной версии кодификатора пока нет тем.</p>}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof BookOpen; label: string; value: string }) {
  return <Card><CardContent className="flex items-center gap-3 pt-5"><span className="flex h-10 w-10 items-center justify-center rounded-xl icon-blue"><Icon className="h-5 w-5 text-white" /></span><div><p className="text-lg font-semibold text-[rgb(var(--text))]">{value}</p><p className="text-xs text-[rgb(var(--text-2))]">{label}</p></div></CardContent></Card>;
}
