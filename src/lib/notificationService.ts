import { get, ref, set, remove, update, type Database } from 'firebase/database';

// ─── API Config ──────────────────────────────────────────────────────────────

// The Expo Push proxy runs on Vercel, separate from the Lovable-hosted panel.
// CORS is enabled on the Vercel function to allow cross-origin requests.
const VERCEL_API_BASE = import.meta.env.VITE_VERCEL_API_URL || 'https://mcmpanel.vercel.app';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ActionButton {
  text: string;
  url: string;
}

export interface SendNotificationInput {
  title: string;
  body: string;
  category: string;
  priority: 'default' | 'normal' | 'high';
  icon?: string;
  imageUrl?: string;
  internalRoute?: string;
  actionButtons?: ActionButton[];
  recipientType?: string;
  delegacion?: string;
}

export interface NotificationRecord {
  notificationId: string;
  title: string;
  body: string;
  category: string;
  priority: string;
  icon: string | null;
  imageUrl: string | null;
  internalRoute: string | null;
  actionButtons: ActionButton[];
  recipientType: string | null;
  delegacion: string | null;
  status: string;
  createdAt: string;
  sentAt: string | null;
  totalTokens: number;
  sentCount: number;
  failedCount: number;
  invalidTokens: number;
}

export interface NotificationStats {
  devices: {
    total: number;
    active24h: number;
    active7d: number;
    platforms: Record<string, number>;
  };
  notifications: {
    total: number;
    sent: number;
  };
}

interface PushTokenRecord {
  token: string;
  platform?: 'ios' | 'android' | 'web';
  lastActive?: string;
  delegacion?: string;
  userType?: string;
}

interface ExpoPushTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

// ─── Stats (client-side, from Firebase directly) ─────────────────────────────

export async function getStats(db: Database): Promise<NotificationStats> {
  const [pushTokensSnap, notificationsSnap] = await Promise.all([
    get(ref(db, '/pushTokens')),
    get(ref(db, '/notifications')),
  ]);

  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  let totalDevices = 0;
  let active24h = 0;
  let active7d = 0;
  const platforms: Record<string, number> = { ios: 0, android: 0, web: 0, unknown: 0 };

  const pushTokensVal = pushTokensSnap.val() as Record<string, PushTokenRecord> | null;
  if (pushTokensVal && typeof pushTokensVal === 'object') {
    const entries = Object.values(pushTokensVal);
    totalDevices = entries.length;

    for (const record of entries) {
      const platform = (typeof record === 'object' && record.platform) || 'unknown';
      platforms[platform] = (platforms[platform] || 0) + 1;

      if (typeof record === 'object' && record.lastActive) {
        const lastActive = new Date(record.lastActive);
        if (lastActive >= last24h) active24h++;
        if (lastActive >= last7d) active7d++;
      }
    }
  }

  let totalNotifications = 0;
  let totalSent = 0;

  const notificationsVal = notificationsSnap.val() as Record<string, NotificationRecord> | null;
  if (notificationsVal && typeof notificationsVal === 'object') {
    const notifications = Object.values(notificationsVal);
    totalNotifications = notifications.length;
    totalSent = notifications.filter((n) => n.status === 'completed').length;
  }

  return {
    devices: { total: totalDevices, active24h, active7d, platforms },
    notifications: { total: totalNotifications, sent: totalSent },
  };
}

// ─── Send notification (orchestrates Firebase + Expo proxy) ──────────────────

