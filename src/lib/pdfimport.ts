// PDF import (web + iOS app): every page is rendered to an image (for the card photo, the PDF export and OCR), and if
// the page has a real text layer (a PDF made by a computer, not a scan) that text is used directly instead of OCR.
// pdf.js (legacy build, for older iOS Safari) is only loaded when a PDF is opened; its worker is a same-origin file
// precached for offline use. Everything stays on the device.
import { canvasToBlob } from './image';

export const MAX_PDF_PAGES = 10;
export interface PdfPage { image: Blob; text: string | null; width: number; height: number }

export const isPdf = (f: { type?: string; name?: string }) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name ?? '');

/** Text layer of a page, line by line. Only trusted when it has enough letters (scanned PDFs have none). */
export function textFromItems(items: { str?: string; hasEOL?: boolean }[]): string {
  let out = '';
  for (const it of items) { if (typeof it.str !== 'string') continue; out += it.str + (it.hasEOL ? '\n' : (it.str && !it.str.endsWith(' ') ? ' ' : '')); }
  return out.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
export const usableText = (t: string) => (t.match(/\p{L}/gu) ?? []).length >= 40;

export async function pdfToPages(file: Blob, onPage?: (i: number, n: number) => void): Promise<{ pages: PdfPage[]; total: number }> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const workerUrl = (await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), useSystemFonts: true, isImageDecoderSupported: false, isOffscreenCanvasSupported: false });
  const doc = await task.promise;
  const total = doc.numPages;
  const n = Math.min(total, MAX_PDF_PAGES);
  const pages: PdfPage[] = [];
  for (let i = 1; i <= n; i++) {
    onPage?.(i, n);
    const page = await doc.getPage(i);
    const base = page.getViewport({ scale: 1 });
    // ~2000 px on the long side: enough for OCR, small enough for phones
    const scale = Math.min(3, 2000 / Math.max(base.width, base.height));
    const vp = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(vp.width); canvas.height = Math.ceil(vp.height);
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: ctx, viewport: vp }).promise;
    let text: string | null = null;
    try { const tc = await page.getTextContent(); const t = textFromItems(tc.items as { str?: string; hasEOL?: boolean }[]); text = usableText(t) ? t : null; } catch { text = null; }
    pages.push({ image: await canvasToBlob(canvas, 'image/jpeg', 0.85), text, width: canvas.width, height: canvas.height });
    page.cleanup();
  }
  await task.destroy();
  return { pages, total };
}
