// src/lib/activityWrites.ts
//
// B4 del PLAN_INTEGRACIONES: escrituras granulares de Actividades.
//
// El guardado del panel hacía `set('/activities', árbolCompleto)`, lo que pisa
// los subnodos que escribe la app (`<evento>/evaluacion/respuestas/<device>` y
// `<evento>/compartiendo`) si llegan entre el snapshot y el guardado. Aquí
// traducimos las subrutas que el admin realmente editó a rutas Firebase y
// resolvemos sus valores, para escribir SOLO esas rutas con `update()` multi-path
// dejando intacto todo lo demás.
//
// `editedPath` son segmentos relativos al árbol COMBINADO que maneja
// ActivitiesSection, donde `jubileo` es un hermano de los eventos de
// `/activities`. Ejemplos:
//   ['_meta']                       -> 'activities/_meta'
//   ['visitapapa26', 'compartiendo']-> 'activities/visitapapa26/compartiendo'
//   ['visitapapa26', '_meta']       -> 'activities/visitapapa26/_meta'
//   ['nuevoevento']                 -> 'activities/nuevoevento'
//   ['jubileo', 'horario']          -> 'jubileo/horario'   (nodo legacy /jubileo)

/** Convierte los segmentos editados en la ruta Firebase absoluta (sin barra inicial). */
export function activityFirebasePath(editedPath: string[]): string {
  if (editedPath.length === 0) return 'activities';
  // `jubileo` vive en /jubileo (raíz), no bajo /activities.
  if (editedPath[0] === 'jubileo') return editedPath.join('/');
  return ['activities', ...editedPath].join('/');
}

/** ¿`child` es la misma ruta que `ancestor` o cuelga de ella? */
function isSameOrDescendant(child: string, ancestor: string): boolean {
  return child === ancestor || child.startsWith(ancestor + '/');
}

/**
 * Colapsa un conjunto de rutas quitando las que son descendientes de otra ya
 * presente (Firebase `update()` rechaza rutas que se solapan, p. ej.
 * 'activities/x' y 'activities/x/y'). Se conserva el ancestro; su valor, resuelto
 * del árbol en memoria, ya incluye los cambios de los descendientes.
 */
export function collapseOverlappingPaths(paths: string[]): string[] {
  const unique = Array.from(new Set(paths));
  return unique.filter(
    (p) => !unique.some((other) => other !== p && isSameOrDescendant(p, other)),
  );
}

/** Camina un objeto por una lista de claves; devuelve undefined si el camino no existe. */
function valueAt(root: unknown, keys: string[]): unknown {
  let current: unknown = root;
  for (const key of keys) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

/**
 * Construye el objeto multi-path para `update(ref(db,'/'), obj)` a partir de las
 * rutas Firebase editadas y las secciones en memoria (las copias pendientes que
 * el listener de la raíz protege). Los valores se resuelven al vuelo desde esas
 * copias, así que siempre reflejan la última edición.
 *
 * - `activitiesData` = copia en memoria de `/activities` (eventos + `_meta`).
 * - `jubileoData`    = copia en memoria de `/jubileo`.
 *
 * Se omiten las rutas cuyo valor sea `undefined` (no deberían escribirse).
 */
export function buildGranularActivityWrites(
  firebasePaths: string[],
  activitiesData: unknown,
  jubileoData: unknown,
): Record<string, unknown> {
  const collapsed = collapseOverlappingPaths(firebasePaths);
  const writes: Record<string, unknown> = {};

  for (const path of collapsed) {
    const segments = path.split('/');
    const isJubileo = segments[0] === 'jubileo';
    const sectionData = isJubileo ? jubileoData : activitiesData;
    // Para /jubileo la ruta ya empieza por 'jubileo'; para /activities el primer
    // segmento es 'activities'. En ambos casos el resto navega la sección.
    const rest = segments.slice(1);
    const value = valueAt(sectionData, rest);
    if (value !== undefined) writes[path] = value;
  }

  return writes;
}
