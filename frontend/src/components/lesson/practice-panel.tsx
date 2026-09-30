'use client';

import { useEffect, useRef, useState } from 'react';
import { Lightbulb, Loader2, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';

interface PracticeItem {
  title: string;
  task: string;
  reason: string;
}

interface PracticePlan {
  summary: string;
  items: PracticeItem[];
}

export function PracticePanel({ lessonId }: { lessonId: string }) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [plan, setPlan] = useState<PracticePlan | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [box, setBox] = useState<{ top: number; left: number } | null>(null);

  const load = async (refresh = false) => {
    setLoading(true);
    setError('');
    try {
      const data = refresh
        ? await api.post<PracticePlan>(`/lessons/${lessonId}/practice`)
        : await api.get<PracticePlan>(`/lessons/${lessonId}/practice`);
      setPlan(data);
      setOpen(true);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || 'Не удалось подобрать задачи';
      setError(message);
      setOpen(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(false);
  }, [lessonId]);

  useEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(384, window.innerWidth * 0.8);
      setBox({
        top: rect.bottom + 8,
        left: Math.min(Math.max(8, rect.left), window.innerWidth - width - 8),
      });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, plan]);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => (plan ? setOpen((value) => !value) : load(false))}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[rgb(var(--border))] px-2.5 py-1 text-xs font-medium text-[rgb(var(--text))] hover:bg-[rgb(var(--surface-2))]"
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Lightbulb className="h-3.5 w-3.5" />
        )}
        Что решать
      </button>
      {open && (
        <div
          className="fixed z-[80] max-h-[70vh] w-[min(24rem,80vw)] overflow-y-auto rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-4 shadow-card"
          style={{ top: box?.top ?? 48, left: box?.left ?? 16 }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[rgb(var(--text))]">
                На этом уроке
              </p>
              {plan?.summary && (
                <p className="mt-1 text-xs leading-5 text-[rgb(var(--text-2))]">
                  {plan.summary}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => load(true)}
              className="text-[rgb(var(--text-3))] hover:text-[rgb(var(--text))]"
              aria-label="Обновить подбор"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
          {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
          <ol className="mt-3 space-y-3">
            {plan?.items.map((item, index) => (
              <li key={`${item.title}-${index}`} className="text-sm">
                <p className="font-medium text-[rgb(var(--text))]">
                  {index + 1}. {item.title}
                </p>
                <p className="mt-1 text-[rgb(var(--text-2))]">{item.task}</p>
                {item.reason && (
                  <p className="mt-1 text-xs text-[rgb(var(--text-3))]">
                    {item.reason}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