export async function sendNotification(
  db: Database,
  input: SendNotificationInput,
): Promise<{
  notificationId: string;
  totalTokens: number;
  sentCount: number;
  failedCount: number;
  invalidTokensCleaned: number;
}> {
  const notificationId = crypto.randomUUID();

  // 1. Save notification record to Firebase
  const record: NotificationRecord = {
    notificationId,
    title: input.title,
    body: input.body,
    category: input.category || 'general',
    priority: input.priority || 'normal',
    icon: input.icon || null,
    imageUrl: input.imageUrl || null,
    internalRoute: input.internalRoute || null,
    actionButtons: input.actionButtons || [],
    recipientType: input.recipientType || null,
    delegacion: input.delegacion || null,
    status: 'sending',
    createdAt: new Date().toISOString(),
    sentAt: null,
    totalTokens: 0,
    sentCount: 0,
    failedCount: 0,
    invalidTokens: 0,
  };

  await set(ref(db, `/notifications/${notificationId}`), record);

  // 2. Read push tokens from Firebase
  const tokensSnap = await get(ref(db, '/pushTokens'));
  const tokensVal = tokensSnap.val() as Record<string, PushTokenRecord | string> | null;

  if (!tokensVal || typeof tokensVal !== 'object') {
    await update(ref(db, `/notifications/${notificationId}`), {
      status: 'completed',
      sentAt: new Date().toISOString(),
      totalTokens: 0,
    });
    return { notificationId, totalTokens: 0, sentCount: 0, failedCount: 0, invalidTokensCleaned: 0 };
  }

  // 3. Filter tokens (future: recipientType, delegacion)
  let tokenEntries = Object.entries(tokensVal);

  if (input.recipientType) {
    tokenEntries = tokenEntries.filter(([, r]) => typeof r === 'object' && r.userType === input.recipientType);
  }
  if (input.delegacion) {
    tokenEntries = tokenEntries.filter(([, r]) => typeof r === 'object' && r.delegacion === input.delegacion);
  }

  const tokens = tokenEntries
    .map(([key, r]) => ({
      key,
      token: typeof r === 'string' ? r : r.token,
    }))
    .filter((t) => t.token && t.token.startsWith('ExponentPushToken['));

  // 4. Build Expo push messages
  const messages = tokens.map((t) => ({
    to: t.token,
    title: input.title,
    body: input.body,
    data: {
      id: notificationId,
      category: input.category || 'general',
      priority: input.priority || 'normal',
      internalRoute: input.internalRoute || null,
      icon: input.icon || null,
      imageUrl: input.imageUrl || null,
      actionButtons: input.actionButtons || [],
    },
    categoryId: input.category || 'general',
    priority: input.priority || 'default',
    sound: 'default' as const,
  }));

  await update(ref(db, `/notifications/${notificationId}`), { totalTokens: messages.length });

  if (messages.length === 0) {
    await update(ref(db, `/notifications/${notificationId}`), {
      status: 'completed',
      sentAt: new Date().toISOString(),
    });
    return { notificationId, totalTokens: 0, sentCount: 0, failedCount: 0, invalidTokensCleaned: 0 };
  }

  // 5. Call Expo proxy (Vercel serverless function)
  const response = await fetch(`${VERCEL_API_BASE}/api/notifications/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error((err as { error: string }).error || `Server error: ${response.status}`);
  }

  const { tickets } = await response.json() as { tickets: ExpoPushTicket[] };

  // 6. Process results
  let sentCount = 0;
  let failedCount = 0;
  const invalidTokenKeys: string[] = [];

  for (let i = 0; i < tickets.length; i++) {
    if (tickets[i].status === 'ok') {
      sentCount++;
    } else {
      failedCount++;
      if (tickets[i].details?.error === 'DeviceNotRegistered') {
        invalidTokenKeys.push(tokens[i].key);
      }
    }
  }

  // 7. Clean invalid tokens from Firebase
  for (const key of invalidTokenKeys) {
    try {
      await remove(ref(db, `/pushTokens/${key}`));
    } catch {
      // Best effort cleanup
    }
  }

  // 8. Update notification record
  const sentAt = new Date().toISOString();
  await update(ref(db, `/notifications/${notificationId}`), {
    status: 'completed',
    sentAt,
    sentCount,
    failedCount,
    invalidTokens: invalidTokenKeys.length,
  });

  return {
    notificationId,
    totalTokens: messages.length,
    sentCount,
    failedCount,
    invalidTokensCleaned: invalidTokenKeys.length,
  };
}
