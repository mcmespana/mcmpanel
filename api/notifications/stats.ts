import type { VercelRequest, VercelResponse } from '@vercel/node';

const FIREBASE_DB_URL = process.env.VITE_FIREBASE_DATABASE_URL || process.env.FIREBASE_DATABASE_URL || '';

interface PushTokenRecord {
  token: string;
  platform?: 'ios' | 'android' | 'web';
  lastActive?: string;
  delegacion?: string;
  userType?: string;
}

async function firebaseGet<T = unknown>(path: string): Promise<T | null> {
  const res = await fetch(`${FIREBASE_DB_URL}${path}.json`);
  if (!res.ok) throw new Error(`Firebase GET ${path} failed: ${res.status}`);
  return res.json() as Promise<T | null>;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!FIREBASE_DB_URL) {
    res.status(500).json({ error: 'FIREBASE_DATABASE_URL not configured' });
    return;
  }

  try {
    const [pushTokensRaw, notificationsRaw] = await Promise.all([
      firebaseGet<Record<string, PushTokenRecord>>('/pushTokens'),
      firebaseGet<Record<string, { sentAt?: string; status?: string }>>('/notifications'),
    ]);

    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    let totalDevices = 0;
    let active24h = 0;
    let active7d = 0;
    const platformBreakdown: Record<string, number> = { ios: 0, android: 0, web: 0, unknown: 0 };

    if (pushTokensRaw && typeof pushTokensRaw === 'object') {
      const entries = Object.values(pushTokensRaw);
      totalDevices = entries.length;

      for (const record of entries) {
        const platform = (typeof record === 'object' && record.platform) || 'unknown';
        platformBreakdown[platform] = (platformBreakdown[platform] || 0) + 1;

        if (typeof record === 'object' && record.lastActive) {
          const lastActive = new Date(record.lastActive);
          if (lastActive >= last24h) active24h++;
          if (lastActive >= last7d) active7d++;
        }
      }
    }

    let totalNotifications = 0;
    let totalSent = 0;

    if (notificationsRaw && typeof notificationsRaw === 'object') {
      const notifications = Object.values(notificationsRaw);
      totalNotifications = notifications.length;
      totalSent = notifications.filter((n) => n.status === 'completed').length;
    }

    res.json({
      devices: {
        total: totalDevices,
        active24h,
        active7d,
        platforms: platformBreakdown,
      },
      notifications: {
        total: totalNotifications,
        sent: totalSent,
      },
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats', details: String(error) });
  }
}
