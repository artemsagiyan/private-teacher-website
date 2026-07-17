'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
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
import { ArrowLeft, Loader2, Video, PenLine, LayoutPanelLeft, MonitorOff, PictureInPicture2, PanelRight, Maximize2, Minimize2 } from 'lucide-react';

const DOCK_DEFAULT = 280;
const DOCK_MIN = 180;
const DOCK_MAX_RATIO = 0.75; // video can take up to 75% of the stage
const DOCK_COMPACT = 240;
const PIP_W = 300;
const PIP_H = 220;

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
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipRef = useRef(false);
  const enc = useRef(new TextEncoder());
  const dec = useRef(new TextDecoder());
  const panRef = useRef<{
    active: boolean;
    lastX: number;
    lastY: number;
    moved: boolean;
  } | null>(null);

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

  // Right-mouse drag to pan (Excalidraw has no built-in RMB pan)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 2) return;
      if (!apiRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      panRef.current = {
        active: true,
        lastX: e.clientX,
        lastY: e.clientY,
        moved: false,
      };
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      apiRef.current.setCursor?.('grabbing');
    };

    const onPointerMove = (e: PointerEvent) => {
      const pan = panRef.current;
      if (!pan?.active || !apiRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      const dx = e.clientX - pan.lastX;
      const dy = e.clientY - pan.lastY;
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) pan.moved = true;
      pan.lastX = e.clientX;
      pan.lastY = e.clientY;

      const appState = apiRef.current.getAppState();
      const zoom = appState.zoom?.value ?? 1;
      apiRef.current.updateScene({
        appState: {
          scrollX: appState.scrollX + dx / zoom,
          scrollY: appState.scrollY + dy / zoom,
        },
        captureUpdate: 'NEVER',
      });
    };

    const endPan = (e: PointerEvent) => {
      if (!panRef.current?.active) return;
      panRef.current.active = false;
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      apiRef.current?.resetCursor?.();
    };

    const onContextMenu = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const refreshBoard = () => {
      // Excalidraw needs a refresh after container size changes (e.g. fullscreen)
      requestAnimationFrame(() => apiRef.current?.refresh?.());
    };

    el.addEventListener('pointerdown', onPointerDown, true);
    el.addEventListener('pointermove', onPointerMove, true);
    el.addEventListener('pointerup', endPan, true);
    el.addEventListener('pointercancel', endPan, true);
    el.addEventListener('contextmenu', onContextMenu, true);
    document.addEventListener('fullscreenchange', refreshBoard);
    window.addEventListener('resize', refreshBoard);

    return () => {
      el.removeEventListener('pointerdown', onPointerDown, true);
      el.removeEventListener('pointermove', onPointerMove, true);
      el.removeEventListener('pointerup', endPan, true);
      el.removeEventListener('pointercancel', endPan, true);
      el.removeEventListener('contextmenu', onContextMenu, true);
      document.removeEventListener('fullscreenchange', refreshBoard);
      window.removeEventListener('resize', refreshBoard);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative"
      style={{ background: 'var(--color-surface)', cursor: panRef.current?.active ? 'grabbing' : undefined }}
    >
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
  const [dockWidth, setDockWidth] = useState(DOCK_DEFAULT);
  const [dragging, setDragging] = useState(false);
  const [pip, setPip] = useState(false);
  const [pipPos, setPipPos] = useState({ x: 24, y: 24 });
  const [pipDragging, setPipDragging] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const dockWidthRef = useRef(dockWidth);
  const pipDragOffset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    dockWidthRef.current = dockWidth;
  }, [dockWidth]);

  const clampDockWidth = useCallback((width: number) => {
    const stage = stageRef.current;
    const stageW = stage?.getBoundingClientRect().width ?? 1200;
    const max = Math.max(DOCK_MIN, Math.floor(stageW * DOCK_MAX_RATIO));
    return Math.min(max, Math.max(DOCK_MIN, width));
  }, []);

  const clampPipPos = useCallback((x: number, y: number) => {
    const stage = stageRef.current;
    if (!stage) return { x, y };
    const rect = stage.getBoundingClientRect();
    const maxX = Math.max(8, rect.width - PIP_W - 8);
    const maxY = Math.max(8, rect.height - PIP_H - 8);
    return {
      x: Math.min(maxX, Math.max(8, x)),
      y: Math.min(maxY, Math.max(8, y)),
    };
  }, []);

  const openPip = useCallback(() => {
    const stage = stageRef.current;
    if (stage) {
      const rect = stage.getBoundingClientRect();
      setPipPos(clampPipPos(rect.width - PIP_W - 20, rect.height - PIP_H - 20));
    }
    setPip(true);
  }, [clampPipPos]);

  const closePip = useCallback(() => {
    setPip(false);
    setDockWidth((w) => (w < DOCK_DEFAULT ? DOCK_DEFAULT : w));
    if (viewMode === 'board') setViewMode('split');
  }, [viewMode]);

  const toggleFullscreen = useCallback(async () => {
    const root = rootRef.current;
    if (!root) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        if (viewMode === 'video') setViewMode('board');
        await root.requestFullscreen();
      }
    } catch (err) {
      console.error('Fullscreen failed', err);
    }
  }, [viewMode]);

  useEffect(() => {
    const onFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  const setMode = useCallback(
    (mode: ViewMode) => {
      setViewMode(mode);
      if (mode === 'video') setPip(false);
      if (mode === 'board' && !pip) {
        /* board-only: video hidden; keep pip off unless already floating */
      }
    },
    [pip],
  );

  const onResizeStart = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const onPipDragStart = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    pipDragOffset.current = {
      x: e.clientX - pipPos.x,
      y: e.clientY - pipPos.y,
    };
    setPipDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, [pipPos.x, pipPos.y]);

  useEffect(() => {
    if (!dragging) return;

    const onMove = (e: PointerEvent) => {
      const stage = stageRef.current;
      if (!stage) return;
      const rect = stage.getBoundingClientRect();
      const next = Math.round(rect.right - e.clientX);
      setDockWidth(clampDockWidth(next));
    };

    const onUp = () => {
      setDragging(false);
      // Dragged to the minimum → detach into a floating mini window
      if (dockWidthRef.current <= DOCK_MIN + 2) {
        openPip();
      }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [dragging, openPip, clampDockWidth]);

  useEffect(() => {
    if (!pipDragging) return;

    const onMove = (e: PointerEvent) => {
      setPipPos(
        clampPipPos(
          e.clientX - pipDragOffset.current.x,
          e.clientY - pipDragOffset.current.y,
        ),
      );
    };
    const onUp = () => setPipDragging(false);

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [pipDragging, clampPipPos]);

  useEffect(() => {
    const active = dragging || pipDragging;
    document.body.style.cursor = dragging ? 'col-resize' : pipDragging ? 'grabbing' : '';
    document.body.style.userSelect = active ? 'none' : '';
    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [dragging, pipDragging]);

  const showDock = viewMode === 'split' && !pip;
  const showPip = pip && viewMode !== 'video';
  const videoHidden = viewMode === 'board' && !pip;

  return (
    <div
      ref={rootRef}
      className="lesson-room flex flex-col"
      style={
        {
          height: isFullscreen ? '100%' : 'calc(100vh - 56px)',
          ['--lesson-dock-w']: `${dockWidth}px`,
        } as CSSProperties
      }
    >
      <LiveKitRoom
        serverUrl={livekitUrl}
        token={token}
        connect
        video
        audio
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

          <button
            type="button"
            onClick={toggleFullscreen}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-[rgb(var(--text-2))] hover:text-[rgb(var(--text))] hover:bg-[rgb(var(--surface-2))] transition-colors"
            title={isFullscreen ? 'Свернуть (Esc)' : 'Развернуть доску на весь экран'}
          >
            {isFullscreen ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">
              {isFullscreen ? 'Свернуть' : 'На весь экран'}
            </span>
          </button>

          {viewMode === 'split' && !pip && (
            <button
              type="button"
              onClick={openPip}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-[rgb(var(--text-2))] hover:text-[rgb(var(--text))] hover:bg-[rgb(var(--surface-2))] transition-colors"
              title="Открепить видео в мини-окно"
            >
              <PictureInPicture2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Мини-окно</span>
            </button>
          )}

          {pip && viewMode !== 'video' && (
            <button
              type="button"
              onClick={closePip}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-[rgb(var(--text-2))] hover:text-[rgb(var(--text))] hover:bg-[rgb(var(--surface-2))] transition-colors"
              title="Вернуть видео в панель"
            >
              <PanelRight className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">В панель</span>
            </button>
          )}

          <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-[rgb(var(--surface-2))] border border-[rgb(var(--border))]">
            {VIEW_MODES.map(({ mode, Icon, label }) => (
              <button
                key={mode}
                type="button"
                title={label}
                onClick={() => setMode(mode)}
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

        <div
          ref={stageRef}
          className="lesson-stage relative flex-1 min-h-0 overflow-hidden bg-[rgb(var(--bg))]"
        >
          {/* Board */}
          <div
            className="absolute inset-0"
            style={{
              display: viewMode === 'video' ? 'none' : 'block',
              right: showDock ? dockWidth : 0,
            }}
          >
            <WhiteboardPanel />
          </div>

          {/* Resize handle */}
          {showDock && (
            <div
              role="separator"
              aria-orientation="vertical"
              aria-valuenow={dockWidth}
              aria-valuemin={DOCK_MIN}
              aria-valuemax={Math.round(
                (stageRef.current?.getBoundingClientRect().width ?? 1200) * DOCK_MAX_RATIO,
              )}
              onPointerDown={onResizeStart}
              className={[
                'absolute top-0 bottom-0 z-30 w-1.5 -ml-0.5 cursor-col-resize touch-none',
                'bg-transparent hover:bg-[rgb(var(--primary))]/40',
                dragging ? 'bg-[rgb(var(--primary))]/50' : '',
              ].join(' ')}
              style={{ right: dockWidth }}
              title="Потяните, чтобы изменить размер"
            >
              <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-[rgb(var(--border))]" />
            </div>
          )}

          {/* Video panel: full / dock / pip / hidden */}
          <div
            className={[
              'min-h-0 overflow-hidden',
              showPip
                ? 'absolute z-40 rounded-xl border border-white/15 bg-[#111] shadow-2xl shadow-black/40'
                : viewMode === 'video'
                  ? 'absolute inset-0'
                  : showDock
                    ? 'absolute top-0 right-0 bottom-0 border-l border-[rgb(var(--border))] bg-[#111]'
                    : 'absolute pointer-events-none opacity-0',
              !dragging && !showPip && viewMode !== 'split' ? 'transition-[width] duration-300 ease-out' : '',
            ].join(' ')}
            style={
              showPip
                ? {
                    left: pipPos.x,
                    top: pipPos.y,
                    width: PIP_W,
                    height: PIP_H,
                    visibility: 'visible',
                  }
                : {
                    width: viewMode === 'video' ? '100%' : showDock ? dockWidth : 0,
                    visibility: videoHidden ? 'hidden' : 'visible',
                    zIndex: videoHidden ? -1 : 2,
                  }
            }
            data-lk-theme="default"
          >
            {/* PiP drag bar */}
            {showPip && (
              <div
                onPointerDown={onPipDragStart}
                className={[
                  'flex items-center gap-2 h-8 px-2 shrink-0 cursor-grab active:cursor-grabbing touch-none',
                  'bg-[#1a1a1a] border-b border-white/10 select-none',
                ].join(' ')}
              >
                <span className="flex-1 text-[11px] text-white/70 truncate">Видео</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    closePip();
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="text-[11px] text-white/80 hover:text-white px-1.5 py-0.5 rounded hover:bg-white/10"
                  title="Вернуть в панель"
                >
                  В панель
                </button>
              </div>
            )}

            {/* Compact dock: click to float */}
            {showDock && dockWidth <= DOCK_COMPACT && (
              <button
                type="button"
                onClick={openPip}
                className="absolute inset-x-2 top-2 z-20 rounded-md bg-black/70 text-white text-[11px] px-2 py-1.5 hover:bg-black/85 transition-colors"
              >
                Нажмите — мини-окно
              </button>
            )}

            <div
              className={[
                'w-full min-h-0',
                showPip ? 'h-[calc(100%-2rem)] lesson-video-pip' : 'h-full',
                showDock && dockWidth <= DOCK_COMPACT + 40 ? 'lesson-video-dock' : '',
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
