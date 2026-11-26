import { forwardRef, useRef, useState } from 'react';
import { Star, ImageDown, Loader2, Quote, Users, CalendarDays, Filter, GitBranch, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  formatLongDate,
  formatMean,
  groupBySection,
  type ReportAgg,
  type ReportComment,
  type ReportCount,
  type ReportQuestion,
  type SurveyReport,
} from '@/lib/surveyReport';
import { SURVEY_CLASS_LABELS } from '@/lib/surveys';

// ─────────────────────────────────────────────────────────────────────────────
// Un único pintor de informes para: la página pública (/informe/<slug>), la
// vista previa del panel, el PDF (impresión) y las imágenes para WhatsApp.
// Mobile first, claro, con la marca de MCM (tokens `report-*`). El acento de la
// encuesta solo se usa como RELLENO (barras, bandas): como texto sobre blanco
// no da contraste (design.md de la app §3).
// ─────────────────────────────────────────────────────────────────────────────

export interface ReportViewProps {
  report: SurveyReport;
  /** Comentarios marcados como favoritos (estrella rellena). */
  favoriteIds?: string[];
  onToggleFavorite?: (c: ReportComment, q: ReportQuestion) => void;
  /** Muestra el botón de «imagen» en cada tarjeta. */
  onExportCard?: (node: HTMLElement, q: ReportQuestion) => Promise<void>;
  /** Todos los comentarios desplegados (impresión). */
  expandAll?: boolean;
  /** Navegación por secciones fija arriba (web). */
  stickyNav?: boolean;
  className?: string;
}

const COMMENTS_PREVIEW = 5;

export const ReportView = forwardRef<HTMLDivElement, ReportViewProps>(function ReportView(
  { report, favoriteIds, onToggleFavorite, onExportCard, expandAll, stickyNav, className },
  ref,
) {
  const groups = groupBySection(report.questions);
  const sections = groups.filter((g) => g.section);
  const favs = new Set(favoriteIds ?? []);

  return (
    <div ref={ref} className={cn('report-surface bg-report-bg', className)}>
      <ReportHeader report={report} />

      <div className="mx-auto w-full max-w-2xl space-y-4 px-4 pb-10 pt-4">
        {report.note && (
          <div className="report-card rounded-2xl bg-report-card p-4 text-[15px] leading-relaxed shadow-sm">
            <p className="whitespace-pre-line">{report.note}</p>
          </div>
        )}

        {report.breakdown && <Breakdown report={report} />}

        {report.highlights.length > 0 && (
          <section className="report-card rounded-2xl bg-report-card p-4 shadow-sm">
            <h2 className="mb-3 flex items-center gap-2 text-[17px] font-bold text-report-brand">
              <Star className="h-5 w-5" fill="currentColor" /> Lo más destacado
            </h2>
            <ul className="space-y-3">
              {report.highlights.map((h) => (
                <li key={h.id}>
                  <CommentBlock comment={h} accent={report.accent} context={h.questionLabel} />
                </li>
              ))}
            </ul>
          </section>
        )}

        {sections.length > 1 && (
          <nav
            data-export-ignore
            className={cn(
              '-mx-4 flex gap-2 overflow-x-auto px-4 py-2',
              stickyNav && 'sticky top-0 z-10 bg-report-bg/95 backdrop-blur',
            )}
            aria-label="Secciones del informe"
          >
            {groups.map((g, i) =>
              g.section ? (
                <a
                  key={`${g.section}-${i}`}
                  href={`#sec-${i}`}
                  className="whitespace-nowrap rounded-full border bg-report-card px-3 py-1.5 text-[13px] font-medium text-report-brand"
                >
                  {g.section}
                </a>
              ) : null,
            )}
          </nav>
        )}

        {groups.map((g, i) => (
          <section key={`${g.section ?? 'general'}-${i}`} id={`sec-${i}`} className="scroll-mt-14 space-y-3">
            {g.section && (
              <h2 className="report-section-title px-1 pt-3 text-[13px] font-semibold uppercase tracking-wide text-report-muted">
                {g.section}
              </h2>
            )}
            {g.questions.map((q) => (
              <QuestionCard
                key={q.id}
                q={q}
                report={report}
                favs={favs}
                onToggleFavorite={onToggleFavorite}
                onExportCard={onExportCard}
                expandAll={expandAll}
              />
            ))}
          </section>
        ))}

        <footer className="pt-4 text-center text-[12px] leading-relaxed text-report-muted">
          Movimiento Consolación para el Mundo · Informe generado el {formatLongDate(report.generatedAt)}
          <br />
          Resultados agregados de la app MCM
        </footer>
      </div>
    </div>
  );
});

