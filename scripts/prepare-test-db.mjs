// Applique les migrations Prisma sur la base de test définie dans .env.test.
// Multiplateforme (Windows, macOS, Linux).
import { config } from "dotenv";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

if (!existsSync(".env.test")) {
  console.error("✖ Fichier .env.test introuvable. Copiez .env.test.example en .env.test.");
  process.exit(1);
}
const env = { ...process.env };
config({ path: ".env.test", override: true, processEnv: env, quiet: true });
if (!env.DATABASE_URL?.includes("test")) {
  console.error("✖ DATABASE_URL de .env.test doit désigner une base dont le nom contient « test ».");
  process.exit(1);
}
const r = spawnSync("npx", ["prisma", "migrate", "deploy"], { stdio: "inherit", env, shell: true });
process.exit(r.status ?? 1);
