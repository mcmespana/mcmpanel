import { getDB } from '@/lib/firebase';
import { get, ref, remove, update } from 'firebase/database';
import { guardWrite } from '@/lib/firebaseRules';

/**
 * Lectura y escritura del nodo `/choirs` — los **coros** de la app.
 *
 * Desde el rediseño de agosto de 2026, las playlists compartidas cuelgan de un
 * coro en vez de vivir sueltas bajo un código de 4 dígitos. La app lista los
 * coros, deja elegir uno y a partir de ahí importar «la última» es un toque.
 * Contrato completo: `mcmapp/docs/funcionalidades/COROS.md`.
 *
 *   /choirs/{choirId} = {
 *     name, nameKey, createdAt, updatedAt,
 *     createdBy: { deviceId, name? },
 *     playlists: { "1234": { name, createdAt, updatedAt, songCount, by?, ownerDeviceId? } }
 *   }
 *
 * ⚠️ El **contenido** de cada playlist NO está aquí: vive en
 * `/playlistShares/{code}` (que es lo que la app descarga). Este nodo es solo
 * el índice. Por eso "quitar del coro" y "borrar de la nube" son dos cosas
 * distintas, y la sección ofrece las dos.
 *
 * Qué puede hacer el panel (y la app no):
 *  - **borrar** un coro entero (cualquiera puede crearlos sin login);
 *  - **renombrar** un coro o una de sus playlists;
 *  - **retocar la fecha** de una playlist, que es lo que ORDENA el histórico y
 *    decide cuál es «la última» que importa todo el mundo.
 *
 * Todas las escrituras son `update()`/`remove()` sobre rutas concretas, NO el
 * `set()` de nodo completo del JSONManager: la app escribe aquí en vivo y
 * pisarle el nodo entero borraría la playlist que alguien acaba de subir.
 */

const ROOT = 'choirs';

export interface ChoirPlaylistEntry {
  /** Código de 4 dígitos con el que la playlist se puede importar suelta. */
  code: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  songCount: number;
  /** Nombre de quien la subió, si lo tenía puesto en su perfil. */
  by?: string;
  ownerDeviceId?: string;
}

export interface PanelChoir {
  id: string;
  name: string;
  nameKey: string;
  createdAt: number;
  updatedAt: number;
  createdByDeviceId: string | null;
  createdByName: string | null;
  /** Playlists ya ordenadas: la más reciente primero (igual que en la app). */
  playlists: ChoirPlaylistEntry[];
}

/** Sesión de coro en vivo (`/choirSessions/{choirId}`), para poder cerrarla. */
export interface PanelChoirSession {
  key: string;
  leaderName: string | null;
  leaderDeviceId: string | null;
  startedAt: number;
  expiresAt: number;
  songCount: number;
}

/* ─── Nombres ──────────────────────────────────────────────────────────── */

/**
 * ESPEJO de `mcm-app/utils/choirIds.ts#choirNameKey`. Se usa para detectar
 * duplicados al crear un coro desde la app, así que al renombrar desde aquí
 * hay que recalcularlo con las MISMAS reglas o dejarías crear un duplicado.
 */
export function choirNameKey(name: string): string {
  return (name ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, '-');
}

/* ─── Lectura ──────────────────────────────────────────────────────────── */

