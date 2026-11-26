import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { createApp } from "../src/app";

let app: Express;
beforeEach(() => {
  app = createApp();
});

function cookieValue(res: request.Response): string {
  const cookies = res.headers["set-cookie"] as string[] | undefined;
  const found = cookies?.find((c) => c.startsWith("refreshToken="));
  if (!found) throw new Error("Missing refreshToken cookie");
  return found.split(";")[0]!;
}

describe("POST /auth/refresh with simultaneous requests", () => {
  it("lets two tabs refresh with the same cookie at the same time", async () => {
    const reg = await request(app)
      .post("/auth/register")
      .send({ name: "Race", email: "race@example.com", password: "Password123!" });
    expect(reg.status).toBe(201);
    const cookie = cookieValue(reg);

    const [a, b] = await Promise.all([
      request(app).post("/auth/refresh").set("Cookie", cookie),
      request(app).post("/auth/refresh").set("Cookie", cookie),
    ]);
    expect([a.status, b.status]).toEqual([200, 200]);

    // Both new cookies must keep working.
    const again1 = await request(app).post("/auth/refresh").set("Cookie", cookieValue(a));
    const again2 = await request(app).post("/auth/refresh").set("Cookie", cookieValue(b));
    expect(again1.status).toBe(200);
    expect(again2.status).toBe(200);
  });
});
