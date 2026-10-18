'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LiveKitRoom,
  VideoTrack,
  useLocalParticipant,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import { Camera, CameraOff, Loader2, RefreshCw, Smartphone } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { resolveLivekitUrl } from '@/lib/livekit-url';

type CameraConnection = {
  token: string;
  url: string;
  lessonId: string;
  expiresAt: string;
};

type FacingMode = 'environment' | 'user';

function CameraSession() {
  const { localParticipant, cameraTrack, isCameraEnabled } = useLocalParticipant();
  const [facingMode, setFacingMode] = useState<FacingMode>('environment');
  const [switching, setSwitching] = useState(false);

  const toggleCamera = async () => {
    setSwitching(true);
    try {
      if (isCameraEnabled) {
        await localParticipant.setCameraEnabled(false);
      } else {
        await localParticipant.setCameraEnabled(true, {
          facingMode,
          resolution: { width: 1280, height: 720 },
          frameRate: 15,
        });
      }
    } finally {
      setSwitching(false);
    }
  };

  const flipCamera = async () => {
    const next = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(next);
    setSwitching(true);
    try {
      await localParticipant.setCameraEnabled(false);
      await localParticipant.setCameraEnabled(true, {
        facingMode: next,
        resolution: { width: 1280, height: 720 },
        frameRate: 15,
      });
    } finally {
      setSwitching(false);
    }
  };

  const trackRef = cameraTrack
    ? ({
        participant: localParticipant,
        publication: cameraTrack,
        source: Track.Source.Camera,
      } as any)
    : undefined;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col gap-5 px-4 py-6">
      <header className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-500/12 text-primary-600">
          <Smartphone className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-[rgb(var(--text))]">Камера тетради</h1>
          <p className="text-sm text-[rgb(var(--text-2))]">Телефон передаёт изображение преподавателю</p>
        </div>
      </header>

      <section className="mx-auto w-full max-w-sm overflow-hidden rounded-2xl border border-[rgb(var(--border))] bg-black shadow-sm">
        <div className="aspect-[9/16] w-full">
          {trackRef ? (
            <VideoTrack trackRef={trackRef} className="h-full w-full object-contain" />
          ) : (
            <div className="flex h-full items-center justify-center text-center text-sm text-white/70">
              Камера выключена
            </div>
          )}
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => void toggleCamera()}
          disabled={switching}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-500 px-4 py-3 text-sm font-medium text-white transition hover:bg-primary-600 disabled:opacity-60"
        >
          {switching ? <Loader2 className="h-4 w-4 animate-spin" /> : isCameraEnabled ? <CameraOff className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
          {isCameraEnabled ? 'Выключить' : 'Включить камеру'}
        </button>
        <button
          type="button"
          onClick={() => void flipCamera()}
          disabled={switching || !isCameraEnabled}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-4 py-3 text-sm font-medium text-[rgb(var(--text))] transition hover:bg-[rgb(var(--surface-2))] disabled:opacity-50"
        >
          <RefreshCw className="h-4 w-4" />
          Сменить камеру
        </button>
      </div>

      <p className="rounded-xl bg-[rgb(var(--surface-2))] px-4 py-3 text-center text-sm leading-6 text-[rgb(var(--text-2))]">
        Поставьте телефон над тетрадью и включите камеру. Для лучшего качества используйте заднюю камеру и устойчивое соединение Wi‑Fi.
      </p>
    </main>
  );
}