// ─── Cabecera ────────────────────────────────────────────────────────────────

function ReportHeader({ report }: { report: SurveyReport }) {
  const { totals } = report;
  const period =
    totals.firstAt && totals.lastAt
      ? sameDay(totals.firstAt, totals.lastAt)
        ? formatLongDate(totals.firstAt)
        : `${shortDate(totals.firstAt)} – ${shortDate(totals.lastAt)}`
      : '—';
  return (
    <header className="bg-report-brand text-white">
      <div className="h-1.5 w-full" style={{ backgroundColor: report.accent }} />
      <div className="mx-auto w-full max-w-2xl px-4 pb-5 pt-6">
        <p className="text-[12px] font-semibold uppercase tracking-wider text-white/70">
          Informe · {SURVEY_CLASS_LABELS[report.surveyClass]}
        </p>
        <h1 className="mt-1.5 flex items-start gap-2 text-[26px] font-bold leading-tight">
          {report.emoji && <span aria-hidden>{report.emoji}</span>}
          <span>{report.title}</span>
        </h1>
        {report.subtitle && <p className="mt-1.5 text-[15px] text-white/85">{report.subtitle}</p>}
        {report.filterLabel && (
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[12px] font-medium">
            <Filter className="h-3.5 w-3.5" /> {report.filterLabel}
          </p>
        )}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Kpi icon={<Users className="h-4 w-4" />} label="Respuestas" value={totals.responses.toLocaleString('es-ES')} />
          <Kpi icon={<CalendarDays className="h-4 w-4" />} label="Periodo" value={period} small />
        </div>
      </div>
    </header>
  );
}

function Kpi({ icon, label, value, small }: { icon: React.ReactNode; label: string; value: string; small?: boolean }) {
  return (
    <div className="rounded-xl bg-white/10 px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-[12px] text-white/75">
        {icon} {label}
      </p>
      <p className={cn('mt-0.5 font-bold tabular-nums', small ? 'text-[15px] leading-snug' : 'text-[24px] leading-none')}>
        {value}
      </p>
    </div>
  );
}

function Breakdown({ report }: { report: SurveyReport }) {
  const b = report.breakdown!;
  const rows: { title: string; items: ReportCount[] }[] = [
    { title: 'Perfil', items: b.profiles },
    { title: 'Delegación', items: b.delegations },
  ].filter((r) => r.items.length > 1 || (r.items.length === 1 && r.items[0].label !== 'desconocido'));
  if (rows.length === 0) return null;
  return (
    <section className="report-card space-y-4 rounded-2xl bg-report-card p-4 shadow-sm">
      <h2 className="text-[17px] font-bold text-report-brand">Quién ha respondido</h2>
      {rows.map((row) => {
        const total = row.items.reduce((s, x) => s + x.count, 0) || 1;
        const top = row.items.slice(0, 6);
        const rest = row.items.slice(6).reduce((s, x) => s + x.count, 0);
        return (
          <div key={row.title}>
            <p className="mb-1.5 text-[13px] font-medium text-report-muted">{row.title}</p>
            <div className="flex flex-wrap gap-1.5">
              {top.map((it) => (
                <span key={it.label} className="rounded-full border bg-report-sunken px-2.5 py-1 text-[13px]">
                  {it.label === 'desconocido' ? 'Sin indicar' : it.label}{' '}
                  <span className="font-semibold tabular-nums">{Math.round((it.count / total) * 100)}%</span>
                </span>
              ))}
              {rest > 0 && (
                <span className="rounded-full border bg-report-sunken px-2.5 py-1 text-[13px] text-report-muted">
                  Otras <span className="font-semibold tabular-nums">{Math.round((rest / total) * 100)}%</span>
                </span>
              )}
            </div>
          </div>
        );
      })}
    </section>
  );
}

