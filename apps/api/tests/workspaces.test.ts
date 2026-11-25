import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { createApp } from "../src/app";

let app: Express;
beforeEach(() => {
  app = createApp();
});

let counter = 0;
async function makeUser(name: string) {
  counter++;
  const email = `u${counter}_${Date.now()}@test.local`;
  const res = await request(app)
    .post("/auth/register")
    .send({ name, email, password: "Password123!" });
  return { id: res.body.user.id as string, email, token: res.body.accessToken as string };
}

async function makeWorkspace(token: string, name = "Team") {
  const res = await request(app)
    .post("/workspaces")
    .set("Authorization", `Bearer ${token}`)
    .send({ name });
  return res.body.workspace.id as string;
}

describe("workspaces: create & list", () => {
  it("creates a workspace with the caller as owner", async () => {
    const owner = await makeUser("Owner");
    const res = await request(app)
      .post("/workspaces")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ name: "Engineering" });
    expect(res.status).toBe(201);
    expect(res.body.workspace).toEqual({
      id: expect.any(String),
      name: "Engineering",
      ownerId: owner.id,
    });
  });

  it("lists only workspaces the caller belongs to", async () => {
    const a = await makeUser("A");
    const b = await makeUser("B");
    await makeWorkspace(a.token, "A-space");
    await makeWorkspace(b.token, "B-space");

    const listA = await request(app).get("/workspaces").set("Authorization", `Bearer ${a.token}`);
    expect(listA.status).toBe(200);
    const namesA = listA.body.workspaces.map((w: { name: string }) => w.name);
    expect(namesA).toContain("A-space");
    expect(namesA).not.toContain("B-space");
  });
});

describe("workspaces: RBAC", () => {
  it("rejects a non-member with FORBIDDEN", async () => {
    const owner = await makeUser("Owner");
    const outsider = await makeUser("Outsider");
    const wsId = await makeWorkspace(owner.token);

    const res = await request(app)
      .get(`/workspaces/${wsId}`)
      .set("Authorization", `Bearer ${outsider.token}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("lets a viewer read but not add members or change roles", async () => {
    const owner = await makeUser("Owner");
    const viewer = await makeUser("Viewer");
    const target = await makeUser("Target");
    const wsId = await makeWorkspace(owner.token);

    await request(app)
      .post(`/workspaces/${wsId}/members`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ email: viewer.email, role: "viewer" })
      .expect(204);

    const read = await request(app)
      .get(`/workspaces/${wsId}`)
      .set("Authorization", `Bearer ${viewer.token}`);
    expect(read.status).toBe(200);

    const addAttempt = await request(app)
      .post(`/workspaces/${wsId}/members`)
      .set("Authorization", `Bearer ${viewer.token}`)
      .send({ email: target.email, role: "member" });
    expect(addAttempt.status).toBe(403);
    expect(addAttempt.body.error.code).toBe("FORBIDDEN");
  });

  it("lets a member read but not manage members", async () => {
    const owner = await makeUser("Owner");
    const member = await makeUser("Member");
    const target = await makeUser("Target");
    const wsId = await makeWorkspace(owner.token);

    await request(app)
      .post(`/workspaces/${wsId}/members`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ email: member.email, role: "member" })
      .expect(204);

    const read = await request(app)
      .get(`/workspaces/${wsId}`)
      .set("Authorization", `Bearer ${member.token}`);
    expect(read.status).toBe(200);

    const addAttempt = await request(app)
      .post(`/workspaces/${wsId}/members`)
      .set("Authorization", `Bearer ${member.token}`)
      .send({ email: target.email, role: "viewer" });
    expect(addAttempt.status).toBe(403);
  });
});

describe("workspaces: last-owner invariants", () => {
  it("forbids the last owner from leaving", async () => {
    const owner = await makeUser("Owner");
    const wsId = await makeWorkspace(owner.token);

    const res = await request(app)
      .delete(`/workspaces/${wsId}/leave`)
      .set("Authorization", `Bearer ${owner.token}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("forbids the last owner from demoting themselves", async () => {
    const owner = await makeUser("Owner");
    const wsId = await makeWorkspace(owner.token);

    const res = await request(app)
      .patch(`/workspaces/${wsId}/members/${owner.id}`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ role: "member" });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("allows the second owner to demote the first (not last anymore)", async () => {
    const a = await makeUser("A");
    const b = await makeUser("B");
    const wsId = await makeWorkspace(a.token);

    await request(app)
      .post(`/workspaces/${wsId}/members`)
      .set("Authorization", `Bearer ${a.token}`)
      .send({ email: b.email, role: "owner" })
      .expect(204);

    const demote = await request(app)
      .patch(`/workspaces/${wsId}/members/${a.id}`)
      .set("Authorization", `Bearer ${b.token}`)
      .send({ role: "member" });
    expect(demote.status).toBe(204);
  });
});

describe("workspaces: cross-workspace isolation", () => {
  it("cannot read another workspace's data by id", async () => {
    const a = await makeUser("A");
    const b = await makeUser("B");
    const wsA = await makeWorkspace(a.token, "A-space");
    await makeWorkspace(b.token, "B-space");

    const res = await request(app)
      .get(`/workspaces/${wsA}`)
      .set("Authorization", `Bearer ${b.token}`);
    expect(res.status).toBe(403);
  });

  it("rejects adding a non-existent email with NOT_FOUND", async () => {
    const owner = await makeUser("Owner");
    const wsId = await makeWorkspace(owner.token);

    const res = await request(app)
      .post(`/workspaces/${wsId}/members`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ email: "nobody@nowhere.test", role: "member" });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("rejects duplicate member with CONFLICT", async () => {
    const owner = await makeUser("Owner");
    const member = await makeUser("Member");
    const wsId = await makeWorkspace(owner.token);

    await request(app)
      .post(`/workspaces/${wsId}/members`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ email: member.email, role: "member" })
      .expect(204);

    const dup = await request(app)
      .post(`/workspaces/${wsId}/members`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ email: member.email, role: "member" });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe("CONFLICT");
  });
});
