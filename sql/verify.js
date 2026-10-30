import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

// Les controles utilisent uniquement une base temporaire creee ici.
const temporaryDirectory = mkdtempSync(join(tmpdir(), "mini-ecommerce-sql-"));
const databasePath = join(temporaryDirectory, "verification.db");
let db;
let passed = 0;
let failed = 0;

function check(name, verify) {
  try {
    verify();
    passed += 1;
    console.log(`OK - ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`ECHEC - ${name}: ${error.message}`);
  }
}

function runScript(filename, argumentsList) {
  const result = spawnSync(
    process.execPath,
    [fileURLToPath(new URL(filename, import.meta.url)), ...argumentsList],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  return result.stdout;
}

try {
  check("Initialisation et seed repetables", () => {
    runScript("./init.js", [databasePath]);
    runScript("./init.js", [databasePath]);
    db = new Database(databasePath);
    db.pragma("foreign_keys = ON");
    assert.equal(db.prepare("SELECT count(*) AS n FROM users").get().n, 3);
    assert.equal(db.prepare("SELECT count(*) AS n FROM products").get().n, 3);
    assert.equal(db.prepare("SELECT count(*) AS n FROM orders").get().n, 2);
    assert.equal(db.prepare("SELECT count(*) AS n FROM order_items").get().n, 3);
    assert.deepEqual(
      db.prepare("SELECT role, count(*) AS n FROM users GROUP BY role ORDER BY role").all(),
      [{ role: "customer", n: 2 }, { role: "seller", n: 1 }],
    );
  });

  check("Quatre requetes SQL et totaux historiques", () => {
    const queries = readFileSync(new URL("./queries.sql", import.meta.url), "utf8")
      .split(";")
      .filter((query) => query.trim());
    assert.equal(queries.length, 4);
    const results = queries.map((query) => db.prepare(query).all());
    assert.deepEqual(results[0].map((product) => product.id), [1, 2]);
    assert.deepEqual(results[1].map((order) => order.id), [1]);
    assert.equal(results[2].length, 2);
    assert.equal(results[3][0].calculatedTotalCents, 6000);
    const totals = db.prepare(`
      SELECT o.totalCents, SUM(oi.quantity * oi.unitPriceCents) AS calculatedTotalCents
      FROM orders o JOIN order_items oi ON o.id = oi.orderId GROUP BY o.id
    `).all();
    for (const order of totals) assert.equal(order.totalCents, order.calculatedTotalCents);
  });

  check("Cles etrangeres actives et ligne orpheline refusee", () => {
    assert.equal(db.pragma("foreign_keys", { simple: true }), 1);
    assert.throws(
      () => db.prepare(`
        INSERT INTO order_items (orderId, productId, productName, quantity, unitPriceCents)
        VALUES (999999, 1, 'Mouse', 1, 2500)
      `).run(),
      { code: "SQLITE_CONSTRAINT_FOREIGNKEY" },
    );
    assert.deepEqual(db.pragma("foreign_key_check"), []);
  });

  check("Commandes des deux clients separees et requete parametree", () => {
    const query = db.prepare("SELECT id, customerId FROM orders WHERE customerId = ? ORDER BY id");
    assert.deepEqual(query.all(2), [{ id: 1, customerId: 2 }]);
    assert.deepEqual(query.all(3), [{ id: 2, customerId: 3 }]);
    assert.deepEqual(query.all("2 OR 1=1"), []);
    const customerOneOutput = runScript("./getCustomerOrders.js", ["2", databasePath]);
    const customerTwoOutput = runScript("./getCustomerOrders.js", ["3", databasePath]);
    assert.match(customerOneOutput, /Livrer apres 18 h/);
    assert.doesNotMatch(customerTwoOutput, /Livrer apres 18 h/);
    const invalidArgument = spawnSync(
      process.execPath,
      [fileURLToPath(new URL("./getCustomerOrders.js", import.meta.url)), "2 OR 1=1", databasePath],
      { encoding: "utf8" },
    );
    assert.equal(invalidArgument.status, 1);
  });

  check("customerNote facultatif : insertion et lecture", () => {
    const insert = db.prepare("INSERT INTO orders (id, customerId, totalCents, customerNote) VALUES (?, ?, ?, ?)");
    insert.run(10, 2, 2500, "Note de verification");
    insert.run(11, 3, 1000, null);
    assert.equal(db.prepare("SELECT customerNote FROM orders WHERE id = ?").get(10).customerNote, "Note de verification");
    assert.equal(db.prepare("SELECT customerNote FROM orders WHERE id = ?").get(11).customerNote, null);
    db.prepare("DELETE FROM orders WHERE id IN (10, 11)").run();
  });

  check("Contraintes email, roles, statuts, prix, quantites et doublons", () => {
    const rejectedStatements = [
      "INSERT INTO users VALUES (10, 'Duplicate', 'seller@example.com', 'demo', 'customer')",
      "INSERT INTO users VALUES (10, 'Role', 'role@example.com', 'demo', 'admin')",
      "UPDATE orders SET status = 'cancelled' WHERE id = 1",
      "UPDATE products SET name = ' ' WHERE id = 1",
      "UPDATE products SET available = 2 WHERE id = 1",
      "UPDATE products SET priceCents = 0 WHERE id = 1",
      "UPDATE products SET priceCents = 1.5 WHERE id = 1",
      "UPDATE products SET priceCents = 9007199254740992 WHERE id = 1",
      "UPDATE orders SET totalCents = 1.5 WHERE id = 1",
      "UPDATE orders SET totalCents = 9007199254740992 WHERE id = 1",
      "UPDATE order_items SET unitPriceCents = 0 WHERE id = 1",
      "UPDATE order_items SET unitPriceCents = 1.5 WHERE id = 1",
      "UPDATE order_items SET unitPriceCents = 9007199254740992 WHERE id = 1",
      "UPDATE order_items SET unitPriceCents = 9007199254740991 WHERE id = 1",
      "UPDATE order_items SET quantity = 0 WHERE id = 1",
      "UPDATE order_items SET quantity = 11 WHERE id = 1",
      "UPDATE order_items SET quantity = 1.5 WHERE id = 1",
      "INSERT INTO order_items (orderId, productId, productName, quantity, unitPriceCents) VALUES (1, 1, 'Mouse', 1, 2500)",
    ];
    for (const statement of rejectedStatements) {
      assert.throws(
        () => db.prepare(statement).run(),
        (error) => error.code?.startsWith("SQLITE_CONSTRAINT"),
        statement,
      );
    }
  });
} finally {
  if (db) db.close();
  rmSync(temporaryDirectory, { recursive: true, force: true });
}

console.log(`SQLite : ${passed} controles reussis, ${failed} echecs.`);
if (failed > 0) process.exitCode = 1;
