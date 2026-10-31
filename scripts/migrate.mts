/** Aplica las migraciones de ./drizzle a DATABASE_URL. Se usa en local y en el deploy. */
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

config({ path: [".env.local", ".env"], quiet: true });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("❌ Falta DATABASE_URL. En Vercel: Storage → conectá la base Neon al proyecto.");
  process.exit(1);
}

let host = "?";
try {
  host = new URL(url).host;
} catch {
  console.error("❌ DATABASE_URL no es una URL válida.");
  process.exit(1);
}
const isLocalHost = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host);
if (process.env.VERCEL && isLocalHost) {
  console.error(
    `❌ En Vercel, DATABASE_URL apunta a tu compu (${host}). Borrá esa variable en Settings → Environment Variables y conectá la base Neon desde Storage.`,
  );
  process.exit(1);
}

console.log(`Aplicando migraciones en ${host}…`);
const pool = new Pool({ connectionString: url, max: 1 });
await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
await pool.end();
console.log("✅ Migraciones aplicadas");
