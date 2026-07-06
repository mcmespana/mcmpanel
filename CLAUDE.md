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
| Cantoral | `/cantoral` | `/songs` | `{ data: {cat: {categoryTitle, songs[]}}, updatedAt, ediciones, solicitudes, fallitos }`. La **fuente de verdad** es el repo `mcmapp-cantoral` (regenera y hace PUT de `songs/data`); las colas `ediciones/solicitudes/fallitos` las escribe la app |
| Wordle | `/wordle` | `/wordle` | Dormido en la app |
| Actividades | `/actividades` | `/activities` (+ legacy `/jubileo`) | Eventos y sus subsecciones. `activities/_meta = { updatedAt, data: { activeEventId } }` marca el evento activo global |
| Notificaciones | `/notificaciones` | `/notifications`, `/scheduledNotifications`, `/pushTokens` | Composer con audiencia de 4 ejes (todos/perfil/delegación/evento) + programadas |
| Encuestas | `/encuestas` | `/surveys` | Encuestas/evaluaciones (contrato en mcmapp) |
| Usuarios | `/usuarios` | `/users` | Solo escribe `users/{uid}/isAdmin` |
| Perfiles | `/perfiles` | `/profileConfig` | Perfiles, delegaciones, overrides, flags globales, modo revisión |

## Contratos con la app (fuente de verdad: repo `mcmapp`)

| Tema | Documento |
| ---- | --------- |
| Notificaciones (payload, rutas, topics, `/pushTokens`) | `mcmapp/docs/contratos/NOTIFICACIONES_CONTRATO.md` |
| Sistema de perfiles (`/profileConfig`) | `mcmapp/docs/contratos/PANEL_PERFILES.md` |
| Encuestas | `mcmapp/docs/contratos/ENCUESTAS_CONTRATO.md` |
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

- Suscripción en tiempo real a la **raíz** de la RTDB (`onValue('/')`).
- Las ediciones se acumulan en `pendingUpdates` y se escriben con `set()` de
  **nodo completo** cada 10 s (auto-save) o con el botón de guardado.
- El listener de raíz NO debe pisar secciones con cambios pendientes (los
  heartbeats de `/pushTokens` refrescan la raíz constantemente).

## Comandos

```bash
npm run dev        # desarrollo (localhost:8080)
npm run lint       # ESLint
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

## Seguridad (estado real)

- El panel escribe con el **SDK cliente de Firebase, sin autenticación**.
  Funciona porque las reglas de la RTDB en producción están abiertas.
- ⚠️ `mcm-app/database.rules.json` (repo mcmapp) asume que el panel usa Admin
  SDK. **Desplegar esas reglas rompería este panel** (lectura de raíz y todas
  las escrituras). Antes de endurecer reglas hay que dar auth real al panel
  (Firebase Auth + allowlist, o mover escrituras a las funciones de `api/` con
  credencial de servidor).
- `/api/notifications/send` y `/api/notifications/schedule` no exigen
  autenticación: cualquiera que conozca la URL puede enviar push a todos los
  usuarios. Pendiente de proteger.

## Checklist antes de push

```bash
npm run lint && npm run build
```

- ¿Tocaste un contrato de datos? Actualiza el doc correspondiente en `mcmapp/docs/`.
- ¿Escribes un nodo nuevo? Comprueba cómo lo lee la app (`useFirebaseData` espera `{ updatedAt, data }`).
