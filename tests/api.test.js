import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";

import app from "../src/app.js";
import Order from "../src/modules/Order.js";
import Product from "../src/modules/Product.js";
import User from "../src/modules/User.js";

const TEST_DB = "mini_ecommerce_test";
const TEST_SECRET = "secret-used-only-by-tests";

let mongo;
let customerToken;
let otherCustomerToken;
let sellerToken;
let keyboard;
let mouse;
let unavailableProduct;

function item(product, quantity = 1) {
  return { productId: product.id, quantity };
}

beforeAll(async () => {
  // MongoMemoryServer creates a new MongoDB process, separate from the local database.
  if (mongoose.connection.readyState !== 0) {
    throw new Error("A MongoDB connection is already open");
  }

  process.env.JWT_SECRET = TEST_SECRET;
  mongo = await MongoMemoryServer.create({
    instance: { dbName: TEST_DB, ip: "127.0.0.1" },
  });
  await mongoose.connect(mongo.getUri(TEST_DB));
}, 300000);

beforeEach(async () => {
  // Never clear a database unless it belongs to this temporary MongoDB process.
  if (
    !mongo ||
    mongoose.connection.name !== TEST_DB ||
    mongoose.connection.host !== "127.0.0.1" ||
    mongoose.connection.port !== mongo.instanceInfo.port
  ) {
    throw new Error("Refusing to clear a non-test database");
  }

  await Order.deleteMany({});
  await Product.deleteMany({});
  await User.deleteMany({});

  // Password hashes are placeholders here: these tests use JWTs, not the login route.
  const [seller, customer, otherCustomer] = await User.create([
    { name: "Seller", email: "seller@test.example", passwordHash: "test-hash", role: "seller" },
    { name: "Customer", email: "customer@test.example", passwordHash: "test-hash", role: "customer" },
    { name: "Other", email: "other@test.example", passwordHash: "test-hash", role: "customer" },
  ]);

  [keyboard, mouse, unavailableProduct] = await Product.create([
    { name: "Keyboard", priceCents: 1250 },
    { name: "Mouse", priceCents: 800 },
    { name: "Screen", priceCents: 2000, available: false },
  ]);

  sellerToken = jwt.sign({ id: seller.id, role: seller.role }, TEST_SECRET);
  customerToken = jwt.sign({ id: customer.id, role: customer.role }, TEST_SECRET);
  otherCustomerToken = jwt.sign({ id: otherCustomer.id, role: otherCustomer.role }, TEST_SECRET);
});

afterAll(async () => {
  if (!mongo) return;
  await mongoose.disconnect();
  await mongo.stop();
});

test("1. calculates the total for several order lines", async () => {
  const response = await request(app)
    .post("/api/orders")
    .set("Authorization", `Bearer ${customerToken}`)
    .send({ items: [item(keyboard, 2), item(mouse, 3)] });

  expect(response.status).toBe(201);
  expect(response.body.totalCents).toBe(4900); // 2 x 1250 + 3 x 800
  expect((await Order.findById(response.body._id)).totalCents).toBe(4900);
});

test("2. rejects invalid quantities", async () => {
  for (const quantity of [0, 11]) {
    const response = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ items: [item(keyboard, quantity)] });

    expect(response.status).toBe(400);
  }
  expect(await Order.countDocuments()).toBe(0);
});

test("3. rejects protected routes without a token", async () => {
  const orders = await request(app).get("/api/orders/me");
  const products = await request(app)
    .post("/api/products")
    .send({ name: "New product", priceCents: 100 });

  expect(orders.status).toBe(401);
  expect(products.status).toBe(401);
});

test("4. prevents a customer from creating a product", async () => {
  const response = await request(app)
    .post("/api/products")
    .set("Authorization", `Bearer ${customerToken}`)
    .send({ name: "New product", priceCents: 100 });

  expect(response.status).toBe(403);
  expect(await Product.countDocuments()).toBe(3);
});

test("5. uses database prices instead of a fake client total", async () => {
  const response = await request(app)
    .post("/api/orders")
    .set("Authorization", `Bearer ${customerToken}`)
    .send({
      items: [{ ...item(keyboard, 2), unitPriceCents: 1 }],
      totalCents: 1,
    });

  expect(response.status).toBe(201);
  expect(response.body.totalCents).toBe(2500);
  expect(response.body.items[0].unitPriceCents).toBe(1250);
});

test("6. prevents a customer from reading another customer's order", async () => {
  const created = await request(app)
    .post("/api/orders")
    .set("Authorization", `Bearer ${customerToken}`)
    .send({ items: [item(keyboard)] });

  expect(created.status).toBe(201);
  const response = await request(app)
    .get(`/api/orders/${created.body._id}`)
    .set("Authorization", `Bearer ${otherCustomerToken}`);

  expect(response.status).toBe(403);
});

test("7. rejects an unavailable product without saving a partial order", async () => {
  const response = await request(app)
    .post("/api/orders")
    .set("Authorization", `Bearer ${customerToken}`)
    .send({ items: [item(keyboard), item(unavailableProduct)] });

  expect(response.status).toBe(409);
  expect(await Order.countDocuments()).toBe(0);
});

test("8. keeps the purchase price after the product price changes", async () => {
  const created = await request(app)
    .post("/api/orders")
    .set("Authorization", `Bearer ${customerToken}`)
    .send({ items: [item(keyboard, 2)] });
  expect(created.status).toBe(201);

  const updated = await request(app)
    .patch(`/api/products/${keyboard.id}`)
    .set("Authorization", `Bearer ${sellerToken}`)
    .send({ priceCents: 9000 });
  expect(updated.status).toBe(200);

  const order = await request(app)
    .get(`/api/orders/${created.body._id}`)
    .set("Authorization", `Bearer ${customerToken}`);

  expect(order.status).toBe(200);
  expect(order.body.items[0].unitPriceCents).toBe(1250);
  expect(order.body.totalCents).toBe(2500);
});
