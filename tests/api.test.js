import { afterAll, beforeAll, beforeEach, describe, expect, test } from "@jest/globals";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";

import app from "../src/app.js";
import Order from "../src/modules/Order.js";
import Product from "../src/modules/Product.js";
import User from "../src/modules/User.js";

const TEST_DATABASE = "mini_ecommerce_test";
const TEST_SECRET = "only-for-automated-tests-never-for-deployment";
const PASSWORD = "test-password-123";
const MISSING_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";

let mongo;
let ownsConnection = false;
let passwordHash;
let seller;
let customer;
let otherCustomer;
let products;
let sellerToken;
let customerToken;
let otherCustomerToken;

function tokenFor(user, options = {}) {
  return jwt.sign({ id: user._id.toString(), role: user.role }, TEST_SECRET, {
    expiresIn: "1h",
    ...options,
  });
}

function expectError(response, status) {
  expect(response.status).toBe(status);
  expect(response.body).toEqual({ error: { message: expect.any(String) } });
  expect(response.body.error.message.length).toBeGreaterThan(0);
}

function expectNoCredentials(value) {
  const json = JSON.stringify(value);
  expect(json).not.toContain("password");
  expect(json).not.toContain(passwordHash);
}

function createOrder(items, token = customerToken, extra = {}) {
  return request(app)
    .post("/api/orders")
    .auth(token, { type: "bearer" })
    .send({ items, ...extra });
}

function oneItem(quantity = 1, product = products[0]) {
  return [{ productId: product._id.toString(), quantity }];
}

// Never load .env or connect to MONGODB_URI: this suite owns its MongoDB process.
beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    throw new Error("Tests refuse to reuse an existing MongoDB connection");
  }

  process.env.JWT_SECRET = TEST_SECRET;
  mongo = await MongoMemoryServer.create({
    instance: { dbName: TEST_DATABASE, ip: "127.0.0.1" },
  });
  await mongoose.connect(mongo.getUri(TEST_DATABASE));
  ownsConnection = true;
  await Promise.all([User.init(), Product.init(), Order.init()]);
  passwordHash = await bcrypt.hash(PASSWORD, 4);
}, 180000);

beforeEach(async () => {
  // Even if test setup changes later, cleanup cannot target an external database.
  if (
    !ownsConnection ||
    mongoose.connection.name !== TEST_DATABASE ||
    mongoose.connection.host !== "127.0.0.1" ||
    mongoose.connection.port !== mongo.instanceInfo.port
  ) {
    throw new Error("Refusing cleanup outside the disposable test database");
  }

  await Promise.all([
    User.deleteMany({}),
    Product.deleteMany({}),
    Order.deleteMany({}),
  ]);

  [seller, customer, otherCustomer] = await User.create([
    { name: "Seller", email: "seller@example.test", passwordHash, role: "seller" },
    { name: "Customer A", email: "a@example.test", passwordHash, role: "customer" },
    { name: "Customer B", email: "b@example.test", passwordHash, role: "customer" },
  ]);

  products = await Product.create([
    { name: "Keyboard", priceCents: 1250 },
    { name: "Mouse", priceCents: 799 },
    { name: "Unavailable screen", priceCents: 2000, available: false },
  ]);

  sellerToken = tokenFor(seller);
  customerToken = tokenFor(customer);
  otherCustomerToken = tokenFor(otherCustomer);
});