function num(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/**
 * Normaliza el nodo `/choirs` tal cual llega de Firebase. Defensivo a
 * propósito: lo escribe la app sin login y un coro puede quedarse a medias
 * (sin `playlists`, sin `createdBy`…) sin que eso deba romper el panel.
 */
export function parseChoirs(node: unknown): PanelChoir[] {
  if (!node || typeof node !== 'object') return [];
  const out: PanelChoir[] = [];

  for (const [id, raw] of Object.entries(node as Record<string, unknown>)) {
    if (!raw || typeof raw !== 'object') continue;
    const choir = raw as Record<string, unknown>;
    const createdBy = (choir.createdBy ?? {}) as Record<string, unknown>;
    const playlistsNode = (choir.playlists ?? {}) as Record<string, unknown>;

    const playlists: ChoirPlaylistEntry[] = Object.entries(playlistsNode)
      .filter(([, entry]) => entry && typeof entry === 'object')
      .map(([code, entry]) => {
        const e = entry as Record<string, unknown>;
        const createdAt = num(e.createdAt);
        return {
          code,
          name: str(e.name) ?? `Playlist ${code}`,
          createdAt,
          // Sin `updatedAt` propio cae a `createdAt`: si no, ordenaría por 0 y
          // una playlist antigua se colaría como «la última».
          updatedAt: num(e.updatedAt, createdAt),
          songCount: num(e.songCount),
          ...(str(e.by) ? { by: str(e.by)! } : {}),
          ...(str(e.ownerDeviceId) ? { ownerDeviceId: str(e.ownerDeviceId)! } : {}),
        };
      })
      .sort((a, b) => b.updatedAt - a.updatedAt || a.name.localeCompare(b.name));

    const name = str(choir.name) ?? id;
    out.push({
      id,
      name,
      nameKey: str(choir.nameKey) ?? choirNameKey(name),
      createdAt: num(choir.createdAt),
      updatedAt: num(choir.updatedAt, num(choir.createdAt)),
      createdByDeviceId: str(createdBy.deviceId),
      createdByName: str(createdBy.name),
      playlists,
    });
  }

  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** Sesiones en vivo, indexadas por su clave (id de coro o código suelto). */
export function parseChoirSessions(
  node: unknown,
): Record<string, PanelChoirSession> {
  const out: Record<string, PanelChoirSession> = {};
  if (!node || typeof node !== 'object') return out;

  for (const [key, raw] of Object.entries(node as Record<string, unknown>)) {
    if (!raw || typeof raw !== 'object') continue;
    const session = raw as Record<string, unknown>;
    const master = (session.master ?? {}) as Record<string, unknown>;
    const startedAt = num(session.startedAt, num(session.createdAt));
    out[key] = {
      key,
      leaderName: str(master.name),
      leaderDeviceId: str(master.deviceId),
      startedAt,
      // Las sesiones caducan 24 h después de empezar.
      expiresAt: num(session.expiresAt, startedAt + 24 * 60 * 60 * 1000),
      songCount: Array.isArray(session.playlist) ? session.playlist.length : 0,
    };
  }
  return out;
}

/** ¿Sigue viva esta sesión? (la app ignora las caducadas aunque sigan en RTDB) */
export function isSessionLive(
  session: PanelChoirSession | undefined,
  now = Date.now(),
): boolean {
  return !!session && session.expiresAt > now;
}

/** Canciones de una playlist concreta, leídas de `/playlistShares/{code}`. */
export async function fetchPlaylistSongs(code: string): Promise<string[]> {
  const snap = await get(ref(getDB(), `playlistShares/${code}`));
  const value = snap.val();
  const songs = value?.songs;
  if (!Array.isArray(songs)) return [];
  return songs
    .map((s) => (s && typeof s === 'object' ? String(s.filename ?? '') : ''))
    .filter(Boolean);
}

/* ─── Escritura ────────────────────────────────────────────────────────── */

/** Renombra el coro. Recalcula `nameKey` para no romper el anti-duplicados. */
export async function renameChoir(choirId: string, name: string): Promise<void> {
  const clean = (name ?? '').replace(/\s+/g, ' ').trim().slice(0, 60);
  if (clean.length < 3) throw new Error('El nombre es demasiado corto');
  await guardWrite(`${ROOT}/${choirId}`, 'Coros', () =>
    update(ref(getDB(), `${ROOT}/${choirId}`), {
      name: clean,
      nameKey: choirNameKey(clean),
      updatedAt: Date.now(),
    }),
  );
}

/**
 * Borra el coro entero. NO borra el contenido de sus playlists en
 * `/playlistShares`, que caduca solo a los 6 meses: así, si alguien tenía el
 * código apuntado, su enlace sigue funcionando aunque el coro ya no exista.
 */
export async function deleteChoir(choirId: string): Promise<void> {
  await guardWrite(`${ROOT}/${choirId}`, 'Coros', () =>
    remove(ref(getDB(), `${ROOT}/${choirId}`)),
  );
}

/** Renombra una playlist dentro del coro (no toca su contenido). */
export async function renameChoirPlaylist(
  choirId: string,
  code: string,
  name: string,
): Promise<void> {
  const clean = (name ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
  if (!clean) throw new Error('El nombre no puede quedar vacío');
  await guardWrite(`${ROOT}/${choirId}`, 'Coros', () =>
    update(ref(getDB(), `${ROOT}/${choirId}`), {
      [`playlists/${code}/name`]: clean,
      updatedAt: Date.now(),
    }),
  );
}

/**
 * Cambia la fecha de una playlist. Es la palanca de ORDEN: el histórico se
 * ordena por `updatedAt` y «importar la última» coge la primera, así que subir
 * la fecha de una playlist es lo que la convierte en la del próximo domingo.
 */
export async function setChoirPlaylistDate(
  choirId: string,
  code: string,
  updatedAt: number,
): Promise<void> {
  if (!Number.isFinite(updatedAt)) throw new Error('Fecha inválida');
  await guardWrite(`${ROOT}/${choirId}`, 'Coros', () =>
    update(ref(getDB(), `${ROOT}/${choirId}`), {
      [`playlists/${code}/updatedAt`]: updatedAt,
      updatedAt: Date.now(),
    }),
  );
}

/** Quita la playlist del histórico del coro (su contenido sigue en la nube). */
export async function removeChoirPlaylist(
  choirId: string,
  code: string,
): Promise<void> {
  await guardWrite(`${ROOT}/${choirId}`, 'Coros', () =>
    update(ref(getDB(), `${ROOT}/${choirId}`), {
      [`playlists/${code}`]: null,
      updatedAt: Date.now(),
    }),
  );
}

/** Quita la playlist del coro Y borra su contenido compartido. */
export async function deleteChoirPlaylistCompletely(
  choirId: string,
  code: string,
): Promise<void> {
  await removeChoirPlaylist(choirId, code);
  await guardWrite(`playlistShares/${code}`, 'Coros', () =>
    remove(ref(getDB(), `playlistShares/${code}`)),
  );
}

/** Cierra a mano una sesión de coro en vivo. */
export async function closeChoirSession(key: string): Promise<void> {
  await guardWrite(`choirSessions/${key}`, 'Coros', () =>
    remove(ref(getDB(), `choirSessions/${key}`)),
  );
}

/* ─── Formato ──────────────────────────────────────────────────────────── */

export function formatChoirDate(ts: number | null): string {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

/** Valor para un `<input type="datetime-local">` a partir de un timestamp. */
export function toDateTimeLocal(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}
