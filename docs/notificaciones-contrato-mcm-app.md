# Notificaciones push — contrato de datos MCM Panel ↔ MCM App

> **Fuente de verdad del contrato completo**:
> `mcmapp/docs/contratos/NOTIFICACIONES_CONTRATO.md` (repo de la app). Este
> documento resume solo **lo que hace el Panel** hoy. Si cambias el formato,
> actualiza el contrato del repo mcmapp.

## Qué envía el Panel

Por cada token (`api/_lib/push.ts → dispatchNotification`):

```jsonc
{
  "to": "ExponentPushToken[...]",
  "title": "Título (máx 50)",
  "body": "Cuerpo (máx 200)",
  "sound": "default",
  "priority": "default" | "normal" | "high",
  "categoryId": "general" | "eventos" | "fotos",  // solo estas producen botones iOS
  "channelId": "default" | "urgente" | "eventos" | "celebraciones" |
               "cancionero" | "fotos" | "mantenimiento",  // Android: canal de sonido/silencio
  "richContent": { "image": "<url>" },  // solo si hay imagen (Android e iOS con NSE)
  "mutableContent": true,               // solo si hay imagen (obligatorio para que se vea en iOS)
  "data": {
    "id": "<notificationId>",           // crítico: dedup/leído en la app
    "category": "general|eventos|cancionero|fotos|celebraciones|urgente|mantenimiento",
    "internalRoute": "/(tabs)/..." | null,
    "bodyLong": "descripción extendida" ,  // solo si ≤1500 chars; si no, queda solo en Firebase
    "icon": "<url>" | null,
    "imageUrl": "<url>" | null,
    "actionButtons": [ { "text", "url", "isInternal" } ]  // hasta 3 (canónico)
  }
}
```

- **Botones de acción**: formato canónico `data.actionButtons` (array, máx. 3).
  El objeto único `actionButton` es legacy: se acepta al leer registros
  antiguos, pero ya no se envía.
- **`categoryId` ≠ `data.category`**: el primero solo activa los botones
  nativos iOS registrados (`general`/`eventos`/`fotos`; `celebraciones` se
  mapea a `eventos`, el resto a `general`). La categoría de negocio viaja en
  `data.category`.
- **`channelId` (Android, nuevo desde la build de agosto de 2026)**: el panel
  lo deriva de `data.category` con `resolveChannelId()` (`api/_lib/push.ts`) —
  mismo valor que la categoría, salvo `general`/desconocida → `default`. Es
  **obligatorio** mandarlo: la app tiene una lista **cerrada** de 7 canales
  (uno por categoría) y **descarta silenciosamente** cualquier push con un
  `channelId` que no haya declarado. Como el desplegable "Categoría" del
  composer ya solo ofrece esos 7 valores, la derivación es siempre segura.
  Efecto para el usuario: puede silenciar el cantoral o las fotos sin
  silenciar los avisos urgentes.
- **Registro en Firebase**: cada envío crea `/notifications/<id>` (historial
  que la app lee) y las programadas viven en `/scheduledNotifications/<id>`
  (ver `notificaciones-programadas.md`).
- **Rutas internas**: el desplegable del composer solo ofrece rutas reales de
  la app (`NotificationsSection.tsx → ROUTE_GROUPS`); la lista definitiva está
  en el contrato del repo mcmapp.

## Estructura esperada en `/pushTokens`

Para que **el dashboard** (activos 24h/7d) y **los filtros de segmentación**
funcionen, cada token debe guardarse así (lo escribe la app):

```jsonc
"/pushTokens/<tokenKey>": {
  "token": "ExponentPushToken[...]",        // obligatorio
  "platform": "ios" | "android" | "web",
  "lastActive": "2026-06-02T10:00:00.000Z", // ISO; alimenta activos 24h/7d
  "profileType": "familia" | "monitor" | "miembro" | null,      // eje "perfil"
  "delegationId": "mcm-castellon" | "mcm-madrid" | ... | null,  // eje "delegación"
  "topics": ["general", "eventos", "familias", "mcm-madrid", "event-jubileo"]
}
```

> El panel **filtra del lado servidor** combinando hasta 4 ejes (ver abajo). Si
> la app no guarda `profileType`/`delegationId`/`topics`, esos ejes no pueden
> funcionar (el token no entra en el segmento). Los dispositivos sin
> `profileType` (saltaron el onboarding) se cuentan, y el panel avisa de ellos.

## Segmentación de destinatarios (4 ejes + AND/OR)

El composer combina hasta cuatro ejes **opcionales**. Dentro de un eje el
criterio es OR; entre ejes distintos se aplica el conmutador `match`
(`all` = AND, por defecto; `any` = OR). El backend evalúa cada token así:

| Eje | Activo cuando | Criterio sobre el token |
|-----|---------------|-------------------------|
| Todos | `audience.todos === true` | `topics` incluye `"general"` |
| Perfil | `audience.perfiles.length > 0` | `profileType ∈ perfiles` |
| Delegación | `audience.delegaciones.length > 0` | `delegationId ∈ delegaciones` |
| Evento | `audience.eventId != null` | `topics` incluye `"event-<eventId>"` |

> Para avisar de **un evento concreto** (Jubileo, un encuentro…) se segmenta por
> el topic `event-<id>` (suscripción opt-in), **no** por `"eventos"`/`"general"`,
> que los tienen todos y llegarían a todo el mundo. El `<id>` es el id del
> registry de la app (`mcm-app/constants/events.ts`): p. ej. `jubileo`,
> `visitapapa26`.

El filtro usado se guarda en `/notifications/<id>.audience` (y en
`/scheduledNotifications/<id>.audience` para los programados), incluido el modo
`match`. Sin ningún eje activo, la notificación va a **todos**.

La lógica está duplicada a propósito en `src/lib/audience.ts` (preview de
recuento en el composer) y `api/_lib/push.ts` (filtrado real). **Si cambias una,
cambia la otra.**
