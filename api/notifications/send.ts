import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'node:crypto';

const FIREBASE_DB_URL = process.env.VITE_FIREBASE_DATABASE_URL || process.env.FIREBASE_DATABASE_URL || '';
const EXPO_PUSH_API = 'https://exp.host/--/api/v2/push/send';
const CHUNK_SIZE = 100;

// ─── Firebase REST helpers ───────────────────────────────────────────────────

async function firebaseGet<T = unknown>(path: string): Promise<T | null> {
  const res = await fetch(`${FIREBASE_DB_URL}${path}.json`);
  if (!res.ok) throw new Error(`Firebase GET ${path} failed: ${res.status}`);
  return res.json() as Promise<T | null>;
}

async function firebaseSet(path: string, data: unknown): Promise<void> {
  const res = await fetch(`${FIREBASE_DB_URL}${path}.json`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Firebase SET ${path} failed: ${res.status}`);
}

async function firebasePatch(path: string, data: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${FIREBASE_DB_URL}${path}.json`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Firebase PATCH ${path} failed: ${res.status}`);
}

async function firebaseDelete(path: string): Promise<void> {
  const res = await fetch(`${FIREBASE_DB_URL}${path}.json`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Firebase DELETE ${path} failed: ${res.status}`);
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface PushTokenRecord {
  token: string;
  platform?: 'ios' | 'android' | 'web';
  lastActive?: string;
  delegacion?: string;
  userType?: string;
}

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  categoryId?: string;
  priority?: 'default' | 'normal' | 'high';
  sound?: string;
}

interface ExpoPushTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

interface SendNotificationBody {
  title: string;
  body: string;
  category?: string;
  priority?: 'default' | 'normal' | 'high';
  icon?: string;
  imageUrl?: string;
  internalRoute?: string;
  actionButtons?: Array<{ text: string; url: string }>;
  recipientType?: string;
  delegacion?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

// ─── Handler ─────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!FIREBASE_DB_URL) {
    res.status(500).json({ error: 'FIREBASE_DATABASE_URL not configured' });
    return;
  }

  try {
    const body = req.body as SendNotificationBody;

    if (!body.title || !body.body) {
      res.status(400).json({ error: 'title and body are required' });
      return;
    }

    if (body.title.length > 50) {
      res.status(400).json({ error: 'title must be 50 characters or less' });
      return;
    }

    if (body.body.length > 200) {
      res.status(400).json({ error: 'body must be 200 characters or less' });
      return;
    }

    const notificationId = crypto.randomUUID();

    // Save notification record to Firebase
    const notificationRecord = {
      notificationId,
      title: body.title,
      body: body.body,
      category: body.category || 'general',
      priority: body.priority || 'normal',
      icon: body.icon || null,
      imageUrl: body.imageUrl || null,
      internalRoute: body.internalRoute || null,
      actionButtons: body.actionButtons || [],
      recipientType: body.recipientType || null,
      delegacion: body.delegacion || null,
      status: 'sending',
      createdAt: new Date().toISOString(),
      sentAt: null,
      totalTokens: 0,
      sentCount: 0,
      failedCount: 0,
      invalidTokens: 0,
    };

    await firebaseSet(`/notifications/${notificationId}`, notificationRecord);

    // Read all push tokens
    const pushTokensRaw = await firebaseGet<Record<string, PushTokenRecord>>('/pushTokens');

    if (!pushTokensRaw || typeof pushTokensRaw !== 'object') {
      await firebasePatch(`/notifications/${notificationId}`, {
        status: 'completed',
        sentAt: new Date().toISOString(),
        totalTokens: 0,
      });

      res.json({
        notificationId,
        status: 'completed',
        totalTokens: 0,
        sentCount: 0,
        failedCount: 0,
        message: 'No push tokens registered',
      });
      return;
    }

    // Filter tokens (future: by recipientType, delegacion)
    let tokenEntries = Object.entries(pushTokensRaw);

    if (body.recipientType) {
      tokenEntries = tokenEntries.filter(([, record]) => record.userType === body.recipientType);
    }

    if (body.delegacion) {
      tokenEntries = tokenEntries.filter(([, record]) => record.delegacion === body.delegacion);
    }

    const tokens = tokenEntries.map(([key, record]) => ({
      key,
      token: typeof record === 'string' ? record : record.token,
      platform: typeof record === 'object' ? record.platform : undefined,
    }));

    // Build Expo push messages
    const seenTokens = new Set<string>();
    const messages: (ExpoPushMessage & { _tokenKey: string })[] = tokens
      .filter((t) => {
        if (!t.token || !t.token.startsWith('ExponentPushToken[')) return false;
        if (seenTokens.has(t.token)) return false;
        seenTokens.add(t.token);
        return true;
      })
      .map((t) => ({
        _tokenKey: t.key,
        to: t.token,
        title: body.title,
        body: body.body,
        data: {
          id: notificationId,
          category: body.category || 'general',
          priority: body.priority || 'normal',
          internalRoute: body.internalRoute || null,
          icon: body.icon || null,
          imageUrl: body.imageUrl || null,
          actionButtons: body.actionButtons || [],
        },
        categoryId: body.category || 'general',
        priority: (body.priority || 'default') as 'default' | 'normal' | 'high',
        sound: 'default',
      }));

    await firebasePatch(`/notifications/${notificationId}`, {
      totalTokens: messages.length,
    });

    // Send in chunks of 100
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

    // Clean up invalid tokens
    for (const key of invalidTokenKeys) {
      try {
        await firebaseDelete(`/pushTokens/${key}`);
      } catch (err) {
        console.error(`Failed to delete invalid token ${key}:`, err);
      }
    }

    // Update notification record with results
    const sentAt = new Date().toISOString();
    await firebasePatch(`/notifications/${notificationId}`, {
      status: 'completed',
      sentAt,
      sentCount,
      failedCount,
      invalidTokens: invalidTokenKeys.length,
    });

    res.json({
      notificationId,
      status: 'completed',
      totalTokens: messages.length,
      sentCount,
      failedCount,
      invalidTokensCleaned: invalidTokenKeys.length,
      sentAt,
    });
  } catch (error) {
    console.error('Send notification error:', error);
    res.status(500).json({ error: 'Failed to send notification', details: String(error) });
  }
}
