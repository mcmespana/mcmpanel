import { ref, set, update } from 'firebase/database';
import { getDB } from '@/lib/firebase';
import { slugify } from '@/lib/profileCatalog';

// ─────────────────────────────────────────────────────────────────────────────
// Encuestas y Evaluaciones — contrato de datos (ver docs / ENCUESTAS_CONTRATO.md)
//
// Tres clases de encuesta, mismo modelo:
//   • Evaluación del evento  → activities/<evento>/evaluacion
//   • Evaluación de la app    → app/evaluationConfig (+ respuestas en app/evaluations)
//   • Encuestas genéricas      → surveys/<id>
// La `data` (SurveyConfig) la escribe SOLO el panel; las respuestas las escribe la
// app. Cada vez que el panel toca `data`, debe tocar el `updatedAt` hermano para
// invalidar la caché de los clientes (mismo patrón que /profileConfig).
// ─────────────────────────────────────────────────────────────────────────────

export type SurveyStatus = 'draft' | 'scheduled' | 'open' | 'closed';
export type QuestionType = 'stars' | 'scale' | 'text' | 'yesno' | 'single' | 'multi';
export type Platform = 'ios' | 'android' | 'web';
export type ProfileType = 'familia' | 'monitor' | 'miembro';
export type SurveyClass = 'event' | 'app' | 'generic';
export type PlacementType = 'link-only' | 'home-banner' | 'event-banner' | 'app-settings';

export interface QuestionOption {
  value: string;
  label: string;
}

export interface SurveyQuestion {
  /** Clave estable en `answers`. No cambiar tras recibir respuestas. */
  id: string;
  type: QuestionType;
  label: string;
  /** Falta o false = obligatoria. */
  optional?: boolean;
  placeholder?: string; // text
  min?: number; // scale (def. 0)
  max?: number; // scale (def. 10)
  minLabel?: string; // scale
  maxLabel?: string; // scale
  options?: QuestionOption[]; // single / multi (obligatorio)
}

export interface SurveyPlacement {
  type: PlacementType;
  eventId?: string;
  ctaLabel?: string;
}

export interface SurveyAudience {
  profileTypes?: ProfileType[];
  topics?: string[];
  delegationIds?: string[];
}

export interface SurveyConfig {
  status?: SurveyStatus;
  opensAt?: number; // epoch ms
  closesAt?: number; // epoch ms
  evaluationOpen?: boolean; // legacy (solo si no hay status)
  title?: string;
  intro?: string;
  thanksTitle?: string;
  thanksBody?: string;
  closedTitle?: string;
  closedBody?: string;
  accentColor?: string;
  emoji?: string;
  anonymous?: boolean; // solo genéricas
  placement?: SurveyPlacement; // solo genéricas
  audience?: SurveyAudience; // solo genéricas
  questions?: SurveyQuestion[];
  /** Las genéricas reflejan su id dentro de data (ver seed). */
  id?: string;
}

export type AnswerValue = number | string | boolean | string[];

export interface SurveyResponse {
  answers?: Record<string, AnswerValue>;
  deviceId?: string;
  surveyId?: string; // solo genéricas
  eventId?: string; // solo evaluación de evento
  timestamp?: number; // epoch ms (cliente)
  reportedAt?: string; // ISO legible
  platform?: Platform;
  status?: string; // solo evaluación de app ("pending" → triaje)
  userName?: string; // ausente si anonymous
  userProfileType?: string; // ausente si anonymous
  userDelegation?: string; // etiqueta legible ("Madrid")
  userId?: string; // solo con sesión Firebase Auth
}

export interface SurveyIndexEntry {
  id: string;
  title?: string;
  intro?: string;
  emoji?: string;
  accentColor?: string;
  status?: SurveyStatus;
  opensAt?: number;
  closesAt?: number;
  placement?: SurveyPlacement;
  audience?: SurveyAudience;
}

