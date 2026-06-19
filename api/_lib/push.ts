// Shared push-notification logic used by both the immediate-send endpoint
// (api/notifications/send.ts) and the scheduled processor that the Vercel Cron
// invokes (api/notifications/process-scheduled.ts).
//
// Keeping the Expo + Firebase plumbing here avoids duplicating the chunking,
// topic-filtering and invalid-token cleanup in two places.

const FIREBASE_DB_URL = process.env.VITE_FIREBASE_DATABASE_URL || process.env.FIREBASE_DATABASE_URL || '';
const EXPO_PUSH_API = 'https://exp.host/--/api/v2/push/send';
const CHUNK_SIZE = 100;

// In-app action buttons: the app renders at most 3 (MAX_ACTION_BUTTONS in
// mcm-app/utils/notificationRoutes.ts). Keep the panel/app limit in sync.
export const MAX_ACTION_BUTTONS = 3;
// bodyLong soft limit (mirrors NOTIFICACIONES_CONTRATO.md §3.bis).
export const MAX_BODY_LONG = 2000;
// Above this size we keep bodyLong only in the Firebase record and drop it from
// the Expo `data` payload to stay clear of the ~4 KB APNs/FCM limit. The app
// recovers it from /notifications/<id> when the notification is opened.
const BODY_LONG_DATA_MAX = 1500;

// iOS notification categories actually registered in the MCM App. Only these
// produce native action buttons; any other value is ignored by the app.
const IOS_CATEGORIES = new Set(['general', 'eventos', 'fotos']);

// Maps the business category (data.category) to a registered iOS categoryId.
export function resolveCategoryId(category: string): string {
  if (IOS_CATEGORIES.has(category)) return category;
  if (category === 'celebraciones') return 'eventos';
  return 'general';
}

export function getFirebaseDbUrl(): string {
  return FIREBASE_DB_URL;
}

// ─── Firebase REST helpers ───────────────────────────────────────────────────

export async function firebaseGet<T = unknown>(path: string): Promise<T | null> {
  const res = await fetch(`${FIREBASE_DB_URL}${path}.json`);
  if (!res.ok) throw new Error(`Firebase GET ${path} failed: ${res.status}`);
  return res.json() as Promise<T | null>;
}

export async function firebaseSet(path: string, data: unknown): Promise<void> {
  const res = await fetch(`${FIREBASE_DB_URL}${path}.json`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Firebase SET ${path} failed: ${res.status}`);
}

export async function firebasePatch(path: string, data: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${FIREBASE_DB_URL}${path}.json`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Firebase PATCH ${path} failed: ${res.status}`);
}

export async function firebaseDelete(path: string): Promise<void> {
  const res = await fetch(`${FIREBASE_DB_URL}${path}.json`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Firebase DELETE ${path} failed: ${res.status}`);
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PushTokenRecord {
  token: string;
  platform?: 'ios' | 'android' | 'web';
  lastActive?: string;
  // Segmentation fields written by the app per device.
  profileType?: 'familia' | 'monitor' | 'miembro' | null;
  delegationId?: string | null;
  // Pre-computed union of profile + delegation topics + subscribed "event-<id>".
  topics?: string[];
}

// ─── Audience segmentation ─────────────────────────────────────────────────--
//
// Mirror of src/lib/audience.ts (client). Keep both in sync: a send combines up
// to four optional axes (todos / perfiles / delegaciones / eventId). Within an
// axis the match is OR; between axes it's `match` ('all' = AND, 'any' = OR). An
// axis with no selection doesn't count; no active axis at all = send to everyone.

export type AudienceMatch = 'all' | 'any';

export interface AudienceFilter {
  match: AudienceMatch;
  todos: boolean;
  perfiles: string[];
  delegaciones: string[];
  eventId: string | null;
}

function audienceHasAxis(a: AudienceFilter): boolean {
  return a.todos || a.perfiles.length > 0 || a.delegaciones.length > 0 || !!a.eventId;
}

// Normalizes an incoming audience; returns null when no axis is active (= all).
export function normalizeAudience(input?: Partial<AudienceFilter> | null): AudienceFilter | null {
  if (!input || typeof input !== 'object') return null;
  const audience: AudienceFilter = {
    match: input.match === 'any' ? 'any' : 'all',
    todos: !!input.todos,
    perfiles: Array.isArray(input.perfiles) ? input.perfiles.filter(Boolean) : [],
    delegaciones: Array.isArray(input.delegaciones) ? input.delegaciones.filter(Boolean) : [],
    eventId: typeof input.eventId === 'string' && input.eventId.trim() ? input.eventId.trim() : null,
  };
  return audienceHasAxis(audience) ? audience : null;
}

export function tokenMatchesAudience(record: PushTokenRecord | string | null | undefined, a: AudienceFilter): boolean {
  const r: Partial<PushTokenRecord> = record && typeof record === 'object' ? record : {};
  const topics = Array.isArray(r.topics) ? r.topics : [];

  const axes: boolean[] = [];
  if (a.todos) axes.push(topics.includes('general'));
  if (a.perfiles.length > 0) axes.push(!!r.profileType && a.perfiles.includes(r.profileType));
  if (a.delegaciones.length > 0) axes.push(!!r.delegationId && a.delegaciones.includes(r.delegationId));
  if (a.eventId) axes.push(topics.includes(`event-${a.eventId}`));

  if (axes.length === 0) return true;
  return a.match === 'any' ? axes.some(Boolean) : axes.every(Boolean);
}

export interface ActionButton {
  text: string;
  url: string;
  isInternal?: boolean;
}

export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  categoryId?: string;
  priority?: 'default' | 'normal' | 'high';
  sound?: string;
  // Rich media: shows the image in the OS notification on Android (iOS needs a
  // Notification Service Extension, which the app does NOT have yet).
  richContent?: { image: string };
  mutableContent?: boolean;
}

