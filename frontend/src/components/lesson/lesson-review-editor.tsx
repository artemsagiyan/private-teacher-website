'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, RefreshCw, Save, Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import type { Booking } from '@/types';
import type { HomeworkAssignment, LessonReview, TopicAssessment } from '@/types/learning';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const assessmentLabel: Record<TopicAssessment, string> = { mastered: 'Освоено', practiced: 'Практиковали', difficulty: 'Сложность' };

export function LessonReviewEditor({ lessonId, slotId, onPublished }: { lessonId: string; slotId: string; onPublished: () => void }) {
  const [students, setStudents] = useState<Booking[]>([]);
  const [studentId, setStudentId] = useState('');
  const [review, setReview] = useState<LessonReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [summary, setSummary] = useState('');
  const [achievements, setAchievements] = useState('');
  const [recommendations, setRecommendations] = useState('');
  const [topics, setTopics] = useState<Array<{ topicId: string; assessment: TopicAssessment; confidence: number; note: string }>>([]);
  const [mistakes, setMistakes] = useState<Array<{ topicId?: string; description: string }>>([]);
  const [homework, setHomework] = useState<HomeworkAssignment | null>(null);

  useEffect(() => {
    api.get<Booking[]>('/bookings/teacher').then((rows) => {
      const inSlot = rows.filter((booking) => booking.slotId === slotId && ['confirmed', 'completed'].includes(booking.status));
      setStudents(inSlot);
      if (inSlot[0]) setStudentId(inSlot[0].studentId);
    }).catch(() => toast.error('Не удалось загрузить учеников этого занятия'));
  }, [slotId]);

  const load = useCallback(async () => {
    if (!studentId) { setLoading(false); return; }
    setLoading(true);
    try {
      const data = await api.get<LessonReview>(`/learning/lessons/${lessonId}/review?studentId=${studentId}`);
      setReview(data); setSummary(data.summary); setAchievements(data.achievements.join('\n')); setRecommendations(data.recommendations.join('\n'));
      setTopics(data.topics.map((topic) => ({ topicId: topic.topicId, assessment: topic.assessment, confidence: topic.confidence, note: topic.note || '' })));
      setMistakes(data.mistakes.map((mistake) => ({ topicId: mistake.topicId || undefined, description: mistake.description })));
      setHomework(data.homework);
    } catch (error: any) {
      setReview(null); toast.error(error.response?.data?.message || 'Не удалось загрузить разбор. Ученик должен выбрать экзамен в разделе «Мой прогресс».');
    } finally { setLoading(false); }
  }, [lessonId, studentId]);

  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    if (!review) return;
    setSaving(true);
    try {
      const updated = await api.put<LessonReview>(`/learning/lessons/${lessonId}/review?studentId=${studentId}`, {
        revision: review.revision, summary, achievements: splitLines(achievements), recommendations: splitLines(recommendations),
        topics, mistakes: mistakes.filter((mistake) => mistake.description.trim()),
      });
      setReview(updated); toast.success('Разбор сохранён');
    } catch (error: any) { toast.error(error.response?.data?.message || 'Не удалось сохранить разбор'); }
    finally { setSaving(false); }
  };

  const generate = async () => {
    if (!review) return;
    setSaving(true);
    try {
      const result = await api.post<HomeworkAssignment>(`/learning/lessons/${lessonId}/homework/generate?studentId=${studentId}`);
      setHomework(result); toast.success(`Подобрано заданий: ${result.items.length}`);
    } catch (error: any) { toast.error(error.response?.data?.message || 'Не удалось подобрать задания. Проверьте активный каталог.'); }
    finally { setSaving(false); }
  };

  const saveHomework = async () => {
    if (!homework) return;
    setSaving(true);
    try {
      const result = await api.patch<HomeworkAssignment>(`/learning/homework/${homework.id}`, {
        items: homework.items.map((item) => ({ taskId: item.task.id, rationale: item.rationale })), dueAt: homework.dueAt,
      });
      setHomework(result); toast.success('Состав домашнего задания сохранён');
    } catch (error: any) { toast.error(error.response?.data?.message || 'Не удалось сохранить задания'); }
    finally { setSaving(false); }
  };

  const publish = async () => {
    if (!homework || homework.items.length < 20 || new Set(homework.items.map((item) => item.task.taskType)).size < 5) {
      toast.error('Для публикации нужно не менее 20 заданий пяти типов');
      return;
    }
    setSaving(true);
    try {
      await api.post(`/learning/lessons/${lessonId}/publish?studentId=${studentId}`);
      toast.success('Отчёт и домашнее задание опубликованы');
      await load(); onPublished();
    } catch (error: any) { toast.error(error.response?.data?.message || 'Перед публикацией сохраните разбор и соберите домашнее задание'); }
    finally { setSaving(false); }
  };

  if (!students.length) return <Card><CardContent className="py-5 text-sm text-[rgb(var(--text-2))]">К этому занятию не привязаны ученики.</CardContent></Card>;
  return <Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><CardTitle>Проверка разбора и публикация</CardTitle>{students.length > 1 && <select value={studentId} onChange={(event) => setStudentId(event.target.value)} className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 py-2 text-sm">{students.map((booking) => <option key={booking.studentId} value={booking.studentId}>{[booking.student?.user?.firstName, booking.student?.user?.lastName].filter(Boolean).join(' ') || 'Ученик'}</option>)}</select>}</div></CardHeader><CardContent className="space-y-5">{loading ? <div className="skeleton h-40 rounded-xl" /> : !review ? <p className="text-sm text-[rgb(var(--text-2))]">Разбор пока недоступен. Проверьте настройки подготовки ученика и повторите загрузку.</p> : <>
    {review.status === 'published' && <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-xs text-emerald-800">Отчёт опубликован {review.publishedAt ? new Date(review.publishedAt).toLocaleString('ru-RU') : ''}. Редактирование закрыто.</p>}
    <label className="block space-y-1.5 text-sm font-medium">Краткий итог<textarea disabled={review.status === 'published'} value={summary} onChange={(event) => setSummary(event.target.value)} rows={3} className="w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 py-2 text-sm font-normal disabled:opacity-60" /></label>
    <div className="grid gap-3 md:grid-cols-2"><TextList label="Что получилось" value={achievements} disabled={review.status === 'published'} onChange={setAchievements} /><TextList label="Рекомендации" value={recommendations} disabled={review.status === 'published'} onChange={setRecommendations} /></div>
    <section><div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-semibold">Темы из кодификатора</h3><span className="text-xs text-[rgb(var(--text-3))]">Выберите оценку для каждой темы урока</span></div><div className="space-y-2">{review.curriculumTopics.map((topic) => { const finding = topics.find((item) => item.topicId === topic.id); return <div key={topic.id} className="grid gap-2 rounded-lg border border-[rgb(var(--border))] p-3 sm:grid-cols-[minmax(0,1fr)_150px]"><div className="flex items-center gap-2"><input type="checkbox" disabled={review.status === 'published'} checked={!!finding} onChange={(event) => setTopics((current) => event.target.checked ? [...current, { topicId: topic.id, assessment: 'practiced', confidence: 1, note: '' }] : current.filter((item) => item.topicId !== topic.id))} /><span className="text-xs text-[rgb(var(--text-3))]">{topic.code}</span><span className="text-sm">{topic.title}</span></div>{finding && <select disabled={review.status === 'published'} value={finding.assessment} onChange={(event) => setTopics((current) => current.map((item) => item.topicId === topic.id ? { ...item, assessment: event.target.value as TopicAssessment } : item))} className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-2 py-1.5 text-xs">{Object.entries(assessmentLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>}</div>; })}</div></section>
    <section><div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-semibold">Ошибки и сложности</h3>{review.status === 'draft' && <Button size="sm" variant="ghost" onClick={() => setMistakes((rows) => [...rows, { description: '' }])}><Plus className="h-4 w-4" />Добавить</Button>}</div><div className="space-y-2">{mistakes.map((mistake, index) => <div key={index} className="flex gap-2"><input disabled={review.status === 'published'} value={mistake.description} onChange={(event) => setMistakes((rows) => rows.map((row, i) => i === index ? { ...row, description: event.target.value } : row))} placeholder="Опишите ошибку или сложность" className="min-w-0 flex-1 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 py-2 text-sm" />{review.status === 'draft' && <Button size="icon" variant="ghost" onClick={() => setMistakes((rows) => rows.filter((_, i) => i !== index))}><Trash2 className="h-4 w-4" /></Button>}</div>)}</div></section>
    <div className="flex flex-wrap gap-2">{review.status === 'draft' && <Button onClick={save} isLoading={saving}><Save className="h-4 w-4" />Сохранить разбор</Button>}{review.status === 'draft' && <Button variant="outline" onClick={generate} isLoading={saving}><RefreshCw className="h-4 w-4" />Собрать ДЗ</Button>}</div>
    {homework && <section className="space-y-3 rounded-xl border border-[rgb(var(--border))] p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-sm font-semibold">Домашнее задание · {homework.items.length} заданий</h3><p className="mt-1 text-xs text-[rgb(var(--text-3))]">Состав можно скорректировать до публикации.</p></div>{review.status === 'draft' && <Button size="sm" variant="outline" onClick={saveHomework} isLoading={saving}>Сохранить состав</Button>}</div>{(homework.items.length < 20 || new Set(homework.items.map((item) => item.task.taskType)).size < 5) && <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-800">Для публикации нужно не менее 20 заданий пяти типов. Сейчас: {homework.items.length} заданий, {new Set(homework.items.map((item) => item.task.taskType)).size} типов.</p>}<div className="max-h-96 space-y-2 overflow-auto">{homework.items.map((item) => <div key={item.id} className="flex items-start gap-2 rounded-lg bg-[rgb(var(--surface-2))] p-3"><div className="min-w-0 flex-1"><p className="text-xs text-[rgb(var(--text-3))]">{item.task.topic?.title} · {item.task.taskType}</p><p className="mt-1 whitespace-pre-line text-sm">{item.task.statement}</p></div>{review.status === 'draft' && <Button size="icon" variant="ghost" title="Убрать из ДЗ" onClick={() => setHomework((current) => current ? { ...current, items: current.items.filter((candidate) => candidate.id !== item.id) } : current)}><Trash2 className="h-4 w-4" /></Button>}</div>)}</div></section>}
    {review.status === 'draft' && <Button variant="gradient" onClick={publish} isLoading={saving} disabled={!homework || homework.items.length < 20 || new Set(homework.items.map((item) => item.task.taskType)).size < 5}><Send className="h-4 w-4" />Опубликовать отчёт и ДЗ</Button>}
  </>}</CardContent></Card>;
}

function TextList({ label, value, onChange, disabled }: { label: string; value: string; onChange: (value: string) => void; disabled: boolean }) { return <label className="space-y-1.5 text-sm font-medium">{label}<textarea disabled={disabled} value={value} onChange={(event) => onChange(event.target.value)} rows={3} placeholder="Каждая строка станет отдельным пунктом" className="w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 py-2 text-sm font-normal disabled:opacity-60" /></label>; }
function splitLines(value: string) { return value.split('\n').map((line) => line.trim()).filter(Boolean); }
