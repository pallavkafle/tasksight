import { Router, type Request, type Response } from "express";
import {
  loginSchema,
  registerSchema,
  type LoginInput,
  type RegisterInput,
} from "@tasksight/shared";
import { env } from "../config/env";
import { AppError } from "../errors/AppError";
import { requireAuth } from "../middleware/requireAuth";
import { validateBody } from "../middleware/validate";
import * as service from "../modules/auth/service";

const COOKIE_NAME = "refreshToken";
const COOKIE_PATH = "/api/auth";

function setRefreshCookie(res: Response, value: string, expiresAt: Date): void {
  res.cookie(COOKIE_NAME, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    path: COOKIE_PATH,
    expires: expiresAt,
  });
}

function readRefreshCookie(req: Request): string {
  const raw = req.cookies?.[COOKIE_NAME];
  if (typeof raw !== "string" || raw.length === 0) {
    throw new AppError("UNAUTHORIZED", "Missing refresh token cookie");
  }
  return raw;
}

export const authRouter = Router();

authRouter.post("/auth/register", validateBody(registerSchema), async (req, res) => {
  const result = await service.register(req.valid?.body as RegisterInput);
  setRefreshCookie(res, result.refreshCookie.value, result.refreshCookie.expiresAt);
  res.status(201).json(result.body);
});

authRouter.post("/auth/login", validateBody(loginSchema), async (req, res) => {
  const result = await service.login(req.valid?.body as LoginInput);
  setRefreshCookie(res, result.refreshCookie.value, result.refreshCookie.expiresAt);
  res.status(200).json(result.body);
});

authRouter.post("/auth/refresh", async (req, res) => {
  const result = await service.refresh(readRefreshCookie(req));
  setRefreshCookie(res, result.refreshCookie.value, result.refreshCookie.expiresAt);
  res.status(200).json(result.body);
});

authRouter.post("/auth/logout", async (req, res) => {
  const raw = req.cookies?.[COOKIE_NAME];
  if (typeof raw === "string" && raw.length > 0) await service.logout(raw);
  res.clearCookie(COOKIE_NAME, { path: COOKIE_PATH });
  res.status(204).end();
});

authRouter.get("/auth/me", requireAuth, (req, res) => {
  res.status(200).json({ user: req.user });
});