/** Un nodo de encuesta normalizado para la UI del panel. */
export interface SurveyEntry {
  /** Clave única en la UI: 'app' | `event:<id>` | `generic:<id>`. */
  key: string;
  surveyClass: SurveyClass;
  /** id de la encuesta (genéricas), id del evento (evento), 'app' (app). */
  id: string;
  eventId?: string;
  /** Etiqueta legible para la lista. */
  label: string;
  config: SurveyConfig;
  responses: SurveyResponse[];
  /** Path Firebase del nodo padre (donde viven `data` y `updatedAt`). */
  configPath: string;
  updatedAt?: number | string;
  hidden?: boolean; // solo evento
}

// ─── Catálogos de segmentación (alineados con NOTIFICACIONES_CONTRATO §7) ──────

export const PROFILE_TYPE_OPTIONS: { value: ProfileType; label: string }[] = [
  { value: 'familia', label: 'Familias' },
  { value: 'monitor', label: 'Monitores' },
  { value: 'miembro', label: 'Miembros' },
];

/** Topics de notificación reutilizables para audience.topics. */
export const TOPIC_OPTIONS: { value: string; label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'eventos', label: 'Eventos' },
  { value: 'familias', label: 'Familias' },
  { value: 'monitores', label: 'Monitores' },
  { value: 'miembros', label: 'Miembros' },
];

/** Slugs de delegación (mismos ids que los topics mcm-* de notificaciones). */
export const DELEGATION_OPTIONS: { value: string; label: string }[] = [
  { value: 'mcm-espana', label: 'MCM España' },
  { value: 'mcm-benicarlo-vinaros', label: 'Benicarló-Vinaròs' },
  { value: 'mcm-burriana', label: 'Burriana' },
  { value: 'mcm-caravaca', label: 'Caravaca' },
  { value: 'mcm-castellon', label: 'Castellón' },
  { value: 'mcm-espinardo', label: 'Espinardo' },
  { value: 'mcm-granada', label: 'Granada' },
  { value: 'mcm-lalcora', label: "L'Alcora" },
  { value: 'mcm-madrid', label: 'Madrid' },
  { value: 'mcm-nules', label: 'Nules' },
  { value: 'mcm-onda', label: 'Onda' },
  { value: 'mcm-quintanar', label: 'Quintanar' },
  { value: 'mcm-vila-real', label: 'Vila-real' },
  { value: 'mcm-villacanas', label: 'Villacañas' },
  { value: 'mcm-zaragoza', label: 'Zaragoza' },
  { value: 'internacional', label: 'Internacional' },
];

/** profileTypes (singular) → topic de notificación (plural) para el push. */
export const PROFILE_TYPE_TO_TOPIC: Record<ProfileType, string> = {
  familia: 'familias',
  monitor: 'monitores',
  miembro: 'miembros',
};

export const PLACEMENT_LABELS: Record<PlacementType, string> = {
  'link-only': 'Solo enlace / push (sin banner)',
  'home-banner': 'Banner en la Home',
  'event-banner': 'Banner en el hub del evento',
  'app-settings': 'Fila en Ajustes',
};

export const STATUS_META: Record<SurveyStatus, { label: string; className: string }> = {
  draft: { label: 'Borrador', className: 'bg-muted text-muted-foreground border-border' },
  scheduled: { label: 'Programada', className: 'bg-primary/15 text-primary border-primary/30' },
  open: { label: 'Abierta', className: 'bg-success/15 text-success border-success/30' },
  closed: { label: 'Cerrada', className: 'bg-destructive/15 text-destructive border-destructive/30' },
};

