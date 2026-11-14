import { config } from "dotenv";
import path from "node:path";

// Toujours la base de test : jamais la base de développement ou de production.
config({ path: path.resolve(__dirname, "../.env.test"), override: true, quiet: true });
if (!process.env.DATABASE_URL?.includes("test")) {
  throw new Error("Les tests doivent utiliser une base dont le nom contient « test » (.env.test).");
}
process.env.TZ = "UTC"; // le code ne doit pas dépendre du fuseau du serveur
