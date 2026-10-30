import Database from "better-sqlite3";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const databasePath = process.argv[3]
  ? resolve(process.argv[3])
  : fileURLToPath(new URL("./demo.db", import.meta.url));

const customerId = Number(process.argv[2]);

if (!Number.isSafeInteger(customerId) || customerId <= 0) {
  console.error("Usage : node sql/getCustomerOrders.js <identifiant client> [base.db]");
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
      orders.createdAt,
      orders.customerNote
    FROM orders
    WHERE orders.customerId = ?
    ORDER BY orders.id
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
