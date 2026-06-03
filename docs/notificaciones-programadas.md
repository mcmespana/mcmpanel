# Notificaciones push programadas

Permite crear una notificación desde el panel y dejarla **programada** para que se
envíe automáticamente a la fecha y hora indicadas, sin que nadie tenga que estar
delante.

## Cómo funciona

```
[Panel · Crear Notificación]
   │  (toggle "Programar envío" + fecha/hora)
   ▼
POST /api/notifications/schedule
   │  guarda en Firebase /scheduledNotifications/{id} (status: "scheduled")
   ▼
[Cron externo · cron-job.org]  ──cada minuto──▶  GET /api/notifications/process-scheduled
   │  busca las que ya vencieron (scheduledFor <= ahora, status "scheduled")
   │  las marca "processing", las envía con la MISMA lógica que el envío normal
   │  (api/_lib/push.ts → Expo Push API) y las marca "sent"
   ▼
[Expo Push API] ─▶ dispositivos
```

> **¿Por qué un cron externo y no el de Vercel?** El plan **Hobby** de Vercel solo
> ejecuta los Cron Jobs una vez al día, así que no sirve para enviar "a la hora
> exacta". En vez de pagar el plan Pro, usamos un servicio de cron gratuito que
> hace un ping cada minuto al endpoint. La lógica de envío vive en nuestro código;
> el servicio externo solo "despierta" el proceso.

- El envío real reutiliza `dispatchNotification()` de `api/_lib/push.ts`, exactamente
  la misma ruta que el envío inmediato (`/api/notifications/send`). Una notificación
  programada que se envía aparece también en el **Historial** como cualquier otra,
  y la entrada de `/scheduledNotifications` queda enlazada con `sentNotificationId`.
- Las horas se guardan en **UTC** (ISO 8601). El panel usa la hora local del navegador
  del administrador para el selector y la conversión.

## Estados de una programación

| Estado       | Significado                                              |
|--------------|---------------------------------------------------------|
| `scheduled`  | Pendiente, esperando su hora. Se puede cancelar.        |
| `processing` | El cron la está enviando ahora mismo.                   |
| `sent`       | Enviada. `sentNotificationId` enlaza con `/notifications`.|
| `cancelled`  | Cancelada manualmente desde el panel antes de enviarse. |
| `failed`     | Hubo un error al enviar (ver campo `error`).            |

## Endpoints

- `POST /api/notifications/schedule` — crea una programación. Body = el mismo payload
  de `/send` más `scheduledFor` (ISO) y opcional `createdBy`.
- `GET /api/notifications/schedule` — lista todas las programaciones.
- `DELETE /api/notifications/schedule?id=<id>` — cancela una pendiente.
- `GET /api/notifications/process-scheduled` — lo invoca el cron externo. No usar a mano.

## Configuración (plan gratuito, sin Vercel Pro)

### 1. Variable de entorno `CRON_SECRET` (recomendado)

En el proyecto de Vercel → Settings → Environment Variables, crea `CRON_SECRET` con
un valor secreto largo (p. ej. genera uno con `openssl rand -hex 32`). Sirve para que
**solo** tu cron pueda disparar el envío y nadie desde fuera. Vuelve a desplegar para
que tome efecto.

> Si no defines `CRON_SECRET`, el endpoint queda abierto (cualquiera que conozca la
> URL podría dispararlo). Úsalo al menos en producción.

`VITE_FIREBASE_DATABASE_URL` (o `FIREBASE_DATABASE_URL`) ya debe estar configurada,
igual que para el envío inmediato.

### 2. Cron externo gratuito (cron-job.org)

1. Crea una cuenta gratis en https://cron-job.org.
2. **Create cronjob** con estos datos:
   - **URL**: `https://TU-DOMINIO.vercel.app/api/notifications/process-scheduled`
   - **Schedule**: cada minuto (`Every 1 minute`).
   - **Autenticación** (elige UNA):
     - *Opción A — cabecera (recomendada):* en "Advanced → Headers" añade
       `Authorization: Bearer <CRON_SECRET>`.
     - *Opción B — query param:* usa la URL
       `https://TU-DOMINIO.vercel.app/api/notifications/process-scheduled?secret=<CRON_SECRET>`.
3. Guarda. A partir de ahí, cada minuto comprobará la cola y enviará lo que toque.

> Cualquier servicio equivalente sirve (EasyCron, Uptime cron, etc.). Lo único que
> necesita es hacer una petición HTTP GET cada minuto a esa URL con el secreto.

### Comprobación rápida

Programa una notificación a 1–2 minutos vista y observa en la pestaña «Programadas»
cómo pasa de `Programada` → `Enviando` → `Enviada`. También puedes mirar los logs de
ejecución en el panel de cron-job.org (debe devolver HTTP 200).

## Reglas de Firebase

Se añade un nodo nuevo `/scheduledNotifications`. Cuando se implemente la capa de
autenticación/reglas, hay que dar a este nodo el mismo tratamiento que a
`/notifications` (lectura para el panel, escritura controlada).