export const QUESTION_TYPE_META: Record<QuestionType, { label: string; hint: string }> = {
  stars: { label: 'Estrellas', hint: 'Valoración de 1 a 5 estrellas' },
  scale: { label: 'Escala', hint: 'Número entre un mínimo y un máximo (p. ej. NPS 0–10)' },
  text: { label: 'Texto libre', hint: 'Respuesta abierta en un campo de texto' },
  yesno: { label: 'Sí / No', hint: 'Pregunta binaria' },
  single: { label: 'Opción única', hint: 'Elegir una opción de una lista' },
  multi: { label: 'Opción múltiple', hint: 'Elegir varias opciones de una lista' },
};

// ─── Estado abierto/cerrado (espejo de isEvaluationOpen en la app) ─────────────

export function isSurveyOpen(c: SurveyConfig | undefined, now = Date.now()): boolean {
  if (!c) return false;
  if (c.status === 'draft' || c.status === 'closed') return false;
  if (c.opensAt != null && now < c.opensAt) return false;
  if (c.closesAt != null && now > c.closesAt) return false;
  if (c.status === 'open' || c.status === 'scheduled') return true;
  return c.evaluationOpen !== false; // sin status: legacy, por defecto abierta
}

/** Estado a mostrar en la UI: el `status` guardado, o derivado del legacy. */
export function effectiveStatus(c: SurveyConfig | undefined): SurveyStatus {
  if (!c) return 'draft';
  if (c.status) return c.status;
  return c.evaluationOpen === false ? 'closed' : 'open';
}

// ─── Utilidades ────────────────────────────────────────────────────────────────

/** Elimina recursivamente claves `undefined` (RTDB las rechaza). */
export function pruneUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((v) => pruneUndefined(v)) as unknown as T;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === undefined) continue;
      out[k] = pruneUndefined(v);
    }
    return out as T;
  }
  return value;
}

/** Marca temporal de una respuesta (timestamp epoch ms o reportedAt ISO). */
export function responseTime(r: SurveyResponse): number {
  if (typeof r.timestamp === 'number') return r.timestamp;
  if (r.reportedAt) {
    const t = Date.parse(r.reportedAt);
    if (!Number.isNaN(t)) return t;
  }
  return 0;
}

/** Convierte el mapa `respuestas/<deviceId>` en una lista, ignorando hijos sin `answers`. */
export function responsesFromNode(node: unknown): SurveyResponse[] {
  if (!node || typeof node !== 'object') return [];
  return Object.entries(node as Record<string, unknown>)
    .filter(([key]) => key !== 'updatedAt')
    .map(([deviceId, value]) => {
      const r = (value && typeof value === 'object' ? value : {}) as SurveyResponse;
      return { deviceId, ...r };
    })
    .filter((r) => r.answers && typeof r.answers === 'object' && Object.keys(r.answers).length > 0);
}

// ─── Lectura del árbol de encuestas ────────────────────────────────────────────

export interface SurveysTree {
  generics: SurveyEntry[];
  index: SurveyIndexEntry[];
}

/** Parsea el nodo `surveys` (encuestas genéricas + índice de banners). */
export function parseSurveysNode(node: unknown): SurveysTree {
  const generics: SurveyEntry[] = [];
  let index: SurveyIndexEntry[] = [];
  if (node && typeof node === 'object') {
    const obj = node as Record<string, unknown>;
    const rawIndex = (obj._index as { data?: unknown } | undefined)?.data;
    if (Array.isArray(rawIndex)) index = rawIndex as SurveyIndexEntry[];
    else if (rawIndex && typeof rawIndex === 'object') index = Object.values(rawIndex) as SurveyIndexEntry[];

    for (const [id, value] of Object.entries(obj)) {
      if (id === '_index' || id === 'updatedAt') continue;
      if (!value || typeof value !== 'object') continue;
      const wrapper = value as { data?: SurveyConfig; updatedAt?: number | string; respuestas?: unknown };
      const config = (wrapper.data && typeof wrapper.data === 'object' ? wrapper.data : {}) as SurveyConfig;
      generics.push({
        key: `generic:${id}`,
        surveyClass: 'generic',
        id,
        label: config.title || id,
        config,
        responses: responsesFromNode(wrapper.respuestas),
        configPath: `surveys/${id}`,
        updatedAt: wrapper.updatedAt,
      });
    }
  }
  generics.sort((a, b) => a.label.localeCompare(b.label));
  return { generics, index };
}

