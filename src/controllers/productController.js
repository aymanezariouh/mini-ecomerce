import mongoose from "mongoose";
import Product from "../modules/Product.js";

// GET all products
export async function getProducts(req, res) {
  try {
    const products = await Product.find();

    return res.status(200).json(products);
  } catch (error) {
    return res.status(500).json({
      message: "Error fetching products",
    });
  }
}

// GET product by ID
export async function getProductById(req, res) {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        message: "Invalid product ID",
      });
    }

    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({
        message: "Product not found",
      });
    }

    return res.status(200).json(product);
  } catch (error) {
    return res.status(500).json({
      message: "Error fetching product",
    });
  }
}

// POST create product
export async function createProduct(req, res) {
  try {
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      return res.status(400).json({
        message: "Request body is required",
      });
    }
    const { name, description, priceCents, available } = req.body;

    const product = await Product.create({
      name,
      description,
      priceCents,
      available,
    });

    return res.status(201).json(product);
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({
        message: "Invalid product data",
      });
    }

    return res.status(500).json({
      message: "Error creating product",
    });
  }
}
