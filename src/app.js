import express from "express";
import swaggerUi from "swagger-ui-express";
import { readFileSync } from "node:fs";
import productRoutes from "./routes/productRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import { notFound, errorHandler } from "./middleware/errorMiddleware.js";

const app = express();
const openapi = JSON.parse(
  readFileSync(new URL("../docs/openapi.json", import.meta.url), "utf8"),
);

app.use(express.json());

app.get("/api/health", (req, res) => {
  return res.status(200).json({
    status: "OK",
    message: "Mini E-commerce API is running",
  });
});

app.get("/api/docs.json", (req, res) => res.json(openapi));
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openapi));

app.use("/api/products", productRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/orders", orderRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