/** Parsea `app/evaluationConfig` + `app/evaluations` en una entrada de la app. */
export function parseAppEvaluation(configNode: unknown, responsesNode: unknown): SurveyEntry {
  const wrapper = (configNode && typeof configNode === 'object' ? configNode : {}) as {
    data?: SurveyConfig;
    updatedAt?: number | string;
  };
  const config = (wrapper.data && typeof wrapper.data === 'object' ? wrapper.data : {}) as SurveyConfig;
  return {
    key: 'app',
    surveyClass: 'app',
    id: 'app',
    label: config.title || 'Evaluación de la app',
    config,
    responses: responsesFromNode(responsesNode),
    configPath: 'app/evaluationConfig',
    updatedAt: wrapper.updatedAt,
  };
}

/** Recorre `activities` y extrae las evaluaciones de evento existentes. */
export function parseEventEvaluations(activitiesNode: unknown): SurveyEntry[] {
  const out: SurveyEntry[] = [];
  if (!activitiesNode || typeof activitiesNode !== 'object') return out;
  for (const [eventId, value] of Object.entries(activitiesNode as Record<string, unknown>)) {
    if (!value || typeof value !== 'object') continue;
    const evalNode = (value as Record<string, unknown>).evaluacion;
    if (!evalNode || typeof evalNode !== 'object') continue;
    const wrapper = evalNode as {
      data?: SurveyConfig;
      updatedAt?: number | string;
      hidden?: boolean;
      respuestas?: unknown;
    };
    const config = (wrapper.data && typeof wrapper.data === 'object' ? wrapper.data : {}) as SurveyConfig;
    out.push({
      key: `event:${eventId}`,
      surveyClass: 'event',
      id: eventId,
      eventId,
      label: config.title || eventId,
      config,
      responses: responsesFromNode(wrapper.respuestas),
      configPath: `activities/${eventId}/evaluacion`,
      updatedAt: wrapper.updatedAt,
      hidden: wrapper.hidden === true,
    });
  }
  out.sort((a, b) => a.label.localeCompare(b.label));
  return out;
}

// ─── Escritura de configuración ─────────────────────────────────────────────────

/** Escribe `data` + toca `updatedAt`, sin tocar `respuestas` ni `hidden`. */
export async function writeSurveyConfig(configPath: string, config: SurveyConfig): Promise<void> {
  const db = getDB();
  await update(ref(db, configPath), {
    data: pruneUndefined(config),
    updatedAt: Date.now(),
  });
}

/** Toggle del estado abierto/cerrado de una encuesta (solo cambia status). */
export async function setSurveyStatus(configPath: string, config: SurveyConfig, status: SurveyStatus): Promise<void> {
  await writeSurveyConfig(configPath, { ...config, status });
}

/** Oculta/muestra la tarjeta de evaluación en el hub del evento. */
export async function setEventEvaluationHidden(configPath: string, hidden: boolean): Promise<void> {
  const db = getDB();
  await update(ref(db, configPath), { hidden, updatedAt: Date.now() });
}

/** Borra una encuesta genérica completa (incluye respuestas). */
export async function deleteGenericSurvey(id: string): Promise<void> {
  const db = getDB();
  await set(ref(db, `surveys/${id}`), null);
}

// ─── Índice de banners (surveys/_index) ─────────────────────────────────────────

