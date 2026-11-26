import { toBlob } from 'html-to-image';
import { triggerDownload } from '@/lib/surveys';

// Exportación de informes: imagen (PNG, pensada para WhatsApp) y PDF (impresión
// del navegador, que da texto vectorial y paginación A4 sin dependencias).

/** Captura un nodo del DOM como PNG. Marca `data-capturing` durante la captura
 * para que se vea el pie de marca y se oculten los botones. */
export async function captureNode(node: HTMLElement, opts: { width?: number } = {}): Promise<Blob> {
  node.setAttribute('data-capturing', '');
  try {
    // Espera a que se aplique el atributo (layout) antes de clonar.
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    const width = opts.width ?? node.offsetWidth;
    // ~1080 px de ancho final: lo que WhatsApp no recomprime a papilla.
    const pixelRatio = Math.max(2, Math.min(3, 1080 / Math.max(width, 1)));
    const blob = await toBlob(node, {
      pixelRatio,
      backgroundColor: '#ffffff',
      width,
      style: { margin: '0' },
      filter: (el) => !(el instanceof HTMLElement && el.hasAttribute('data-export-ignore')),
    });
    if (!blob) throw new Error('No se pudo generar la imagen');
    return blob;
  } finally {
    node.removeAttribute('data-capturing');
  }
}

/**
 * En el móvil abre la hoja de compartir del sistema (WhatsApp sale ahí con la
 * imagen ya adjunta); en el ordenador, descarga el PNG.
 */
export async function shareOrDownload(blob: Blob, filename: string, title?: string): Promise<'shared' | 'downloaded'> {
  const file = new File([blob], filename, { type: blob.type || 'image/png' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  const isTouch = window.matchMedia?.('(pointer: coarse)').matches;
  if (isTouch && nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title });
      return 'shared';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'shared';
      // Si falla el share, cae a descarga.
    }
  }
  triggerDownload(blob, filename);
  return 'downloaded';
}

export async function exportNodeAsImage(node: HTMLElement, filename: string, title?: string, width?: number) {
  const blob = await captureNode(node, { width });
  return shareOrDownload(blob, filename, title);
}

/** Copia una imagen al portapapeles (para pegarla en WhatsApp Web). */
export async function copyImage(blob: Blob): Promise<boolean> {
  try {
    if (!('ClipboardItem' in window) || !navigator.clipboard?.write) return false;
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Imprime (→ «Guardar como PDF») solo el contenido de `#report-print-portal`.
 * El título del documento pasa a ser el nombre del PDF por defecto.
 */
export function printReport(docTitle: string) {
  const prevTitle = document.title;
  document.title = docTitle;
  document.body.classList.add('printing-report');
  const done = () => {
    document.body.classList.remove('printing-report');
    document.title = prevTitle;
    window.removeEventListener('afterprint', done);
  };
  window.addEventListener('afterprint', done);
  // Deja pintar el portal antes de abrir el diálogo.
  setTimeout(() => window.print(), 50);
}

export function fileSafe(s: string): string {
  return (
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase()
      .slice(0, 60) || 'informe'
  );
}
