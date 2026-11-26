import type { Request } from "express";
import { isObjectIdOrHexString } from "mongoose";
import { AppError } from "../errors/AppError";

export function param(req: Request, name: string): string {
  const v = req.params[name];
  if (typeof v !== "string" || v.length === 0) {
    throw new AppError("NOT_FOUND", "Resource not found");
  }
  return v;
}
// Stricter than isValidObjectId (which accepts any 12-char string).
// Use for user-supplied ids that must resolve to an existing document.
export function objectIdParam(req: Request, name: string): string {
  const v = param(req, name);
  if (!isObjectIdOrHexString(v)) {
    throw new AppError("NOT_FOUND", "Resource not found");
  }
  return v;
}
