'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  Loader2,
  Radio,
} from 'lucide-react';
import { api } from '@/lib/api';
import type { LessonRecord, LessonStatus } from '@/types';

const STATUS: Record<
  LessonStatus,
  { label: string; icon: typeof Clock3; className: string }
> = {
  waiting: {
    label: 'Ожидает начала',
    icon: Clock3,
    className: 'text-amber-600 bg-amber-500/10',
  },
  starting: {
    label: 'Запускается',
    icon: Radio,
    className: 'text-amber-600 bg-amber-500/10',
  },
  active: {
    label: 'Идёт сейчас',
    icon: Radio,
    className: 'text-red-600 bg-red-500/10',
  },
  ending: {
    label: 'Завершается',
    icon: Clock3,
    className: 'text-slate-600 bg-slate-500/10',
  },
  processing: {
    label: 'Готовится отчёт',
    icon: Loader2,
    className: 'text-indigo-600 bg-indigo-500/10',
  },
  completed: {
    label: 'Завершён',
    icon: CheckCircle2,
    className: 'text-emerald-600 bg-emerald-500/10',
  },
  failed: {
    label: 'Ошибка обработки',
    icon: AlertCircle,
    className: 'text-red-600 bg-red-500/10',
  },
};

export function LessonHistory() {
  const [lessons, setLessons] = useState<LessonRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get<LessonRecord[]>('/lessons')
      .then(setLessons)
      .catch((err) =>
        setError(err.response?.data?.message || 'Не удалось загрузить уроки'),
      )
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-5 md:p-8">
      <div>
        <h1 className="text-2xl font-bold text-[rgb(var(--text))]">
          История уроков
        </h1>
        <p className="mt-1 text-sm text-[rgb(var(--text-2))]">
          Записи, доски, транскрипты и отчёты по завершённым занятиям
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-600">
          {error}
        </div>
      )}

      {!error && lessons.length === 0 && (
        <div className="rounded-2xl border border-dashed border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-12 text-center">
          <FileText className="mx-auto h-9 w-9 text-[rgb(var(--text-3))]" />
          <p className="mt-3 font-medium text-[rgb(var(--text))]">
            История пока пуста
          </p>
          <p className="mt-1 text-sm text-[rgb(var(--text-2))]">
            После первого урока здесь появятся материалы и отчёт.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {lessons.map((lesson) => {
          const status = STATUS[lesson.status];
          const StatusIcon = status.icon;
          const date = lesson.slot?.startTime || lesson.startedAt || lesson.createdAt;

          return (
            <Link
              key={lesson.id}
              href={`/dashboard/lessons/${lesson.id}`}
              className="group block rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-4 transition hover:border-primary-400/50 hover:shadow-sm md:p-5"
            >
              <div className="flex items-start gap-4">
                <div className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-500/10 text-primary-600 sm:flex">
                  <CalendarDays className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold text-[rgb(var(--text))]">
                      {lesson.slot?.note || 'Онлайн-урок'}
                    </h2>
                    <span
                      className={[
                        'inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium',
                        status.className,
                      ].join(' ')}
                    >
                      <StatusIcon
                        className={[
                          'h-3 w-3',
                          lesson.status === 'processing' ? 'animate-spin' : '',
                        ].join(' ')}
                      />
                      {status.label}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-[rgb(var(--text-2))]">
                    {format(new Date(date), 'd MMMM yyyy, HH:mm', {
                      locale: ru,
                    })}
                    {lesson.teacher?.user
                      ? ` · ${lesson.teacher.user.firstName} ${lesson.teacher.user.lastName}`
                      : ''}
                  </p>
                  {lesson.report?.summary && (
                    <p className="mt-3 line-clamp-2 text-sm text-[rgb(var(--text-2))]">
                      {lesson.report.summary}
                    </p>
                  )}
                </div>
                <ChevronRight className="mt-2 h-5 w-5 shrink-0 text-[rgb(var(--text-3))] transition-transform group-hover:translate-x-0.5 group-hover:text-primary-500" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
