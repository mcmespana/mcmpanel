# Notificaciones push — contrato de datos MCM Panel ↔ MCM App

> **Estado: ALINEADO** (2026-06-02). La MCM App devolvió el contrato real y el
> Panel se ha ajustado a él. Este documento refleja ya el formato canónico.

## Resumen del alineamiento aplicado en el Panel

- **Rutas internas**: lista corregida a las reales (`/(tabs)/index`,
  `/(tabs)/calendario`, `/(tabs)/fotos`, `/(tabs)/mas`, `/(tabs)/cancionero`,
  `/(tabs)/contigo[...]`, `/(tabs)/visitapapa`, `/notifications`). Eliminadas las
  inexistentes (`/(tabs)/actividades`, `/(tabs)/jubileo`, `/(tabs)/albums`,
  `/(tabs)/wordle`). Las que dependen del perfil se marcan con ⚠️.
- **Botón de acción**: ahora es **único** y se envía como `data.actionButton`
  (objeto `{ text, url, isInternal }`), el formato canónico de la app.
- **Segmentación**: por **`topics`** (perfil → familias/monitores/miembros,
  delegación → `mcm-*`). El backend filtra `topics.includes(t)` con AND. Por
  defecto (sin filtros) → **a todos** (envío masivo).
- **Categoría de negocio** (`data.category`): vocabulario alineado
  (general, eventos, cancionero, fotos, celebraciones, urgente, mantenimiento).
  El `categoryId` (iOS) se mapea automáticamente a `general`/`eventos`/`fotos`.
- **Imagen**: se envía `richContent.image` (Android) + siempre `data.imageUrl`
  (lo que usa la app, único soportado en iOS hoy).
- **`data.id`**: se mantiene (crítico para dedup en la app).
- Eliminado `data.priority` (la app no lo usa; vale el `priority` top-level).

---

## Contrato original (referencia histórica)

Este documento describe **qué envía exactamente el MCM Panel** al enviar una
notificación, para que la **MCM App** procese cada campo de forma coherente.
Sirve como base para el prompt de verificación que hay al final.

## Flujo

```
MCM Panel (UI) → /api/notifications/send (Vercel) → Expo Push API → dispositivos
                          ↓
                 Firebase /notifications/<id>  (historial + estado)
                 Firebase /pushTokens          (tokens + metadatos)
```

## Payload que llega a cada dispositivo (Expo)

El panel construye este mensaje por cada token (`api/notifications/send.ts`):

```jsonc
{
  "to": "ExponentPushToken[...]",
  "title": "Título (máx 50)",
  "body": "Cuerpo (máx 200)",
  "sound": "default",
  "priority": "default" | "normal" | "high",
  "categoryId": "<category>",          // p.ej. "general", "evento", "urgente"
  "richContent": { "image": "<url>" }, // solo si hay imageUrl
  "mutableContent": true,              // solo si hay imageUrl (iOS)
  "data": {
    "id": "<notificationId>",
    "category": "general | evento | actividad | cantoral | jubileo | urgente",
    "priority": "default | normal | high",
    "internalRoute": "/(tabs)/cancionero" | null,
    "icon": "<url>" | null,
    "imageUrl": "<url>" | null,
    "actionButtons": [ { "text": "...", "url": "..." } ]
  }
}
```

## Estructura esperada en `/pushTokens`

Para que **el dashboard** (activos 24h/7d) y **los filtros de segmentación**
funcionen, cada token debe guardarse así:

```jsonc
"/pushTokens/<deviceKey>": {
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
> que los tienen todos y llegarían a todo el mundo.

El filtro usado se guarda en `/notifications/<id>.audience` (y en
`/scheduledNotifications/<id>.audience` para los programados), incluido el modo
`match`. Sin ningún eje activo, la notificación va a **todos**.

## Campos que dependen de soporte en la app

| Campo | Qué hace el panel | Qué necesita la app |
|-------|-------------------|---------------------|
| `internalRoute` | Lo manda en `data.internalRoute` | Leerlo en el handler de "notificación tocada" y navegar (Expo Router) |
| `icon` | URL en `data.icon` | Render propio (lista in-app); iOS/Android no lo usan en la notificación del SO |
| `imageUrl` | `richContent.image` + `data.imageUrl` | iOS: Notification Service Extension; Android: se muestra solo |
| `actionButtons` | `data.actionButtons` | Registrar categorías con `setNotificationCategoryAsync` y `categoryId` |
| `categoryId` | = `category` de negocio | Si no hay categoría registrada con ese id, se ignora |

---

# PROMPT PARA LA MCM APP

> Copia y pega lo siguiente en la sesión de Claude/agente sobre el repo de la **MCM App**.

```
Contexto: el MCM Panel (dashboard de administración) envía notificaciones push
vía Expo Push API. Necesito alinear la app con lo que el panel envía. El payload
exacto por dispositivo es:

