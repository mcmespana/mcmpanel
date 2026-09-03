---
title: MCM Panel — design.md
purpose: Guía de diseño para agentes que construyen interfaz en el panel de administración.
scope: mcmpanel. La app (repo mcmapp) tiene el suyo y manda en todo lo compartido.
authority: Este archivo manda sobre el criterio propio del agente. Los tokens de src/index.css mandan sobre este archivo.
---

# design.md — MCM Panel

**Lee antes [`design.md` del repo `mcmapp`](https://github.com/mcmespana/mcmapp/blob/main/design.md).**
Manda la app. Este archivo solo dice **en qué el panel es distinto a propósito**
y **en qué tiene que ir de la manita**.

---

## 1. Qué es esto y para quién

Herramienta interna. Quien la usa es una persona de la oficina técnica, en un
portátil, editando datos que salen publicados en el móvil de mucha gente. No es
una superficie de cara al público y **no tiene que parecerse a la app**.

Lo que se optimiza aquí, en este orden:

1. **Que no se rompa un dato.** Estado de guardado visible, confirmación antes
   de destruir, error legible con el path que ha fallado.
2. **Densidad.** Ver mucho sin hacer scroll. Tablas antes que tarjetas.
3. **Velocidad de teclado.** Formularios navegables sin ratón.
4. **Estética.** Al final, y cede el sitio a las tres anteriores.

## 2. Identidad propia: oscuro tipo consola

Es una decisión, no un accidente. Base gris azulada muy oscura, primario cian,
acento teal, glows sutiles, mono `JetBrains Mono` para datos y código,
`--radius` 12px, shadcn-ui como base de componentes.

**El panel es oscuro y solo oscuro.** `src/index.css` define los tokens
únicamente en `:root`; no hay bloque `.dark` ni tema claro. Cualquier
componente que copies de la documentación de shadcn asume claro por defecto:
compruébalo antes de darlo por bueno. **No añadas un tema claro** sin
pedírselo al usuario — es más superficie que mantener a cambio de nada.

Tokens en `src/index.css` (HSL, formato shadcn) y `tailwind.config.ts`. Como en
la app: **no inventes, no redeclares, no alias**. Si falta un color, se añade
como variable con nombre semántico.

Efectos disponibles y cuándo: `.tech-glow` en el elemento activo o crítico de
la pantalla, **uno como mucho**. `gradient-primary` en cabeceras de sección.
`animate-pulse-subtle` solo mientras algo está realmente en curso.

## 3. Lo que se comparte con la app — innegociable

1. **Cuando el panel representa algo de la app, usa los colores de la app.**
   Colores de calendario, `tintColor` de evento, colores de perfil,
   previsualización de notificación o de encuesta: se pintan con los tokens
   reales de MCM, no con el cian del panel. El admin tiene que ver lo que la
   persona verá en el móvil.
   El espejo de tokens es [`src/lib/brandTokens.ts`](src/lib/brandTokens.ts) —
   misma convención que `src/lib/profileCatalog.ts`, que ya es espejo del
   catálogo de la app. Ya lo usan el selector de color de calendarios y el
   acento por defecto de las encuestas.
2. **El vocabulario es el mismo** que en la app y en los contratos: perfil,
   delegación, evento, arreglo, playlist, encuesta. Nada de sinónimos "de
   admin".
3. **La forma de los datos manda sobre la estética.** `{ updatedAt, data }`,
   `updatedAt` siempre, IDs contra `profileCatalog`, escrituras granulares
   donde `CLAUDE.md` lo exige. Ninguna decisión visual justifica escribir un
   nodo de otra forma.

## 4. Reglas de la superficie

- **Tabla antes que tarjeta** para listas de más de cinco elementos. Nada de
  rejillas de cards para datos tabulares.
- **Un dato numérico es mono** y alineado a la derecha. IDs, hex, timestamps y
  paths, mono siempre.
- **Nada destructivo sin confirmación** y sin decir qué se va a borrar. No hay
  papelera en Firebase.
- **Estado de guardado siempre visible**: pendiente, guardando, guardado, error.
  El autoguardado cada 10 s es invisible por diseño; su resultado no.
- **Los errores de permisos van por `onRulesError` / `guardWrite`.** Una
  sección vacía sin explicación es un fallo de diseño, no de Firebase.
- **Feedback con toasts** (sonner), estados de carga en toda operación async.
- **Formularios**: label siempre visible (nada de solo placeholder), error bajo
  el campo, foco visible.

## 5. Rechaza los reflejos del diseño generado

- Rejilla de cards para lo que es una tabla.
- Más de un `.tech-glow` por pantalla; glow en elementos inertes.
- Gradientes de fondo a pantalla completa.
- Emoji como iconografía (hay `lucide-react`).
- Métricas decorativas que nadie ha pedido en la cabecera de una sección.
- Animar la aparición de filas de una tabla.
- Copy de marketing. Aquí se dice qué hace el botón y qué nodo escribe.

## 6. Antes de dar por buena una pantalla

- [ ] `npm run lint && npm run typecheck && npm run build`
- [ ] ¿Colores por variable CSS, cero hex nuevos?
- [ ] ¿Lo que representa datos de la app usa los colores de la app?
- [ ] ¿Escritura granular donde toca, `updatedAt` tocado?
- [ ] ¿Toda escritura/suscripción nueva pasa por `onRulesError`/`guardWrite`?
- [ ] ¿Se puede rellenar y enviar con el teclado?
- [ ] ¿Un error de red o de permisos se ve, y dice dónde?

## 7. Mantener este archivo

Si cambias un token, va a `src/index.css`. Si cambias una **regla**, va aquí.
Si la incoherencia que te encuentras es con la app, se anota en
`mcmapp/docs/planes/PLAN_DISENO.md` §G — no se arregla de paso.
