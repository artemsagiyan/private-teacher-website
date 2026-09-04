'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

export function UserAvatar({
  className,
  fallback,
}: {
  className?: string;
  fallback: React.ReactNode;
}) {
  const avatarUrl = useAuthStore((s) => s.user?.avatarUrl);
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!avatarUrl) {
      setSrc(null);
      return;
    }
    if (avatarUrl.startsWith('http')) {
      setSrc(avatarUrl);
      return;
    }
    let objectUrl: string | null = null;
    let cancelled = false;
    api
      .getBlob('/users/me/avatar')
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setSrc(null);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [avatarUrl]);

  if (!src) return <>{fallback}</>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" className={className} />;
}
