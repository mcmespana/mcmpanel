// Segmentación de destinatarios de notificaciones.
//
// Un envío puede combinar hasta cuatro EJES independientes (todos opcionales):
//   - todos        → el token tiene el topic "general" (todos los onboarded)
//   - perfiles[]   → token.profileType ∈ perfiles  (OR dentro del eje)
//   - delegaciones[] → token.delegationId ∈ delegaciones  (OR dentro del eje)
//   - eventId      → el token tiene el topic "event-<eventId>" (suscripción opt-in)
//
// Entre ejes distintos se combinan según `match`:
//   - 'all' (AND, por defecto) → el token debe cumplir TODOS los ejes activos.
//   - 'any' (OR)               → el token cumple CUALQUIER eje activo.
// Un eje sin selección NO cuenta. Si no hay ningún eje activo → va a TODOS.
//
// IMPORTANTE: esta lógica está duplicada (idéntica) en api/_lib/push.ts para el
// filtrado del lado servidor. Si cambias el algoritmo aquí, cámbialo allí también.

import type { ProfileType } from '@/types/profileConfig';

export type AudienceMatch = 'all' | 'any';

export interface AudienceFilter {
  /** Cómo combinar los ejes activos entre sí. 'all' = AND, 'any' = OR. */
  match: AudienceMatch;
  /** Eje "todos": tokens con el topic "general". */
  todos: boolean;
  /** Eje perfil: profileType del token ∈ esta lista. */
  perfiles: ProfileType[];
  /** Eje delegación: delegationId del token ∈ esta lista. */
  delegaciones: string[];
  /** Eje evento: token suscrito al topic "event-<eventId>". null = eje inactivo. */
  eventId: string | null;
}

/** Forma mínima de un token de /pushTokens necesaria para segmentar. */
export interface SegmentTokenRecord {
  token?: string;
  profileType?: ProfileType | null;
  delegationId?: string | null;
  topics?: string[];
}

export const EMPTY_AUDIENCE: AudienceFilter = {
  match: 'all',
  todos: false,
  perfiles: [],
  delegaciones: [],
  eventId: null,
};

/** ¿Hay al menos un eje activo? Si no, el envío va a todos los dispositivos. */
export function audienceHasAxis(a: AudienceFilter): boolean {
  return a.todos || a.perfiles.length > 0 || a.delegaciones.length > 0 || !!a.eventId;
}

/** Topic que identifica la suscripción opt-in a un evento concreto. */
export function eventTopic(eventId: string): string {
  return `event-${eventId}`;
}

/**
 * Evalúa si un token concreto cumple el filtro de audiencia.
 * Acepta también el formato antiguo (string suelto) o null sin romperse.
 */
export function tokenMatchesAudience(
  record: SegmentTokenRecord | string | null | undefined,
  a: AudienceFilter,
): boolean {
  const r: SegmentTokenRecord = record && typeof record === 'object' ? record : {};
  const topics = Array.isArray(r.topics) ? r.topics : [];

  const axes: boolean[] = [];
  if (a.todos) axes.push(topics.includes('general'));
  if (a.perfiles.length > 0) {
    axes.push(!!r.profileType && a.perfiles.includes(r.profileType));
  }
  if (a.delegaciones.length > 0) {
    axes.push(!!r.delegationId && a.delegaciones.includes(r.delegationId));
  }
  if (a.eventId) axes.push(topics.includes(eventTopic(a.eventId)));

  if (axes.length === 0) return true; // sin ejes activos → a todos
  return a.match === 'any' ? axes.some(Boolean) : axes.every(Boolean);
}

/**
 * Sanea/normaliza una audiencia que llega de fuera (payload, registro guardado).
 * Devuelve null cuando no hay ningún eje activo (= "a todos", sin filtro).
 */
export function normalizeAudience(
  input?: Partial<AudienceFilter> | null,
): AudienceFilter | null {
  if (!input || typeof input !== 'object') return null;
  const audience: AudienceFilter = {
    match: input.match === 'any' ? 'any' : 'all',
    todos: !!input.todos,
    perfiles: Array.isArray(input.perfiles) ? input.perfiles.filter(Boolean) : [],
    delegaciones: Array.isArray(input.delegaciones)
      ? input.delegaciones.filter(Boolean)
      : [],
    eventId:
      typeof input.eventId === 'string' && input.eventId.trim()
        ? input.eventId.trim()
        : null,
  };
  return audienceHasAxis(audience) ? audience : null;
}

const PROFILE_LABELS: Record<ProfileType, string> = {
  familia: 'Familias',
  monitor: 'Monitores',
  miembro: 'Miembros',
};

export interface SummarizeOptions {
  /** Traduce un delegationId a su etiqueta legible (cae al propio id si no hay). */
  delegationLabel?: (id: string) => string;
  /** Traduce un eventId a su etiqueta legible (cae al propio id si no hay). */
  eventLabel?: (id: string) => string;
}

/**
 * Descripción legible de la audiencia, p.ej. «(Familias o Monitores) y Madrid».
 * Devuelve "Todos los dispositivos" cuando no hay ningún eje activo.
 */
export function summarizeAudience(
  a: AudienceFilter | null | undefined,
  opts: SummarizeOptions = {},
): string {
  if (!a || !audienceHasAxis(a)) return 'Todos los dispositivos';

  const delLabel = opts.delegationLabel ?? ((id) => id);
  const evLabel = opts.eventLabel ?? ((id) => id);
  const between = a.match === 'any' ? ' o ' : ' y ';

  const parts: string[] = [];
  if (a.todos) parts.push('Todos (general)');
  if (a.perfiles.length > 0) {
    const inner = a.perfiles.map((p) => PROFILE_LABELS[p] ?? p).join(' o ');
    parts.push(a.perfiles.length > 1 ? `(${inner})` : inner);
  }
  if (a.delegaciones.length > 0) {
    const inner = a.delegaciones.map(delLabel).join(' o ');
    parts.push(a.delegaciones.length > 1 ? `(${inner})` : inner);
  }
  if (a.eventId) parts.push(evLabel(a.eventId));

  return parts.join(between);
}
