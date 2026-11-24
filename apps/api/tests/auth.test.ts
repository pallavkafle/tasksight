import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { createApp } from "../src/app";
import { User } from "../src/models/User";
import { hashRefreshToken } from "../src/modules/auth/tokens";

const validUser = {
  name: "Test",
  email: "test@example.com",
  password: "Password123!",
};

let app: Express;
beforeEach(() => {
  app = createApp();
});

function cookieValue(res: request.Response, name = "refreshToken"): string {
  const cookies = res.headers["set-cookie"] as string[] | undefined;
  const found = cookies?.find((c) => c.startsWith(`${name}=`));
  if (!found) throw new Error(`Missing ${name} cookie`);
  return found.split(";")[0]!;
}

async function register(overrides: Partial<typeof validUser> = {}) {
  return request(app)
    .post("/auth/register")
    .send({ ...validUser, ...overrides });
}

describe("POST /auth/register", () => {
  it("creates a user, returns an access token, and sets a secure cookie", async () => {
    const res = await register();
    expect(res.status).toBe(201);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.user).toEqual({
      id: expect.any(String),
      name: validUser.name,
      email: validUser.email,
    });
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.body.user.refreshTokens).toBeUndefined();
    expect(res.body.user._id).toBeUndefined();

    const cookie = res.headers["set-cookie"]?.[0] ?? "";
    expect(cookie).toContain("refreshToken=");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/api/auth");
  });

  it("rejects a duplicate email with 409 CONFLICT", async () => {
    await register();
    const res = await register();
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CONFLICT");
  });

  it("rejects invalid input with 400 VALIDATION_ERROR and details", async () => {
    const res = await request(app)
      .post("/auth/register")
      .send({ name: "", email: "not-an-email", password: "short" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(Array.isArray(res.body.error.details)).toBe(true);
    expect(res.body.error.details.length).toBeGreaterThanOrEqual(3);
  });
});

describe("POST /auth/login", () => {
  it("returns 200 with an access token for valid credentials", async () => {
    await register();
    const res = await request(app)
      .post("/auth/login")
      .send({ email: validUser.email, password: validUser.password });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.user.email).toBe(validUser.email);
  });

  it("returns 401 UNAUTHORIZED for a wrong password", async () => {
    await register();
    const res = await request(app)
      .post("/auth/login")
      .send({ email: validUser.email, password: "wrongwrong" });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });
});

describe("POST /auth/refresh", () => {
  it("rotates the refresh token and issues a new access token", async () => {
    const reg = await register();
    const oldCookie = cookieValue(reg);
    const res = await request(app).post("/auth/refresh").set("Cookie", oldCookie);
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
    const newCookie = cookieValue(res);
    expect(newCookie).not.toBe(oldCookie);
  });

  it("allows reuse of the previous token inside the grace window", async () => {
    const reg = await register();
    const a = cookieValue(reg);
    const rot1 = await request(app).post("/auth/refresh").set("Cookie", a);
    expect(rot1.status).toBe(200);
    // A is now the previous token, freshly rotated (0s elapsed < 10s grace)
    const rot2 = await request(app).post("/auth/refresh").set("Cookie", a);
    expect(rot2.status).toBe(200);
  });

  it("revokes the whole family on reuse after the grace window", async () => {
    const reg = await register();
    const a = cookieValue(reg);
    const b = cookieValue(await request(app).post("/auth/refresh").set("Cookie", a));

    // Push previousUsedAt 15s into the past: outside the 10s grace window.
    const hashA = hashRefreshToken(a.replace("refreshToken=", ""));
    const user = await User.findOne({ "refreshTokens.previousTokenHash": hashA });
    if (!user) throw new Error("expected user with previous token");
    const shifted = user.refreshTokens.map((t) => ({
      tokenHash: t.tokenHash,
      familyId: t.familyId,
      expiresAt: t.expiresAt,
      previousTokenHash: t.previousTokenHash ?? null,
      previousUsedAt: t.previousUsedAt ? new Date(Date.now() - 15000) : null,
    }));
    user.set("refreshTokens", shifted);
    await user.save();

    // Reuse of A: 401, family revoked.
    const reuse = await request(app).post("/auth/refresh").set("Cookie", a);
    expect(reuse.status).toBe(401);
    expect(reuse.body.error.code).toBe("UNAUTHORIZED");

    // B is in the same family, so it must also be dead.
    const bRes = await request(app).post("/auth/refresh").set("Cookie", b);
    expect(bRes.status).toBe(401);
  });
});

describe("POST /auth/logout", () => {
  it("clears the cookie and revokes the family", async () => {
    const reg = await register();
    const cookie = cookieValue(reg);
    const res = await request(app).post("/auth/logout").set("Cookie", cookie);
    expect(res.status).toBe(204);
    const cleared = res.headers["set-cookie"]?.[0] ?? "";
    expect(cleared).toContain("refreshToken=");
    expect(cleared).toContain("Expires=Thu, 01 Jan 1970");

    // Token is dead on the server side.
    const ref = await request(app).post("/auth/refresh").set("Cookie", cookie);
    expect(ref.status).toBe(401);
  });
});

describe("GET /auth/me", () => {
  it("returns the user with a valid bearer token", async () => {
    const reg = await register();
    const res = await request(app)
      .get("/auth/me")
      .set("Authorization", `Bearer ${reg.body.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({
      id: expect.any(String),
      name: validUser.name,
      email: validUser.email,
    });
  });

  it("returns 401 UNAUTHORIZED without a token", async () => {
    const res = await request(app).get("/auth/me");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });
});

describe("POST /auth/* rate limiting", () => {
  it("returns 429 RATE_LIMITED after 20 auth requests from the same IP", async () => {
    let last: request.Response | undefined;
    for (let i = 0; i < 21; i++) {
      last = await request(app)
        .post("/auth/login")
        .send({ email: "nobody@example.com", password: "nope" });
    }
    expect(last?.status).toBe(429);
    expect(last?.body.error.code).toBe("RATE_LIMITED");
  });
});
