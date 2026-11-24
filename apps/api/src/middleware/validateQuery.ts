import type { RequestHandler } from "express";
import type { ZodTypeAny } from "zod";
import { AppError } from "../errors/AppError";

export function validateQuery<S extends ZodTypeAny>(schema: S): RequestHandler {
  return (req, _res, next) => {
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) {
      const details = parsed.error.issues.map((i) => ({
        path: i.path.map(String).join("."),
        message: i.message,
      }));
      next(new AppError("VALIDATION_ERROR", "Invalid query parameters", details));
      return;
    }
    req.valid = { ...(req.valid ?? {}), query: parsed.data };
    next();
  };
}
