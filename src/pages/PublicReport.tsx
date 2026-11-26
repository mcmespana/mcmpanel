import { useEffect, useMemo, useRef, useState } from 'react';
import { onValue, ref } from 'firebase/database';
import { Share2, ImageDown, FileDown, Star, Loader2, Trash2, Check, BarChart3 } from 'lucide-react';
import { getDB } from '@/lib/firebase';
import { REPORTS_NODE } from '@/lib/reportShares';
import { normalizeReport, type ReportHighlight, type SurveyReport } from '@/lib/surveyReport';
import { publicFavoritesKey, useFavorites } from '@/lib/favorites';
import { captureNode, exportNodeAsImage, fileSafe, printReport, shareOrDownload } from '@/lib/reportExport';
import { ReportView, CommentBlock } from '@/components/report/ReportView';
import { ReportSummaryCard } from '@/components/report/ReportSummaryCard';
import { Offscreen, PrintPortal } from '@/components/report/PrintPortal';
import { cn } from '@/lib/utils';

// ─────────────────────────────────────────────────────────────────────────────
// /informe/<slug> — página PÚBLICA (sin login) con el informe de una encuesta.
// Lee solo `surveyReports/<slug>/data`, que es un resumen ya agregado: nunca
// las respuestas en bruto. Mobile first: se abre desde un enlace de WhatsApp.
// Los favoritos de quien la lee se guardan en su navegador y le dan «Mi resumen».
// ─────────────────────────────────────────────────────────────────────────────

type LoadState = { status: 'loading' } | { status: 'missing' } | { status: 'error'; message: string } | { status: 'ok'; report: SurveyReport };

