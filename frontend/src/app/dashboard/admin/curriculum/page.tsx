'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Database, FileUp, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Release = { id: string; examTrack: string; year: number; version: string; title: string; sourceKind: string; isActive: boolean; topicCount: number; taskCount: number };
type Preview = { dryRun: boolean; topics: number; tasks: number; taskTypes: number; tasksWithoutAnswers: number; warnings: string[] };

export default function CurriculumAdminPage() {
  const [releases, setReleases] = useState<Release[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => setReleases(await api.get<Release[]>('/curriculum/releases')), []);
  useEffect(() => { load().catch(() => toast.error('Не удалось загрузить версии каталога')).finally(() => setLoading(false)); }, [load]);

  const inspect = async () => {
    if (!file) return toast.error('Выберите JSON- или CSV-файл');
    const form = new FormData(); form.append('file', file);
    setWorking(true);
    try {
      setPreview(await api.post<Preview>('/curriculum/import?dryRun=true', form));
      toast.success('Проверка каталога завершена');
    } catch (error: any) {
      const data = error.response?.data;
      const details = Array.isArray(data?.errors) ? data.errors.join('; ') : data?.message;
      toast.error(details || 'Файл не прошёл проверку');
      setPreview(null);
    } finally { setWorking(false); }
  };

  const importAndActivate = async () => {
    if (!file || !preview) return;
    const form = new FormData(); form.append('file', file);
    setWorking(true);
    try {
      const result = await api.post<{ releaseId: string }>('/curriculum/import', form);
      await api.patch(`/curriculum/releases/${result.releaseId}/activate`, {});
      await load();
      setFile(null); setPreview(null);
      toast.success('Каталог загружен и активирован');
    } catch (error: any) { toast.error(error.response?.data?.message || 'Не удалось загрузить каталог'); }
    finally { setWorking(false); }
  };

  const activate = async (id: string) => {
    try { await api.patch(`/curriculum/releases/${id}/activate`, {}); await load(); toast.success('Версия каталога активирована'); }
    catch { toast.error('Не удалось активировать версию'); }
  };

  const importDemo = async () => {
    setWorking(true);
    try { await api.post('/curriculum/demo?activate=true'); await load(); toast.success('Демонстрационные каталоги подготовлены'); }
    catch (error: any) { toast.error(error.response?.data?.message || 'Не удалось загрузить демо-данные'); }
    finally { setWorking(false); }
  };

  return <div className="mx-auto max-w-5xl space-y-5"><header><h1 className="text-xl font-semibold text-[rgb(var(--text))]">Каталог заданий и кодификаторы</h1><p className="mt-1 text-sm text-[rgb(var(--text-2))]">Загружайте подготовленные каталоги ОГЭ и ЕГЭ, проверяйте состав до публикации и управляйте активными версиями.</p></header>
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><FileUp className="h-4 w-4 text-primary-500" />Импорт каталога</CardTitle></CardHeader><CardContent className="space-y-4"><input type="file" accept=".json,.csv,application/json,text/csv" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setPreview(null); }} className="block w-full text-sm text-[rgb(var(--text-2))] file:mr-3 file:rounded-lg file:border-0 file:bg-[rgb(var(--surface-2))] file:px-3 file:py-2 file:text-sm" /><p className="text-xs leading-5 text-[rgb(var(--text-3))]">JSON должен содержать schemaVersion, examTrack, year, version, title, topics и tasks. CSV ожидает столбцы externalId, topicCode, topicTitle, taskType, difficulty, statement, acceptedAnswers и общие метаданные версии в первой строке. Максимальный размер — 5 МБ.</p><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={inspect} isLoading={working} disabled={!file}>Проверить файл</Button>{preview && <Button onClick={importAndActivate} isLoading={working}>Импортировать и активировать</Button>}<Button variant="ghost" onClick={importDemo} isLoading={working}><RefreshCw className="h-4 w-4" />Добавить демо-каталоги</Button></div>{preview && <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] p-4 text-sm"><p className="font-medium text-[rgb(var(--text))]">Тем: {preview.topics} · заданий: {preview.tasks} · типов заданий: {preview.taskTypes}</p>{preview.tasksWithoutAnswers > 0 && <p className="mt-1 text-[rgb(var(--text-2))]">Без автоответа: {preview.tasksWithoutAnswers}. Их сможет проверять преподаватель.</p>}{preview.warnings.length > 0 && <ul className="mt-2 list-inside list-disc text-xs text-amber-700">{preview.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>}</div>}</CardContent></Card>
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><Database className="h-4 w-4 text-primary-500" />Загруженные версии</CardTitle></CardHeader><CardContent>{loading ? <div className="skeleton h-24 rounded-xl" /> : releases.length ? <div className="space-y-2">{releases.map((release) => <div key={release.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[rgb(var(--border))] p-4"><div><p className="font-medium text-[rgb(var(--text))]">{release.title}</p><p className="mt-1 text-xs text-[rgb(var(--text-2))]">{trackLabel(release.examTrack)} · {release.year} · {release.version} · {release.topicCount} тем · {release.taskCount} заданий · {release.sourceKind === 'demo' ? 'демо' : 'импорт'}</p></div>{release.isActive ? <span className="inline-flex items-center gap-1 text-xs text-emerald-700"><Check className="h-4 w-4" />Активна</span> : <Button size="sm" variant="outline" onClick={() => activate(release.id)}>Активировать</Button>}</div>)}</div> : <p className="text-sm text-[rgb(var(--text-2))]">Каталоги ещё не загружены.</p>}</CardContent></Card>
  </div>;
}

function trackLabel(track: string) { return ({ oge: 'ОГЭ', ege_base: 'ЕГЭ, базовый', ege_profile: 'ЕГЭ, профильный' } as Record<string, string>)[track] || track; }
