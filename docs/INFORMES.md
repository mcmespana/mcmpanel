# Informes de encuestas — PDF, imágenes y enlaces públicos

> Sección **Encuestas → (una encuesta) → Respuestas → pestaña «Informe»**.
> Código: `src/lib/surveyReport.ts` (modelo), `src/components/report/` (pintor
> único), `src/components/sections/surveys/ReportBuilder.tsx` (panel),
> `src/pages/PublicReport.tsx` (página pública).

## Qué se puede sacar

| Salida | Cómo | Notas |
| ------ | ---- | ----- |
| **PDF** | Botón «PDF» → diálogo de impresión → *Guardar como PDF* | A4, texto vectorial, todos los comentarios desplegados. Lo imprimible vive en `#report-print-portal` (fuera de `#root`) y el CSS de `@media print` esconde el resto. |
| **Imagen resumen** | «Imagen resumen» / «Copiar imagen» | PNG vertical de 1080 px: una cifra por pregunta cerrada + «Lo más destacado». En el móvil abre la hoja de compartir (WhatsApp con la imagen adjunta); en el ordenador descarga o copia al portapapeles. |
| **Imagen de una pregunta** | Icono 🖼 en cada tarjeta | Captura la tarjeta tal cual, con un pie «emoji título · MCM» que solo sale en la imagen. |
| **Enlace público** | «Crear enlace público» | `/informe/<slug>`, sin login, mobile first. |

## Opciones del informe

Título, subtítulo, nota; filtro (perfil, delegación, plataforma, fechas);
comentarios (todos / solo favoritos / ninguno); firmar con nombre (**apagado
por defecto**); perfil y delegación bajo cada comentario; bloque «Quién ha
respondido»; qué preguntas entran. El borrador de opciones se recuerda por
encuesta en `localStorage` (`mcm-panel:report-draft:<surveyKey>`).

## Favoritos (solo en local)

- **Panel**: la ★ en Análisis, Individuales o en la vista previa del informe
  marca un comentario. Los favoritos son **«Lo más destacado»** del informe.
  Clave `mcm-panel:favs:<surveyKey>`; id de comentario `<questionId>~<deviceId>`
  (estable entre regeneraciones).
- **Página pública**: quien lee también puede marcar ★; le sale la pestaña
  **«Mi resumen»** con sus comentarios y botón de imagen. Clave
  `mcm-informe:favs:<slug>`. Nunca se sube a Firebase.

## Rutas condicionales (`showIf`) en los números

Una pregunta de una ruta solo cuenta a quien **la vio** (mismo algoritmo que
`visibleQuestions` de la app): «12 de 15 respondieron», no «12 de 38». La
tarjeta lo dice con «Solo si respondió «…»».

## Nodo Firebase — `/surveyReports/<slug>`

```
surveyReports/<slug>
├── updatedAt: ms
├── data: SurveyReport        ← lo único que lee la página pública
└── meta: { surveyKey, options: ReportOptions, createdAt }
```

- `data` es una **foto ya agregada**: medias, repartos, porcentajes y los
  comentarios elegidos. **Nunca** respuestas en bruto, `deviceId`, `userId` ni
  (salvo que se active «Firmar con el nombre») nombres.
- RTDB borra arrays vacíos: la página pública pasa por `normalizeReport()`.
- El slug lleva un sufijo aleatorio de 6 caracteres para que no se adivine.
- **Es una foto, no va en vivo.** En la tabla de enlaces se ve «+N nuevas»
  cuando hay respuestas posteriores. ↻ la regenera con sus opciones guardadas;
  ⚙ la pisa con lo que haya ahora en el editor; 🗑 la retira (quien tenga el
  enlace verá «Este informe ya no está disponible»).
- **Reglas** (`mcm-app/database.rules.json`, repo `mcmapp`): `$slug` legible
  por cualquiera; la raíz `/surveyReports` (listar y escribir) solo con
  `_config/legacyPanelWrites`. Con auth real en el panel (decisión D2) pasará a
  `isAdmin`.

## Rutas y despliegue

`vercel.json` ya reescribe todo a `index.html`; `App.tsx` detecta
`/informe/<slug>` **antes** del login y carga `PublicReport` en un chunk aparte.
