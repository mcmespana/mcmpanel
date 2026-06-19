import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'node:crypto';
import {
  firebaseGet,
  firebaseSet,
  firebasePatch,
  getFirebaseDbUrl,
  normalizeActionButtons,
  normalizeAudience,
  normalizeBodyLong,
  validateNotificationPayload,
  type NotificationPayload,
} from '../_lib/push.js';

// A scheduled notification lives in /scheduledNotifications/{id} until the cron
// (api/notifications/process-scheduled.ts) picks it up at its scheduledFor time
// and dispatches it. It is NOT sent here — only stored.

interface ScheduleBody extends NotificationPayload {
  scheduledFor: string; // ISO 8601 instant (UTC) when it should be sent
  createdBy?: string;
}

export interface ScheduledNotification extends NotificationPayload {
  id: string;
  scheduledFor: string;
  status: 'scheduled' | 'processing' | 'sent' | 'cancelled' | 'failed';
  createdAt: string;
  createdBy: string | null;
  sentNotificationId: string | null;
  error: string | null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!getFirebaseDbUrl()) {
    res.status(500).json({ error: 'FIREBASE_DATABASE_URL not configured' });
    return;
  }

  try {
    if (req.method === 'POST') return await createSchedule(req, res);
    if (req.method === 'GET') return await listSchedules(res);
    if (req.method === 'DELETE') return await cancelSchedule(req, res);

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Schedule endpoint error:', error);
    res.status(500).json({ error: 'Schedule operation failed', details: String(error) });
  }
}

// ─── POST: create a scheduled notification ───────────────────────────────────

async function createSchedule(req: VercelRequest, res: VercelResponse) {
  const body = req.body as ScheduleBody;

  const validationError = validateNotificationPayload(body);
  if (validationError) {
    res.status(400).json({ error: validationError });
    return;
  }

  const when = new Date(body.scheduledFor);
  if (!body.scheduledFor || Number.isNaN(when.getTime())) {
    res.status(400).json({ error: 'scheduledFor must be a valid ISO date-time' });
    return;
  }

  // Allow a small grace window so a send for "right now" isn't rejected by
  // clock skew, but reject clearly-past times.
  if (when.getTime() < Date.now() - 60_000) {
    res.status(400).json({ error: 'scheduledFor must be in the future' });
    return;
  }

  const id = crypto.randomUUID();
  const actionButtons = normalizeActionButtons(body);
  const record: ScheduledNotification = {
    id,
    title: body.title,
    body: body.body,
    bodyLong: normalizeBodyLong(body) || undefined,
    category: body.category || 'general',
    priority: body.priority || 'default',
    icon: body.icon || undefined,
    imageUrl: body.imageUrl || undefined,
    internalRoute: body.internalRoute || undefined,
    actionButtons: actionButtons.length ? actionButtons : undefined,
    audience: normalizeAudience(body.audience) || undefined,
    topics: (body.topics || []).filter(Boolean),
    scheduledFor: when.toISOString(),
    status: 'scheduled',
    createdAt: new Date().toISOString(),
    createdBy: body.createdBy || null,
    sentNotificationId: null,
    error: null,
  };

  // Firebase rejects `undefined`; strip those keys before writing.
  const clean = JSON.parse(JSON.stringify(record));
  await firebaseSet(`/scheduledNotifications/${id}`, clean);

  res.json({ id, status: 'scheduled', scheduledFor: record.scheduledFor });
}

// ─── GET: list all scheduled notifications ───────────────────────────────────

async function listSchedules(res: VercelResponse) {
  const raw = await firebaseGet<Record<string, ScheduledNotification>>('/scheduledNotifications');
  const items = raw && typeof raw === 'object' ? Object.values(raw) : [];
  items.sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime());
  res.json({ items });
}

// ─── DELETE: cancel a scheduled notification ─────────────────────────────────

async function cancelSchedule(req: VercelRequest, res: VercelResponse) {
  const id = (req.query.id as string) || (req.body as { id?: string })?.id;
  if (!id) {
    res.status(400).json({ error: 'id is required' });
    return;
  }

  const existing = await firebaseGet<ScheduledNotification>(`/scheduledNotifications/${id}`);
  if (!existing) {
    res.status(404).json({ error: 'Scheduled notification not found' });
    return;
  }

  if (existing.status !== 'scheduled') {
    res.status(409).json({ error: `Cannot cancel a notification with status "${existing.status}"` });
    return;
  }

  await firebasePatch(`/scheduledNotifications/${id}`, { status: 'cancelled' });
  res.json({ id, status: 'cancelled' });
}
