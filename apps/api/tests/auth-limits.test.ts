import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { createApp } from "../src/app";

let app: Express;
beforeEach(() => {
  app = createApp();
});

const user = { name: "Limit", email: "limit@example.com", password: "Password123!" };

describe("brute-force limiter", () => {
  it("does not count successful logins, only failed attempts", async () => {
    await request(app).post("/auth/register").send(user).expect(201);

    for (let i = 0; i < 22; i++) {
      const res = await request(app)
        .post("/auth/login")
        .send({ email: user.email, password: user.password });
      expect(res.status).toBe(200);
    }
  });
});
