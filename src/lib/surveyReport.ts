import {
  aggregateQuestion,
  dedupResponses,
  describeShowIf,
  eligibleResponses,
  filterResponses,
  responseTime,
  type QuestionType,
  type SegmentFilter,
  type SurveyClass,
  type SurveyEntry,
  type SurveyQuestion,
  type SurveyResponse,
} from '@/lib/surveys';
import { DEFAULT_SURVEY_ACCENT } from '@/lib/brandTokens';

// ─────────────────────────────────────────────────────────────────────────────
// Informe de una encuesta: un objeto SERIALIZABLE (va tal cual a Firebase para
// los enlaces públicos) con todo ya agregado. La página pública nunca lee las
// respuestas en bruto: con las reglas preparadas no podría (`respuestas` no se
// lista en bloque porque cada una lleva nombre, delegación y userId), y aunque
// pudiera no debe. Lo que sale aquí es lo que ve quien recibe el enlace.
//
// Contrato del nodo: docs/INFORMES.md (repo mcmpanel).
// ─────────────────────────────────────────────────────────────────────────────

export const REPORT_VERSION = 1;

export type CommentMode = 'all' | 'favorites' | 'none';

export interface ReportOptions {
  /** Título del informe (por defecto, el de la encuesta). */
  title?: string;
  /** Línea bajo el título («Resumen para el equipo de monitores»). */
  subtitle?: string;
  /** Nota de quien lo envía, arriba del todo. */
  note?: string;
  filter?: SegmentFilter;
  /** Qué comentarios de texto libre entran. */
  comments: CommentMode;
  /** Firmar los comentarios con el nombre. Por defecto NO. */
  showNames: boolean;
  /** Perfil y delegación bajo cada comentario. */
  showCommentMeta: boolean;
  /** Ids de pregunta que NO entran. */
  excludedQuestions?: string[];
  /** Ids de comentario (ver commentId) que van en «Lo más destacado». */
  highlights?: string[];
  /** Desglose por perfil/delegación/plataforma en la cabecera. */
  showBreakdown: boolean;
}

export const DEFAULT_REPORT_OPTIONS: ReportOptions = {
  comments: 'all',
  showNames: false,
  showCommentMeta: true,
  showBreakdown: true,
};

export interface ReportComment {
  /** `<questionId>~<deviceId>`: estable entre regeneraciones (favoritos). */
  id: string;
  text: string;
  who?: string;
  meta?: string;
  at?: number;
}

export interface ReportHighlight extends ReportComment {
  questionLabel: string;
}

export interface ReportCount {
  label: string;
  count: number;
}

export type ReportAgg =
  | { kind: 'numeric'; mean: number; min: number; max: number; distribution: ReportCount[]; nps?: number; minLabel?: string; maxLabel?: string; stars?: boolean }
  | { kind: 'boolean'; yes: number; no: number }
  | { kind: 'options'; multi: boolean; total: number; maxSelect?: number; items: (ReportCount & { pct: number })[] }
  | { kind: 'ratings'; items: { label: string; n: number; mean: number; distribution: number[] }[] }
  | { kind: 'text'; comments: ReportComment[]; hidden: number };

export interface ReportQuestion {
  id: string;
  label: string;
  type: QuestionType;
  section?: string;
  /** «Solo si respondió …» cuando la pregunta es de una ruta. */
  condition?: string;
  /** Respuestas a las que se les enseñó la pregunta. */
  eligible: number;
  /** De esas, las que la contestaron. */
  answered: number;
  agg: ReportAgg;
}

export interface SurveyReport {
  v: number;
  surveyKey: string;
  surveyClass: SurveyClass;
  title: string;
  subtitle?: string;
  note?: string;
  emoji?: string;
  accent: string;
  generatedAt: number;
  /** Texto legible del filtro aplicado («Monitores · Madrid»). */
  filterLabel?: string;
  totals: { responses: number; people: number; devices: number; firstAt?: number; lastAt?: number };
  breakdown?: { profiles: ReportCount[]; delegations: ReportCount[]; platforms: ReportCount[] };
  highlights: ReportHighlight[];
  questions: ReportQuestion[];
}

const PROFILE_LABELS: Record<string, string> = {
  familia: 'Familias',
  monitor: 'Monitores',
  miembro: 'Miembros',
  'sin-perfil': 'Sin perfil',
};
const PLATFORM_LABELS: Record<string, string> = { ios: 'iPhone', android: 'Android', web: 'Web' };

export const profileLabel = (p: string) => PROFILE_LABELS[p] ?? p;
export const platformLabel = (p: string) => PLATFORM_LABELS[p] ?? p;

