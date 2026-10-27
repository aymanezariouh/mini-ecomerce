import mongoose from "mongoose";
import dotenv from "dotenv";
import bcrypt from "bcrypt";

import User from "../modules/User.js";

dotenv.config();

async function seedSeller() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    const email = process.env.SELLER_EMAIL?.trim().toLowerCase();
    const password = process.env.SELLER_PASSWORD;

    if (!email || !password || password.length < 8) {
      throw new Error("Invalid seller credentials in .env");
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      console.log("Account already exists with this email");
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await User.create({
      name: "Shop Seller",
      email,
      passwordHash,
      role: "seller",
    });

    console.log("Seller account created successfully");
  } catch (error) {
    console.error("Seed error:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

seedSeller();
