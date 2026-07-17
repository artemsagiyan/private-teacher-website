'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { LessonRoom } from '@/components/lesson/lesson-room';
import type { LessonStatus } from '@/types';

export default function TeacherLessonPage() {
  const { slotId } = useParams<{ slotId: string }>();
  const router = useRouter();
  const [connection, setConnection] = useState<{
    token: string;
    lessonId: string;
    lessonStatus: LessonStatus;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL || 'ws://localhost:7880';

  useEffect(() => {
    api
      .get<{
        token: string;
        room: string;
        lessonId: string;
        lessonStatus: LessonStatus;
      }>(`/video/token?slotId=${slotId}`)
      .then((data) => setConnection(data))
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

  if (!connection) return null;

  return (
    <LessonRoom
      token={connection.token}
      livekitUrl={livekitUrl}
      lessonId={connection.lessonId}
      initialStatus={connection.lessonStatus}
      isTeacher
      backHref="/dashboard/teacher/calendar"
      title="Ведение урока"
    />
  );
}
