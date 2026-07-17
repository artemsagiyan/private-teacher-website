'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import {
  ArrowLeft,
  ClipboardList,
  Download,
  FileAudio,
  FileText,
  Loader2,
  Presentation,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import type { LessonRecord, LessonReport } from '@/types';

const SECTION_LABELS: Array<{
  key: keyof Pick<
    LessonReport,
    | 'topics'
    | 'achievements'
    | 'difficulties'
    | 'homework'
    | 'recommendations'
  >;
  label: string;
}> = [
  { key: 'topics', label: 'Темы урока' },
  { key: 'achievements', label: 'Что получилось' },
  { key: 'difficulties', label: 'Сложности' },
  { key: 'homework', label: 'Домашнее задание' },
  { key: 'recommendations', label: 'Рекомендации' },
];

export default function LessonDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const user = useAuthStore((state) => state.user);
  const [lesson, setLesson] = useState<LessonRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await api.get<LessonRecord>(`/lessons/${id}`);
      setLesson(data);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Не удалось загрузить урок');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!lesson || !['processing', 'ending'].includes(lesson.status)) return;
    const interval = window.setInterval(load, 10_000);
    return () => window.clearInterval(interval);
  }, [lesson, load]);

  const download = async (
    type: 'recording' | 'transcript' | 'report',
    extension: string,
  ) => {
    setDownloading(type);
    try {
      await api.download(
        `/lessons/${id}/files/${type}`,
        `lesson-${id}-${type}.${extension}`,
      );
    } finally {
      setDownloading('');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary-500" />
      </div>
    );
  }

  if (error || !lesson) {
    return (
      <div className="p-8">
        <p className="text-red-600">{error || 'Урок не найден'}</p>
      </div>
    );
  }

  const backHref =
    user?.role === 'teacher'
      ? '/dashboard/teacher/lessons'
      : '/dashboard/student/lessons';
  const report =
    lesson.report && 'topics' in lesson.report
      ? (lesson.report as LessonReport)
      : null;
  const date = lesson.slot?.startTime || lesson.startedAt || lesson.createdAt;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-5 md:p-8">
      <div>
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm text-[rgb(var(--text-2))] hover:text-[rgb(var(--text))]"
        >
          <ArrowLeft className="h-4 w-4" />
          История уроков
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-[rgb(var(--text))]">
          {lesson.slot?.note || 'Отчёт по уроку'}
        </h1>
        <p className="mt-1 text-sm text-[rgb(var(--text-2))]">
          {format(new Date(date), 'd MMMM yyyy, HH:mm', { locale: ru })}
          {lesson.transcriptDurationSeconds
            ? ` · ${Math.round(lesson.transcriptDurationSeconds / 60)} мин`
            : ''}
        </p>
      </div>

      {['processing', 'ending'].includes(lesson.status) && (
        <div className="flex items-center gap-3 rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-4 text-sm text-indigo-700 dark:text-indigo-300">
          <Loader2 className="h-4 w-4 animate-spin" />
          Аудио распознаётся, локальная модель готовит отчёт. Страница
          обновится автоматически.
        </div>
      )}

      {lesson.status === 'failed' && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300">
          Обработка завершилась с ошибкой: {lesson.processingError}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          href={`/dashboard/lessons/${id}/board`}
          className="flex items-center gap-3 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-4 hover:border-primary-400/50"
        >
          <Presentation className="h-5 w-5 text-primary-500" />
          <span className="text-sm font-medium">Открыть доску</span>
        </Link>
        <button
          type="button"
          disabled={!lesson.files.transcript || downloading === 'transcript'}
          onClick={() => download('transcript', 'txt')}
          className="flex items-center gap-3 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-4 text-left hover:border-primary-400/50 disabled:opacity-40"
        >
          <FileText className="h-5 w-5 text-primary-500" />
          <span className="text-sm font-medium">Транскрипт</span>
        </button>
        <button
          type="button"
          disabled={!lesson.files.recording || downloading === 'recording'}
          onClick={() => download('recording', 'ogg')}
          className="flex items-center gap-3 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-4 text-left hover:border-primary-400/50 disabled:opacity-40"
        >
          <FileAudio className="h-5 w-5 text-primary-500" />
          <span className="text-sm font-medium">Аудиозапись</span>
        </button>
        <button
          type="button"
          disabled={!lesson.files.report || downloading === 'report'}
          onClick={() => download('report', 'json')}
          className="flex items-center gap-3 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-4 text-left hover:border-primary-400/50 disabled:opacity-40"
        >
          <Download className="h-5 w-5 text-primary-500" />
          <span className="text-sm font-medium">Скачать отчёт</span>
        </button>
      </div>

      {report ? (
        <>
          <section className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-5 md:p-6">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary-500" />
              <h2 className="font-semibold text-[rgb(var(--text))]">
                Итоги урока
              </h2>
            </div>
            <p className="mt-3 whitespace-pre-line text-sm leading-6 text-[rgb(var(--text-2))]">
              {report.summary}
            </p>
          </section>

          <div className="grid gap-4 md:grid-cols-2">
            {SECTION_LABELS.map(({ key, label }) => (
              <section
                key={key}
                className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-5"
              >
                <h2 className="font-semibold text-[rgb(var(--text))]">
                  {label}
                </h2>
                {report[key].length ? (
                  <ul className="mt-3 space-y-2">
                    {report[key].map((item, index) => (
                      <li
                        key={`${key}-${index}`}
                        className="flex gap-2 text-sm leading-5 text-[rgb(var(--text-2))]"
                      >
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-500" />
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-[rgb(var(--text-3))]">
                    Не указано
                  </p>
                )}
              </section>
            ))}
          </div>

          {report.keyMoments.length > 0 && (
            <section className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-5">
              <h2 className="font-semibold text-[rgb(var(--text))]">
                Ключевые моменты
              </h2>
              <div className="mt-3 space-y-3">
                {report.keyMoments.map((moment, index) => (
                  <div
                    key={index}
                    className="flex gap-3 text-sm text-[rgb(var(--text-2))]"
                  >
                    {moment.time && (
                      <span className="shrink-0 font-mono text-xs text-primary-500">
                        {moment.time}
                      </span>
                    )}
                    <span>{moment.description}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      ) : lesson.status === 'completed' ? (
        <div className="rounded-2xl border border-dashed border-[rgb(var(--border))] p-8 text-center text-sm text-[rgb(var(--text-2))]">
          Для этого урока отчёт не формировался.
        </div>
      ) : null}
    </div>
  );
}
