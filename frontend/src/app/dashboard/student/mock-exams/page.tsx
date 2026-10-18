'use client';

import { useState } from 'react';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { ClipboardCheck, TimerReset } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { LearningProgress } from '@/types/learning';

export default function MockExamsPage() {
  const [started, setStarted] = useState(false);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [finished, setFinished] = useState(false);
  const [exam, setExam] = useState<any>(null);
  const [progress, setProgress] = useState<LearningProgress | null>(null);
  useEffect(() => { api.get<LearningProgress>('/learning/progress').then(setProgress).catch(() => undefined); }, []);

  const start = async () => {
    try { const created = await api.post<any>('/mock-exams/start'); setExam(created); setStarted(true); }
    catch (error: any) { toast.error(error.response?.data?.message || 'Не удалось начать пробник'); }
  };
  const submit = async () => {
    try {
      const result = await api.post<any>(`/mock-exams/${exam.id}/submit`, { answers: exam.items.map((item: any, index: number) => ({ taskId: item.taskId, answer: answers[index] ?? '' })) });
      setExam(result); setFinished(true);
    } catch (error: any) { toast.error(error.response?.data?.message || 'Не удалось отправить ответы'); }
  };

  return <div className="mx-auto max-w-4xl space-y-5"><header><h1 className="text-xl font-semibold text-[rgb(var(--text))]">Тренировочный пробник</h1><p className="mt-1 text-sm text-[rgb(var(--text-2))]">Проверьте темы из выбранного экзамена и внесите результат в карту прогресса.</p></header>{!started ? <Card><CardContent className="py-10 text-center"><ClipboardCheck className="mx-auto h-10 w-10 text-primary-500" /><h2 className="mt-3 text-lg font-semibold text-[rgb(var(--text))]">20 заданий · 60 минут</h2><p className="mx-auto mt-2 max-w-lg text-sm text-[rgb(var(--text-2))]">Вариант строится по активному каталогу выбранного экзамена. Доступны только каталоги, в которых достаточно заданий.</p>{progress?.profile?.curriculumRelease?.sourceKind === 'demo' && <p className="mt-2 text-xs text-amber-700">Активен демонстрационный каталог. Его результаты не отражают официальный вариант ФИПИ.</p>}<Button className="mt-5" onClick={start}>Начать пробник</Button></CardContent></Card> : <><div className="flex items-center gap-2 rounded-xl border border-primary-500/20 bg-primary-500/10 px-4 py-3 text-sm text-primary-800"><TimerReset className="h-4 w-4" />Задания: {exam?.items?.length ?? 20} · время: 60 минут</div><div className="space-y-3">{exam?.items?.map((item: any, index: number) => <Card key={item.taskId}><CardHeader><CardTitle className="text-base">{index + 1}. {item.topicTitle}</CardTitle></CardHeader><CardContent><p className="whitespace-pre-line text-sm leading-6 text-[rgb(var(--text))]">{item.statement}</p><input value={answers[index] || item.answer || ''} disabled={finished} onChange={(event) => setAnswers((current) => ({ ...current, [index]: event.target.value }))} placeholder="Ответ" className="mt-3 w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 py-2.5 text-sm disabled:opacity-60" />{finished && <p className="mt-2 text-xs text-[rgb(var(--text-2))]">{item.status === 'correct' ? 'Верно' : item.status === 'needs_review' ? 'Нужна проверка преподавателя' : 'Ответ не совпал'}</p>}</CardContent></Card>)}</div>{!finished ? <Button onClick={submit}>Завершить и отправить</Button> : <Card><CardContent className="py-8"><h2 className="text-lg font-semibold text-[rgb(var(--text))]">Результат: {exam.correctCount} из {exam.items.length}</h2><p className="mt-2 text-sm text-[rgb(var(--text-2))]">Доля автоматически проверенных правильных ответов: {exam.score}%. Результат учтён в карте прогресса.</p>{exam.items.filter((item: any) => item.solution).slice(0, 3).map((item: any) => <details key={item.taskId} className="mt-3 rounded-lg border border-[rgb(var(--border))] p-3"><summary className="cursor-pointer text-sm">Разбор: {item.topicTitle}</summary><p className="mt-2 whitespace-pre-line text-sm text-[rgb(var(--text-2))]">{item.solution}</p></details>)}</CardContent></Card>}</>}</div>;
}
