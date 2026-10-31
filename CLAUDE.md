@AGENTS.md

# Lavafy (lavaderos físicos) — guía para Claude Code

- Idioma de la UI y los textos: castellano rioplatense (voseo). Código e identificadores en inglés.
- Next.js 16 con **Cache Components**: todo lo que lea cookies/sesión/DB por request va dentro de `<Suspense>`; las páginas exportan un shell sincrónico y un componente async interno. Leé `node_modules/next/dist/docs/` antes de usar APIs nuevas.
- Mutaciones: server actions en `src/server/actions/*`, validadas con zod, devuelven `ActionResult` (`ok`/`fail`) y llaman `refresh()`. Los emails van con `after()`.
- Reglas de turnos: SOLO en `src/server/bookings.ts` (transacción + `pg_advisory_xact_lock`). El cálculo de horarios es puro en `src/lib/availability.ts` y tiene tests: si lo tocás, corré `npm test`.
- Fechas: instantes en UTC (`timestamptz`); horarios del lavadero en minutos desde medianoche en `business.timezone`. Usá `src/lib/time.ts`, nunca `new Date("YYYY-MM-DD")`.
- Esquema: `src/db/schema.ts` → `npm run db:generate` → revisar el SQL en `drizzle/`. Ver `docs/base-de-datos.md`.
- UI: reusar `src/components/ui/*` (Button, Field, Card, Sheet, Switch, StatusBadge) y los tokens de `globals.css` (`bg-primary`, `text-ink`, `border-line`…). Mobile-first: probar en 320px de ancho; en grids usá `grid-cols-1` y `min-w-0` para evitar desbordes.
- Antes de terminar: `npm run lint && npm run typecheck && npm test && npm run build`.
