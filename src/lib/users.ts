import { getDB } from '@/lib/firebase';
import { ref, set } from 'firebase/database';

/**
 * Helpers to read and normalise the `users` node of the Realtime Database.
 *
 * The mobile app mirrors each authenticated account under `users/{uid}`. The
 * exact shape isn't strictly enforced, so this parser is intentionally
 * defensive: it accepts several common spellings for each field (e.g.
 * `displayName` / `name` / `fullName`, `photoURL` / `photo`) and infers the
 * sign-in provider from whatever provider metadata is available.
 *
 * The only field this panel writes is `users/{uid}/isAdmin` (a boolean), which
 * grants a user administrator privileges in the app.
 */

export type AuthProvider = 'google' | 'apple' | 'email' | 'phone' | 'facebook' | 'unknown';

export interface PanelUser {
  /** Firebase Auth uid — the key under `/users`. */
  uid: string;
  email: string | null;
  /** Best available human-readable name. */
  name: string | null;
  photoURL: string | null;
  isAdmin: boolean;
  /** Sign-in providers detected from the stored metadata. */
  providers: AuthProvider[];
  /** Epoch millis if we could parse a creation timestamp, else null. */
  createdAt: number | null;
  /** Epoch millis of last sign-in / activity if available, else null. */
  lastLogin: number | null;
  /** MCM profile type (e.g. "monitor"), from `mcm.profileType`. */
  profileType: string | null;
  /** MCM delegation id (e.g. "madrid"), from `mcm.delegationId`. */
  delegationId: string | null;
  /** The raw node, kept around for the "ver datos" debug view. */
  raw: Record<string, unknown>;
}

/** Read a value from `obj` or from a nested object under `obj[nestedKey]`. */
function nested(obj: Record<string, unknown>, key: string): Record<string, unknown> | null {
  const value = obj[key];
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

/** Map a raw providerId string (e.g. "google.com") to our enum. */
function normaliseProviderId(id: string): AuthProvider {
  const v = id.toLowerCase();
  if (v.includes('google')) return 'google';
  if (v.includes('apple')) return 'apple';
  if (v.includes('facebook')) return 'facebook';
  if (v.includes('phone')) return 'phone';
  if (v.includes('password') || v.includes('email')) return 'email';
  return 'unknown';
}

/**
 * Collect the sign-in providers from the many shapes Firebase data can take:
 * a `providerData` array, a single `providerId` / `provider` string, or a
 * `providers` array/map of ids.
 */
function detectProviders(node: Record<string, unknown>): AuthProvider[] {
  const found = new Set<AuthProvider>();

  const consider = (raw: unknown) => {
    if (typeof raw === 'string' && raw.trim()) found.add(normaliseProviderId(raw));
  };

  // providerData: [{ providerId: "google.com", ... }, ...]
  const providerData = node.providerData;
  if (Array.isArray(providerData)) {
    for (const entry of providerData) {
      if (entry && typeof entry === 'object') {
        consider((entry as Record<string, unknown>).providerId);
        consider((entry as Record<string, unknown>).provider);
      } else {
        consider(entry);
      }
    }
  }

  // providers: ["google.com"] or { "google.com": true }
  const providers = node.providers;
  if (Array.isArray(providers)) providers.forEach(consider);
  else if (providers && typeof providers === 'object') {
    Object.keys(providers as Record<string, unknown>).forEach(consider);
  }

  // Single string fields.
  consider(node.providerId);
  consider(node.provider);
  consider(node.signInProvider);

  found.delete('unknown');
  return [...found];
}

function parseTimestamp(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    // Heuristic: treat seconds as millis if the value looks like seconds.
    return value < 1e12 ? value * 1000 : value;
  }
  if (typeof value === 'string') {
    const ms = Date.parse(value);
    if (!Number.isNaN(ms)) return ms;
  }
  return null;
}

function parseTimestampFrom(node: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const ms = parseTimestamp(node[key]);
    if (ms !== null) return ms;
  }
  return null;
}

/** Normalise a single `users/{uid}` node into a `PanelUser`. */
export function parseUser(uid: string, raw: unknown): PanelUser {
  const node: Record<string, unknown> =
    raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};

  // Timestamps and profile info can live at the top level or nested under
  // `meta` / `mcm` (the shape used by the MCM app).
  const meta = nested(node, 'meta') ?? {};
  const mcm = nested(node, 'mcm') ?? {};

  return {
    uid,
    email: pickString(node, ['email', 'mail', 'correo']),
    name: pickString(node, ['displayName', 'name', 'fullName', 'nombre', 'username']),
    photoURL: pickString(node, ['photoURL', 'photoUrl', 'photo', 'avatar', 'picture']),
    isAdmin: node.isAdmin === true,
    providers: detectProviders(node),
    createdAt:
      parseTimestampFrom(node, ['createdAt', 'creationTime', 'created']) ??
      parseTimestampFrom(meta, ['createdAt', 'creationTime', 'created']),
    lastLogin:
      parseTimestampFrom(node, ['lastLogin', 'lastLoginAt', 'lastSignInTime', 'lastSeen', 'lastSeenAt']) ??
      parseTimestampFrom(meta, ['lastSeenAt', 'lastSeen', 'lastLogin', 'lastLoginAt', 'lastSignInTime']),
    profileType: pickString(mcm, ['profileType', 'profile', 'type']),
    delegationId: pickString(mcm, ['delegationId', 'delegation', 'delegacion']),
    raw: node,
  };
}

/** Normalise the whole `users` node into a sorted list. */
export function parseUsers(usersNode: unknown): PanelUser[] {
  if (!usersNode || typeof usersNode !== 'object') return [];
  return Object.entries(usersNode as Record<string, unknown>).map(([uid, raw]) =>
    parseUser(uid, raw),
  );
}

/** Write the admin flag for a single user. Returns a promise that resolves on success. */
export function setUserAdmin(uid: string, isAdmin: boolean): Promise<void> {
  const db = getDB();
  return set(ref(db, `users/${uid}/isAdmin`), isAdmin);
}

export const PROVIDER_META: Record<AuthProvider, { label: string; className: string }> = {
  google: { label: 'Google', className: 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400' },
  apple: { label: 'Apple', className: 'border-foreground/20 bg-foreground/10 text-foreground' },
  facebook: { label: 'Facebook', className: 'border-blue-600/30 bg-blue-600/10 text-blue-600 dark:text-blue-400' },
  email: { label: 'Email', className: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  phone: { label: 'Teléfono', className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  unknown: { label: 'Otro', className: 'border-border bg-muted text-muted-foreground' },
};

/** Initials for the avatar fallback, from name or email. */
export function initialsFor(user: PanelUser): string {
  const source = user.name || user.email || user.uid;
  const parts = source.replace(/@.*/, '').split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Format an epoch-millis timestamp for display, or `—`. */
export function formatUserDate(ms: number | null): string {
  if (ms === null) return '—';
  try {
    return new Date(ms).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return '—';
  }
}
