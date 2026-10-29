import mongoose from "mongoose";
import Product from "../modules/Product.js";

// GET all products
export async function getProducts(req, res) {
  try {
    const products = await Product.find();

    return res.status(200).json(products);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: { message: "Error fetching products" },
    });
  }
}

// GET one product
export async function getProductById(req, res) {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        error: { message: "Invalid product ID" },
      });
    }

    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({
        error: { message: "Product not found" },
      });
    }

    return res.status(200).json(product);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: { message: "Error fetching product" },
    });
  }
}

// POST create product
export async function createProduct(req, res) {
  try {
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      return res.status(400).json({
        error: { message: "Request body is required" },
      });
    }

    const { name, description, priceCents, available } = req.body;

    const allowedFields = ["name", "description", "priceCents", "available"];

    if (
      Object.keys(req.body).some((field) => !allowedFields.includes(field)) ||
      typeof name !== "string" ||
      !name.trim() ||
      !Number.isSafeInteger(priceCents) ||
      priceCents <= 0 ||
      (description !== undefined && typeof description !== "string") ||
      (available !== undefined && typeof available !== "boolean")
    ) {
      return res.status(400).json({
        error: { message: "Invalid product data" },
      });
    }

    const product = await Product.create({
      name,
      description,
      priceCents,
      available,
    });

    return res.status(201).json(product);
  } catch (error) {
    if (error.name === "ValidationError" || error.name === "CastError") {
      return res.status(400).json({
        error: { message: "Invalid product data" },
      });
    }

    console.error(error);

    return res.status(500).json({
      error: { message: "Error creating product" },
    });
  }
}

// PATCH update product
export async function updateProduct(req, res) {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        error: { message: "Invalid product ID" },
      });
    }

    if (
      !req.body ||
      typeof req.body !== "object" ||
      Array.isArray(req.body) ||
      Object.keys(req.body).length === 0
    ) {
      return res.status(400).json({
        error: { message: "A non-empty request body is required" },
      });
    }

    const { name, description, priceCents, available } = req.body;

    const allowedFields = ["name", "description", "priceCents", "available"];

    if (
      Object.keys(req.body).some((field) => !allowedFields.includes(field)) ||
      (name !== undefined && (typeof name !== "string" || !name.trim())) ||
      (description !== undefined && typeof description !== "string") ||
      (priceCents !== undefined &&
        (!Number.isSafeInteger(priceCents) || priceCents <= 0)) ||
      (available !== undefined && typeof available !== "boolean")
    ) {
      return res.status(400).json({
        error: { message: "Invalid product data" },
      });
    }

    const product = await Product.findByIdAndUpdate(
      id,
      { $set: req.body },
      {
        new: true,
        runValidators: true,
      },
    );

    if (!product) {
      return res.status(404).json({
        error: { message: "Product not found" },
      });
    }

    return res.status(200).json(product);
  } catch (error) {
    if (error.name === "ValidationError" || error.name === "CastError") {
      return res.status(400).json({
        error: { message: "Invalid product data" },
      });
    }

    console.error(error);

    return res.status(500).json({
      error: { message: "Error updating product" },
    });
  }
}