/** Construye un SurveyIndexEntry ligero a partir de la config (solo metadatos). */
export function toIndexEntry(id: string, c: SurveyConfig): SurveyIndexEntry {
  const entry: SurveyIndexEntry = { id };
  if (c.title) entry.title = c.title;
  if (c.intro) entry.intro = c.intro;
  if (c.emoji) entry.emoji = c.emoji;
  if (c.accentColor) entry.accentColor = c.accentColor;
  if (c.status) entry.status = c.status;
  if (c.opensAt != null) entry.opensAt = c.opensAt;
  if (c.closesAt != null) entry.closesAt = c.closesAt;
  if (c.placement) entry.placement = c.placement;
  if (c.audience) entry.audience = c.audience;
  return entry;
}

/**
 * Recalcula el índice de banners a partir del conjunto de encuestas genéricas.
 * Incluye solo las que llevan banner (placement ≠ link-only) y están activas
 * (status distinto de draft/closed). La app filtra igualmente por ventana y
 * audience, pero el índice debe contener las encuestas con banner activas.
 */
export function buildIndex(generics: { id: string; config: SurveyConfig }[]): SurveyIndexEntry[] {
  return generics
    .filter(({ config }) => {
      const placement = config.placement?.type ?? 'link-only';
      if (placement === 'link-only') return false;
      const status = effectiveStatus(config);
      return status !== 'draft' && status !== 'closed';
    })
    .map(({ id, config }) => toIndexEntry(id, config));
}

/** Escribe el índice ligero `surveys/_index/data` + toca su `updatedAt`. */
export async function writeIndex(entries: SurveyIndexEntry[]): Promise<void> {
  const db = getDB();
  await update(ref(db, 'surveys/_index'), {
    data: pruneUndefined(entries),
    updatedAt: Date.now(),
  });
}

// ─── Dedup y segmentación ────────────────────────────────────────────────────

export interface DedupResult {
  deduped: SurveyResponse[];
  /** Personas distintas (respuestas con userId). */
  peopleCount: number;
  /** Dispositivos sin sesión (respuestas sin userId). */
  deviceCount: number;
}

/** Deduplica por userId (queda la más reciente); las sin userId van por deviceId. */
export function dedupResponses(responses: SurveyResponse[]): DedupResult {
  const byUser = new Map<string, SurveyResponse>();
  const noUser: SurveyResponse[] = [];
  for (const r of responses) {
    if (r.userId) {
      const existing = byUser.get(r.userId);
      if (!existing || responseTime(r) > responseTime(existing)) byUser.set(r.userId, r);
    } else {
      noUser.push(r);
    }
  }
  return {
    deduped: [...byUser.values(), ...noUser],
    peopleCount: byUser.size,
    deviceCount: noUser.length,
  };
}

export interface SegmentFilter {
  profileType?: string; // '' = todas
  delegation?: string;
  platform?: string;
  from?: number; // epoch ms
  to?: number; // epoch ms
}

export function filterResponses(responses: SurveyResponse[], filter: SegmentFilter): SurveyResponse[] {
  return responses.filter((r) => {
    if (filter.profileType && r.userProfileType !== filter.profileType) return false;
    if (filter.delegation && r.userDelegation !== filter.delegation) return false;
    if (filter.platform && r.platform !== filter.platform) return false;
    if (filter.from != null || filter.to != null) {
      const t = responseTime(r);
      if (filter.from != null && t < filter.from) return false;
      if (filter.to != null && t > filter.to) return false;
    }
    return true;
  });
}

/** Valores distintos presentes en las respuestas, para poblar los selectores. */
export function segmentOptions(responses: SurveyResponse[]) {
  const profiles = new Set<string>();
  const delegations = new Set<string>();
  const platforms = new Set<string>();
  for (const r of responses) {
    if (r.userProfileType) profiles.add(r.userProfileType);
    if (r.userDelegation) delegations.add(r.userDelegation);
    if (r.platform) platforms.add(r.platform);
  }
  return {
    profiles: [...profiles].sort(),
    delegations: [...delegations].sort(),
    platforms: [...platforms].sort(),
  };
}