export interface ExpoPushTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

// Canonical notification payload shared by immediate and scheduled sends.
export interface NotificationPayload {
  title: string;
  body: string;
  // Extended, scrollable description shown only in the in-app detail modal.
  // The app falls back to `body` when it's absent.
  bodyLong?: string;
  category?: string;
  priority?: 'default' | 'normal' | 'high';
  icon?: string;
  imageUrl?: string;
  internalRoute?: string;
  // Canonical format: up to 3 in-app action buttons.
  actionButtons?: ActionButton[];
  // Legacy single-button field. Still accepted for backwards compatibility and
  // merged into actionButtons; the panel sends only actionButtons now.
  actionButton?: ActionButton | null;
  // Canonical audience filter (4 axes + AND/OR). When present it drives token
  // filtering; `topics` is kept only for backwards compatibility.
  audience?: AudienceFilter | null;
  topics?: string[];
}

export interface DispatchResult {
  notificationId: string;
  status: 'completed';
  totalTokens: number;
  sentCount: number;
  failedCount: number;
  invalidTokensCleaned: number;
  sentAt: string;
  message?: string;
}

// ─── Validation ──────────────────────────────────────────────────────────────

// Returns an error message when the payload is invalid, or null when it's OK.
export function validateNotificationPayload(body: Partial<NotificationPayload>): string | null {
  if (!body.title || !body.body) return 'title and body are required';
  if (body.title.length > 50) return 'title must be 50 characters or less';
  if (body.body.length > 200) return 'body must be 200 characters or less';
  if (body.bodyLong && body.bodyLong.length > MAX_BODY_LONG) {
    return `bodyLong must be ${MAX_BODY_LONG} characters or less`;
  }
  if (body.actionButtons && !Array.isArray(body.actionButtons)) {
    return 'actionButtons must be an array';
  }
  return null;
}

// ─── Normalization ─────────────────────────────────────────────────────────--

