/**
 * Detección y registro de fallos de REGLAS de la Realtime Database.
 *
 * ── Por qué existe ──────────────────────────────────────────────────────────
 *
 * El panel escribe con el SDK de cliente sin autenticar. El día que se
 * desplieguen unas reglas más estrictas de la cuenta, o que alguien apague un
 * interruptor de `/_config`, lo que ve el admin es… nada: una sección vacía, un
 * "Guardado" que en realidad no guardó, un contador a cero. El error real se
 * queda en la consola del navegador, que nadie mira.
 *
 * Esto recoge esos fallos y los junta para que `FirebaseRulesErrorDialog` los
 * enseñe de golpe, con el path exacto y la operación. Diagnóstico en diez
 * segundos en vez de en media hora.
 *
 * No se usa un toast: los toasts se van solos y aquí lo que hace falta es algo
 * que se quede y se pueda copiar y pegar.
 */

export type FirebaseOp = 'read' | 'write';

export interface RulesFailure {
  /** Path de la RTDB que fue denegado, tal cual se le pasó a `ref()`. */
  path: string;
  op: FirebaseOp;
  /** Sección del panel donde pasó, para saber qué dejó de funcionar. */
  section: string;
  /** Mensaje original del SDK. */
  detail: string;
  at: Date;
}

/**
 * ¿Es una denegación de reglas y no un fallo de red?
 *
 * El SDK lo entrega unas veces con `code === 'PERMISSION_DENIED'` y otras solo
 * dentro del mensaje (`"permission_denied at /users: Client doesn't have
 * permission…"`). Se miran las dos cosas, en minúsculas.
 */
export function isPermissionDenied(error: unknown): boolean {
  if (!error) return false;
  const code = (error as { code?: unknown }).code;
  if (typeof code === 'string' && code.toLowerCase().includes('permission_denied')) {
    return true;
  }
  const message =
    error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  return message.toLowerCase().includes('permission_denied');
}

const failures: RulesFailure[] = [];
const listeners = new Set<(all: RulesFailure[]) => void>();

function emit() {
  const snapshot = [...failures];
  listeners.forEach((fn) => fn(snapshot));
}

/**
 * Registra el fallo si de verdad es de reglas, y devuelve `true` en ese caso.
 * Devuelve `false` para cualquier otro error, que el llamante debe seguir
 * tratando como siempre (red, datos mal formados…).
 *
 * Deduplica por `op + path`: un nodo denegado falla en cada re-render y en cada
 * `onValue`, y la lista tiene que seguir siendo legible.
 */
export function recordIfPermissionDenied(
  error: unknown,
  op: FirebaseOp,
  path: string,
  section: string,
): boolean {
  if (!isPermissionDenied(error)) return false;

  const already = failures.some((f) => f.op === op && f.path === path);
  if (already) return true;

  failures.push({
    path,
    op,
    section,
    detail: error instanceof Error ? error.message : String(error),
    at: new Date(),
  });
  emit();
  return true;
}

/** Suscribe a la lista de fallos. Devuelve la función para desuscribirse. */
export function subscribeRulesFailures(
  listener: (all: RulesFailure[]) => void,
): () => void {
  listeners.add(listener);
  listener([...failures]);
  return () => listeners.delete(listener);
}

/** Vacía la lista (el botón "Entendido" del modal). */
export function clearRulesFailures(): void {
  failures.length = 0;
  emit();
}

/**
 * Callback de error listo para pasarle a `onValue(ref, ok, onRulesError(...))`.
 * Los errores que no son de reglas se dejan en la consola, como antes.
 */
export function onRulesError(path: string, section: string) {
  return (error: unknown) => {
    if (recordIfPermissionDenied(error, 'read', path, section)) return;
    console.error(`Firebase onValue error en ${path}`, error);
  };
}

/**
 * Envuelve una escritura. Si las reglas la deniegan, la registra y relanza:
 * quien llama sigue viendo que falló (para no marcar "Guardado" en falso),
 * pero además queda en el modal con su path.
 */
export async function guardWrite<T>(
  path: string,
  section: string,
  run: () => Promise<T>,
): Promise<T> {
  try {
    return await run();
  } catch (error) {
    recordIfPermissionDenied(error, 'write', path, section);
    throw error;
  }
}

/** Texto de una sola pieza para el botón "Copiar" del modal. */
export function formatFailuresForClipboard(all: RulesFailure[]): string {
  const lines = [
    'MCM Panel — error de reglas de Firebase',
    `Fecha: ${new Date().toISOString()}`,
    `URL: ${typeof window !== 'undefined' ? window.location.href : '—'}`,
    '',
    ...all.map(
      (f) =>
        `[${f.op.toUpperCase()}] ${f.path}\n  sección: ${f.section}\n  detalle: ${f.detail}`,
    ),
  ];
  return lines.join('\n');
}