// ─── Lectura de una respuesta ─────────────────────────────────────────────────

export function getAnswer(r: SurveyResponse, questionId: string): AnswerValue | undefined {
  return r.answers ? r.answers[questionId] : undefined;
}

/** ¿La pregunta tiene una respuesta válida (no vacía) en esta respuesta? */
export function isAnswered(q: SurveyQuestion, value: AnswerValue | undefined): boolean {
  if (value === undefined || value === null) return false;
  switch (q.type) {
    case 'stars':
      return typeof value === 'number' && value > 0;
    case 'scale':
      return typeof value === 'number'; // 0 es válido
    case 'text':
      return typeof value === 'string' && value.trim().length > 0;
    case 'yesno':
      return typeof value === 'boolean';
    case 'single':
      return typeof value === 'string' && value.length > 0;
    case 'multi':
      return Array.isArray(value) && value.length > 0;
    default:
      return false;
  }
}

// ─── Agregación por pregunta ──────────────────────────────────────────────────

export interface NumericAgg {
  kind: 'numeric';
  n: number;
  mean: number;
  distribution: { label: string; count: number }[];
  /** Net Promoter Score (solo escalas 0–10). */
  nps?: number;
}
export interface BooleanAgg {
  kind: 'boolean';
  n: number;
  yes: number;
  no: number;
}
export interface OptionAgg {
  kind: 'options';
  n: number; // respuestas que contestaron
  total: number; // selecciones totales (multi puede superar n)
  items: { value: string; label: string; count: number; pct: number }[];
}
export interface TextAgg {
  kind: 'text';
  n: number;
  values: { text: string; response: SurveyResponse }[];
}
export type QuestionAgg = NumericAgg | BooleanAgg | OptionAgg | TextAgg;

export function aggregateQuestion(q: SurveyQuestion, responses: SurveyResponse[]): QuestionAgg {
  const answered = responses
    .map((r) => getAnswer(r, q.id))
    .filter((v) => isAnswered(q, v));

  switch (q.type) {
    case 'stars': {
      const nums = answered as number[];
      const distribution = [1, 2, 3, 4, 5].map((star) => ({
        label: String(star),
        count: nums.filter((n) => Math.round(n) === star).length,
      }));
      const mean = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
      return { kind: 'numeric', n: nums.length, mean, distribution };
    }
    case 'scale': {
      const nums = answered as number[];
      const min = q.min ?? 0;
      const max = q.max ?? 10;
      const distribution: { label: string; count: number }[] = [];
      for (let i = min; i <= max; i++) {
        distribution.push({ label: String(i), count: nums.filter((n) => Math.round(n) === i).length });
      }
      const mean = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
      let nps: number | undefined;
      if (min === 0 && max === 10 && nums.length) {
        const promoters = nums.filter((n) => n >= 9).length;
        const detractors = nums.filter((n) => n <= 6).length;
        nps = Math.round(((promoters - detractors) / nums.length) * 100);
      }
      return { kind: 'numeric', n: nums.length, mean, distribution, nps };
    }
    case 'yesno': {
      const bools = answered as boolean[];
      return {
        kind: 'boolean',
        n: bools.length,
        yes: bools.filter((b) => b === true).length,
        no: bools.filter((b) => b === false).length,
      };
    }
    case 'single': {
      const vals = answered as string[];
      const options = q.options ?? [];
      const items = options.map((o) => {
        const count = vals.filter((v) => v === o.value).length;
        return { value: o.value, label: o.label, count, pct: vals.length ? (count / vals.length) * 100 : 0 };
      });
      // Valores fuera del catálogo (por si cambió tras recibir respuestas).
      for (const v of new Set(vals)) {
        if (!options.some((o) => o.value === v)) {
          const count = vals.filter((x) => x === v).length;
          items.push({ value: v, label: v, count, pct: vals.length ? (count / vals.length) * 100 : 0 });
        }
      }
      return { kind: 'options', n: vals.length, total: vals.length, items };
    }
    case 'multi': {
      const arrays = answered as string[][];
      const options = q.options ?? [];
      const flat = arrays.flat();
      const items = options.map((o) => {
        const count = flat.filter((v) => v === o.value).length;
        return { value: o.value, label: o.label, count, pct: arrays.length ? (count / arrays.length) * 100 : 0 };
      });
      for (const v of new Set(flat)) {
        if (!options.some((o) => o.value === v)) {
          const count = flat.filter((x) => x === v).length;
          items.push({ value: v, label: v, count, pct: arrays.length ? (count / arrays.length) * 100 : 0 });
        }
      }
      return { kind: 'options', n: arrays.length, total: flat.length, items };
    }
    case 'text':
    default: {
      const values = responses
        .map((r) => ({ value: getAnswer(r, q.id), response: r }))
        .filter((x) => isAnswered(q, x.value))
        .map((x) => ({ text: String(x.value), response: x.response }));
      return { kind: 'text', n: values.length, values };
    }
  }
}

