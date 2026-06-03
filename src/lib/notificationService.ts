import { get, ref, type Database } from 'firebase/database';

const API_BASE = '/api/notifications';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ActionButton {
  text: string;
  url: string;
  isInternal?: boolean; // true = la url es una ruta interna de la app (router)
}

export interface SendNotificationRequest {
  title: string;
  body: string;
  category: string;
  priority: 'default' | 'normal' | 'high';
  icon?: string;
  imageUrl?: string;
  internalRoute?: string;
  actionButton?: ActionButton;
  // Segmentación por "topics" (la app guarda un array topics[] por token).
  // Si se envían varios, el token debe contenerlos TODOS (AND). Vacío = a todos.
  topics?: string[];
}

export interface SendNotificationResponse {
  notificationId: string;
  status: string;
  totalTokens: number;
  sentCount: number;
  failedCount: number;
  invalidTokensCleaned: number;
  sentAt: string;
  message?: string;
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

export interface ScheduleNotificationRequest extends SendNotificationRequest {
  // ISO 8601 instant (UTC) at which the notification should be sent.
  scheduledFor: string;
  createdBy?: string;
}

export interface ScheduledNotification {
  id: string;
  title: string;
  body: string;
  category: string;
  priority: 'default' | 'normal' | 'high';
  icon?: string;
  imageUrl?: string;
  internalRoute?: string;
  actionButton?: ActionButton | null;
  topics?: string[];
  scheduledFor: string;
  status: 'scheduled' | 'processing' | 'sent' | 'cancelled' | 'failed';
  createdAt: string;
  createdBy: string | null;
  sentNotificationId: string | null;
  error: string | null;
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
  actionButton: ActionButton | null;
  topics: string[];
  status: string;
  createdAt: string;
  sentAt: string | null;
  totalTokens: number;
  sentCount: number;
  failedCount: number;
  invalidTokens: number;
}

// ─── Send notification (delegates to Vercel serverless function) ─────────────

export async function sendNotification(data: SendNotificationRequest): Promise<SendNotificationResponse> {
  const res = await fetch(`${API_BASE}/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error((err as { error: string }).error || `Server error: ${res.status}`);
  }

  return res.json();
}

// ─── Scheduled notifications ─────────────────────────────────────────────────

// Stores a notification to be dispatched later by the Vercel Cron processor.
export async function scheduleNotification(
  data: ScheduleNotificationRequest,
): Promise<{ id: string; status: string; scheduledFor: string }> {
  const res = await fetch(`${API_BASE}/schedule`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error((err as { error: string }).error || `Server error: ${res.status}`);
  }

  return res.json();
}

// Cancels a pending (status === 'scheduled') notification.
export async function cancelScheduledNotification(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/schedule?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error((err as { error: string }).error || `Server error: ${res.status}`);
  }
}

// Reads the scheduled-notifications queue directly from Firebase (same pattern
// as getStats / the history listener), sorted by scheduled time ascending.
export async function getScheduledNotifications(db: Database): Promise<ScheduledNotification[]> {
  const snap = await get(ref(db, '/scheduledNotifications'));
  const val = snap.val() as Record<string, ScheduledNotification> | null;
  if (!val || typeof val !== 'object') return [];
  return Object.values(val).sort(
    (a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime(),
  );
}

// ─── Stats (client-side, reads Firebase directly like other sections) ────────

interface PushTokenRecord {
  token: string;
  platform?: 'ios' | 'android' | 'web';
  lastActive?: string;
}

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
