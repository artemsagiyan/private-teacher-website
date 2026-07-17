'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { LessonRoom } from '@/components/lesson/lesson-room';

export default function StudentLessonPage() {
  const { slotId } = useParams<{ slotId: string }>();
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL || 'ws://localhost:7880';

  useEffect(() => {
    api
      .get<{ token: string; room: string }>(`/video/token?slotId=${slotId}`)
      .then((d) => setToken(d.token))
      .catch((err) => {
        toast.error(err.response?.data?.message || 'Не удалось получить доступ к уроку');
        router.push('/dashboard/student/bookings');
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
    <LessonRoom
      token={token}
      livekitUrl={livekitUrl}
      backHref="/dashboard/student/bookings"
      title="Урок"
    />
  );
}