/**
 * Si la config no trae preguntas (la app cae al set por defecto en código),
 * inferimos un esquema mínimo a partir de las claves observadas en las respuestas
 * para poder analizarlas igualmente.
 */
export function inferQuestionsFromResponses(responses: SurveyResponse[]): SurveyQuestion[] {
  const seen = new Map<string, SurveyQuestion>();
  for (const r of responses) {
    if (!r.answers) continue;
    for (const [id, value] of Object.entries(r.answers)) {
      if (seen.has(id)) {
        // Acumula opciones observadas para multi/single.
        const q = seen.get(id)!;
        if ((q.type === 'multi' || q.type === 'single') && q.options) {
          const vals = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
          for (const v of vals) {
            if (!q.options.some((o) => o.value === v)) q.options.push({ value: v, label: v });
          }
        }
        continue;
      }
      let q: SurveyQuestion;
      if (typeof value === 'boolean') {
        q = { id, type: 'yesno', label: id };
      } else if (typeof value === 'number') {
        q = { id, type: value >= 1 && value <= 5 && Number.isInteger(value) ? 'stars' : 'scale', label: id };
      } else if (Array.isArray(value)) {
        q = { id, type: 'multi', label: id, options: value.map((v) => ({ value: String(v), label: String(v) })) };
      } else {
        q = { id, type: 'text', label: id };
      }
      seen.set(id, q);
    }
  }
  return [...seen.values()];
}

/** Devuelve las preguntas a analizar: las de la config o, si faltan, inferidas. */
export function questionsForAnalysis(entry: SurveyEntry): SurveyQuestion[] {
  if (entry.config.questions && entry.config.questions.length > 0) return entry.config.questions;
  return inferQuestionsFromResponses(entry.responses);
}

// ─── Validación del editor ─────────────────────────────────────────────────────

export function validateQuestions(questions: SurveyQuestion[]): string[] {
  const errors: string[] = [];
  if (questions.length === 0) errors.push('Añade al menos una pregunta.');
  const ids = new Set<string>();
  questions.forEach((q, i) => {
    const n = `Pregunta ${i + 1}`;
    if (!q.id.trim()) errors.push(`${n}: falta el identificador.`);
    else if (ids.has(q.id)) errors.push(`${n}: el id "${q.id}" está repetido.`);
    ids.add(q.id);
    if (!q.label.trim()) errors.push(`${n}: falta el enunciado.`);
    if (q.type === 'scale') {
      const min = q.min ?? 0;
      const max = q.max ?? 10;
      if (min >= max) errors.push(`${n}: el mínimo debe ser menor que el máximo.`);
    }
    if (q.type === 'single' || q.type === 'multi') {
      const opts = q.options ?? [];
      if (opts.length < 2) errors.push(`${n}: necesita al menos 2 opciones.`);
      const vals = new Set<string>();
      opts.forEach((o) => {
        if (!o.value.trim()) errors.push(`${n}: hay una opción sin valor.`);
        if (vals.has(o.value)) errors.push(`${n}: el valor de opción "${o.value}" está repetido.`);
        vals.add(o.value);
      });
    }
  });
  return errors;
}

