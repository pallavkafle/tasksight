import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import type { Express } from "express";
import mongoose from "mongoose";
import { createApp } from "../src/app";
import { env, envSchema } from "../src/config/env";
import { errorHandler } from "../src/errors/handler";
import { User } from "../src/models/User";
import { Workspace } from "../src/models/Workspace";
import { WorkspaceMember } from "../src/models/WorkspaceMember";
import { hashRefreshToken } from "../src/modules/auth/tokens";

let app: Express;

beforeEach(() => {
  app = createApp();
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function register(email = `hardening_${Date.now()}_${Math.random()}@test.local`) {
  return request(app)
    .post("/auth/register")
    .send({ name: "Test", email, password: "Password123!" });
}

function cookieValue(res: request.Response): string {
  const cookies = res.headers["set-cookie"] as string[] | undefined;
  const found = cookies?.find((cookie) => cookie.startsWith("refreshToken="));
  if (!found) throw new Error("Missing refreshToken cookie");
  return found.split(";")[0]!;
}

function tokenRecord(familyId: string, expiresAt: Date, tokenHash = familyId) {
  return {
    tokenHash,
    familyId,
    expiresAt,
    previousTokenHash: null,
    previousUsedAt: null,
  };
}

describe("API hardening", () => {
  it("rolls back the account and personal workspace if registration setup fails", async () => {
    vi.spyOn(WorkspaceMember, "create").mockImplementationOnce(() => {
      throw new Error("Injected membership failure");
    });
    const email = `rollback_${Date.now()}@test.local`;

    const res = await register(email);

    expect(res.status).toBe(500);
    expect(await User.countDocuments({ email })).toBe(0);
    expect(await Workspace.countDocuments({ name: "My Workspace" })).toBe(0);
    expect(await WorkspaceMember.countDocuments({})).toBe(0);
  });

  it("prunes expired tokens and caps active tokens at 10 on login", async () => {
    const email = `login_cap_${Date.now()}@test.local`;
    expect((await register(email)).status).toBe(201);
    const user = await User.findOne({ email });
    if (!user) throw new Error("Registered user was not found");

    const now = Date.now();
    user.set("refreshTokens", [
      tokenRecord("expired", new Date(now - 1)),
      ...Array.from({ length: 11 }, (_, i) =>
        tokenRecord(`family-${i}`, new Date(now + 86_400_000)),
      ),
    ]);
    await user.save();

    const res = await request(app).post("/auth/login").send({ email, password: "Password123!" });

    expect(res.status).toBe(200);
    const updated = await User.findOne({ email });
    if (!updated) throw new Error("Logged-in user was not found");
    expect(updated.refreshTokens).toHaveLength(10);
    expect(updated.refreshTokens.every((token) => token.expiresAt.getTime() > now)).toBe(true);
    expect(updated.refreshTokens.some((token) => token.familyId === "family-0")).toBe(false);
    expect(updated.refreshTokens.some((token) => token.familyId === "family-10")).toBe(true);
  });

  it("prunes expired tokens and caps active tokens at 10 on refresh", async () => {
    const email = `refresh_cap_${Date.now()}@test.local`;
    const registered = await register(email);
    expect(registered.status).toBe(201);
    const cookie = cookieValue(registered);
    const rawToken = cookie.slice("refreshToken=".length);
    const user = await User.findOne({ email });
    if (!user) throw new Error("Registered user was not found");

    const now = Date.now();
    user.set("refreshTokens", [
      tokenRecord("expired", new Date(now - 1)),
      ...Array.from({ length: 11 }, (_, i) =>
        tokenRecord(`family-${i}`, new Date(now + 86_400_000)),
      ),
      tokenRecord("current-family", new Date(now + 86_400_000), hashRefreshToken(rawToken)),
    ]);
    await user.save();

    const res = await request(app).post("/auth/refresh").set("Cookie", cookie);

    expect(res.status).toBe(200);
    const updated = await User.findOne({ email });
    if (!updated) throw new Error("Refreshed user was not found");
    expect(updated.refreshTokens).toHaveLength(10);
    expect(updated.refreshTokens.every((token) => token.expiresAt.getTime() > now)).toBe(true);
    expect(updated.refreshTokens.some((token) => token.familyId === "family-0")).toBe(false);
  });

  it("prunes expired tokens and keeps logout token records bounded", async () => {
    const email = `logout_cap_${Date.now()}@test.local`;
    const registered = await register(email);
    const cookie = cookieValue(registered);
    const rawToken = cookie.slice("refreshToken=".length);
    const user = await User.findOne({ email });
    if (!user) throw new Error("Registered user was not found");

    const now = Date.now();
    user.set("refreshTokens", [
      tokenRecord("expired", new Date(now - 1)),
      ...Array.from({ length: 11 }, (_, i) =>
        tokenRecord(`family-${i}`, new Date(now + 86_400_000)),
      ),
      tokenRecord("current-family", new Date(now + 86_400_000), hashRefreshToken(rawToken)),
    ]);
    await user.save();

    await request(app).post("/auth/logout").set("Cookie", cookie).expect(204);

    const updated = await User.findOne({ email });
    if (!updated) throw new Error("Logged-out user was not found");
    expect(updated.refreshTokens.length).toBeLessThanOrEqual(10);
    expect(updated.refreshTokens.every((token) => token.expiresAt.getTime() > now)).toBe(true);
    expect(updated.refreshTokens.some((token) => token.familyId === "current-family")).toBe(false);
  });

  it("rejects production access-token secrets shorter than 32 characters", () => {
    const base = { ...env, NODE_ENV: "production" as const };
    expect(envSchema.safeParse({ ...base, JWT_ACCESS_SECRET: "x".repeat(31) }).success).toBe(false);
    expect(envSchema.safeParse({ ...base, JWT_ACCESS_SECRET: "x".repeat(32) }).success).toBe(true);
  });

  it("returns 500 rather than 401 when the user lookup fails", async () => {
    const registered = await register();
    vi.spyOn(User, "findById").mockImplementationOnce(() => {
      throw new Error("Database unavailable");
    });

    const res = await request(app)
      .get("/auth/me")
      .set("Authorization", `Bearer ${registered.body.accessToken}`);

    expect(res.status).toBe(500);
  });

  it("maps Mongoose cast errors to 400 and oversized JSON to 413", async () => {
    const castApp = express();
    castApp.get("/cast", (_req, _res, next) => {
      next(new mongoose.Error.CastError("ObjectId", "invalid", "_id"));
    });
    castApp.use(errorHandler);

    const cast = await request(castApp).get("/cast");
    expect(cast.status).toBe(400);
    expect(cast.body.error.code).toBe("VALIDATION_ERROR");

    const oversized = await request(app)
      .post("/auth/register")
      .send({
        name: "x".repeat(110_000),
        email: "oversized@test.local",
        password: "Password123!",
      });
    expect(oversized.status).toBe(413);
    expect(oversized.body.error.code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("sets no-store on the health response", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe("no-store");
  });

  it("returns 401 for an invalid access token", async () => {
    const res = await request(app).get("/auth/me").set("Authorization", "Bearer invalid-token");
    expect(res.status).toBe(401);
  });

  it("documents every configured API environment variable in the example", () => {
    const example = readFileSync(new URL("../.env.example", import.meta.url), "utf8");
    for (const name of Object.keys(env)) {
      expect(example).toMatch(new RegExp(`^${name}=`, "m"));
    }
  });
});
