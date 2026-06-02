import { get, ref, type Database } from 'firebase/database';

const API_BASE = '/api/notifications';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ActionButton {
  text: string;
  url: string;
}

export interface SendNotificationRequest {
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

// ─── Stats (client-side, reads Firebase directly like other sections) ────────

interface PushTokenRecord {
  token: string;
  platform?: 'ios' | 'android' | 'web';
  lastActive?: string;
  userType?: string;
  delegacion?: string;
}

export interface FilterOptions {
  userTypes: string[];
  delegaciones: string[];
}

// Reads the distinct userType / delegacion values present in the registered
// push tokens, so the recipient filters only ever offer values that can match.
export async function getFilterOptions(db: Database): Promise<FilterOptions> {
  const snap = await get(ref(db, '/pushTokens'));
  const val = snap.val() as Record<string, PushTokenRecord> | null;

  const userTypes = new Set<string>();
  const delegaciones = new Set<string>();

  if (val && typeof val === 'object') {
    for (const record of Object.values(val)) {
      if (record && typeof record === 'object') {
        if (record.userType) userTypes.add(record.userType);
        if (record.delegacion) delegaciones.add(record.delegacion);
      }
    }
  }

  return {
    userTypes: [...userTypes].sort(),
    delegaciones: [...delegaciones].sort(),
  };
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
