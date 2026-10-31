/**
 * Postgres local SIN Docker para desarrollo: `npm run db:local` (dejalo corriendo en una terminal).
 * Guarda los datos en ./.data/pg. URL: postgres://postgres:postgres@localhost:5433/lavafy
 */
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
import path from "node:path";

const dir = path.resolve(process.env.LOCAL_PG_DIR ?? ".data/pg");
const fresh = !existsSync(dir);
const pg = new EmbeddedPostgres({ databaseDir: dir, port: 5433, user: "postgres", password: "postgres", persistent: true, onLog: () => {} });

if (fresh) await pg.initialise();
await pg.start();
if (fresh) await pg.createDatabase("lavafy");
console.log("✅ Postgres local listo en postgres://postgres:postgres@localhost:5433/lavafy  (Ctrl+C para cortar)");

const stop = async () => {
  await pg.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
setInterval(() => {}, 1 << 30);