// Collapses the canonical `actionButtons` array (and the legacy single
// `actionButton`) into a clean, deduplicated list of at most MAX_ACTION_BUTTONS.
// Mirrors the app's extractActionButtons(): buttons without a `url` are dropped,
// `text` defaults to "Ver", and `isInternal` is inferred from the url when not
// provided. Dedupe key is `url|text` (same as the app).
export function normalizeActionButtons(body: NotificationPayload): ActionButton[] {
  const collected: ActionButton[] = [];
  if (Array.isArray(body.actionButtons)) collected.push(...body.actionButtons);
  if (body.actionButton) collected.push(body.actionButton);

  const seen = new Set<string>();
  const result: ActionButton[] = [];

  for (const btn of collected) {
    if (!btn || typeof btn !== 'object') continue;
    const url = typeof btn.url === 'string' ? btn.url.trim() : '';
    if (!url) continue; // the app discards buttons without a url
    const text = typeof btn.text === 'string' && btn.text.trim() ? btn.text.trim() : 'Ver';
    const isInternal = typeof btn.isInternal === 'boolean'
      ? btn.isInternal
      : !/^https?:\/\//i.test(url);

    const key = `${url}|${text}`;
    if (seen.has(key)) continue;
    seen.add(key);

    result.push({ text, url, isInternal });
    if (result.length >= MAX_ACTION_BUTTONS) break;
  }

  return result;
}

// Returns the extended description to store, or null when it adds nothing
// (empty, or identical to `body` — in which case the app's fallback handles it).
export function normalizeBodyLong(body: NotificationPayload): string | null {
  const long = typeof body.bodyLong === 'string' ? body.bodyLong.trim() : '';
  if (!long) return null;
  if (long === body.body.trim()) return null;
  return long;
}

// ─── Expo helpers ────────────────────────────────────────────────────────────