function LessonCameraContent() {
  const searchParams = useSearchParams();
  const code = searchParams.get('code') || '';
  const [connection, setConnection] = useState<CameraConnection | null>(null);
  const [error, setError] = useState('');
  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const requestNumber = useRef(0);

  const loadConnection = useCallback(async () => {
    const request = ++requestNumber.current;
    setLoading(true);
    setError('');
    if (!code) {
      setError('QR-код неполный. Попросите преподавателя создать новый код.');
      setLoading(false);
      return null;
    }
    try {
      const value = await api.post<CameraConnection>('/video/camera-token', { code });
      if (request === requestNumber.current) {
        setConnection({ ...value, url: resolveLivekitUrl(value.url) });
        setError('');
      }
      return value;
    } catch (requestError: any) {
      if (request === requestNumber.current) {
        setError(
          requestError.response?.data?.message ||
            'Не удалось получить доступ к камере. Проверьте соединение и повторите попытку.',
        );
      }
      return null;
    } finally {
      if (request === requestNumber.current) setLoading(false);
    }
  }, [code]);

  useEffect(() => {
    void loadConnection();
    return () => {
      requestNumber.current += 1;
    };
  }, [loadConnection]);

  const startCamera = async () => {
    setConnecting(true);
    const freshConnection = await loadConnection();
    if (freshConnection) setStarted(true);
    setConnecting(false);
  };

  const expiresText = useMemo(() => {
    if (!connection?.expiresAt) return '';
    return new Intl.DateTimeFormat('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(connection.expiresAt));
  }, [connection?.expiresAt]);

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center px-5 py-8 text-center">
        <div className="max-w-sm rounded-2xl border border-red-500/20 bg-red-500/8 p-6">
          <CameraOff className="mx-auto h-8 w-8 text-red-600" />
          <h1 className="mt-3 text-lg font-semibold text-[rgb(var(--text))]">Не удалось подключить камеру</h1>
          <p className="mt-2 text-sm leading-6 text-[rgb(var(--text-2))]">{error}</p>
          {code && (
            <button
              type="button"
              onClick={() => void loadConnection()}
              disabled={loading}
              className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Повторить подключение
            </button>
          )}
        </div>
      </main>
    );
  }

  if (!connection || loading) {
    return (
      <main className="flex min-h-screen items-center justify-center gap-3 text-sm text-[rgb(var(--text-2))]">
        <Loader2 className="h-5 w-5 animate-spin text-primary-500" />
        Подключаем камеру…
      </main>
    );
  }

  if (!started) {
    return (
      <main className="flex min-h-screen items-center justify-center px-5 py-8">
        <section className="w-full max-w-sm rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-6 text-center shadow-sm">
          <Camera className="mx-auto h-10 w-10 text-primary-500" />
          <h1 className="mt-4 text-xl font-semibold text-[rgb(var(--text))]">Готовы показать тетрадь?</h1>
          <p className="mt-2 text-sm leading-6 text-[rgb(var(--text-2))]">
            Разрешите доступ к камере, поставьте телефон над тетрадью и нажмите кнопку подключения.
          </p>
          <button
            type="button"
            onClick={() => void startCamera()}
            disabled={connecting}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary-500 px-4 py-3 text-sm font-medium text-white transition hover:bg-primary-600 disabled:opacity-60"
          >
            {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            {connecting ? 'Подключаем…' : 'Подключить камеру'}
          </button>
          {expiresText && <p className="mt-3 text-xs text-[rgb(var(--text-3))]">Ссылка действует до {expiresText}</p>}
        </section>
      </main>
    );
  }

  return (
    <LiveKitRoom
      key={connection.token}
      serverUrl={connection.url}
      token={connection.token}
      connect
      video={{
        facingMode: 'environment',
        resolution: { width: 1280, height: 720 },
        frameRate: 15,
      }}
      audio={false}
      options={{ disconnectOnPageLeave: true }}
      onError={() => {
        setStarted(false);
        setError('Связь с уроком прервалась. Нажмите «Повторить подключение».');
        void loadConnection();
      }}
      onDisconnected={() => {
        setStarted(false);
        void loadConnection();
      }}
      style={{ minHeight: '100vh', display: 'block' }}
    >
      <CameraSession />
    </LiveKitRoom>
  );
}

export default function LessonCameraPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center gap-3 text-sm text-[rgb(var(--text-2))]">
          <Loader2 className="h-5 w-5 animate-spin text-primary-500" />
          Загружаем подключение…
        </main>
      }
    >
      <LessonCameraContent />
    </Suspense>
  );
}
