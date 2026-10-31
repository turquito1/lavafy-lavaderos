import EmbeddedPostgres from "embedded-postgres";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/** Levanta un Postgres real y temporal para tests de integración. */
export async function startTestDb() {
  const dir = path.join(tmpdir(), `lavafy-pg-${process.pid}-${Date.now()}`); // initdb crea la carpeta
  const port = 54000 + Math.floor(Math.random() * 1000);
  const pg = new EmbeddedPostgres({ databaseDir: dir, port, user: "postgres", password: "postgres", persistent: false, onLog: () => {} });
  await pg.initialise();
  await pg.start();
  await pg.createDatabase("test");
  const url = `postgres://postgres:postgres@localhost:${port}/test`;
  process.env.DATABASE_URL = url;
  const { migrate } = await import("drizzle-orm/node-postgres/migrator");
  const { db, pool } = await import("@/db");
  await migrate(db, { migrationsFolder: path.resolve(import.meta.dirname, "../../drizzle") });
  return {
    url,
    async stop() {
      await pool.end();
      await pg.stop();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
