import "dotenv/config";
import mongoose from "mongoose";
import Product from "../modules/Product.js";
import { readSeedUser, ensureSeedUsers } from "./seedUsers.js";

async function seedDemo() {
  try {
    const users = [
      readSeedUser("SELLER", "seller", "Shop Seller"),
      readSeedUser("CUSTOMER_ONE", "customer", "Customer One"),
      readSeedUser("CUSTOMER_TWO", "customer", "Customer Two"),
    ];

    if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required");
    await mongoose.connect(process.env.MONGODB_URI);
    await ensureSeedUsers(users);

    const products = [
      { _id: "650000000000000000000001", name: "Wireless Mouse", priceCents: 2500, available: true },
      { _id: "650000000000000000000002", name: "Mechanical Keyboard", priceCents: 6500, available: true },
      { _id: "650000000000000000000003", name: "USB-C Cable", priceCents: 1200, available: true },
      { _id: "650000000000000000000004", name: "Laptop Stand", priceCents: 3900, available: true },
      { _id: "650000000000000000000005", name: "Bluetooth Headphones", priceCents: 4500, available: false },
    ];

    // Fixed demonstration IDs prevent duplicates without requiring unique product names.
    for (const product of products) {
      await Product.updateOne(
        { _id: product._id },
        { $setOnInsert: product },
        { upsert: true, runValidators: true },
      );
    }

    console.log("Demonstration seed ready: 1 seller, 2 customers, 5 products (1 unavailable).");
    console.log("Existing accounts, passwords and products are preserved.");
  } catch (error) {
    console.error("Seed error:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

seedDemo();