export function commentId(questionId: string, r: SurveyResponse): string {
  return `${questionId}~${r.deviceId ?? r.userId ?? responseTime(r)}`;
}

function countBy(responses: SurveyResponse[], get: (r: SurveyResponse) => string | undefined, label = (s: string) => s) {
  const map = new Map<string, number>();
  for (const r of responses) {
    const k = get(r) || 'desconocido';
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([k, count]) => ({ label: label(k), count }))
    .sort((a, b) => b.count - a.count);
}

export function describeFilter(f: SegmentFilter | undefined): string | undefined {
  if (!f) return undefined;
  const parts: string[] = [];
  if (f.profileType) parts.push(profileLabel(f.profileType));
  if (f.delegation) parts.push(f.delegation);
  if (f.platform) parts.push(platformLabel(f.platform));
  const fmt = (ms: number) => new Date(ms).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  if (f.from != null && f.to != null) parts.push(`${fmt(f.from)} – ${fmt(f.to)}`);
  else if (f.from != null) parts.push(`desde el ${fmt(f.from)}`);
  else if (f.to != null) parts.push(`hasta el ${fmt(f.to)}`);
  return parts.length ? parts.join(' · ') : undefined;
}

function commentFor(q: SurveyQuestion, r: SurveyResponse, text: string, opts: ReportOptions): ReportComment {
  const c: ReportComment = { id: commentId(q.id, r), text };
  if (opts.showNames && r.userName && r.userName !== 'Anónimo') c.who = r.userName;
  if (opts.showCommentMeta) {
    const meta = [r.userProfileType && r.userProfileType !== 'sin-perfil' ? profileLabel(r.userProfileType) : '', r.userDelegation && r.userDelegation !== 'Sin delegación' ? r.userDelegation : '']
      .filter(Boolean)
      .join(' · ');
    if (meta) c.meta = meta;
  }
  const t = responseTime(r);
  if (t) c.at = t;
  return c;
}

/** Construye el informe. Puro: mismo input, mismo output (salvo `generatedAt`). */
export function buildReport(entry: SurveyEntry, questions: SurveyQuestion[], opts: ReportOptions): SurveyReport {
  const filtered = filterResponses(entry.responses, opts.filter ?? {});
  const { deduped, peopleCount, deviceCount } = dedupResponses(filtered);
  const times = deduped.map(responseTime).filter((t) => t > 0);
  const excluded = new Set(opts.excludedQuestions ?? []);
  const highlightIds = new Set(opts.highlights ?? []);
  const highlights: ReportHighlight[] = [];

  const reportQuestions: ReportQuestion[] = [];
  for (const q of questions) {
    const eligible = eligibleResponses(q, questions, deduped);
    const agg = aggregateQuestion(q, eligible);

    // Destacados: se recogen aunque la pregunta esté excluida del cuerpo.
    if (agg.kind === 'text') {
      for (const v of agg.values) {
        const c = commentFor(q, v.response, v.text, opts);
        if (highlightIds.has(c.id)) highlights.push({ ...c, questionLabel: q.label });
      }
    }
    if (excluded.has(q.id)) continue;

    let rAgg: ReportAgg;
    switch (agg.kind) {
      case 'numeric':
        rAgg = {
          kind: 'numeric',
          mean: agg.mean,
          min: q.type === 'stars' ? 1 : q.min ?? 0,
          max: q.type === 'stars' ? 5 : q.max ?? 10,
          distribution: agg.distribution,
          nps: agg.nps,
          minLabel: q.minLabel,
          maxLabel: q.maxLabel,
          stars: q.type === 'stars',
        };
        break;
      case 'boolean':
        rAgg = { kind: 'boolean', yes: agg.yes, no: agg.no };
        break;
      case 'options':
        rAgg = {
          kind: 'options',
          multi: q.type === 'multi',
          total: agg.total,
          maxSelect: q.maxSelect,
          items: [...agg.items].sort((a, b) => b.count - a.count).map(({ label, count, pct }) => ({ label, count, pct })),
        };
        break;
      case 'ratings':
        rAgg = {
          kind: 'ratings',
          items: [...agg.items].sort((a, b) => b.mean - a.mean).map(({ label, n, mean, distribution }) => ({ label, n, mean, distribution })),
        };
        break;
      case 'text': {
        const all = agg.values
          .map((v) => commentFor(q, v.response, v.text, opts))
          .sort((a, b) => (b.at ?? 0) - (a.at ?? 0));
        const kept =
          opts.comments === 'all' ? all : opts.comments === 'favorites' ? all.filter((c) => highlightIds.has(c.id)) : [];
        rAgg = { kind: 'text', comments: kept, hidden: all.length - kept.length };
        break;
      }
    }

    reportQuestions.push({
      id: q.id,
      label: q.label,
      type: q.type,
      section: q.section,
      condition: describeShowIf(q, questions) ?? undefined,
      eligible: eligible.length,
      answered: agg.n,
      agg: rAgg,
    });
  }

  // Orden de los destacados: el de las preguntas, y dentro, el que se marcó.
  const order = opts.highlights ?? [];
  highlights.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));

  return {
    v: REPORT_VERSION,
    surveyKey: entry.key,
    surveyClass: entry.surveyClass,
    title: opts.title?.trim() || entry.config.title || entry.label,
    subtitle: opts.subtitle?.trim() || undefined,
    note: opts.note?.trim() || undefined,
    emoji: entry.config.emoji,
    accent: entry.config.accentColor || DEFAULT_SURVEY_ACCENT,
    generatedAt: Date.now(),
    filterLabel: describeFilter(opts.filter),
    totals: {
      responses: deduped.length,
      people: peopleCount,
      devices: deviceCount,
      firstAt: times.length ? Math.min(...times) : undefined,
      lastAt: times.length ? Math.max(...times) : undefined,
    },
    breakdown: opts.showBreakdown
      ? {
          profiles: countBy(deduped, (r) => r.userProfileType, profileLabel),
          delegations: countBy(deduped, (r) => r.userDelegation),
          platforms: countBy(deduped, (r) => r.platform, platformLabel),
        }
      : undefined,
    highlights,
    questions: reportQuestions,
  };
}

