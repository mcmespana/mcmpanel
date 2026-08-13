# MCM Panel — Contexto del proyecto para agentes

> Panel de administración del ecosistema **MCM App**. Todo lo que se edita aquí
> se guarda en Firebase Realtime Database y la app móvil lo consume sin
> necesidad de publicar versiones nuevas.

---

## Qué es

SPA de **React 18 + TypeScript + Vite + shadcn-ui/Tailwind**, desplegada en
**Vercel**. Además del frontend hay **funciones serverless** en `api/`
(notificaciones push + proxy de calendarios) y un **cron externo**
(cron-job.org) que dispara el procesado de notificaciones programadas.

```
[Admin] → MCM Panel (SPA React)
            ├─ lee/escribe Firebase RTDB (SDK cliente, sin Firebase Auth)
            └─ POST /api/notifications/* (Vercel) → Expo Push API → dispositivos
                                        └─ Firebase /notifications, /scheduledNotifications
```

**Autenticación**: solo un código de acceso verificado en cliente
(`src/lib/auth.ts`, hash SHA-256 + cookie). No hay Firebase Auth ni protección
server-side; los endpoints `api/notifications/*` solo protegen el cron con
`CRON_SECRET`. ⚠️ Ver "Seguridad" abajo.

## Secciones reales (src/lib/sections.ts)

| Sección | Slug | Nodo Firebase | Notas |
| ------- | ---- | ------------- | ----- |
| Inicio | `/` | — | Dashboard de atajos |
| App | `/app` | `/app` | Feedback y evaluaciones de la app |
| Álbumes | `/albums` | `/albums` | `{ data: [...], updatedAt }` |
| Calendarios | `/calendarios` | `/calendars` | Fuentes ICS `{ id, name, url, color }` |
| Cantoral | `/cantoral` | `/songs` | `{ data: {cat: {categoryTitle, songs[]}}, updatedAt, ediciones, solicitudes, fallitos }`. La **fuente de verdad** es el repo `mcmapp-cantoral` (regenera y hace PUT de `songs/data`); las colas `ediciones/solicitudes/fallitos` las escribe la app. **La edición de canciones está deprecada**: hay un aviso a pantalla completa antes de entrar, porque el siguiente push del repo se lleva por delante lo que se toque aquí |
| Wordle | `/wordle` | `/wordle` | Dormido en la app |
| Actividades | `/actividades` | `/activities` (+ legacy `/jubileo`) | Eventos y sus subsecciones. `activities/_meta = { updatedAt, data: { activeEventId } }` marca el evento activo global |
| Notificaciones | `/notificaciones` | `/notifications`, `/scheduledNotifications`, `/pushTokens` | Composer con audiencia de 4 ejes (todos/perfil/delegación/evento) + programadas |
| Encuestas | `/encuestas` | `/surveys` | Encuestas/evaluaciones (contrato en mcmapp) |
| Coros | `/coros` | `/choirs`, `/choirSessions/<choirId>`, `/playlistShares` | Coros de los que cuelgan las playlists compartidas. Los crea la gente desde la app (sin login): aquí se borran, se renombran y se **retoca la fecha** de cada playlist, que es lo que ordena el histórico y decide cuál es «la última». Escribe con `update()`/`remove()` granular, NO por el guardado de nodo completo |
| Usuarios | `/usuarios` | `/users` | Solo escribe `users/{uid}/isAdmin` |
| Perfiles | `/perfiles` | `/profileConfig` | Perfiles, delegaciones, overrides, flags globales, modo revisión. `delegationList` **se deriva** de `delegations` al guardar (la app la ignora y hace lo mismo): no se edita a mano |

## Contratos con la app (fuente de verdad: repo `mcmapp`)

| Tema | Documento |
| ---- | --------- |
| Notificaciones (payload, rutas, topics, `/pushTokens`) | `mcmapp/docs/contratos/NOTIFICACIONES_CONTRATO.md` |
| Sistema de perfiles (`/profileConfig`) | `mcmapp/docs/contratos/PANEL_PERFILES.md` |
| Encuestas | `mcmapp/docs/contratos/ENCUESTAS_CONTRATO.md` |
| Coros y playlists compartidas (`/choirs`) | `mcmapp/docs/funcionalidades/COROS.md` |
| Eventos (estructura `activities/*`) | `mcmapp/docs/funcionalidades/EVENTOS.md` |

Reglas de oro al tocar datos:

1. **`updatedAt` siempre**: la app cachea por `updatedAt`; si escribes `data`
   sin tocar `updatedAt` del mismo nodo, los clientes no verán el cambio.
2. **La forma de los nodos es `{ updatedAt, data }`** (hook `useFirebaseData`
   de la app). No escribas campos "en plano" que la app espera bajo `data`.
3. **No sobrescribas lo que escribe la app**: `pushTokens.topics`,
   `activities/*/evaluacion/respuestas`, `songs/ediciones|solicitudes|fallitos`,
   `*/compartiendo`. Guardados de nodo completo deben preservarlos.
4. **IDs contra catálogo**: tabs/homeButtons/masItems/albumTags de perfiles
   deben salir de `src/lib/profileCatalog.ts` (espejo de
   `mcm-app/constants/profileCatalog.ts`). Un ID desconocido se descarta
   silenciosamente en la app.
