'use client';

import Link from 'next/link';
import { PenLine, Video } from 'lucide-react';
import { canJoinLesson } from '@/lib/lesson';
import { cn } from '@/lib/utils';

export function lessonRoomHref(
  role: 'student' | 'teacher',
  slotId: string,
  view?: 'board' | 'video',
) {
  const base = `/dashboard/${role}/lesson/${slotId}`;
  if (view === 'board' || view === 'video') return `${base}?view=${view}`;
  return base;
}

export function LessonJoinLinks({
  role,
  slotId,
  startTime,
  endTime,
  now = Date.now(),
  layout = 'inline',
  showHint = false,
  className,
}: {
  role: 'student' | 'teacher';
  slotId: string;
  startTime: string | Date;
  endTime: string | Date;
  now?: number;
  layout?: 'inline' | 'stack';
  showHint?: boolean;
  className?: string;
}) {
  if (!canJoinLesson(startTime, endTime, now)) {
    if (!showHint) return null;
    return (
      <p className={cn('text-xs text-[rgb(var(--text-3))]', className)}>
        Ссылки на видеовстречу и доску появятся за 30 минут до начала
      </p>
    );
  }

  const stack = layout === 'stack';
  return (
    <div
      className={cn(
        'flex',
        stack ? 'flex-col gap-2' : 'flex-wrap items-center gap-2',
        className,
      )}
    >
      <Link
        href={lessonRoomHref(role, slotId, 'video')}
        className={cn(
          'inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-600',
          stack && 'w-full py-2',
        )}
      >
        <Video className="h-3.5 w-3.5" />
        Видеовстреча
      </Link>
      <Link
        href={lessonRoomHref(role, slotId, 'board')}
        className={cn(
          'inline-flex items-center justify-center gap-1.5 rounded-lg border border-primary-300 bg-primary-50 px-3 py-1.5 text-xs font-medium text-primary-700 transition-colors hover:bg-primary-100 dark:border-primary-800 dark:bg-primary-950/40 dark:text-primary-300',
          stack && 'w-full py-2',
        )}
      >
        <PenLine className="h-3.5 w-3.5" />
        Доска
      </Link>
    </div>
  );
}
