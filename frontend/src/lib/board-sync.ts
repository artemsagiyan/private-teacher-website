/** LiveKit reliable data messages stay under ~15KB. */
export const WB_PAYLOAD_MAX = 12_000;
export const WB_BROADCAST_MS = 50;

export type BoardElement = {
  id: string;
  type?: string;
  version?: number;
  points?: unknown[];
  text?: string;
  isDeleted?: boolean;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  strokeColor?: string;
  backgroundColor?: string;
  strokeWidth?: number;
  opacity?: number;
};

export function elementSyncKey(element: BoardElement) {
  const points = Array.isArray(element.points) ? element.points.length : 0;
  const text = typeof element.text === 'string' ? element.text.length : 0;
  return [
    element.version || 0,
    points,
    text,
    element.isDeleted ? 1 : 0,
    Math.round(Number(element.x) || 0),
    Math.round(Number(element.y) || 0),
    Math.round(Number(element.width) || 0),
    Math.round(Number(element.height) || 0),
    element.strokeColor || '',
    element.backgroundColor || '',
    element.strokeWidth || 0,
    element.opacity ?? '',
  ].join(':');
}

export function changedElements(
  elements: readonly BoardElement[],
  sent: ReadonlyMap<string, string>,
) {
  return elements.filter((element) => {
    if (!element?.id) return false;
    return sent.get(element.id) !== elementSyncKey(element);
  });
}

export function isNewerElement(incoming: BoardElement, current?: BoardElement) {
  if (!current) return true;
  const nextVersion = Number(incoming.version || 0);
  const currentVersion = Number(current.version || 0);
  if (nextVersion > currentVersion) return true;
  if (nextVersion < currentVersion) return false;
  if (incoming.type === 'freedraw' || current.type === 'freedraw') {
    return (incoming.points?.length || 0) > (current.points?.length || 0);
  }
  return false;
}

export function boardPayloadBytes(payload: unknown) {
  return new TextEncoder().encode(JSON.stringify(payload)).byteLength;
}

export function fitElementForWire(
  element: BoardElement,
  maxBytes = WB_PAYLOAD_MAX,
) {
  const size = (value: BoardElement) =>
    boardPayloadBytes({ elements: [value], files: [] });
  if (size(element) <= maxBytes) return element;
  if (element.type !== 'freedraw' || !Array.isArray(element.points)) return null;

  let points = element.points.slice();
  let fitted: BoardElement = { ...element, points };
  while (points.length > 8 && size(fitted) > maxBytes) {
    const next = points.filter((_, index) => index % 2 === 0);
    if (next.length === points.length) break;
    points = next;
    fitted = { ...element, points };
  }
  return size(fitted) <= maxBytes ? fitted : null;
}

export function chunkBoardElements(
  elements: readonly BoardElement[],
  maxBytes = WB_PAYLOAD_MAX,
) {
  const chunks: BoardElement[][] = [];
  let batch: BoardElement[] = [];

  const batchBytes = (items: BoardElement[]) =>
    boardPayloadBytes({ elements: items, files: [] });

  for (const element of elements) {
    const fitted = fitElementForWire(element, maxBytes);
    if (!fitted) continue;
    if (!batch.length) {
      batch = [fitted];
      continue;
    }
    if (batchBytes([...batch, fitted]) > maxBytes) {
      chunks.push(batch);
      batch = [fitted];
    } else {
      batch.push(fitted);
    }
  }
  if (batch.length) chunks.push(batch);
  return chunks;
}
