'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { toast } from 'sonner';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';

export default function TeacherLessonPage() {
  const { slotId } = useParams<{ slotId: string }>();
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL || 'ws://localhost:7880';

  useEffect(() => {
    api.get<{ token: string; room: string }>(`/video/token?slotId=${slotId}`)
      .then((d) => setToken(d.token))
      .catch((err) => {
        toast.error(err.response?.data?.message || 'Не удалось получить доступ к уроку');
        router.push('/dashboard/teacher/calendar');
      })
      .finally(() => setLoading(false));
  }, [slotId, router]);

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-56px)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    );
  }

  if (!token) return null;

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">
      <div className="flex items-center gap-3 px-4 py-2 border-b border-[rgb(var(--border))] bg-[rgb(var(--surface))] shrink-0">
        <button
          onClick={() => router.push('/dashboard/teacher/calendar')}
          className="flex items-center gap-1.5 text-sm text-[rgb(var(--text-2))] hover:text-[rgb(var(--text))] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Назад
        </button>
        <span className="text-sm font-medium text-[rgb(var(--text))]">Ведение урока</span>
      </div>

      <div className="flex-1 min-h-0" data-lk-theme="default">
        <LiveKitRoom
          serverUrl={livekitUrl}
          token={token}
          connect={true}
          video={true}
          audio={true}
          style={{ height: '100%' }}
        >
          <VideoConference />
          <RoomAudioRenderer />
        </LiveKitRoom>
      </div>
    </div>
  );
}
