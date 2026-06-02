# Notificaciones push — contrato de datos MCM Panel ↔ MCM App

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
  "token": "ExponentPushToken[...]",  // obligatorio
  "platform": "ios" | "android" | "web",
  "lastActive": "2026-06-02T10:00:00.000Z", // ISO; alimenta activos 24h/7d
  "userType": "joven" | "responsable" | ...,// para filtro "Tipo de perfil"
  "delegacion": "Castellón" | "Madrid" | ... // para filtro "Delegación"
}
```

> El panel **filtra del lado servidor**: `recipientType` se compara con
> `userType` y `delegacion` con `delegacion`. Si la app no guarda esos campos,
> la segmentación no puede funcionar (llega a todos).

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