async function sendExpoPushChunk(messages: ExpoPushMessage[]): Promise<ExpoPushTicket[]> {
  const res = await fetch(EXPO_PUSH_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip, deflate',
    },
    body: JSON.stringify(messages),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Expo Push API error ${res.status}: ${text}`);
  }

  const result = await res.json() as { data: ExpoPushTicket[] };
  return result.data;
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// ─── Core dispatch ───────────────────────────────────────────────────────────

// Sends the notification to all matching devices via Expo, writing a record to
// /notifications/{notificationId} (created here as "sending" and patched to
// "completed" with the final counts). Reusable from any endpoint.
export async function dispatchNotification(
  notificationId: string,
  body: NotificationPayload,
): Promise<DispatchResult> {
  const category = body.category || 'general';
  const topics = (body.topics || []).filter(Boolean);
  const audience = normalizeAudience(body.audience);
  const actionButtons = normalizeActionButtons(body);
  const bodyLong = normalizeBodyLong(body);

  // Save the "sending" notification record to Firebase. bodyLong always lives in
  // the record (the app reads it back from /notifications/<id> on open), even
  // when it's too big to ride along in the push `data`.
  const notificationRecord = {
    notificationId,
    title: body.title,
    body: body.body,
    bodyLong,
    category,
    priority: body.priority || 'default',
    icon: body.icon || null,
    imageUrl: body.imageUrl || null,
    internalRoute: body.internalRoute || null,
    actionButtons: actionButtons.length ? actionButtons : null,
    audience: audience || null,
    topics,
    status: 'sending',
    createdAt: new Date().toISOString(),
    sentAt: null,
    totalTokens: 0,
    sentCount: 0,
    failedCount: 0,
    invalidTokens: 0,
  };

  await firebaseSet(`/notifications/${notificationId}`, notificationRecord);

  // Read all push tokens.
  const pushTokensRaw = await firebaseGet<Record<string, PushTokenRecord>>('/pushTokens');

  if (!pushTokensRaw || typeof pushTokensRaw !== 'object') {
    const sentAt = new Date().toISOString();
    await firebasePatch(`/notifications/${notificationId}`, {
      status: 'completed',
      sentAt,
      totalTokens: 0,
    });
    return {
      notificationId,
      status: 'completed',
      totalTokens: 0,
      sentCount: 0,
      failedCount: 0,
      invalidTokensCleaned: 0,
      sentAt,
      message: 'No push tokens registered',
    };
  }

  // Filter recipients. Preferred path: the canonical `audience` filter (4 axes +
  // AND/OR). Legacy fallback: a flat `topics` list matched with AND. Neither =
  // send to everyone.
  let tokenEntries = Object.entries(pushTokensRaw);

  if (audience) {
    tokenEntries = tokenEntries.filter(([, record]) => tokenMatchesAudience(record, audience));
  } else if (topics.length > 0) {
    tokenEntries = tokenEntries.filter(([, record]) => {
      const tokenTopics = Array.isArray(record?.topics) ? record.topics : [];
      return topics.every((t) => tokenTopics.includes(t));
    });
  }

  const tokens = tokenEntries.map(([key, record]) => ({
    key,
    token: typeof record === 'string' ? record : record.token,
    platform: typeof record === 'object' ? record.platform : undefined,
  }));

  // Build Expo push messages (dedup ExponentPushToken values).
  const seenTokens = new Set<string>();
  const messages: (ExpoPushMessage & { _tokenKey: string })[] = tokens
    .filter((t) => {
      if (!t.token || !t.token.startsWith('ExponentPushToken[')) return false;
      if (seenTokens.has(t.token)) return false;
      seenTokens.add(t.token);
      return true;
    })
    .map((t) => {
      const data: Record<string, unknown> = {
        id: notificationId, // critical: used by the app to dedupe / mark read
        category,
        internalRoute: body.internalRoute || null,
        icon: body.icon || null,
        imageUrl: body.imageUrl || null,
        // Canonical: send only `actionButtons` (the app combines/dedupes if both
        // are present, but sending one format avoids confusion).
        actionButtons: actionButtons.length ? actionButtons : null,
      };
      // bodyLong rides along only when small enough; otherwise the app fetches
      // it from the Firebase record to keep the payload under the ~4 KB limit.
      if (bodyLong && bodyLong.length <= BODY_LONG_DATA_MAX) {
        data.bodyLong = bodyLong;
      }

      const msg: ExpoPushMessage & { _tokenKey: string } = {
        _tokenKey: t.key,
        to: t.token,
        title: body.title,
        body: body.body,
        data,
        categoryId: resolveCategoryId(category),
        priority: (body.priority || 'default') as 'default' | 'normal' | 'high',
        sound: 'default',
      };
      // Image: rendered in the OS notification on Android; on iOS it only shows
      // inside the app (via data.imageUrl) until an NSE is added.
      if (body.imageUrl) {
        msg.richContent = { image: body.imageUrl };
        msg.mutableContent = true;
      }
      return msg;
    });

  await firebasePatch(`/notifications/${notificationId}`, {
    totalTokens: messages.length,
  });

  // Send in chunks of 100.
  const chunks = chunkArray(messages, CHUNK_SIZE);
  let sentCount = 0;
  let failedCount = 0;
  const invalidTokenKeys: string[] = [];

  for (const chunk of chunks) {
    try {
      const tickets = await sendExpoPushChunk(
        chunk.map(({ _tokenKey, ...msg }) => msg)
      );

      for (let i = 0; i < tickets.length; i++) {
        const ticket = tickets[i];
        if (ticket.status === 'ok') {
          sentCount++;
        } else {
          failedCount++;
          if (ticket.details?.error === 'DeviceNotRegistered') {
            invalidTokenKeys.push(chunk[i]._tokenKey);
          }
        }
      }
    } catch (chunkError) {
      failedCount += chunk.length;
      console.error('Chunk send error:', chunkError);
    }
  }

  // Clean up invalid tokens.
  for (const key of invalidTokenKeys) {
    try {
      await firebaseDelete(`/pushTokens/${key}`);
    } catch (err) {
      console.error(`Failed to delete invalid token ${key}:`, err);
    }
  }

  // Update notification record with results.
  const sentAt = new Date().toISOString();
  await firebasePatch(`/notifications/${notificationId}`, {
    status: 'completed',
    sentAt,
    sentCount,
    failedCount,
    invalidTokens: invalidTokenKeys.length,
  });

  return {
    notificationId,
    status: 'completed',
    totalTokens: messages.length,
    sentCount,
    failedCount,
    invalidTokensCleaned: invalidTokenKeys.length,
    sentAt,
  };
}
