import express from "express";
import { createOrder } from "../controllers/orderController.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post(
  "/",
  protect,
  function (req, res, next) {
    if (req.user.role !== "customer") {
      return res.status(403).json({
        error: { message: "Customer access required" },
      });
    }

    next();
  },
  createOrder,
);

export default router;
