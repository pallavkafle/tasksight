import type { ErrorRequestHandler, RequestHandler } from "express";
import mongoose from "mongoose";
import type { ApiError } from "@tasksight/shared";
import { AppError } from "./AppError";

// Runs when no route matched
export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new AppError("NOT_FOUND", `Route not found: ${req.method} ${req.path}`));
};

// Express 5 forwards async errors here automatically. Never leaks raw errors to the client.
export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  let appError: AppError;
  if (err instanceof AppError) {
    appError = err;
  } else if ((err as { type?: unknown } | null)?.type === "entity.parse.failed") {
    appError = new AppError("VALIDATION_ERROR", "Request body is not valid JSON");
  } else if ((err as { type?: unknown } | null)?.type === "entity.too.large") {
    appError = new AppError("PAYLOAD_TOO_LARGE", "Request body is too large");
  } else if (err instanceof mongoose.Error.CastError) {
    appError = new AppError("VALIDATION_ERROR", "Invalid identifier");
  } else {
    req.log.error({ err }, "unhandled error");
    appError = new AppError("INTERNAL", "Something went wrong");
  }

  const body: ApiError = {
    error: {
      code: appError.code,
      message: appError.message,
      ...(appError.details ? { details: appError.details } : {}),
    },
  };
  res.status(appError.status).json(body);
};
