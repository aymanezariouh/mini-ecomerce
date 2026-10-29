import express from "express";

import {
  createOrder,
  getMyOrders,
  getAllOrders,
  getOrderById,
  updateOrderStatus,
} from "../controllers/orderController.js";

import { protect, customerOnly, sellerOnly } from "../middleware/authMiddleware.js";

const router = express.Router();

// All order routes require authentication
router.use(protect);

// Customer routes
router.post("/", customerOnly, createOrder);
router.get("/me", customerOnly, getMyOrders);

// Seller routes
router.get("/", sellerOnly, getAllOrders);
router.patch("/:id/status", sellerOnly, updateOrderStatus);

// Owner or seller
router.get("/:id", getOrderById);

export default router;