{
  "to": "ExponentPushToken[...]",
  "title": "...", "body": "...",
  "sound": "default",
  "priority": "default|normal|high",
  "categoryId": "<categoria>",
  "richContent": { "image": "<url>" },   // solo si hay imagen
  "mutableContent": true,                 // solo si hay imagen
  "data": {
    "id": "<uuid>",
    "category": "general|evento|actividad|cantoral|jubileo|urgente",
    "priority": "default|normal|high",
    "internalRoute": "/(tabs)/cancionero" | null,
    "icon": "<url>" | null,
    "imageUrl": "<url>" | null,
    "actionButtons": [ { "text": "...", "url": "..." } ]
  }
}

Revisa el código de notificaciones de la app y respóndeme con precisión:

1. RECEPCIÓN: ¿Dónde se reciben las notificaciones (listeners de
   expo-notifications: addNotificationReceivedListener y
   addNotificationResponseReceivedListener)? Pega el código.

2. NAVEGACIÓN (internalRoute): Cuando el usuario toca una notificación, ¿se lee
   `data.internalRoute` y se navega con Expo Router? Dame la LISTA EXACTA Y
   ACTUAL de rutas válidas (las del router real, ej. /(tabs)/...). En el panel
   tengo configuradas: /(tabs)/cancionero, /(tabs)/calendario,
   /(tabs)/actividades, /(tabs)/jubileo, /(tabs)/wordle, /(tabs)/albums.
   ¿Siguen siendo correctas? ¿"jubileo" sigue existiendo como ruta propia o se
   integró en actividades? ¿Cómo sería el deep link para abrir UNA actividad
   concreta (por id/slug)?

3. CATEGORÍAS / BOTONES DE ACCIÓN: ¿La app registra categorías con
   Notifications.setNotificationCategoryAsync? ¿Con qué identificadores? ¿Se usa
   `categoryId`? ¿Se leen los `data.actionButtons` (text/url) para algo, o se
   ignoran? Si no se usan, dime cómo deberían formatearse para que funcionen.

4. IMAGEN: ¿La app muestra la imagen de la notificación? ¿Tenéis Notification
   Service Extension (iOS) configurada? ¿Leéis `richContent.image` o
   `data.imageUrl`?

5. ICONO: ¿Se usa `data.icon` en algún sitio (p. ej. centro de notificaciones
   in-app)? ¿O es ignorado?

6. CATEGORÍA DE NEGOCIO: ¿Se hace algo con `data.category`
   (general/evento/actividad/cantoral/jubileo/urgente)? ¿Filtrado, icono,
   color, agrupación?

7. REGISTRO DE TOKENS (/pushTokens en Firebase Realtime DB): ¿Qué campos guarda
   la app por dispositivo? Necesito que guarde, además del token:
   - platform ("ios"|"android"|"web")
   - lastActive (ISO 8601, actualizado al abrir la app) → para "activos 24h/7d"
   - userType (tipo de perfil del usuario) → para segmentar
   - delegacion (delegación local) → para segmentar
   Dime cuáles guarda hoy y, si faltan userType/delegacion/lastActive, propón el
   cambio para añadirlos (de dónde sacar el perfil y la delegación del usuario).

8. ANDROID CHANNELS: ¿Qué notification channels tenéis creados
   (setNotificationChannelAsync) y con qué ids? Así el panel podría mandar
   `channelId` correcto en el futuro.

9. PRIORIDAD: ¿Se respeta `priority`? ¿Mapea bien a Android (high → heads-up)?

Devuélveme: (a) lista definitiva de rutas válidas, (b) lista de categoryIds /
categorías de acción registradas, (c) lista de channels Android, (d) campos que
hoy se guardan en /pushTokens y los que faltan, y (e) un resumen de qué campos
del payload se procesan y cuáles se ignoran. Con eso ajusto el panel para que
ambos lados queden 100% alineados.
```
