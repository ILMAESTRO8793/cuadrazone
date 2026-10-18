# CuadraZone

Marketplace en español para la comunidad evangélica de Panamá. React 19 + Vite + Tailwind 4 en el cliente; Express + tRPC + Zod en el servidor; MySQL + Drizzle en la base de datos. Inicio de sesión con Google. Independiente de Manus desde el 17 de octubre de 2026.

## Desarrollo local

1. Node 22 y pnpm 10.18 (`corepack enable`).
2. Copia `.env.example` como `.env` y complétalo (MySQL local, `SESSION_SECRET`, credenciales de Google).
3. `pnpm install`
4. `pnpm dev` y abre http://localhost:3000. Las tablas se crean solas al arrancar.

## Comandos

- `pnpm check`: comprobación de tipos.
- `pnpm test`: pruebas automáticas.
- `pnpm build` y `pnpm start`: compila y sirve en modo producción. Las migraciones pendientes se aplican solas al arrancar.
- `pnpm db:push`: genera una migración nueva a partir de cambios en `drizzle/*schema.ts`.

## Despliegue

Ver `docs/despliegue-railway.md`.

## Estructura

- `client/`: interfaz (páginas, componentes, `public/assets` con logo e imágenes).
- `server/`: API tRPC, login (`_core/oauth.ts`, `_core/google.ts`), sesiones (`_core/sdk.ts`), fotos (`storage.ts`), documentos privados (`services/privateDocuments.ts`).
- `shared/`: tipos, precios y validaciones compartidas.
- `drizzle/`: esquema y migraciones.
- `docs/`: requisitos, decisiones y revisiones por etapa.
- `plan.md` y `TODO.md`: plan por etapas y estado actual.
