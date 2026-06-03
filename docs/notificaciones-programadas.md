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
[Vercel Cron]  ──cada minuto──▶  GET /api/notifications/process-scheduled
   │  busca las que ya vencieron (scheduledFor <= ahora, status "scheduled")
   │  las marca "processing", las envía con la MISMA lógica que el envío normal
   │  (api/_lib/push.ts → Expo Push API) y las marca "sent"
   ▼
[Expo Push API] ─▶ dispositivos
```

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
- `GET /api/notifications/process-scheduled` — lo invoca el Cron de Vercel. No usar a mano.

## Configuración necesaria en Vercel

1. **Cron** (ya declarado en `vercel.json`):
   ```json
   "crons": [
     { "path": "/api/notifications/process-scheduled", "schedule": "* * * * *" }
   ]
   ```
   > ⚠️ Los Cron Jobs con frecuencia por minuto requieren el plan **Pro** de Vercel.
   > En el plan Hobby los crons solo se ejecutan una vez al día, por lo que la
   > precisión "a la hora exacta" no se cumpliría. Si seguís en Hobby, subid el
   > plan o ajustad la expectativa (p. ej. envíos diarios).

2. **`CRON_SECRET`** (recomendado): variable de entorno en el proyecto de Vercel.
   Cuando está definida, Vercel añade la cabecera `Authorization: Bearer <CRON_SECRET>`
   a las llamadas del cron y el endpoint rechaza cualquier petición que no la lleve,
   evitando que alguien lo dispare desde fuera. Si no se define, el endpoint queda
   abierto (útil para pruebas manuales).

3. `VITE_FIREBASE_DATABASE_URL` (o `FIREBASE_DATABASE_URL`) ya debe estar configurada,
   igual que para el envío inmediato.

## Reglas de Firebase

Se añade un nodo nuevo `/scheduledNotifications`. Cuando se implemente la capa de
autenticación/reglas, hay que dar a este nodo el mismo tratamiento que a
`/notifications` (lectura para el panel, escritura controlada).
