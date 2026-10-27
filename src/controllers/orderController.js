import mongoose from "mongoose";
import Order from "../modules/Order.js";
import Product from "../modules/Product.js";

// Calculate and validate order lines
async function calculateOrder(items) {
  const orderItems = [];
  const usedProducts = new Set();
  let totalCents = 0;

  for (const item of items) {
    if (!item || typeof item !== "object") {
      return { error: "Invalid order item", status: 400 };
    }

    const { productId, quantity } = item;

    if (
      !mongoose.isValidObjectId(productId) ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 10
    ) {
      return { error: "Invalid product ID or quantity", status: 400 };
    }

    const normalizedId = productId.toString().toLowerCase();

    if (usedProducts.has(normalizedId)) {
      return { error: "Duplicate products are not allowed", status: 400 };
    }

    usedProducts.add(normalizedId);

    const product = await Product.findById(productId);

    if (!product) {
      return { error: "Product not found", status: 404 };
    }

    if (!product.available) {
      return { error: "Product unavailable", status: 409 };
    }

    if (!Number.isSafeInteger(product.priceCents) || product.priceCents <= 0) {
      return { error: "Invalid stored product price", status: 500 };
    }

    const lineTotal = product.priceCents * quantity;

    if (!Number.isSafeInteger(lineTotal)) {
      return { error: "Order total exceeds safe limit", status: 400 };
    }

    totalCents += lineTotal;

    if (!Number.isSafeInteger(totalCents)) {
      return { error: "Order total exceeds safe limit", status: 400 };
    }

    orderItems.push({
      product: product._id,
      productName: product.name,
      quantity,
      unitPriceCents: product.priceCents,
    });
  }

  return { orderItems, totalCents };
}

// POST create order
export async function createOrder(req, res) {
  try {
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      return res.status(400).json({
        error: { message: "Request body is required" },
      });
    }

    const { items } = req.body;

    if (!Array.isArray(items) || items.length < 1 || items.length > 10) {
      return res.status(400).json({
        error: { message: "Order must contain 1 to 10 items" },
      });
    }

    const result = await calculateOrder(items);

    if (result.error) {
      return res.status(result.status).json({
        error: { message: result.error },
      });
    }

    const order = await Order.create({
      customer: req.user._id,
      items: result.orderItems,
      totalCents: result.totalCents,
      status: "new",
    });

    return res.status(201).json(order);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: { message: "Error creating order" },
    });
  }
}