export default function PublicReport({ slug }: { slug: string }) {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [tab, setTab] = useState<'report' | 'mine'>('report');
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const favs = useFavorites(publicFavoritesKey(slug));
  const summaryRef = useRef<HTMLDivElement>(null);
  const mineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.body.style.background = 'hsl(var(--report-bg))';
    const meta = document.querySelector('meta[name="theme-color"]') ?? document.head.appendChild(Object.assign(document.createElement('meta'), { name: 'theme-color' }));
    meta.setAttribute('content', '#253883');
    let unsub: (() => void) | undefined;
    try {
      unsub = onValue(
        ref(getDB(), `${REPORTS_NODE}/${slug}/data`),
        (snap) => {
          const report = normalizeReport(snap.val());
          setState(report ? { status: 'ok', report } : { status: 'missing' });
        },
        (err) => setState({ status: 'error', message: err.message }),
      );
    } catch (e) {
      setState({ status: 'error', message: e instanceof Error ? e.message : String(e) });
    }
    return () => unsub?.();
  }, [slug]);

  useEffect(() => {
    if (state.status === 'ok') document.title = `${state.report.title} · Informe MCM`;
  }, [state]);

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2600);
  };

  const report = state.status === 'ok' ? state.report : null;

  /** Comentarios favoritos de quien lee, con la pregunta a la que responden. */
  const myComments = useMemo<ReportHighlight[]>(() => {
    if (!report) return [];
    const byId = new Map<string, ReportHighlight>();
    for (const q of report.questions) {
      if (q.agg.kind !== 'text') continue;
      for (const c of q.agg.comments) byId.set(c.id, { ...c, questionLabel: q.label });
    }
    for (const h of report.highlights) if (!byId.has(h.id)) byId.set(h.id, h);
    return favs.ids.map((id) => byId.get(id)).filter((x): x is ReportHighlight => !!x);
  }, [report, favs.ids]);

  if (state.status !== 'ok' || !report) {
    return (
      <div className="report-surface flex min-h-screen items-center justify-center bg-report-bg p-6 text-center">
        {state.status === 'loading' ? (
          <Loader2 className="h-8 w-8 animate-spin text-report-brand" aria-label="Cargando" />
        ) : (
          <div className="max-w-sm space-y-2">
            <BarChart3 className="mx-auto h-10 w-10 text-report-muted" />
            <h1 className="text-[20px] font-bold text-report-brand">
              {state.status === 'missing' ? 'Este informe ya no está disponible' : 'No se ha podido abrir el informe'}
            </h1>
            <p className="text-[15px] text-report-muted">
              {state.status === 'missing'
                ? 'Puede que el enlace esté mal copiado o que lo hayan retirado. Pide uno nuevo a quien te lo mandó.'
                : 'Revisa tu conexión y vuelve a intentarlo.'}
            </p>
          </div>
        )}
      </div>
    );
  }

  const base = fileSafe(report.title);

  const shareLink = async () => {
    const url = window.location.href;
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
    if (nav.share && window.matchMedia?.('(pointer: coarse)').matches) {
      try {
        await nav.share({ title: report.title, text: `Informe: ${report.title}`, url });
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      flash('Enlace copiado');
    } catch {
      flash(url);
    }
  };

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    try {
      const res = await fn();
      if (res === 'downloaded') flash('Imagen descargada');
    } catch {
      flash('No se ha podido generar la imagen');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="report-surface min-h-screen bg-report-bg pb-24">
      <div className="mx-auto flex max-w-2xl gap-1 px-4 pt-3" role="tablist" data-export-ignore>
        <TabButton active={tab === 'report'} onClick={() => setTab('report')}>
          Informe
        </TabButton>
        <TabButton active={tab === 'mine'} onClick={() => setTab('mine')}>
          Mi resumen{favs.ids.length > 0 && <span className="ml-1.5 rounded-full bg-report-brand px-1.5 text-[11px] text-white">{favs.ids.length}</span>}
        </TabButton>
      </div>

      {tab === 'report' ? (
        <div className="pt-3">
          <ReportView
            report={report}
            stickyNav
            favoriteIds={favs.ids}
            onToggleFavorite={(c) => {
              const adding = !favs.has(c.id);
              favs.toggle(c.id);
              if (adding) flash('Guardado en «Mi resumen»');
            }}
            onExportCard={async (node, q) => {
              await run(`q:${q.id}`, () => exportNodeAsImage(node, `${base}-${fileSafe(q.label).slice(0, 30)}.png`, report.title));
            }}
          />
        </div>
      ) : (
        <div className="mx-auto max-w-2xl space-y-4 px-4 pt-4">
          <div className="rounded-2xl bg-report-card p-4 shadow-sm">
            <h1 className="text-[20px] font-bold text-report-brand">Mi resumen</h1>
            <p className="mt-1 text-[14px] text-report-muted">
              Toca la <Star className="inline h-3.5 w-3.5 -translate-y-0.5" /> de los comentarios que quieras guardar. Se quedan en este móvil, nadie
              más los ve, y puedes mandarlos como imagen.
            </p>
          </div>
          {myComments.length === 0 ? (
            <p className="py-8 text-center text-[15px] text-report-muted">Todavía no has guardado ningún comentario.</p>
          ) : (
            <>
              <ul className="space-y-3 rounded-2xl bg-report-card p-4 shadow-sm">
                {myComments.map((c) => (
                  <li key={c.id} className="flex items-start gap-1">
                    <div className="min-w-0 flex-1">
                      <CommentBlock comment={c} accent={report.accent} context={c.questionLabel} />
                    </div>
                    <button
                      type="button"
                      onClick={() => favs.toggle(c.id)}
                      aria-label="Quitar de mi resumen"
                      className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-report-brand hover:bg-report-sunken"
                    >
                      <Star className="h-5 w-5" fill="currentColor" />
                    </button>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy === 'mine'}
                  onClick={() => run('mine', async () => mineRef.current && shareOrDownload(await captureNode(mineRef.current), `${base}-mi-resumen.png`, report.title))}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-report-brand py-3 text-[15px] font-semibold text-white disabled:opacity-60"
                >
                  {busy === 'mine' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageDown className="h-4 w-4" />} Imagen de mi resumen
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('¿Quitar todos los comentarios de «Mi resumen»?')) favs.clear();
                  }}
                  aria-label="Vaciar mi resumen"
                  className="flex w-12 items-center justify-center rounded-xl border bg-report-card text-report-muted"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Barra de acciones abajo: donde llega el pulgar. */}
      <div data-export-ignore className="fixed inset-x-0 bottom-0 z-20 border-t bg-report-card/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <div className="mx-auto grid max-w-2xl grid-cols-3 gap-2">
          <ActionButton onClick={shareLink} icon={<Share2 className="h-5 w-5" />} label="Compartir" />
          <ActionButton
            busy={busy === 'summary'}
            onClick={() => run('summary', async () => summaryRef.current && shareOrDownload(await captureNode(summaryRef.current), `${base}-resumen.png`, report.title))}
            icon={<ImageDown className="h-5 w-5" />}
            label="Imagen"
          />
          <ActionButton onClick={() => printReport(base)} icon={<FileDown className="h-5 w-5" />} label="PDF" />
        </div>
      </div>

      {toast && (
        <div role="status" className="fixed inset-x-0 top-4 z-30 flex justify-center px-4">
          <span className="flex items-center gap-2 rounded-full bg-report-text px-4 py-2 text-[14px] text-white shadow-lg">
            <Check className="h-4 w-4" /> {toast}
          </span>
        </div>
      )}

      <Offscreen>
        <ReportSummaryCard ref={summaryRef} report={report} />
        <ReportSummaryCard ref={mineRef} report={report} comments={myComments} heading="Mi resumen" maxStats={4} />
      </Offscreen>
      <PrintPortal>
        <ReportView report={report} expandAll />
      </PrintPortal>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'flex min-h-[44px] flex-1 items-center justify-center rounded-xl text-[15px] font-semibold transition-colors',
        active ? 'bg-report-card text-report-brand shadow-sm' : 'text-report-muted',
      )}
    >
      {children}
    </button>
  );
}

function ActionButton({ onClick, icon, label, busy }: { onClick: () => void; icon: React.ReactNode; label: string; busy?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-xl text-[12px] font-medium text-report-brand hover:bg-report-sunken disabled:opacity-60"
    >
      {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : icon}
      {label}
    </button>
  );
}