/**
 * RTDB borra los arrays vacíos y las claves `undefined`: al leer un informe de
 * Firebase hay que volver a poner los arrays que falten antes de pintarlo.
 */
export function normalizeReport(raw: unknown): SurveyReport | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as SurveyReport;
  if (!r.title || !r.totals) return null;
  const arr = <T,>(v: T[] | Record<string, T> | undefined): T[] =>
    Array.isArray(v) ? v.filter((x) => x != null) : v && typeof v === 'object' ? Object.values(v) : [];
  return {
    ...r,
    highlights: arr(r.highlights),
    breakdown: r.breakdown
      ? { profiles: arr(r.breakdown.profiles), delegations: arr(r.breakdown.delegations), platforms: arr(r.breakdown.platforms) }
      : undefined,
    questions: arr(r.questions).map((q) => {
      const a = q.agg as ReportAgg;
      let agg: ReportAgg = a;
      if (a?.kind === 'numeric') agg = { ...a, distribution: arr(a.distribution) };
      else if (a?.kind === 'options') agg = { ...a, items: arr(a.items) };
      else if (a?.kind === 'ratings') agg = { ...a, items: arr(a.items).map((it) => ({ ...it, distribution: arr(it.distribution) })) };
      else if (a?.kind === 'text') agg = { ...a, comments: arr(a.comments), hidden: a.hidden ?? 0 };
      return { ...q, agg };
    }),
  };
}

/** Agrupa las preguntas por `section` conservando el orden. */
export function groupBySection(questions: ReportQuestion[]): { section?: string; questions: ReportQuestion[] }[] {
  const groups: { section?: string; questions: ReportQuestion[] }[] = [];
  for (const q of questions) {
    const last = groups[groups.length - 1];
    if (last && last.section === q.section) last.questions.push(q);
    else groups.push({ section: q.section, questions: [q] });
  }
  return groups;
}

export function formatMean(n: number): string {
  return n.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function formatLongDate(ms: number | undefined): string {
  if (!ms) return '—';
  return new Date(ms).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
}

// ─── Imagen resumen ──────────────────────────────────────────────────────────

export const SUMMARY_WIDTH = 540;

/** La cifra que resume cada pregunta cerrada, en una línea. */
export function headline(q: ReportQuestion): { value: string; caption: string } | null {
  const a = q.agg;
  if (q.answered === 0) return null;
  switch (a.kind) {
    case 'numeric':
      return a.nps !== undefined
        ? { value: `${formatMean(a.mean)}`, caption: `de media · NPS ${a.nps > 0 ? '+' : ''}${a.nps}` }
        : { value: formatMean(a.mean), caption: a.stars ? 'de 5 estrellas' : `de media sobre ${a.max}` };
    case 'boolean': {
      const n = a.yes + a.no || 1;
      return { value: `${Math.round((a.yes / n) * 100)}%`, caption: 'dice que sí' };
    }
    case 'options': {
      const top = a.items[0];
      if (!top) return null;
      return { value: `${Math.round(top.pct)}%`, caption: top.label };
    }
    case 'ratings': {
      const best = a.items[0];
      if (!best) return null;
      return { value: formatMean(best.mean), caption: `lo mejor valorado: ${best.label}` };
    }
    default:
      return null;
  }
}

