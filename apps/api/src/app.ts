import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { pinoHttp } from "pino-http";
import { corsOrigins, env } from "./config/env";
import { logger } from "./logger";
import { AppError } from "./errors/AppError";
import { errorHandler, notFoundHandler } from "./errors/handler";
import { healthRouter } from "./routes/health";
import { authRouter } from "./routes/auth";
import { workspaceRouter } from "./routes/workspaces";

export function createApp() {
  const app = express();

  app.set("trust proxy", env.TRUST_PROXY_HOPS);

  app.use(pinoHttp({ logger }));
  app.use(helmet());
  app.use(
    cors({
      origin: (origin, callback) => callback(null, !origin || corsOrigins.includes(origin)),
      credentials: true,
      allowedHeaders: ["Content-Type", "Authorization"],
    }),
  );

  app.use(healthRouter);

  app.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });

  app.use(
    rateLimit({
      windowMs: env.RATE_LIMIT_WINDOW_MS,
      limit: env.RATE_LIMIT_MAX,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      handler: (_req, _res, next) =>
        next(new AppError("RATE_LIMITED", "Too many requests, try again later")),
    }),
  );

  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    handler: (_req, _res, next) =>
      next(new AppError("RATE_LIMITED", "Too many auth attempts, try again later")),
  });
  app.use("/auth", authLimiter);

  app.use(authRouter);
  app.use(workspaceRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
