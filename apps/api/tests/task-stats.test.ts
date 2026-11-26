import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { createApp } from "../src/app";

let app: Express;
beforeEach(() => {
  app = createApp();
});

let counter = 0;

async function makeUser() {
  counter++;
  const email = `s${counter}_${Date.now()}@test.local`;
  const res = await request(app)
    .post("/auth/register")
    .send({ name: "U", email, password: "Password123!" });
  return { id: res.body.user.id as string, email, token: res.body.accessToken as string };
}

async function makeWorkspace(token: string) {
  const res = await request(app)
    .post("/workspaces")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Stats" });
  return res.body.workspace.id as string;
}

async function ownerAndWs() {
  const user = await makeUser();
  const wsId = await makeWorkspace(user.token);
  return { ...user, wsId };
}

function createTask(token: string, wsId: string, body: Record<string, unknown>) {
  return request(app)
    .post(`/workspaces/${wsId}/tasks`)
    .set("Authorization", `Bearer ${token}`)
    .send(body);
}

function patchTask(token: string, wsId: string, taskId: string, body: Record<string, unknown>) {
  return request(app)
    .patch(`/workspaces/${wsId}/tasks/${taskId}`)
    .set("Authorization", `Bearer ${token}`)
    .send(body);
}

function getStats(token: string, wsId: string, query = "") {
  return request(app)
    .get(`/workspaces/${wsId}/tasks/stats${query}`)
    .set("Authorization", `Bearer ${token}`);
}

function todayIn(timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

describe("completedAt", () => {
  it("is null on a new task and set when the task is created as done", async () => {
    const { token, wsId } = await ownerAndWs();
    const open = await createTask(token, wsId, { title: "open" });
    expect(open.body.task.completedAt).toBeNull();
    const done = await createTask(token, wsId, { title: "done", status: "done" });
    expect(done.body.task.completedAt).toEqual(expect.any(String));
  });

  it("is set when a task becomes done and cleared when it leaves done", async () => {
    const { token, wsId } = await ownerAndWs();
    const created = await createTask(token, wsId, { title: "x" });
    const id = created.body.task.id as string;

    const toDone = await patchTask(token, wsId, id, { status: "done" });
    expect(toDone.body.task.completedAt).toEqual(expect.any(String));

    const stillDone = await patchTask(token, wsId, id, { title: "renamed" });
    expect(stillDone.body.task.completedAt).toBe(toDone.body.task.completedAt);

    const back = await patchTask(token, wsId, id, { status: "todo" });
    expect(back.body.task.completedAt).toBeNull();
  });

  it("is included in the task list", async () => {
    const { token, wsId } = await ownerAndWs();
    await createTask(token, wsId, { title: "d", status: "done" });
    const res = await request(app)
      .get(`/workspaces/${wsId}/tasks`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.body.items[0].completedAt).toEqual(expect.any(String));
  });
});

describe("GET /workspaces/:id/tasks/stats", () => {
  it("is not shadowed by the :taskId route", async () => {
    const { token, wsId } = await ownerAndWs();
    const res = await getStats(token, wsId);
    expect(res.status).toBe(200);
    expect(res.body.counts).toEqual({ todo: 0, in_progress: 0, done: 0 });
  });

  it("counts tasks by status", async () => {
    const { token, wsId } = await ownerAndWs();
    await createTask(token, wsId, { title: "a" });
    await createTask(token, wsId, { title: "b" });
    await createTask(token, wsId, { title: "c", status: "in_progress" });
    await createTask(token, wsId, { title: "d", status: "done" });
    const res = await getStats(token, wsId);
    expect(res.body.counts).toEqual({ todo: 2, in_progress: 1, done: 1 });
    expect(res.body.total).toBe(4);
    expect(res.body.completedLast7Days).toBe(1);
  });

  it("returns seven zero-filled days ending today (UTC by default)", async () => {
    const { token, wsId } = await ownerAndWs();
    await createTask(token, wsId, { title: "d", status: "done" });
    const res = await getStats(token, wsId);
    expect(res.body.completedByDay).toHaveLength(7);
    const dates = res.body.completedByDay.map((d: { date: string }) => d.date);
    expect([...dates].sort()).toEqual(dates);
    const last = res.body.completedByDay[6];
    expect(last.date).toBe(todayIn("UTC"));
    expect(last.count).toBe(1);
    expect(res.body.completedByDay[0].count).toBe(0);
  });

  it("uses the requested time zone", async () => {
    const { token, wsId } = await ownerAndWs();
    await createTask(token, wsId, { title: "d", status: "done" });
    const res = await getStats(token, wsId, "?tz=Asia/Kathmandu");
    expect(res.status).toBe(200);
    expect(res.body.completedByDay).toHaveLength(7);
    expect(res.body.completedByDay[6].date).toBe(todayIn("Asia/Kathmandu"));
    expect(res.body.completedLast7Days).toBe(1);
  });

  it("rejects an invalid time zone with 400", async () => {
    const { token, wsId } = await ownerAndWs();
    const res = await getStats(token, wsId, "?tz=Not/AZone");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("lets a viewer read the stats", async () => {
    const owner = await ownerAndWs();
    const viewer = await makeUser();
    await request(app)
      .post(`/workspaces/${owner.wsId}/members`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ email: viewer.email, role: "viewer" })
      .expect(204);
    const res = await getStats(viewer.token, owner.wsId);
    expect(res.status).toBe(200);
  });

  it("rejects a non-member with 403 and does not count another workspace", async () => {
    const a = await ownerAndWs();
    const b = await ownerAndWs();
    await createTask(a.token, a.wsId, { title: "a1" });
    await createTask(b.token, b.wsId, { title: "b1" });
    await createTask(b.token, b.wsId, { title: "b2" });

    const denied = await getStats(b.token, a.wsId);
    expect(denied.status).toBe(403);

    const own = await getStats(a.token, a.wsId);
    expect(own.body.total).toBe(1);
  });
});
