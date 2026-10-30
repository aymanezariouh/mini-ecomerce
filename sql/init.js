import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Une base de demonstration separee : le fichier boutique.db existant
// n'est jamais utilise implicitement ni supprime.
const databasePath = process.argv[2]
  ? resolve(process.argv[2])
  : fileURLToPath(new URL("./demo.db", import.meta.url));

let db;

try {
  db = new Database(databasePath);
  db.pragma("foreign_keys = ON");
  db.exec(readFileSync(new URL("./schema.sql", import.meta.url), "utf8"));
  db.exec(readFileSync(new URL("./seed.sql", import.meta.url), "utf8"));
  console.log(`Base SQLite initialisee : ${databasePath}`);
  console.log("Relancer cette commande conserve les donnees et ne cree aucun doublon.");
} catch (error) {
  console.error("Erreur d'initialisation SQLite :", error.message);
  process.exitCode = 1;
} finally {
  if (db) db.close();
}