5. **Eventos**: crear una actividad aquí NO la hace visible en la app; la app
   necesita registrarla en `mcm-app/constants/events.ts` (ver EVENTOS.md).
   El id del evento (p. ej. `visitapapa26`) es también el sufijo del topic de
   suscripción `event-<id>`.

## Mecánica de guardado (JSONManager)

- Suscripción en tiempo real **nodo a nodo** (`MANAGED_NODES`: los 8 de
  `JSONData`), NO a la raíz. Conceder `.read` en `/` sería conceder `/users`
  —el diario de Contigo de todo el mundo— y `.read` cascadea sin poder
  revocarse. De paso, ya no se baja la base entera cada vez que un móvil manda
  su heartbeat de `/pushTokens`. **Si añades una clave a `JSONData`, añádela a
  `MANAGED_NODES`** o su sección se quedará siempre vacía.
- Las ediciones se acumulan en `pendingUpdates` y se escriben con `set()` de
  **nodo completo** cada 10 s (auto-save) o con el botón de guardado.
- El listener remoto NO debe pisar secciones con cambios pendientes.
- ⚠️ **Excepciones al `set()` de nodo completo** — nodos que la app también
  escribe y que un `set()` borraría:
  - `/activities` y `/jubileo`: `update()` multi-path solo de las subrutas
    editadas (`src/lib/activityWrites.ts`).
  - `/app`: solo `app/feedback` y `app/updatedAt`. `app/evaluations` (respuestas
    de los dispositivos) y `app/evaluationConfig` (lo gestiona Encuestas) NO se
    tocan. Antes se borraban en cada guardado de la sección App.
  - `/wordle`: solo `daily-words` y `updatedAt`.
  - Coros, Encuestas y Usuarios no pasan por aquí: escriben granular por su
    cuenta.
  Si añades una sección cuyo nodo comparta árbol con escrituras de la app,
  añádela a esta lista en `writePending()`.

## Comandos

```bash
npm run dev        # desarrollo (localhost:8080)
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit (vite build usa SWC y no comprueba tipos)
npm run build      # build de producción (vite build)
npm run preview    # smoke test del build
```

## Archivos clave

| Qué | Archivo |
| --- | ------- |
| Orquestador + guardado | `src/components/JSONManager.tsx` |
| Registro de secciones | `src/lib/sections.ts` |
| Firebase (cliente) | `src/lib/firebase.ts` (env `VITE_*`) |
| Login por código | `src/lib/auth.ts` + `src/components/LoginPage.tsx` |
| Envío push (compartido) | `api/_lib/push.ts` |
| Endpoints push | `api/notifications/{send,schedule,process-scheduled}.ts` |
| Segmentación de audiencia | `src/lib/audience.ts` (espejo en `api/_lib/push.ts`) |
| Catálogo de perfiles | `src/lib/profileCatalog.ts` |
| Seed de profileConfig | `src/lib/profileConfigSeed.ts` |
| Modo revisión de stores | `src/lib/appReviewMode.ts` |
| Encuestas | `src/lib/surveys.ts` |
| Coros | `src/lib/choirs.ts` + `src/components/sections/ChoirsSection.tsx` |

## Seguridad (estado real)

- El panel escribe con el **SDK cliente de Firebase, sin autenticación**.
- `mcm-app/database.rules.json` (repo mcmapp) ya está **preparado para
  desplegarse sin romper el panel**: los permisos que este panel necesita
  cuelgan de dos banderas en `/_config` (`legacyPanelWrites`,
  `legacyNotificationsOpen`). ⚠️ **Hay que sembrar `/_config` en la base de
  datos ANTES de desplegar las reglas** (`mcm-app/firebase-seed/config.json`);
  si no existe, las banderas valen `null` y el panel se queda sin permisos de
  golpe. Guía: `mcmapp/docs/desarrollo/FIREBASE_REGLAS.md`.
- **Dos secciones dejan de funcionar al desplegar, a propósito**: *Usuarios*
  (leer `/users` es leer `users/<uid>/contigo/**`, el diario de cada persona) y
  el contador de destinatarios del composer (listar `/pushTokens` es poder
  mandar push a todos). No tienen bandera; se arreglan con auth real en el panel
  (decisión D2, recomendación: Firebase Auth + `users/<uid>/isAdmin`, que ya
  existe).
- **Diagnóstico**: `src/lib/firebaseRules.ts` recoge todo `PERMISSION_DENIED` y
  `FirebaseRulesErrorDialog` lo enseña con el path, la operación y qué mirar.
  Al añadir una suscripción o escritura nueva, pásala por `onRulesError(path,
  seccion)` o `guardWrite(path, seccion, fn)` — si no, el fallo se pierde en la
  consola y la sección se ve vacía sin explicación.
- `api/_lib/push.ts` manda `?auth=$FIREBASE_DB_SECRET` si la variable existe en
  Vercel (retrocompatible: sin ella se comporta como siempre). Ponerla es lo que
  permite apagar `legacyNotificationsOpen`.
- `/api/notifications/send` y `/api/notifications/schedule` siguen sin exigir
  autenticación: cualquiera que conozca la URL puede enviar push a todos los
  usuarios. Pendiente de proteger.

## Checklist antes de push

```bash
npm run lint && npm run typecheck && npm run build
```

- ¿Tocaste un contrato de datos? Actualiza el doc correspondiente en `mcmapp/docs/`.
- ¿Escribes un nodo nuevo? Comprueba cómo lo lee la app (`useFirebaseData` espera `{ updatedAt, data }`).
