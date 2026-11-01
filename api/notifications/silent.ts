import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'node:crypto';
import {
  firebaseDelete,
  firebaseGet,
  firebasePatch,
  firebaseSet,
  getFirebaseDbUrl,
  MAX_BODY_LONG,
  normalizeActionButtons,
  normalizeAudience,
  normalizeBodyLong,
  validateNotificationPayload,
  type NotificationPayload,
} from '../_lib/push.js';

// Notificaciones "silenciosas": se escriben en /notifications (lo que la app
// pinta en la campana) SIN mandar ninguna push. Mismo registro que crea
// dispatchNotification, con status 'silent' y contadores a 0.
//
// Va por servidor y no por el SDK del navegador porque las reglas de la app solo
// dejan escribir /notifications bajo /_config/legacyNotificationsOpen, que se
// apaga en cuanto FIREBASE_DB_SECRET está puesto (ver api/_lib/push.ts).
//
//   POST   /api/notifications/silent        crea
//   PATCH  /api/notifications/silent?id=…   edita (title, body, bodyLong, category,
//                                            internalRoute, createdAt, disabled)
//   DELETE /api/notifications/silent?id=…   borra (vale para cualquier registro)

interface SilentBody extends NotificationPayload {
  createdAt?: string; // ISO; por defecto, ahora. Es lo que ordena la campana.
  disabled?: boolean; // solo en PATCH: oculta/reactiva sin borrar
}

// Evita que un id con "/" o ".." apunte a otro sitio del árbol (o que un id vacío
// borre /notifications entero).
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!getFirebaseDbUrl()) {
    res.status(500).json({ error: 'FIREBASE_DATABASE_URL not configured' });
    return;
  }

  try {
    if (req.method === 'POST') return await createSilent(req, res);
    if (req.method === 'PATCH') return await editRecord(req, res);
    if (req.method === 'DELETE') return await deleteRecord(req, res);

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Silent notification error:', error);
    res.status(500).json({ error: 'Silent notification operation failed', details: String(error) });
  }
}

function parseIso(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function readId(req: VercelRequest): string | null {
  const id = (req.query.id as string) || (req.body as { id?: string } | undefined)?.id;
  return typeof id === 'string' && ID_RE.test(id) ? id : null;
}

// ─── POST: crear ─────────────────────────────────────────────────────────────

async function createSilent(req: VercelRequest, res: VercelResponse) {
  const body = req.body as SilentBody;

  const validationError = validateNotificationPayload(body);
  if (validationError) {
    res.status(400).json({ error: validationError });
    return;
  }

  let createdAt = new Date().toISOString();
  if (body.createdAt) {
    const parsed = parseIso(body.createdAt);
    if (!parsed) {
      res.status(400).json({ error: 'createdAt must be a valid ISO date-time' });
      return;
    }
    createdAt = parsed;
  }

  const notificationId = crypto.randomUUID();
  const actionButtons = normalizeActionButtons(body);
  const record = {
    notificationId,
    title: body.title,
    body: body.body,
    bodyLong: normalizeBodyLong(body),
    category: body.category || 'general',
    priority: body.priority || 'default',
    icon: body.icon || null,
    imageUrl: body.imageUrl || null,
    internalRoute: body.internalRoute || null,
    eventId: body.eventId || null,
    actionButtons: actionButtons.length ? actionButtons : null,
    audience: normalizeAudience(body.audience),
    topics: [],
    status: 'silent',
    createdAt,
    sentAt: null,
    totalTokens: 0,
    sentCount: 0,
    failedCount: 0,
    invalidTokens: 0,
  };

  await firebaseSet(`/notifications/${notificationId}`, record);
  res.json({ notificationId, status: 'silent', createdAt });
}

// ─── PATCH: editar ───────────────────────────────────────────────────────────

// Solo estos campos se pueden tocar: lo demás (audiencia, botones, contadores…)
// se conserva tal cual. `null` borra el campo.
async function editRecord(req: VercelRequest, res: VercelResponse) {
  const id = readId(req);
  if (!id) {
    res.status(400).json({ error: 'a valid id is required' });
    return;
  }

  const body = (req.body ?? {}) as Partial<SilentBody> & { bodyLong?: string | null; internalRoute?: string | null };
  const existing = await firebaseGet<Record<string, unknown>>(`/notifications/${id}`);
  if (!existing) {
    res.status(404).json({ error: 'Notification not found' });
    return;
  }

  const patch: Record<string, unknown> = {};

  if (body.title !== undefined) {
    if (!body.title.trim() || body.title.length > 50) {
      res.status(400).json({ error: 'title is required and must be 50 characters or less' });
      return;
    }
    patch.title = body.title;
  }
  if (body.body !== undefined) {
    if (!body.body.trim() || body.body.length > 200) {
      res.status(400).json({ error: 'body is required and must be 200 characters or less' });
      return;
    }
    patch.body = body.body;
  }
  if (body.bodyLong !== undefined) {
    const long = (body.bodyLong ?? '').trim();
    if (long.length > MAX_BODY_LONG) {
      res.status(400).json({ error: `bodyLong must be ${MAX_BODY_LONG} characters or less` });
      return;
    }
    const finalBody = typeof patch.body === 'string' ? patch.body : String(existing.body ?? '');
    patch.bodyLong = long && long !== finalBody.trim() ? long : null;
  }
  if (body.category !== undefined) patch.category = body.category || 'general';
  if (body.internalRoute !== undefined) patch.internalRoute = body.internalRoute || null;
  if (body.createdAt !== undefined) {
    const parsed = parseIso(body.createdAt);
    if (!parsed) {
      res.status(400).json({ error: 'createdAt must be a valid ISO date-time' });
      return;
    }
    patch.createdAt = parsed;
  }
  // Desactivar = ocultar de la campana sin borrar. `true` lo marca; `false` lo
  // quita (null borra la clave). OJO: la app tiene que filtrar `disabled`.
  if (body.disabled !== undefined) patch.disabled = body.disabled ? true : null;

  if (Object.keys(patch).length === 0) {
    res.status(400).json({ error: 'nothing to update' });
    return;
  }

  await firebasePatch(`/notifications/${id}`, patch);
  res.json({ notificationId: id, updated: Object.keys(patch) });
}

// ─── DELETE: borrar ──────────────────────────────────────────────────────────

async function deleteRecord(req: VercelRequest, res: VercelResponse) {
  const id = readId(req);
  if (!id) {
    res.status(400).json({ error: 'a valid id is required' });
    return;
  }

  const existing = await firebaseGet(`/notifications/${id}`);
  if (!existing) {
    res.status(404).json({ error: 'Notification not found' });
    return;
  }

  await firebaseDelete(`/notifications/${id}`);
  res.json({ notificationId: id, deleted: true });
}
