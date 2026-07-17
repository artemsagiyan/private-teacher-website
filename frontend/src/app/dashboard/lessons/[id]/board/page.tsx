'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import '@excalidraw/excalidraw/index.css';
import { api } from '@/lib/api';

const ReadonlyBoard = dynamic(
  () =>
    import('@excalidraw/excalidraw').then((module) => ({
      default: module.Excalidraw,
    })),
  { ssr: false },
);

export default function SavedBoardPage() {
  const { id } = useParams<{ id: string }>();
  const [scene, setScene] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get(`/lessons/${id}/board`)
      .then(setScene)
      .catch((err) =>
        setError(err.response?.data?.message || 'Не удалось открыть доску'),
      );
  }, [id]);

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col bg-[rgb(var(--surface))]">
      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-[rgb(var(--border))] px-4">
        <Link
          href={`/dashboard/lessons/${id}`}
          className="inline-flex items-center gap-1.5 text-sm text-[rgb(var(--text-2))] hover:text-[rgb(var(--text))]"
        >
          <ArrowLeft className="h-4 w-4" />
          К отчёту
        </Link>
        <span className="font-medium text-[rgb(var(--text))]">
          Доска урока
        </span>
        <span className="ml-auto text-xs text-[rgb(var(--text-3))]">
          Только просмотр
        </span>
      </div>

      <div className="relative min-h-0 flex-1">
        {!scene && !error && (
          <div className="absolute inset-0 z-10 flex items-center justify-center">
            <Loader2 className="h-7 w-7 animate-spin text-primary-500" />
          </div>
        )}
        {error && (
          <div className="flex h-full items-center justify-center text-sm text-red-600">
            {error}
          </div>
        )}
        {scene && (
          <div className="saved-lesson-board h-full w-full">
            <ReadonlyBoard
              langCode="ru-RU"
              initialData={{
                elements: scene.elements || [],
                appState: scene.appState || {},
                files: scene.files || {},
              }}
              viewModeEnabled
              zenModeEnabled
            />
          </div>
        )}
      </div>
    </div>
  );
}
