import express from "express";

import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
} from "../controllers/productController.js";

import { protect, sellerOnly } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Public routes
router.get("/", getProducts);
router.get("/:id", getProductById);

// Seller-only routes
router.post("/", protect, sellerOnly, createProduct);
router.put("/:id", protect, sellerOnly, updateProduct);

export default router;
