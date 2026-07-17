'use client';

import { useCallback, useEffect, useRef, useState, type ChangeEvent, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
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
import { toast } from 'sonner';
import { isPdfFile, pdfFileToImages } from '@/lib/pdf-to-images';

const DOCK_DEFAULT = 280;
const DOCK_MIN = 180;
const DOCK_MAX_RATIO = 0.75;
const DOCK_COMPACT = 240;
const PIP_W = 300;
const PIP_H = 220;
const WB_FILE_SYNC_MAX = 350_000;

// ─── Excalidraw: browser-only, no SSR ───────────────────────────────────────
const ExcalidrawComponent = dynamic(
  () =>
    import('@excalidraw/excalidraw').then((m) => {
      function ExcalidrawWithOpen(props: Record<string, any>) {
        const { onRequestOpenFile, ...rest } = props;
        return (
          <m.Excalidraw
            {...rest}
            UIOptions={{
              ...rest.UIOptions,
              canvasActions: {
                ...rest.UIOptions?.canvasActions,
                // Replace built-in loader (rejects PDF) with our handler via menu item
                loadScene: false,
              },
            }}
          >
            <m.MainMenu>
              <m.MainMenu.Item onSelect={() => onRequestOpenFile?.()}>
                Открыть файл
              </m.MainMenu.Item>
              <m.MainMenu.DefaultItems.SaveToActiveFile />
              <m.MainMenu.DefaultItems.Export />
              <m.MainMenu.DefaultItems.SaveAsImage />
              <m.MainMenu.DefaultItems.ClearCanvas />
              <m.MainMenu.DefaultItems.ChangeCanvasBackground />
            </m.MainMenu>
          </m.Excalidraw>
        );
      }
      return { default: ExcalidrawWithOpen };
    }),
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
  const openInputRef = useRef<HTMLInputElement>(null);
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
  const importingRef = useRef(false);

  const { send } = useDataChannel('wb', (msg) => {
    try {
      const payload = JSON.parse(dec.current.decode(msg.payload));
      if (!apiRef.current) return;
      skipRef.current = true;
      if (payload.files?.length) {
        apiRef.current.addFiles(payload.files);
      }
      if (payload.elements) {
        apiRef.current.updateScene({
          elements: payload.elements,
          captureUpdate: 'NEVER',
        });
      }
    } catch {
      /* ignore malformed */
    }
  });

  const broadcast = useCallback(
    (elements: readonly any[], files?: Record<string, any>) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        try {
          const fileList: any[] = [];
          if (files) {
            for (const f of Object.values(files)) {
              const dataURL = (f as any)?.dataURL as string | undefined;
              if (!dataURL || dataURL.length > WB_FILE_SYNC_MAX) continue;
              fileList.push(f);
            }
          }
          send(
            enc.current.encode(
              JSON.stringify({
                elements: [...elements],
                files: fileList,
              }),
            ),
            {},
          );
        } catch {
          /* room not ready / payload too large */
        }
      }, 200);
    },
    [send],
  );

  const handleChange = useCallback(
    (elements: readonly any[], _appState: any, files: Record<string, any>) => {
      if (skipRef.current) {
        skipRef.current = false;
        return;
      }
      broadcast(elements, files);
    },
    [broadcast],
  );

  const insertPdfAsImages = useCallback(
    async (file: File) => {
      const api = apiRef.current;
      if (!api) return;
      const mod = await import('@excalidraw/excalidraw');
      toast.message('Загрузка PDF…');
      const pages = await pdfFileToImages(file);
      const appState = api.getAppState();
      const startX = -appState.scrollX + 40 / appState.zoom.value;
      let y = -appState.scrollY + 40 / appState.zoom.value;
      const gap = 24;
      const maxW = 720;

      const binaryFiles: any[] = [];
      const skeletons: any[] = [];

      for (const page of pages) {
        const scale = Math.min(1, maxW / page.width);
        const w = page.width * scale;
        const h = page.height * scale;
        const fileId = `pdf-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        binaryFiles.push({
          id: fileId,
          dataURL: page.dataURL,
          mimeType: 'image/jpeg',
          created: Date.now(),
          lastRetrieved: Date.now(),
        });
        skeletons.push({
          type: 'image',
          fileId,
          x: startX,
          y,
          width: w,
          height: h,
          status: 'saved',
        });
        y += h + gap;
      }

      api.addFiles(binaryFiles);
      const imageElements = mod.convertToExcalidrawElements(skeletons as any);
      const next = [...api.getSceneElements(), ...imageElements];
      api.updateScene({ elements: next });
      broadcast(next, api.getFiles());
      toast.success(
        pages.length === 1
          ? 'PDF добавлен на доску'
          : `PDF: ${pages.length} стр. добавлено на доску`,
      );
    },
    [broadcast],
  );

  const loadSceneOrImage = useCallback(
    async (file: File) => {
      const api = apiRef.current;
      if (!api) return;
      const mod = await import('@excalidraw/excalidraw');

      if (file.type.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(file.name)) {
        // Try as Excalidraw scene embedded in PNG first
        if (/\.excalidraw\.png$/i.test(file.name) || file.type === 'image/png') {
          try {
            const contents = await mod.loadFromBlob(file, api.getAppState(), api.getSceneElements());
            api.updateScene({
              elements: contents.elements,
              appState: { ...(contents.appState || {}), collaborators: new Map() },
            });
            if (contents.files) api.addFiles(Object.values(contents.files));
            broadcast(contents.elements, contents.files || api.getFiles());
            toast.success('Сцена загружена');
            return;
          } catch {
            /* plain image */
          }
        }

        const fileId = `img-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        const dataURL = await mod.getDataURL(file);
        api.addFiles([
          {
            id: fileId,
            dataURL,
            mimeType: file.type || 'image/png',
            created: Date.now(),
            lastRetrieved: Date.now(),
          },
        ]);
        const dims = await new Promise<{ w: number; h: number }>((resolve) => {
          const img = new Image();
          img.onload = () => resolve({ w: img.naturalWidth || 400, h: img.naturalHeight || 300 });
          img.onerror = () => resolve({ w: 400, h: 300 });
          img.src = dataURL;
        });
        const appState = api.getAppState();
        const maxW = Math.min(dims.w, 640);
        const scale = maxW / dims.w;
        const w = maxW;
        const h = dims.h * scale;
        const x = -appState.scrollX + appState.width / 2 / appState.zoom.value - w / 2;
        const y = -appState.scrollY + appState.height / 2 / appState.zoom.value - h / 2;
        const [el] = mod.convertToExcalidrawElements([
          { type: 'image', fileId, x, y, width: w, height: h, status: 'saved' } as any,
        ]);
        const next = [...api.getSceneElements(), el];
        api.updateScene({ elements: next });
        broadcast(next, api.getFiles());
        toast.success('Изображение добавлено');
        return;
      }

      // .excalidraw / .json scene
      const contents = await mod.loadFromBlob(file, api.getAppState(), api.getSceneElements());
      api.updateScene({
        elements: contents.elements,
        appState: { ...(contents.appState || {}), collaborators: new Map() },
      });
      if (contents.files) api.addFiles(Object.values(contents.files));
      broadcast(contents.elements, contents.files || api.getFiles());
      toast.success('Сцена загружена');
    },
    [broadcast],
  );

  const importFiles = useCallback(
    async (files: File[]) => {
      if (!files.length || importingRef.current) return;
      importingRef.current = true;
      try {
        for (const file of files) {
          if (isPdfFile(file)) {
            await insertPdfAsImages(file);
          } else {
            await loadSceneOrImage(file);
          }
        }
      } catch (err) {
        console.error(err);
        toast.error(err instanceof Error ? err.message : 'Не удалось загрузить файл');
      } finally {
        importingRef.current = false;
      }
    },
    [insertPdfAsImages, loadSceneOrImage],
  );

  const onRequestOpenFile = useCallback(() => {
    openInputRef.current?.click();
  }, []);

  const onOpenInputChange = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const list = Array.from(e.target.files || []);
      e.target.value = '';
      await importFiles(list);
    },
    [importFiles],
  );

  // Intercept native Excalidraw PDF drops / file inputs so it doesn't throw "invalid file"
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onDragOver = (e: DragEvent) => {
      const items = e.dataTransfer?.items;
      if (!items) return;
      const hasPdf = Array.from(items).some(
        (it) => it.kind === 'file' && (it.type === 'application/pdf' || it.type === ''),
      );
      if (!hasPdf) return;
      e.preventDefault();
      e.stopPropagation();
    };

    const onDrop = (e: DragEvent) => {
      const files = Array.from(e.dataTransfer?.files || []);
      const pdfs = files.filter(isPdfFile);
      if (!pdfs.length) return;
      e.preventDefault();
      e.stopPropagation();
      void importFiles(pdfs);
    };

    const onChangeCapture = (e: Event) => {
      const input = e.target as HTMLInputElement;
      if (!(input instanceof HTMLInputElement) || input.type !== 'file') return;
      if (input === openInputRef.current) return;
      const files = Array.from(input.files || []);
      const pdfs = files.filter(isPdfFile);
      if (!pdfs.length) return;
      // Stop Excalidraw from parsing PDF as a scene → "Error: invalid file"
      e.stopImmediatePropagation();
      e.preventDefault();
      input.value = '';
      void importFiles(pdfs);
    };

    el.addEventListener('dragover', onDragOver, true);
    el.addEventListener('drop', onDrop, true);
    el.addEventListener('change', onChangeCapture, true);
    return () => {
      el.removeEventListener('dragover', onDragOver, true);
      el.removeEventListener('drop', onDrop, true);
      el.removeEventListener('change', onChangeCapture, true);
    };
  }, [importFiles]);

  // Second click on the same toolbar tool collapses the left settings panel
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const resolveToolKey = (target: HTMLElement): string | null => {
      const testIdBtn = target.closest('[data-testid^="toolbar-"]') as HTMLElement | null;
      if (testIdBtn && el.contains(testIdBtn)) {
        const id = (testIdBtn.getAttribute('data-testid') || '').replace(/^toolbar-/i, '').toLowerCase();
        if (id === 'laserpointer') return 'laser';
        if (id && !['container', 'content', 'lock'].includes(id)) return id;
      }

      const label = target.closest('label.ToolIcon') as HTMLLabelElement | null;
      if (label && el.contains(label)) {
        const input = label.querySelector('input') as HTMLInputElement | null;
        const value = input?.value?.toLowerCase();
        if (value) return value;
      }

      return null;
    };

    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target || !el.contains(target)) return;
      if (!target.closest('.App-toolbar, .App-toolbar-container')) return;

      const toolKey = resolveToolKey(target);
      if (!toolKey) return;

      const api = apiRef.current;
      if (!api) return;

      const activeBefore = String(api.getAppState().activeTool?.type || '').toLowerCase();
      const handOnBefore = !!el.querySelector('[data-testid="toolbar-hand"] input:checked');
      const wasActive =
        activeBefore === toolKey ||
        (toolKey === 'hand' && (activeBefore === 'hand' || handOnBefore));

      if (wasActive) {
        el.classList.toggle('wb-panel-collapsed');
        if (el.classList.contains('wb-panel-collapsed')) {
          api.updateScene({
            appState: { openMenu: null },
            captureUpdate: 'NEVER',
          });
        }
      } else {
        el.classList.remove('wb-panel-collapsed');
      }
    };

    el.addEventListener('click', onClick, true);
    return () => el.removeEventListener('click', onClick, true);
  }, []);

  // Wheel zoom without Ctrl + RMB pan without context menu popup
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const isUiTarget = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return true;
      return !!target.closest(
        'input, textarea, button, a, label, select, .App-menu, .App-toolbar, .context-menu, .Stack, [class*="dropdown"], [class*="Dialog"], [class*="Island"]',
      );
    };

    const onWheel = (e: WheelEvent) => {
      if (!el.contains(e.target as Node)) return;
      if (isUiTarget(e.target)) return;
      if (e.ctrlKey || e.metaKey) return;

      e.preventDefault();
      e.stopPropagation();

      const zoomEvent = new WheelEvent('wheel', {
        deltaX: e.deltaX,
        deltaY: e.deltaY,
        deltaZ: e.deltaZ,
        deltaMode: e.deltaMode,
        clientX: e.clientX,
        clientY: e.clientY,
        screenX: e.screenX,
        screenY: e.screenY,
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
        view: window,
      });
      (e.target as EventTarget).dispatchEvent(zoomEvent);
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 2) return;
      if (!el.contains(e.target as Node)) return;
      if (isUiTarget(e.target)) return;
      if (!apiRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      panRef.current = { active: true, lastX: e.clientX, lastY: e.clientY, moved: false };
      apiRef.current.setCursor?.('grabbing');
      el.querySelectorAll('.context-menu').forEach((node) => node.remove());
    };

    const onPointerMove = (e: PointerEvent) => {
      const pan = panRef.current;
      if (!pan?.active || !apiRef.current) return;
      const dx = e.clientX - pan.lastX;
      const dy = e.clientY - pan.lastY;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) pan.moved = true;
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

    const endPan = () => {
      if (!panRef.current?.active) return;
      panRef.current.active = false;
      apiRef.current?.resetCursor?.();
      requestAnimationFrame(() => {
        el.querySelectorAll('.context-menu').forEach((node) => node.remove());
        document.querySelectorAll('.excalidraw .context-menu').forEach((node) => node.remove());
      });
    };

    const onContextMenu = (e: Event) => {
      if (!el.contains(e.target as Node)) return;
      if (isUiTarget(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
    };

    const refreshBoard = () => {
      requestAnimationFrame(() => apiRef.current?.refresh?.());
    };

    el.addEventListener('wheel', onWheel, { capture: true, passive: false });
    el.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', endPan);
    window.addEventListener('pointercancel', endPan);
    el.addEventListener('contextmenu', onContextMenu, true);
    document.addEventListener('fullscreenchange', refreshBoard);
    window.addEventListener('resize', refreshBoard);

    return () => {
      el.removeEventListener('wheel', onWheel, true);
      el.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', endPan);
      window.removeEventListener('pointercancel', endPan);
      el.removeEventListener('contextmenu', onContextMenu, true);
      document.removeEventListener('fullscreenchange', refreshBoard);
      window.removeEventListener('resize', refreshBoard);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative lesson-whiteboard"
      style={{ background: 'var(--color-surface)' }}
    >
      <input
        ref={openInputRef}
        type="file"
        className="hidden"
        accept="application/pdf,.pdf,image/*,.excalidraw,.json,.excalidrawlib"
        onChange={onOpenInputChange}
      />
      <ExcalidrawComponent
        langCode="ru-RU"
        excalidrawAPI={(api: any) => {
          apiRef.current = api;
        }}
        onChange={handleChange}
        onRequestOpenFile={onRequestOpenFile}
        UIOptions={{
          canvasActions: {
            export: { saveFileToDisk: true },
          },
          tools: { image: true },
        }}
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
