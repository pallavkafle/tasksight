import type { RequestHandler } from "express";
import { AppError } from "../errors/AppError";
import { User } from "../models/User";
import { verifyAccessToken } from "../modules/auth/tokens";

export const requireAuth: RequestHandler = async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    next(new AppError("UNAUTHORIZED", "Missing Authorization header"));
    return;
  }

  let userId: string;
  try {
    userId = await verifyAccessToken(header.slice(7));
  } catch (err) {
    next(err);
    return;
  }

  const user = await User.findById(userId);
  if (!user) {
    next(new AppError("UNAUTHORIZED", "User no longer exists"));
    return;
  }

  req.user = { id: user.id, name: user.name, email: user.email };
  next();
};
