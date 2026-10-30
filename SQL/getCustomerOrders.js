import Database from "better-sqlite3";
import { fileURLToPath } from "node:url";

const databasePath = fileURLToPath(new URL("./boutique.db", import.meta.url));

const customerId = Number(process.argv[2]);

if (!Number.isSafeInteger(customerId) || customerId <= 0) {
  console.error("Please provide a valid customer ID");
  process.exit(1);
}

let db;

try {
  db = new Database(databasePath, {
    readonly: true,
    fileMustExist: true,
  });

  db.pragma("foreign_keys = ON");

  const query = db.prepare(`
    SELECT
      orders.id AS orderId,
      orders.customerId,
      orders.totalCents,
      orders.status,
      orders.createdAt
    FROM orders
    WHERE orders.customerId = ?
  `);

  // Execute query with a safe parameter
  const orders = query.all(customerId);

  console.log(`Orders for customer ${customerId}:`);
  console.table(orders);
} catch (error) {
  console.error("SQLite error:", error.message);
  process.exitCode = 1;
} finally {
  if (db) {
    db.close();
  }
}
