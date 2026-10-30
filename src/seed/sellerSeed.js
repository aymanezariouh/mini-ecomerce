import mongoose from "mongoose";
import dotenv from "dotenv";
import { readSeedUser, ensureSeedUsers } from "./seedUsers.js";

dotenv.config();

async function seedSeller() {
  try {
    const seller = readSeedUser("SELLER", "seller", "Shop Seller");
    if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required");
    await mongoose.connect(process.env.MONGODB_URI);
    await ensureSeedUsers([seller]);
    console.log("Seller account ready (existing password preserved)");
  } catch (error) {
    console.error("Seed error:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

seedSeller();