afterAll(async () => {
  if (ownsConnection) await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

describe("Les huit exigences obligatoires", () => {
  test("1. calcule le total exact d'une commande de plusieurs lignes", async () => {
    const response = await createOrder([
      { productId: products[0]._id.toString(), quantity: 2 },
      { productId: products[1]._id.toString(), quantity: 3 },
    ]);

    expect(response.status).toBe(201);
    expect(response.body.totalCents).toBe(4897);
    expect(response.body.status).toBe("new");
    expect(response.body.items).toHaveLength(2);
    const saved = await Order.findById(response.body._id);
    expect(saved.totalCents).toBe(4897);
  });

  test.each([0, -1, 11, 1.5, "2", null, Number.MAX_SAFE_INTEGER + 1])(
    "2. refuse la quantité invalide %j sans sauvegarde",
    async (quantity) => {
      const response = await createOrder(oneItem(quantity));
      expectError(response, 400);
      expect(await Order.countDocuments()).toBe(0);
    },
  );

  test.each([
    ["post", "/api/products"],
    ["patch", `/api/products/${MISSING_ID}`],
    ["post", "/api/orders"],
    ["get", "/api/orders/me"],
    ["get", "/api/orders"],
    ["get", `/api/orders/${MISSING_ID}`],
    ["patch", `/api/orders/${MISSING_ID}/status`],
  ])("3. refuse %s %s sans authentification", async (method, path) => {
    const response = await request(app)[method](path);
    expectError(response, 401);
  });

  test("4. un client ne peut pas créer un produit", async () => {
    const response = await request(app)
      .post("/api/products")
      .auth(customerToken, { type: "bearer" })
      .send({ name: "Forbidden", priceCents: 100 });

    expectError(response, 403);
    expect(await Product.countDocuments()).toBe(3);
  });

  test("5. ignore le faux total et les faux prix envoyés par le client", async () => {
    const response = await createOrder(
      [{ ...oneItem(2)[0], unitPriceCents: 1, productName: "Fake name" }],
      customerToken,
      { totalCents: 1, customer: otherCustomer._id.toString(), status: "processed" },
    );

    expect(response.status).toBe(201);
    expect(response.body.totalCents).toBe(2500);
    expect(response.body.customer).toBe(customer._id.toString());
    expect(response.body.status).toBe("new");
    expect(response.body.items[0].unitPriceCents).toBe(1250);
    expect(response.body.items[0].productName).toBe("Keyboard");
  });

  test("6. un client ne peut pas lire la commande d'un autre client", async () => {
    const created = await createOrder(oneItem());
    expect(created.status).toBe(201);
    const response = await request(app)
      .get(`/api/orders/${created.body._id}`)
      .auth(otherCustomerToken, { type: "bearer" });

    expectError(response, 403);
  });

  test("7. refuse un produit indisponible sans sauvegarder les autres lignes", async () => {
    const response = await createOrder([
      ...oneItem(),
      ...oneItem(1, products[2]),
    ]);

    expectError(response, 409);
    expect(await Order.countDocuments()).toBe(0);
  });

  test("8. conserve le nom et le prix historiques après modification du produit", async () => {
    const created = await createOrder(oneItem(2));
    expect(created.status).toBe(201);
    const changed = await request(app)
      .patch(`/api/products/${products[0]._id}`)
      .auth(sellerToken, { type: "bearer" })
      .send({ name: "New keyboard", priceCents: 9000 });
    expect(changed.status).toBe(200);

    const response = await request(app)
      .get(`/api/orders/${created.body._id}`)
      .auth(customerToken, { type: "bearer" });

    expect(response.status).toBe(200);
    expect(response.body.items[0]).toMatchObject({
      productName: "Keyboard",
      unitPriceCents: 1250,
      quantity: 2,
    });
    expect(response.body.totalCents).toBe(2500);
    const nextOrder = await createOrder(oneItem());
    expect(nextOrder.status).toBe(201);
    expect(nextOrder.body.totalCents).toBe(9000);
  });
});

describe("Produits", () => {
  test("la liste et le détail sont publics", async () => {
    const list = await request(app).get("/api/products");
    const detail = await request(app).get(`/api/products/${products[0]._id}`);
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(3);
    expect(detail.status).toBe(200);
    expect(detail.body.name).toBe("Keyboard");
  });

  test("un vendeur crée un produit disponible par défaut et peut le modifier", async () => {
    const created = await request(app)
      .post("/api/products")
      .auth(sellerToken, { type: "bearer" })
      .send({ name: "  New product  ", priceCents: 100 });
    expect(created.status).toBe(201);
    expect(created.body.name).toBe("New product");
    expect(created.body.available).toBe(true);

    const updated = await request(app)
      .patch(`/api/products/${created.body._id}`)
      .auth(sellerToken, { type: "bearer" })
      .send({ available: false, priceCents: 250 });
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({ available: false, priceCents: 250 });
  });

  test.each([
    ["nom vide", { name: " " }],
    ["nom absent", { name: null }],
    ["prix nul", { priceCents: 0 }],
    ["prix négatif", { priceCents: -1 }],
    ["prix fractionnaire", { priceCents: 1.5 }],
    ["prix sous forme de texte", { priceCents: "100" }],
    ["prix non sûr", { priceCents: Number.MAX_SAFE_INTEGER + 1 }],
    ["disponibilité non booléenne", { available: "false" }],
    ["description non textuelle", { description: 123 }],
    ["champ inconnu", { role: "seller" }],
  ])("refuse la création et la modification avec %s", async (label, invalid) => {
    const created = await request(app)
      .post("/api/products")
      .auth(sellerToken, { type: "bearer" })
      .send({ name: "Invalid", priceCents: 100, ...invalid });
    expectError(created, 400);

    const updated = await request(app)
      .patch(`/api/products/${products[0]._id}`)
      .auth(sellerToken, { type: "bearer" })
      .send(invalid);
    expectError(updated, 400);
    expect(await Product.countDocuments()).toBe(3);
    expect((await Product.findById(products[0]._id)).priceCents).toBe(1250);
  });

  test("refuse une modification vide et la modification par un client", async () => {
    const empty = await request(app)
      .patch(`/api/products/${products[0]._id}`)
      .auth(sellerToken, { type: "bearer" })
      .send({});
    expectError(empty, 400);
    const forbidden = await request(app)
      .patch(`/api/products/${products[0]._id}`)
      .auth(customerToken, { type: "bearer" })
      .send({ priceCents: 1 });
    expectError(forbidden, 403);
  });

  test.each([["invalid", 400], [MISSING_ID, 404]])(
    "distingue le produit invalide ou absent %s (%i)",
    async (id, status) => {
      expectError(await request(app).get(`/api/products/${id}`), status);
      expectError(
        await request(app)
          .patch(`/api/products/${id}`)
          .auth(sellerToken, { type: "bearer" })
          .send({ priceCents: 100 }),
        status,
      );
    },
  );
});

describe("Authentification", () => {
  test("normalise l'email, hache le mot de passe et interdit l'inscription vendeur", async () => {
    const response = await request(app).post("/api/auth/register").send({
      name: "  New customer  ",
      email: "  NEW@EXAMPLE.TEST  ",
      password: PASSWORD,
      role: "seller",
    });

    expect(response.status).toBe(201);
    expect(response.body.user).toMatchObject({
      name: "New customer",
      email: "new@example.test",
      role: "customer",
    });
    expectNoCredentials(response.body);
    const saved = await User.findById(response.body.user.id).select("+passwordHash");
    expect(saved.passwordHash).not.toBe(PASSWORD);
    expect(await bcrypt.compare(PASSWORD, saved.passwordHash)).toBe(true);
  });

  test("refuse un email déjà enregistré après normalisation", async () => {
    const response = await request(app).post("/api/auth/register").send({
      name: "Duplicate",
      email: " A@EXAMPLE.TEST ",
      password: PASSWORD,
    });
    expectError(response, 409);
    expect(await User.countDocuments()).toBe(3);
  });

  test.each(["", "1234567", null, 12345678])(
    "refuse le mot de passe invalide %j",
    async (password) => {
      const response = await request(app).post("/api/auth/register").send({
        name: "Customer",
        email: "new@example.test",
        password,
      });
      expectError(response, 400);
    },
  );

  test("connecte le client avec un JWT sans exposer de mot de passe", async () => {
    const response = await request(app).post("/api/auth/login").send({
      email: " A@EXAMPLE.TEST ",
      password: PASSWORD,
    });
    expect(response.status).toBe(200);
    expectNoCredentials(response.body);
    expect(jwt.verify(response.body.token, TEST_SECRET).id).toBe(customer._id.toString());
    const protectedResponse = await request(app)
      .get("/api/orders/me")
      .auth(response.body.token, { type: "bearer" });
    expect(protectedResponse.status).toBe(200);
  });

  test.each([
    ["a@example.test", "wrong-password"],
    ["missing@example.test", PASSWORD],
  ])("refuse les identifiants incorrects (%s)", async (email, password) => {
    expectError(
      await request(app).post("/api/auth/login").send({ email, password }),
      401,
    );
  });

  test("refuse les JWT invalides, expirés ou sans utilisateur valide", async () => {
    const tokens = [
      "invalid-token",
      tokenFor(customer, { expiresIn: -1 }),
      jwt.sign({ id: MISSING_ID }, TEST_SECRET),
      jwt.sign({ id: "invalid-id" }, TEST_SECRET),
      jwt.sign({}, TEST_SECRET),
    ];
    for (const token of tokens) {
      const response = await request(app)
        .get("/api/orders/me")
        .auth(token, { type: "bearer" });
      expectError(response, 401);
    }
  });

  test("utilise le rôle en base plutôt qu'un rôle vendeur obsolète dans le JWT", async () => {
    const token = jwt.sign({ id: customer._id.toString(), role: "seller" }, TEST_SECRET);
    const response = await request(app)
      .post("/api/products")
      .auth(token, { type: "bearer" })
      .send({ name: "Forbidden", priceCents: 100 });
    expectError(response, 403);
  });
});

describe("Commandes et séparation des rôles", () => {
  test("accepte les bornes de dix lignes et dix unités", async () => {
    const extraProducts = await Product.create(
      Array.from({ length: 10 }, (_, index) => ({ name: `Product ${index}`, priceCents: 100 })),
    );
    const response = await createOrder(
      extraProducts.map((product) => ({ productId: product._id.toString(), quantity: 10 })),
    );
    expect(response.status).toBe(201);
    expect(response.body.items).toHaveLength(10);
    expect(response.body.totalCents).toBe(10000);
  });

  test.each([0, 11])("refuse %i lignes sans sauvegarde", async (length) => {
    const response = await createOrder(Array.from({ length }, () => oneItem()[0]));
    expectError(response, 400);
    expect(await Order.countDocuments()).toBe(0);
  });

  test("refuse un produit dupliqué, même avec un identifiant en majuscules", async () => {
    const response = await createOrder([
      ...oneItem(),
      { productId: products[0]._id.toString().toUpperCase(), quantity: 1 },
    ]);
    expectError(response, 400);
    expect(await Order.countDocuments()).toBe(0);
  });

  test.each([["invalid", 400], [MISSING_ID, 404]])(
    "refuse le produit de commande invalide ou absent %s",
    async (productId, status) => {
      const response = await createOrder([
        ...oneItem(),
        { productId, quantity: 1 },
      ]);
      expectError(response, status);
      expect(await Order.countDocuments()).toBe(0);
    },
  );

  test("refuse une multiplication dépassant la précision entière sûre", async () => {
    const expensive = await Product.create({ name: "Expensive", priceCents: Number.MAX_SAFE_INTEGER });
    const response = await createOrder(oneItem(2, expensive));
    expectError(response, 400);
    expect(await Order.countDocuments()).toBe(0);
  });

  test("refuse une somme dépassant la précision entière sûre", async () => {
    const expensive = await Product.create({ name: "Expensive", priceCents: Number.MAX_SAFE_INTEGER });
    const response = await createOrder([...oneItem(1, expensive), ...oneItem()]);
    expectError(response, 400);
    expect(await Order.countDocuments()).toBe(0);
  });

  test("isole les listes clients et permet au vendeur de voir toutes les commandes", async () => {
    const first = await createOrder(oneItem());
    const second = await createOrder(oneItem(), otherCustomerToken);
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);

    const customerList = await request(app)
      .get("/api/orders/me")
      .auth(customerToken, { type: "bearer" });
    expect(customerList.status).toBe(200);
    expect(customerList.body.map((order) => order._id)).toEqual([first.body._id]);

    const otherList = await request(app)
      .get("/api/orders/me")
      .auth(otherCustomerToken, { type: "bearer" });
    expect(otherList.status).toBe(200);
    expect(otherList.body.map((order) => order._id)).toEqual([second.body._id]);

    const sellerList = await request(app)
      .get("/api/orders")
      .auth(sellerToken, { type: "bearer" });
    expect(sellerList.status).toBe(200);
    expect(sellerList.body).toHaveLength(2);
    expectNoCredentials(sellerList.body);

    const sellerDetail = await request(app)
      .get(`/api/orders/${first.body._id}`)
      .auth(sellerToken, { type: "bearer" });
    expect(sellerDetail.status).toBe(200);
  });

  test("réserve les commandes clients et vendeurs à leur rôle respectif", async () => {
    expectError(
      await request(app).get("/api/orders").auth(customerToken, { type: "bearer" }),
      403,
    );
    expectError(
      await request(app).get("/api/orders/me").auth(sellerToken, { type: "bearer" }),
      403,
    );
    expectError(await createOrder(oneItem(), sellerToken), 403);
    const created = await createOrder(oneItem());
    expect(created.status).toBe(201);
    expectError(
      await request(app)
        .patch(`/api/orders/${created.body._id}/status`)
        .auth(customerToken, { type: "bearer" })
        .send({ status: "processed" }),
      403,
    );
  });

  test("le traitement est idempotent et interdit le retour au statut new", async () => {
    const created = await createOrder(oneItem());
    expect(created.status).toBe(201);
    const path = `/api/orders/${created.body._id}/status`;
    const processed = await request(app)
      .patch(path)
      .auth(sellerToken, { type: "bearer" })
      .send({ status: "processed" });
    expect(processed.status).toBe(200);
    expect(processed.body.status).toBe("processed");

    const repeated = await request(app)
      .patch(path)
      .auth(sellerToken, { type: "bearer" })
      .send({ status: "processed" });
    expect(repeated.status).toBe(200);
    expect(repeated.body).toEqual(processed.body);

    const reversed = await request(app)
      .patch(path)
      .auth(sellerToken, { type: "bearer" })
      .send({ status: "new" });
    expectError(reversed, 400);
    expect((await Order.findById(created.body._id)).status).toBe("processed");
  });

  test.each([["invalid", 400], [MISSING_ID, 404]])(
    "distingue la commande invalide ou absente %s (%i)",
    async (id, status) => {
      expectError(
        await request(app).get(`/api/orders/${id}`).auth(customerToken, { type: "bearer" }),
        status,
      );
      expectError(
        await request(app)
          .patch(`/api/orders/${id}/status`)
          .auth(sellerToken, { type: "bearer" })
          .send({ status: "processed" }),
        status,
      );
    },
  );
});

describe("HTTP et format uniforme des erreurs", () => {
  test("la route de santé fonctionne", async () => {
    const response = await request(app).get("/api/health");
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("OK");
  });

  test("une route inconnue retourne une erreur JSON", async () => {
    expectError(await request(app).get("/api/missing"), 404);
  });

  test("un JSON mal formé retourne une erreur JSON", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send('{"email":');
    expectError(response, 400);
  });

  test.each(["/api/auth/register", "/api/auth/login", "/api/products", "/api/orders"])(
    "refuse un corps absent sur %s",
    async (path) => {
      const token = path === "/api/products" ? sellerToken : customerToken;
      const response = await request(app).post(path).auth(token, { type: "bearer" });
      expectError(response, 400);
    },
  );
});
