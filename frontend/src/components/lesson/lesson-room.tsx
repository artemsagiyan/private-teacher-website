'use client';

import { useCallback, useRef, useState, type CSSProperties } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
  useDataChannel,
  useLocalParticipant,
  useRoomContext,
} from '@livekit/components-react';
import '@livekit/components-styles';
import '@excalidraw/excalidraw/index.css';
import { Track } from 'livekit-client';
import { ArrowLeft, Loader2, Video, PenLine, LayoutPanelLeft, MonitorOff } from 'lucide-react';

// ─── Excalidraw: browser-only, no SSR ───────────────────────────────────────
const ExcalidrawComponent = dynamic(
  () => import('@excalidraw/excalidraw').then((m) => ({ default: m.Excalidraw })),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-white dark:bg-zinc-900">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    ),
  },
);

// ─── Whiteboard with real-time sync via LiveKit data channel ─────────────────

function WhiteboardPanel() {
  const apiRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipRef = useRef(false);
  const enc = useRef(new TextEncoder());
  const dec = useRef(new TextDecoder());

  const { send } = useDataChannel('wb', (msg) => {
    try {
      const { elements } = JSON.parse(dec.current.decode(msg.payload));
      if (!apiRef.current) return;
      skipRef.current = true;
      apiRef.current.updateScene({ elements });
    } catch {
      /* ignore malformed */
    }
  });

  const handleChange = useCallback(
    (elements: readonly any[]) => {
      if (skipRef.current) {
        skipRef.current = false;
        return;
      }
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        try {
          send(enc.current.encode(JSON.stringify({ elements: [...elements] })), {});
        } catch {
          /* room not ready */
        }
      }, 150);
    },
    [send],
  );

  return (
    <div className="w-full h-full" style={{ background: 'var(--color-surface)' }}>
      <ExcalidrawComponent
        excalidrawAPI={(api: any) => {
          apiRef.current = api;
        }}
        onChange={(elements: readonly any[]) => handleChange(elements)}
      />
    </div>
  );
}

// ─── Explicit stop screen share (fixes stuck share with audio) ───────────────

function StopScreenShareButton() {
  const room = useRoomContext();
  const { isScreenShareEnabled, localParticipant } = useLocalParticipant();
  const [stopping, setStopping] = useState(false);

  if (!isScreenShareEnabled) return null;

  const stopShare = async () => {
    if (stopping) return;
    setStopping(true);
    try {
      await localParticipant.setScreenShareEnabled(false);
      // Force-unpublish leftover screen tracks (known LiveKit issue with share+audio)
      const pubs = Array.from(localParticipant.trackPublications.values());
      for (const pub of pubs) {
        if (
          pub.track &&
          (pub.source === Track.Source.ScreenShare ||
            pub.source === Track.Source.ScreenShareAudio)
        ) {
          await localParticipant.unpublishTrack(pub.track);
        }
      }
      // Also stop browser MediaStreamTracks if still live
      for (const pub of pubs) {
        pub.track?.mediaStreamTrack?.stop();
      }
    } catch (err) {
      console.error('Failed to stop screen share', err);
      try {
        await room.localParticipant.setScreenShareEnabled(false);
      } catch {
        /* ignore */
      }
    } finally {
      setStopping(false);
    }
  };

  return (
    <button
      type="button"
      onClick={stopShare}
      disabled={stopping}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-60 transition-colors"
      title="Отключить демонстрацию экрана"
    >
      {stopping ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <MonitorOff className="h-3.5 w-3.5" />
      )}
      <span className="hidden sm:inline">Отключить демонстрацию</span>
    </button>
  );
}

// ─── View mode toggle ────────────────────────────────────────────────────────

type ViewMode = 'video' | 'split' | 'board';

const VIEW_MODES: { mode: ViewMode; Icon: typeof Video; label: string }[] = [
  { mode: 'video', Icon: Video, label: 'Видео' },
  { mode: 'split', Icon: LayoutPanelLeft, label: 'Видео + Доска' },
  { mode: 'board', Icon: PenLine, label: 'Доска' },
];

// ─── Main exported component ─────────────────────────────────────────────────

interface LessonRoomProps {
  token: string;
  livekitUrl: string;
  backHref: string;
  title: string;
}

export function LessonRoom({ token, livekitUrl, backHref, title }: LessonRoomProps) {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>('split');

  return (
    <div
      className="flex flex-col"
      style={
        {
          height: 'calc(100vh - 56px)',
          ['--lesson-dock-w']: '280px',
        } as CSSProperties
      }
    >
      <LiveKitRoom
        serverUrl={livekitUrl}
        token={token}
        connect
        video
        audio
        // Avoid screen-share+audio unpublish bug; can re-enable later if needed
        screen={{ audio: false }}
        data-lk-theme="default"
        onDisconnected={() => router.push(backHref)}
        style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      >
        {/* Header bar */}
        <div className="flex items-center gap-3 px-4 h-11 shrink-0 border-b border-[rgb(var(--border))] bg-[rgb(var(--surface))]">
          <button
            type="button"
            onClick={() => router.push(backHref)}
            className="flex items-center gap-1.5 text-sm text-[rgb(var(--text-2))] hover:text-[rgb(var(--text))] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Назад
          </button>
          <span className="text-sm font-medium text-[rgb(var(--text))] flex-1 truncate">{title}</span>

          <StopScreenShareButton />

          <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-[rgb(var(--surface-2))] border border-[rgb(var(--border))]">
            {VIEW_MODES.map(({ mode, Icon, label }) => (
              <button
                key={mode}
                type="button"
                title={label}
                onClick={() => setViewMode(mode)}
                className={[
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all',
                  viewMode === mode
                    ? 'bg-[rgb(var(--surface))] text-[rgb(var(--text))] shadow-sm'
                    : 'text-[rgb(var(--text-3))] hover:text-[rgb(var(--text-2))]',
                ].join(' ')}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
        </div>

        <RoomAudioRenderer />

        <div className="relative flex-1 min-h-0 overflow-hidden bg-[rgb(var(--bg))]">
          {/* Board: full stage in split/board modes */}
          <div
            className="absolute inset-0"
            style={{
              display: viewMode === 'video' ? 'none' : 'block',
              // Leave room for the video dock in split mode
              right: viewMode === 'split' ? 'var(--lesson-dock-w, 300px)' : 0,
            }}
          >
            <WhiteboardPanel />
          </div>

          {/* Video: full screen, or narrow dock on the right in split */}
          <div
            className={[
              'min-h-0 overflow-hidden transition-[width,right,top,bottom,border-radius] duration-300 ease-out',
              viewMode === 'video'
                ? 'absolute inset-0'
                : viewMode === 'split'
                  ? 'absolute top-0 right-0 bottom-0 border-l border-[rgb(var(--border))] bg-[#111]'
                  : 'absolute pointer-events-none opacity-0',
            ].join(' ')}
            style={{
              width: viewMode === 'video' ? '100%' : viewMode === 'split' ? 'var(--lesson-dock-w, 300px)' : 0,
              visibility: viewMode === 'board' ? 'hidden' : 'visible',
              // Keep mounted for tracks when board-only
              zIndex: viewMode === 'board' ? -1 : 2,
            }}
            data-lk-theme="default"
          >
            <div
              className={[
                'h-full w-full min-h-0',
                viewMode === 'split' ? 'lesson-video-dock' : '',
              ].join(' ')}
            >
              <VideoConference />
            </div>
          </div>
        </div>
      </LiveKitRoom>
    </div>
  );
}
