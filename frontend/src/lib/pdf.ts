import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';
// Vite-specific `?url` import: resolves to the built worker script's URL rather than
// inlining it, since pdf.js always renders off the main thread via a Worker.
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

/** `source` is either a `File`/`Blob` (freshly picked, before upload -- used to count pages)
 * or a URL string (a signed Storage download URL -- used by the viewer to render pages). */
export async function loadPdfDocument(source: File | Blob | string): Promise<PDFDocumentProxy> {
  const params = typeof source === 'string' ? { url: source } : { data: await source.arrayBuffer() };
  return getDocument(params).promise;
}

export async function countPdfPages(file: File): Promise<number> {
  const doc = await loadPdfDocument(file);
  const count = doc.numPages;
  await doc.loadingTask.destroy();
  return count;
}
