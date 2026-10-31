# Lavafy · turnos para lavaderos

SaaS multi-lavadero: cada lavadero tiene su página (`lavafy.com.ar/mi-lavadero`) donde los clientes sacan turno online, y un panel para manejar la agenda, la capacidad, los servicios y los horarios.

## Stack (todo en Vercel)

| Pieza | Elección | Por qué |
|---|---|---|
| App | **Next.js 16** (App Router, Server Actions, Cache Components) + React 19 + TypeScript | Front y back en un solo proyecto y un solo deploy. |
| Estilos | Tailwind CSS v4, tokens de diseño del Lavafy anterior (`src/app/globals.css`) | Mismo look & feel, mobile-first. |
| Base | **Postgres** (Neon desde el Marketplace de Vercel) + **Drizzle ORM** | Sin binarios, arranque rápido en serverless, migraciones SQL versionadas. |
| Login | **Auth.js** con Google | Obligatorio para confirmar turnos (valida al cliente). |
| Emails | **Resend** | Confirmación, aprobación, cancelación, reprogramación, "tu auto está listo" y recordatorio. |
| Imágenes | **Vercel Blob** | Logo y portada del lavadero. |
| Cron | **Vercel Cron** (`vercel.json`) | Recordatorio diario a las 7:00. |

## Desarrollo local

Requisitos: Node 22+.

```bash
npm install
cp .env.example .env.local      # y completá AUTH_SECRET (npx auth secret)
npm run db:local                # Postgres local SIN Docker (dejalo abierto en otra terminal)
npm run db:migrate
npm run db:seed                 # 2 lavaderos de prueba con turnos
npm run dev                     # http://localhost:3000
```

Con `AUTH_DEV_LOGIN=true` en `.env.local` aparece **"Entrar sin Google"** en `/ingresar`, para probar sin configurar Google (solo funciona fuera de producción). Usuarios del seed: `dueno@lavafy.test` (dueño) y `cliente@lavafy.test`.

```bash
npm test          # tests del motor de turnos + integración con Postgres real (concurrencia incluida)
npm run lint
npm run typecheck
npm run build
```

## Estructura

```
src/
  app/
    page.tsx                 Directorio: buscar lavaderos (texto + "cerca mío")
    [slug]/page.tsx          Página pública del lavadero + reserva en 4 pasos
    turno/[code]/            Detalle del turno (cancelar, reprogramar, agendar, WhatsApp)
    mis-turnos/              Turnos del cliente
    ingresar/                Login con Google
    panel/(app)/             Panel del lavadero: agenda, turnos, servicios, horarios, configuración
    panel/nuevo/             Alta de un lavadero (onboarding)
    admin/                   Super admin (SUPER_ADMIN_EMAILS)
    api/slots                Horarios disponibles (lo usa el selector de horarios)
    api/cron/reminders       Recordatorios diarios
  db/schema.ts               Esquema completo (ver docs/base-de-datos.md)
  lib/availability.ts        Motor de disponibilidad (funciones puras, testeadas)
  lib/time.ts                Zonas horarias y formato en castellano
  server/bookings.ts         Reglas de negocio de turnos (transacciones + lock por lavadero)
  server/actions/            Server actions (validadas con zod, con control de permisos)
  server/notifications.ts    Emails
  components/                UI (ui/, booking/, panel/, directory/, site/)
drizzle/                     Migraciones SQL
tests/                       Vitest
scripts/                     db-local, migrate, seed
```

## Deploy en Vercel (lavafy.com.ar)

1. Subí el repo a GitHub (`turquito1/lavafy-lavaderos`) e importalo en Vercel.
2. **Storage → Neon** (Postgres) → conectalo al proyecto: crea `DATABASE_URL`.
3. **Storage → Blob** → conectalo: crea `BLOB_READ_WRITE_TOKEN`.
4. Variables de entorno (ver `.env.example`): `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `APP_URL=https://lavafy.com.ar`, `RESEND_API_KEY`, `EMAIL_FROM`, `CRON_SECRET`, `SUPER_ADMIN_EMAILS`. **No** pongas `AUTH_DEV_LOGIN` en producción.
5. Google Cloud Console → credencial OAuth "Aplicación web" con la URI de redirección `https://lavafy.com.ar/api/auth/callback/google`.
6. Resend → verificá el dominio `lavafy.com.ar` para mandar desde `turnos@lavafy.com.ar`.
7. Build command: `npm run db:migrate && npm run build` (aplica migraciones en cada deploy).
8. Dominio: asigná `lavafy.com.ar` a este proyecto.

### Landing del detailing en `/landing`

La landing actual (otro proyecto de Vercel) pasa a vivir en `lavafy.com.ar/landing`:

1. En el proyecto de la landing poné `base: "/landing/"` (Vite) o `basePath: "/landing"` (Next) y redeployalo con su URL de Vercel.
2. En este proyecto definí `LANDING_URL=https://<landing>.vercel.app`. El rewrite ya está en `next.config.ts`.

## Roadmap sugerido

- **Cobro de la suscripción** (Mercado Pago suscripciones) y bloqueo al vencer el trial.
- **Señas online** con Mercado Pago al reservar (config por lavadero).
- **WhatsApp** (Cloud API) para confirmaciones y "tu auto está listo".
- **Empleados / boxes** como recursos (`resources`) para asignar cada auto.
- Métricas del lavadero (facturación, servicios más pedidos, ausencias).
