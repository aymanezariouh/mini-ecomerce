export function notFound(req, res) {
  return res.status(404).json({
    error: {
      message: "Route not found",
    },
  });
}

export function errorHandler(err, req, res, next) {
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({
      error: {
        message: "Invalid JSON format",
      },
    });
  }

  console.error(err);

  return res.status(500).json({
    error: {
      message: "Internal server error",
    },
  });
}
