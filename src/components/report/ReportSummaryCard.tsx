import { forwardRef } from 'react';
import { Star } from 'lucide-react';
import { formatLongDate, headline, SUMMARY_WIDTH, type ReportHighlight, type ReportQuestion, type SurveyReport } from '@/lib/surveyReport';
import { CommentBlock } from './ReportView';

// Imagen-resumen vertical (540 px de ancho × pixelRatio 2 = 1080 px), pensada
// para mandarse por WhatsApp: título, respuestas, una cifra por pregunta
// cerrada y los comentarios elegidos. Se pinta fuera de pantalla y se captura.

export const ReportSummaryCard = forwardRef<
  HTMLDivElement,
  { report: SurveyReport; comments?: ReportHighlight[]; heading?: string; maxStats?: number }
>(function ReportSummaryCard({ report, comments, heading, maxStats = 6 }, ref) {
  const stats = report.questions
    .map((q) => ({ q, h: headline(q) }))
    .filter((x): x is { q: ReportQuestion; h: NonNullable<ReturnType<typeof headline>> } => !!x.h)
    .slice(0, maxStats);
  const quotes = (comments ?? report.highlights).slice(0, 4);

  return (
    <div ref={ref} className="report-surface bg-report-bg" style={{ width: SUMMARY_WIDTH }}>
      <div className="bg-report-brand px-6 pb-6 pt-7 text-white">
        <p className="text-[13px] font-semibold uppercase tracking-wider text-white/70">{heading ?? 'Resumen'}</p>
        <h1 className="mt-2 text-[28px] font-bold leading-tight">
          {report.emoji && <span className="mr-2">{report.emoji}</span>}
          {report.title}
        </h1>
        {report.subtitle && <p className="mt-1 text-[16px] text-white/85">{report.subtitle}</p>}
        <p className="mt-4 text-[15px]">
          <span className="text-[30px] font-bold tabular-nums">{report.totals.responses}</span>
          <span className="ml-2 text-white/80">respuestas{report.filterLabel ? ` · ${report.filterLabel}` : ''}</span>
        </p>
      </div>
      <div className="h-2 w-full" style={{ backgroundColor: report.accent }} />

      <div className="space-y-3 p-5">
        {stats.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            {stats.map(({ q, h }) => (
              <div key={q.id} className="rounded-2xl bg-report-card p-4 shadow-sm">
                <p className="text-[30px] font-bold leading-none tabular-nums text-report-brand">{h.value}</p>
                <p className="mt-1 line-clamp-2 text-[13px] font-medium leading-snug">{h.caption}</p>
                <p className="mt-2 line-clamp-3 text-[12px] leading-snug text-report-muted">{q.label}</p>
              </div>
            ))}
          </div>
        )}

        {quotes.length > 0 && (
          <div className="space-y-3 rounded-2xl bg-report-card p-4 shadow-sm">
            <p className="flex items-center gap-1.5 text-[15px] font-bold text-report-brand">
              <Star className="h-4 w-4" fill="currentColor" /> {comments ? 'Comentarios elegidos' : 'Lo más destacado'}
            </p>
            {quotes.map((c) => (
              <CommentBlock key={c.id} comment={c} accent={report.accent} />
            ))}
          </div>
        )}

        <p className="flex items-center justify-between pt-1 text-[12px] text-report-muted">
          <span>{formatLongDate(report.generatedAt)}</span>
          <span className="font-semibold text-report-brand">Movimiento Consolación para el Mundo</span>
        </p>
      </div>
    </div>
  );
});
