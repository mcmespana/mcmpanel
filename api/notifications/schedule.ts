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
    if (req.method === 'PUT') return await updateSchedule(req, res);
    if (req.method === 'DELETE') return await cancelSchedule(req, res);

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Schedule endpoint error:', error);
    res.status(500).json({ error: 'Schedule operation failed', details: String(error) });
  }
}

// ─── POST: create a scheduled notification ───────────────────────────────────

// Validates the body and returns the editable fields of a scheduled record, or
// an error message. Shared by create (POST) and edit (PUT) so both apply the
// exact same rules.
type ScheduleFields = Omit<
  ScheduledNotification,
  'id' | 'status' | 'createdAt' | 'createdBy' | 'sentNotificationId' | 'error'
>;

function buildScheduleFields(body: ScheduleBody): { fields: ScheduleFields } | { error: string } {
  const validationError = validateNotificationPayload(body);
  if (validationError) return { error: validationError };

  const when = new Date(body.scheduledFor);
  if (!body.scheduledFor || Number.isNaN(when.getTime())) {
    return { error: 'scheduledFor must be a valid ISO date-time' };
  }

  // Allow a small grace window so a send for "right now" isn't rejected by
  // clock skew, but reject clearly-past times.
  if (when.getTime() < Date.now() - 60_000) {
    return { error: 'scheduledFor must be in the future' };
  }

  const actionButtons = normalizeActionButtons(body);
  return {
    fields: {
      title: body.title,
      body: body.body,
      bodyLong: normalizeBodyLong(body) || undefined,
      category: body.category || 'general',
      priority: body.priority || 'default',
      icon: body.icon || undefined,
      imageUrl: body.imageUrl || undefined,
      internalRoute: body.internalRoute || undefined,
      eventId: body.eventId || undefined,
      actionButtons: actionButtons.length ? actionButtons : undefined,
      audience: normalizeAudience(body.audience) || undefined,
      topics: (body.topics || []).filter(Boolean),
      scheduledFor: when.toISOString(),
    },
  };
}

// ─── POST: create a scheduled notification ───────────────────────────────────

async function createSchedule(req: VercelRequest, res: VercelResponse) {
  const body = req.body as ScheduleBody;

  const built = buildScheduleFields(body);
  if ('error' in built) {
    res.status(400).json({ error: built.error });
    return;
  }

  const id = crypto.randomUUID();
  const record: ScheduledNotification = {
    id,
    ...built.fields,
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

// ─── PUT: edit a pending scheduled notification ──────────────────────────────
// Only while status === 'scheduled'. Keeps id / createdAt / createdBy and
// replaces every editable field. Fields the edit no longer sets are written as
// null so Realtime DB deletes them (a PATCH alone would leave the old value,
// e.g. a removed image or a narrowed audience).

async function updateSchedule(req: VercelRequest, res: VercelResponse) {
  const id = (req.query.id as string) || (req.body as { id?: string })?.id;
  if (!id) {
    res.status(400).json({ error: 'id is required' });
    return;
  }

  const body = req.body as ScheduleBody;
  const built = buildScheduleFields(body);
  if ('error' in built) {
    res.status(400).json({ error: built.error });
    return;
  }

  const existing = await firebaseGet<ScheduledNotification>(`/scheduledNotifications/${id}`);
  if (!existing) {
    res.status(404).json({ error: 'Scheduled notification not found' });
    return;
  }
  if (existing.status !== 'scheduled') {
    res.status(409).json({ error: `Cannot edit a notification with status "${existing.status}"` });
    return;
  }

  const clean = JSON.parse(JSON.stringify(built.fields)) as Record<string, unknown>;
  const OPTIONAL: (keyof ScheduleFields)[] = [
    'bodyLong', 'icon', 'imageUrl', 'internalRoute', 'eventId', 'actionButtons', 'audience', 'topics',
  ];
  const patch: Record<string, unknown> = { ...clean };
  for (const key of OPTIONAL) {
    const value = clean[key];
    const empty = value === undefined || (Array.isArray(value) && value.length === 0);
    if (empty) patch[key] = null;
  }
  // Records created before the multi-button change may carry the legacy field.
  patch.actionButton = null;
  patch.error = null;

  // Re-read right before writing: the cron flips status to 'processing' just
  // before dispatching, and an edit must not land on a notification in flight.
  const fresh = await firebaseGet<ScheduledNotification>(`/scheduledNotifications/${id}`);
  if (!fresh || fresh.status !== 'scheduled') {
    res.status(409).json({ error: `Cannot edit a notification with status "${fresh?.status ?? 'deleted'}"` });
    return;
  }

  await firebasePatch(`/scheduledNotifications/${id}`, patch);
  res.json({ id, status: 'scheduled', scheduledFor: built.fields.scheduledFor });
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
