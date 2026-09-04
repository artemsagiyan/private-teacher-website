/** Convert PDF pages to JPEG data URLs for the whiteboard. */

export type PdfPageImage = {
  dataURL: string;
  width: number;
  height: number;
};

const MAX_PAGES = 15;
const RENDER_SCALE = 1.5;
const JPEG_QUALITY = 0.82;

export function isPdfFile(file: File): boolean {
  return (
    file.type === 'application/pdf' ||
    file.name.toLowerCase().endsWith('.pdf')
  );
}

export async function pdfFileToImages(
  file: File,
): Promise<{ pages: PdfPageImage[]; truncated: boolean }> {
  const pdfjs = await import('pdfjs-dist');

  // Bundle the worker locally so PDF import also works without internet.
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();

  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;
  const pageCount = Math.min(pdf.numPages, MAX_PAGES);
  const pages: PdfPageImage[] = [];

  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: RENDER_SCALE });
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;

    await page.render({
      canvas,
      canvasContext: ctx,
      viewport,
    }).promise;

    pages.push({
      dataURL: canvas.toDataURL('image/jpeg', JPEG_QUALITY),
      width: canvas.width,
      height: canvas.height,
    });
  }

  if (!pages.length) {
    throw new Error('Не удалось прочитать страницы PDF');
  }

  return { pages, truncated: pdf.numPages > MAX_PAGES };
}