/** Genera un id de pregunta único a partir del enunciado. */
export function makeQuestionId(label: string, existing: string[]): string {
  const base = slugify(label).slice(0, 40) || 'pregunta';
  let id = base;
  let i = 2;
  while (existing.includes(id)) {
    id = `${base}-${i++}`;
  }
  return id;
}

// ─── Exportación CSV / Excel ─────────────────────────────────────────────────

const META_COLUMNS: { key: keyof SurveyResponse; label: string }[] = [
  { key: 'userName', label: 'Nombre' },
  { key: 'userProfileType', label: 'Perfil' },
  { key: 'userDelegation', label: 'Delegación' },
  { key: 'platform', label: 'Plataforma' },
  { key: 'reportedAt', label: 'Fecha' },
  { key: 'deviceId', label: 'deviceId' },
  { key: 'userId', label: 'userId' },
];

function formatAnswerForExport(q: SurveyQuestion, value: AnswerValue | undefined): string {
  if (value === undefined || value === null) return '';
  if (q.type === 'multi' && Array.isArray(value)) return value.join('; ');
  if (q.type === 'yesno' && typeof value === 'boolean') return value ? 'Sí' : 'No';
  return String(value);
}

function buildMatrix(entry: SurveyEntry, questions: SurveyQuestion[]): { headers: string[]; rows: string[][] } {
  const headers = [...META_COLUMNS.map((c) => c.label), ...questions.map((q) => q.id)];
  const rows = entry.responses.map((r) => {
    const meta = META_COLUMNS.map((c) => {
      const v = r[c.key];
      return v == null ? '' : String(v);
    });
    const answers = questions.map((q) => formatAnswerForExport(q, getAnswer(r, q.id)));
    return [...meta, ...answers];
  });
  return { headers, rows };
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function exportResponsesCSV(entry: SurveyEntry, questions: SurveyQuestion[]): void {
  const { headers, rows } = buildMatrix(entry, questions);
  const lines = [headers, ...rows].map((row) => row.map(csvCell).join(','));
  // BOM para que Excel respete UTF-8.
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, `${entry.id}-respuestas.csv`);
}

export function exportResponsesXLS(entry: SurveyEntry, questions: SurveyQuestion[]): void {
  const { headers, rows } = buildMatrix(entry, questions);
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const thead = `<tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr>`;
  const tbody = rows.map((row) => `<tr>${row.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('');
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8" /></head><body><table border="1">${thead}${tbody}</table></body></html>`;
  const blob = new Blob(['﻿' + html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  triggerDownload(blob, `${entry.id}-respuestas.xls`);
}

// ─── Fechas ─────────────────────────────────────────────────────────────────

export function formatDateTime(value: number | string | undefined): string {
  if (value == null) return '—';
  const d = typeof value === 'number' ? new Date(value) : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDate(value: number | string | undefined): string {
  if (value == null) return '—';
  const d = typeof value === 'number' ? new Date(value) : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** epoch ms → valor para <input type="datetime-local"> (hora local). */
export function msToLocalInput(ms: number | undefined): string {
  if (ms == null) return '';
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** valor de <input type="datetime-local"> → epoch ms. */
export function localInputToMs(value: string): number | undefined {
  if (!value) return undefined;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? undefined : ms;
}

/** Tipo de encuesta legible. */
export const SURVEY_CLASS_LABELS: Record<SurveyClass, string> = {
  event: 'Evaluación de evento',
  app: 'Evaluación de la app',
  generic: 'Encuesta genérica',
};
