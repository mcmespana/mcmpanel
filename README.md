# MCM Panel

Panel de administración del ecosistema MCM App. Ver [CLAUDE.md](CLAUDE.md) para
el contexto completo (arquitectura, secciones, contratos de datos, seguridad).

## Desarrollo

Requiere Node.js y npm.

```sh
npm install
npm run dev
```

Copia las variables `VITE_*` de Firebase a un `.env.local` (ver
`src/lib/firebase.ts` para la lista de claves esperadas).

## Comandos

```sh
npm run dev        # desarrollo (localhost:8080)
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
npm run build      # build de producción (vite build)
npm run preview    # smoke test del build
```

## Stack

Vite + TypeScript + React + shadcn-ui + Tailwind CSS. Desplegado en Vercel
(SPA + funciones serverless en `api/`).
