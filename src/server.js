import express from "express";
import dotenv from "dotenv";
import connectDB from "./config/db.js";

dotenv.config();

const app = express();

app.use(express.json());

// Health check
app.get("/api/health", (req, res) => {
  return res.status(200).json({
    status: "OK",
    message: "Mini E-commerce API is running",
  });
});

const PORT = process.env.PORT || 3000;

async function startServer() {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
