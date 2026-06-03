// Shared push-notification logic used by both the immediate-send endpoint
// (api/notifications/send.ts) and the scheduled processor that the Vercel Cron
// invokes (api/notifications/process-scheduled.ts).
//
// Keeping the Expo + Firebase plumbing here avoids duplicating the chunking,
// topic-filtering and invalid-token cleanup in two places.

const FIREBASE_DB_URL = process.env.VITE_FIREBASE_DATABASE_URL || process.env.FIREBASE_DATABASE_URL || '';
const EXPO_PUSH_API = 'https://exp.host/--/api/v2/push/send';
const CHUNK_SIZE = 100;

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
  // Segmentation: the app stores a pre-computed union of profile + delegation topics.
  topics?: string[];
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
  category?: string;
  priority?: 'default' | 'normal' | 'high';
  icon?: string;
  imageUrl?: string;
  internalRoute?: string;
  actionButton?: ActionButton | null;
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
  return null;
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
  const actionButton = body.actionButton && body.actionButton.text && body.actionButton.url
    ? body.actionButton
    : null;

  // Save the "sending" notification record to Firebase.
  const notificationRecord = {
    notificationId,
    title: body.title,
    body: body.body,
    category,
    priority: body.priority || 'default',
    icon: body.icon || null,
    imageUrl: body.imageUrl || null,
    internalRoute: body.internalRoute || null,
    actionButton,
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

  // Filter by topics: a token matches only if its topics[] contains ALL the
  // requested topics (AND). No topics requested = send to everyone.
  let tokenEntries = Object.entries(pushTokensRaw);

  if (topics.length > 0) {
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
      const msg: ExpoPushMessage & { _tokenKey: string } = {
        _tokenKey: t.key,
        to: t.token,
        title: body.title,
        body: body.body,
        data: {
          id: notificationId, // critical: used by the app to dedupe / mark read
          category,
          internalRoute: body.internalRoute || null,
          icon: body.icon || null,
          imageUrl: body.imageUrl || null,
          actionButton,
        },
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
