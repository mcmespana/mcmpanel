import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'node:crypto';
import {
  dispatchNotification,
  firebaseGet,
  firebasePatch,
  getFirebaseDbUrl,
  type NotificationPayload,
} from '../_lib/push.js';
import type { ScheduledNotification } from './schedule.js';

// Invoked every minute by an external cron pinger (e.g. cron-job.org) that hits
// this URL. It finds every scheduled notification whose time has come and
// dispatches it.
//
// Security: when CRON_SECRET is configured, the request must carry the secret,
// either as an "Authorization: Bearer <CRON_SECRET>" header OR as a "?secret="
// query param (whichever is easier to set up in the cron service). Anything
// else is rejected so outsiders can't trigger sends. If CRON_SECRET is not set,
// the endpoint stays open (useful for local/manual runs).

function isAuthorized(req: VercelRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const auth = req.headers.authorization || '';
  if (auth === `Bearer ${secret}`) return true;
  const fromQuery = (req.query.secret as string) || (req.query.key as string) || '';
  return fromQuery === secret;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!isAuthorized(req)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (!getFirebaseDbUrl()) {
    res.status(500).json({ error: 'FIREBASE_DATABASE_URL not configured' });
    return;
  }

  try {
    const raw = await firebaseGet<Record<string, ScheduledNotification>>('/scheduledNotifications');
    const all = raw && typeof raw === 'object' ? Object.values(raw) : [];

    const now = Date.now();
    const due = all.filter(
      (s) => s.status === 'scheduled' && new Date(s.scheduledFor).getTime() <= now,
    );

    const processed: Array<{ id: string; status: string; sentNotificationId?: string }> = [];

    for (const item of due) {
      // Claim the item first so an overlapping cron run can't send it twice.
      // (Realtime DB REST has no transactions; re-reading guards against the
      // common race for our low volume.)
      const fresh = await firebaseGet<ScheduledNotification>(`/scheduledNotifications/${item.id}`);
      if (!fresh || fresh.status !== 'scheduled') continue;

      await firebasePatch(`/scheduledNotifications/${item.id}`, { status: 'processing' });

      try {
        const notificationId = crypto.randomUUID();
        const payload: NotificationPayload = {
          title: item.title,
          body: item.body,
          bodyLong: item.bodyLong,
          category: item.category,
          priority: item.priority,
          icon: item.icon,
          imageUrl: item.imageUrl,
          internalRoute: item.internalRoute,
          // New canonical field; `actionButton` kept for records scheduled
          // before this change (normalizeActionButtons merges both).
          actionButtons: item.actionButtons,
          actionButton: item.actionButton,
          audience: item.audience,
          topics: item.topics,
        };

        await dispatchNotification(notificationId, payload);

        await firebasePatch(`/scheduledNotifications/${item.id}`, {
          status: 'sent',
          sentNotificationId: notificationId,
          sentAt: new Date().toISOString(),
        });

        processed.push({ id: item.id, status: 'sent', sentNotificationId: notificationId });
      } catch (err) {
        console.error(`Failed to dispatch scheduled notification ${item.id}:`, err);
        await firebasePatch(`/scheduledNotifications/${item.id}`, {
          status: 'failed',
          error: String(err),
        });
        processed.push({ id: item.id, status: 'failed' });
      }
    }

    res.json({ checked: all.length, due: due.length, processed });
  } catch (error) {
    console.error('Process-scheduled error:', error);
    res.status(500).json({ error: 'Failed to process scheduled notifications', details: String(error) });
  }
}