// ─── Tarjeta de pregunta ─────────────────────────────────────────────────────

function QuestionCard({
  q,
  report,
  favs,
  onToggleFavorite,
  onExportCard,
  expandAll,
}: {
  q: ReportQuestion;
  report: SurveyReport;
  favs: Set<string>;
  onToggleFavorite?: ReportViewProps['onToggleFavorite'];
  onExportCard?: ReportViewProps['onExportCard'];
  expandAll?: boolean;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const answeredLabel =
    q.eligible === 0
      ? 'Nadie ha llegado a esta pregunta'
      : q.answered === q.eligible
        ? `${q.answered} ${q.answered === 1 ? 'respuesta' : 'respuestas'}`
        : `${q.answered} de ${q.eligible} respondieron`;

  return (
    <article ref={cardRef} data-kind={q.agg.kind} className="report-card relative rounded-2xl bg-report-card p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          {q.section && (
            <p data-capture-only className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-report-muted">
              {q.section}
            </p>
          )}
          <h3 className="text-[16px] font-semibold leading-snug">{q.label}</h3>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-report-muted">
            <span>{answeredLabel}</span>
            {q.condition && (
              <span className="inline-flex items-center gap-1 rounded-full bg-report-sunken px-2 py-0.5 text-[12px]">
                <GitBranch className="h-3 w-3" /> {q.condition}
              </span>
            )}
          </p>
        </div>
        {onExportCard && (
          <button
            type="button"
            data-export-ignore
            aria-label="Guardar esta pregunta como imagen"
            title="Imagen para WhatsApp"
            disabled={busy}
            onClick={async () => {
              if (!cardRef.current) return;
              setBusy(true);
              try {
                await onExportCard(cardRef.current, q);
              } finally {
                setBusy(false);
              }
            }}
            className="-mr-1 -mt-1 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-report-muted transition-colors hover:bg-report-sunken hover:text-report-brand disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImageDown className="h-5 w-5" />}
          </button>
        )}
      </div>

      <div className="mt-4">
        {q.answered === 0 && q.agg.kind !== 'text' ? (
          <p className="py-4 text-center text-[14px] text-report-muted">Sin respuestas todavía.</p>
        ) : (
          <AggView agg={q.agg} q={q} accent={report.accent} favs={favs} onToggleFavorite={onToggleFavorite} expandAll={expandAll} />
        )}
      </div>

      <div data-capture-only className="mt-4 items-center justify-between gap-2 border-t pt-3 text-[12px] text-report-muted">
        <span className="truncate">
          {report.emoji} {report.title}
        </span>
        <span className="font-semibold text-report-brand">MCM</span>
      </div>
    </article>
  );
}

function AggView({
  agg,
  q,
  accent,
  favs,
  onToggleFavorite,
  expandAll,
}: {
  agg: ReportAgg;
  q: ReportQuestion;
  accent: string;
  favs: Set<string>;
  onToggleFavorite?: ReportViewProps['onToggleFavorite'];
  expandAll?: boolean;
}) {
  switch (agg.kind) {
    case 'numeric':
      return <NumericView agg={agg} accent={accent} />;
    case 'boolean':
      return <BooleanView agg={agg} accent={accent} />;
    case 'options':
      return <OptionsView agg={agg} accent={accent} />;
    case 'ratings':
      return <RatingsView agg={agg} accent={accent} />;
    case 'text':
      return <TextView agg={agg} q={q} accent={accent} favs={favs} onToggleFavorite={onToggleFavorite} expandAll={expandAll} />;
  }
}

