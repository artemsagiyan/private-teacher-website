'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, CircleHelp, Clock3, Send } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { HomeworkAssignment } from '@/types/learning';

export default function StudentHomeworkPage() {
  const [assignments, setAssignments] = useState<HomeworkAssignment[]>([]);
  const [selected, setSelected] = useState<HomeworkAssignment | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const rows = await api.get<HomeworkAssignment[]>('/learning/homework');
    setAssignments(rows);
  }, []);

  useEffect(() => { load().catch(() => toast.error('Не удалось загрузить домашние задания')).finally(() => setLoading(false)); }, [load]);

  const open = async (id: string) => {
    try {
      const item = await api.get<HomeworkAssignment>(`/learning/homework/${id}`);
      setSelected(item);
      setAnswers(Object.fromEntries(item.items.map((task) => [task.id, task.answer ?? ''])));
    } catch { toast.error('Не удалось открыть задание'); }
  };

  const submit = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await api.post(`/learning/homework/${selected.id}/submit`, { answers: selected.items.map((item) => ({ itemId: item.id, answer: answers[item.id] ?? '' })) });
      toast.success('Ответы отправлены');
      await load();
      const refreshed = await api.get<HomeworkAssignment>(`/learning/homework/${selected.id}`);
      setSelected(refreshed);
    } catch (error: any) { toast.error(error.response?.data?.message || 'Не удалось отправить ответы'); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="skeleton h-72 max-w-4xl rounded-2xl" />;
  if (selected) return <Assignment assignment={selected} answers={answers} setAnswers={setAnswers} onSubmit={submit} saving={saving} onBack={() => setSelected(null)} />;

  return <div className="mx-auto max-w-5xl space-y-5"><header><h1 className="text-xl font-semibold text-[rgb(var(--text))]">Домашние задания</h1><p className="mt-1 text-sm text-[rgb(var(--text-2))]">Персональные задания по темам уроков и пробелам в подготовке.</p></header>{assignments.length ? <div className="grid gap-4 md:grid-cols-2">{assignments.map((assignment) => <button type="button" key={assignment.id} onClick={() => open(assignment.id)} className="text-left"><Card className="h-full transition hover:-translate-y-0.5 hover:shadow-card-hover"><CardHeader><div className="flex items-start justify-between gap-3"><CardTitle className="text-base">{assignment.lesson?.slot?.note || 'Домашнее задание'}</CardTitle><Badge variant={assignment.status === 'completed' ? 'success' : assignment.status === 'published' ? 'warning' : 'default'}>{statusLabel(assignment.status)}</Badge></div></CardHeader><CardContent><p className="text-sm text-[rgb(var(--text-2))]">{assignment.items.length} заданий</p><p className="mt-2 text-xs text-[rgb(var(--text-3))]">{assignment.dueAt ? `Сдать до ${new Date(assignment.dueAt).toLocaleDateString('ru-RU')}` : 'Срок не задан'}</p></CardContent></Card></button>)}</div> : <Card><CardContent className="py-12 text-center"><CircleHelp className="mx-auto h-9 w-9 text-[rgb(var(--text-3))]" /><p className="mt-3 text-sm text-[rgb(var(--text-2))]">Опубликованных домашних заданий пока нет.</p><Link href="/dashboard/student/progress" className="mt-4 inline-block"><Button variant="outline">Открыть прогресс</Button></Link></CardContent></Card>}</div>;
}

function Assignment({ assignment, answers, setAnswers, onSubmit, saving, onBack }: { assignment: HomeworkAssignment; answers: Record<string, string>; setAnswers: React.Dispatch<React.SetStateAction<Record<string, string>>>; onSubmit: () => void; saving: boolean; onBack: () => void }) {
  const answered = assignment.items.filter((item) => (answers[item.id] ?? '').trim()).length;
  return <div className="mx-auto max-w-4xl space-y-5"><button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-sm text-[rgb(var(--text-2))] hover:text-[rgb(var(--text))]"><ArrowLeft className="h-4 w-4" />Все задания</button><header><h1 className="text-xl font-semibold text-[rgb(var(--text))]">{assignment.lesson?.slot?.note || 'Домашнее задание'}</h1><p className="mt-1 text-sm text-[rgb(var(--text-2))]">Отвечено: {answered} из {assignment.items.length}</p></header><div className="space-y-3">{assignment.items.map((item) => <Card key={item.id}><CardContent className="space-y-3 pt-5"><div className="flex items-start gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[rgb(var(--surface-2))] text-xs font-semibold text-[rgb(var(--text-2))]">{item.position}</span><div className="min-w-0 flex-1"><p className="text-xs text-[rgb(var(--text-3))]">{item.task.topic?.title || item.task.taskType} · {difficultyLabel(item.task.difficulty)}</p><p className="mt-1 whitespace-pre-line text-sm leading-6 text-[rgb(var(--text))]">{item.task.statement}</p></div>{item.status === 'correct' && <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />}</div><input value={answers[item.id] ?? ''} onChange={(event) => setAnswers((current) => ({ ...current, [item.id]: event.target.value }))} disabled={assignment.status === 'completed'} placeholder="Ваш ответ" className="w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 py-2.5 text-sm text-[rgb(var(--text))] disabled:opacity-60" />{item.status === 'incorrect' && <p className="text-xs text-rose-600">Ответ требует повторной проверки.</p>}</CardContent></Card>)}</div>{assignment.status !== 'completed' && <Button onClick={onSubmit} isLoading={saving}><Send className="h-4 w-4" />Отправить ответы</Button>}<p className="flex items-center gap-1 text-xs text-[rgb(var(--text-3))]"><Clock3 className="h-3.5 w-3.5" />Ответы проверяются автоматически, а развернутые решения может проверить преподаватель.</p></div>;
}

function statusLabel(value: HomeworkAssignment['status']) { return ({ draft: 'Черновик', published: 'Новое', in_progress: 'В работе', completed: 'Завершено' })[value]; }
function difficultyLabel(value: string) { return ({ basic: 'базовый уровень', standard: 'стандарт', advanced: 'повышенный уровень' } as Record<string, string>)[value] || value; }
