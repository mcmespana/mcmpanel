# MCM Panel — Guía para agentes

> La referencia completa y actualizada del proyecto está en **[CLAUDE.md](CLAUDE.md)**
> (secciones reales, nodos de Firebase, contratos con la app, mecánica de
> guardado, seguridad y comandos). Léelo antes de tocar nada.

Notas rápidas:

- **Stack**: React 18 + TypeScript + Vite + shadcn-ui/Tailwind. Deploy en **Vercel**
  (SPA + funciones serverless en `api/`).
- **Convenciones**: TypeScript estricto, componentes shadcn-ui, feedback con
  toasts, estados de carga en operaciones async.
- **Contratos de datos con la app**: viven en el repo `mcmapp`
  (`docs/contratos/*` y `docs/funcionalidades/EVENTOS.md`). Si cambias un
  formato, actualiza el contrato.
- **Verificación antes de push**: `npm run lint && npm run build`.
