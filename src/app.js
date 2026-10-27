import express from "express";
import { error } from "node:console";

const app = express();

app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    message: "mini E-commerce Api is running",
  });
});

export default app;