function NumericView({ agg, accent }: { agg: Extract<ReportAgg, { kind: 'numeric' }>; accent: string }) {
  const peak = Math.max(1, ...agg.distribution.map((d) => d.count));
  const total = agg.distribution.reduce((s, d) => s + d.count, 0) || 1;
  return (
    <div>
      <div className="flex items-end gap-3">
        <p className="text-[40px] font-bold leading-none tabular-nums text-report-brand">{formatMean(agg.mean)}</p>
        <div className="pb-1 text-[14px] text-report-muted">
          {agg.stars ? <Stars value={agg.mean} accent={accent} /> : <span>de media sobre {agg.max}</span>}
        </div>
        {agg.nps !== undefined && (
          <div className="ml-auto rounded-xl px-3 py-1.5 text-center text-white" style={{ backgroundColor: accent }}>
            <p className="text-[11px] font-semibold uppercase tracking-wide opacity-90">NPS</p>
            <p className="text-[20px] font-bold leading-none tabular-nums">{agg.nps > 0 ? `+${agg.nps}` : agg.nps}</p>
          </div>
        )}
      </div>
      <div className="mt-4 flex h-28 items-end gap-1" role="img" aria-label="Distribución de respuestas">
        {agg.distribution.map((d) => (
          <div key={d.label} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
            <span className="text-[11px] tabular-nums text-report-muted">{d.count > 0 ? Math.round((d.count / total) * 100) + '%' : ''}</span>
            <div
              className="w-full rounded-t-md"
              style={{
                height: `${Math.max(d.count > 0 ? 6 : 2, (d.count / peak) * 100)}%`,
                backgroundColor: d.count > 0 ? accent : 'hsl(var(--report-border))',
                opacity: d.count > 0 ? 0.45 + 0.55 * (d.count / peak) : 1,
              }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1">
        {agg.distribution.map((d) => (
          <span key={d.label} className="flex-1 text-center text-[12px] font-medium tabular-nums text-report-muted">
            {agg.stars ? `${d.label}★` : d.label}
          </span>
        ))}
      </div>
      {(agg.minLabel || agg.maxLabel) && (
        <div className="mt-1 flex justify-between gap-4 text-[12px] text-report-muted">
          <span>{agg.minLabel}</span>
          <span className="text-right">{agg.maxLabel}</span>
        </div>
      )}
    </div>
  );
}

function BooleanView({ agg, accent }: { agg: Extract<ReportAgg, { kind: 'boolean' }>; accent: string }) {
  const n = agg.yes + agg.no || 1;
  const pct = Math.round((agg.yes / n) * 100);
  return (
    <div>
      <p className="text-[40px] font-bold leading-none tabular-nums text-report-brand">
        {pct}%<span className="ml-2 text-[16px] font-medium text-report-muted">dice que sí</span>
      </p>
      <div className="mt-4 flex h-4 overflow-hidden rounded-full bg-report-border">
        <div style={{ width: `${pct}%`, backgroundColor: accent }} />
      </div>
      <div className="mt-2 flex justify-between text-[13px] text-report-muted">
        <span>
          <span className="font-semibold text-report-text">Sí</span> · {agg.yes}
        </span>
        <span>
          <span className="font-semibold text-report-text">No</span> · {agg.no}
        </span>
      </div>
    </div>
  );
}

function OptionsView({ agg, accent }: { agg: Extract<ReportAgg, { kind: 'options' }>; accent: string }) {
  const top = agg.items[0]?.count ?? 0;
  return (
    <div className="space-y-3">
      {agg.multi && (
        <p className="text-[13px] text-report-muted">
          {agg.maxSelect ? `Cada persona podía marcar hasta ${agg.maxSelect}.` : 'Cada persona podía marcar varias.'} El % es sobre
          quienes respondieron.
        </p>
      )}
      {agg.items.map((it) => (
        <div key={it.label}>
          <div className="mb-1 flex items-start justify-between gap-3 text-[14px] leading-snug">
            <span className={cn(it.count === top && top > 0 && 'font-semibold')}>{it.label}</span>
            <span className="whitespace-nowrap tabular-nums">
              <span className="font-semibold">{Math.round(it.pct)}%</span>
              <span className="ml-1 text-[12px] text-report-muted">({it.count})</span>
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-report-sunken">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.max(it.pct, it.count > 0 ? 2 : 0)}%`, backgroundColor: accent, opacity: it.count === top ? 1 : 0.55 }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function RatingsView({ agg, accent }: { agg: Extract<ReportAgg, { kind: 'ratings' }>; accent: string }) {
  return (
    <ul className="divide-y">
      {agg.items.map((it) => (
        <li key={it.label} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
          <span className="min-w-0 flex-1 text-[14px] leading-snug">{it.label}</span>
          <Stars value={it.mean} accent={accent} small />
          <span className="w-9 text-right text-[16px] font-bold tabular-nums text-report-brand">{it.n ? formatMean(it.mean) : '—'}</span>
        </li>
      ))}
    </ul>
  );
}

function TextView({
  agg,
  q,
  accent,
  favs,
  onToggleFavorite,
  expandAll,
}: {
  agg: Extract<ReportAgg, { kind: 'text' }>;
  q: ReportQuestion;
  accent: string;
  favs: Set<string>;
  onToggleFavorite?: ReportViewProps['onToggleFavorite'];
  expandAll?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const showAll = expandAll || open;
  const list = showAll ? agg.comments : agg.comments.slice(0, COMMENTS_PREVIEW);
  if (agg.comments.length === 0) {
    return (
      <p className="py-2 text-[14px] text-report-muted">
        {agg.hidden > 0 ? `${agg.hidden} comentarios, no incluidos en este informe.` : 'Nadie ha dejado comentarios.'}
      </p>
    );
  }
  return (
    <div>
      <ul className="space-y-3">
        {list.map((c) => (
          <li key={c.id} className="flex items-start gap-1">
            <div className="min-w-0 flex-1">
              <CommentBlock comment={c} accent={accent} />
            </div>
            {onToggleFavorite && (
              <button
                type="button"
                data-export-ignore
                onClick={() => onToggleFavorite(c, q)}
                aria-pressed={favs.has(c.id)}
                aria-label={favs.has(c.id) ? 'Quitar de favoritos' : 'Guardar en favoritos'}
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-report-muted hover:bg-report-sunken"
              >
                <Star
                  className="h-5 w-5"
                  style={favs.has(c.id) ? { color: 'hsl(var(--report-brand))' } : undefined}
                  fill={favs.has(c.id) ? 'currentColor' : 'transparent'}
                />
              </button>
            )}
          </li>
        ))}
      </ul>
      {!showAll && agg.comments.length > COMMENTS_PREVIEW && (
        <button
          type="button"
          data-export-ignore
          onClick={() => setOpen(true)}
          className="mt-3 flex w-full items-center justify-center gap-1 rounded-xl border py-2.5 text-[14px] font-medium text-report-brand"
        >
          Ver los {agg.comments.length} comentarios <ChevronDown className="h-4 w-4" />
        </button>
      )}
      {agg.hidden > 0 && (
        <p className="mt-3 text-[12px] text-report-muted">
          {agg.hidden} {agg.hidden === 1 ? 'comentario más no se incluye' : 'comentarios más no se incluyen'} en este informe.
        </p>
      )}
    </div>
  );
}

export function CommentBlock({ comment, accent, context }: { comment: ReportComment; accent: string; context?: string }) {
  const by = [comment.who, comment.meta].filter(Boolean).join(' · ');
  return (
    <blockquote className="border-l-[3px] pl-3" style={{ borderColor: accent }}>
      {context && <p className="mb-0.5 text-[12px] font-medium text-report-muted">{context}</p>}
      <p className="whitespace-pre-line text-[15px] leading-relaxed">
        <Quote className="mr-1 inline h-3.5 w-3.5 -translate-y-0.5 text-report-muted" aria-hidden />
        {comment.text}
      </p>
      {by && <p className="mt-1 text-[12px] text-report-muted">— {by}</p>}
    </blockquote>
  );
}

function Stars({ value, accent, small }: { value: number; accent: string; small?: boolean }) {
  const size = small ? 'h-4 w-4' : 'h-5 w-5';
  return (
    <span className="inline-flex items-center" aria-label={`${formatMean(value)} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map((s) => {
        const fill = Math.max(0, Math.min(1, value - (s - 1)));
        return (
          <span key={s} className={cn('relative inline-block', size)}>
            <Star className={cn('absolute inset-0', size)} style={{ color: 'hsl(var(--report-border))' }} fill="currentColor" />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star className={size} style={{ color: accent }} fill="currentColor" />
            </span>
          </span>
        );
      })}
    </span>
  );
}

function sameDay(a: number, b: number) {
  return new Date(a).toDateString() === new Date(b).toDateString();
}
function shortDate(ms: number) {
  return new Date(ms).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}
