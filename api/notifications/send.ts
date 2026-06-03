import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'node:crypto';
import {
  dispatchNotification,
  getFirebaseDbUrl,
  validateNotificationPayload,
  type NotificationPayload,
} from '../_lib/push.js';

// ─── Handler ─────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!getFirebaseDbUrl()) {
    res.status(500).json({ error: 'FIREBASE_DATABASE_URL not configured' });
    return;
  }

  try {
    const body = req.body as NotificationPayload;

    const validationError = validateNotificationPayload(body);
    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }

    const notificationId = crypto.randomUUID();
    const result = await dispatchNotification(notificationId, body);

    res.json(result);
  } catch (error) {
    console.error('Send notification error:', error);
    res.status(500).json({ error: 'Failed to send notification', details: String(error) });
  }
}
