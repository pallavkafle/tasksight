import type { Request } from "express";
import { AppError } from "../errors/AppError";

export function param(req: Request, name: string): string {
  const v = req.params[name];
  if (typeof v !== "string" || v.length === 0) {
    throw new AppError("NOT_FOUND", "Resource not found");
  }
  return v;
}
