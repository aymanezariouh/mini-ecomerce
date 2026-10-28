import jwt from "jsonwebtoken";
import User from "../modules/User.js";

// Verify that the user is logged in
export async function protect(req, res, next) {
  try {
    const authorization = req.headers.authorization;

    if (!authorization || !authorization.startsWith("Bearer ")) {
      return res.status(401).json({
        error: {
          message: "Authentication required",
        },
      });
    }

    const token = authorization.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        error: {
          message: "Token missing",
        },
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        error: {
          message: "User no longer exists",
        },
      });
    }

    req.user = user;

    next();
  } catch (error) {
    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError" ||
      error.name === "NotBeforeError"
    ) {
      return res.status(401).json({
        error: {
          message: "Invalid or expired token",
        },
      });
    }

    console.error(error);

    return res.status(500).json({
      error: {
        message: "Authentication error",
      },
    });
  }
}

// Check that the logged-in user is a seller
export function sellerOnly(req, res, next) {
  if (!req.user || req.user.role !== "seller") {
    return res.status(403).json({
      error: {
        message: "Seller access required",
      },
    });
  }

  next();
}
