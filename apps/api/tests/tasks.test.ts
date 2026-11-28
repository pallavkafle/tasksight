import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";
import mongoose from "mongoose";
import { createApp } from "../src/app";

let app: Express;
beforeEach(() => {
  app = createApp();
});

let counter = 0;

async function makeUser() {
  counter++;
  const email = `t${counter}_${Date.now()}@test.local`;
  const res = await request(app)
    .post("/auth/register")
    .send({ name: "U", email, password: "Password123!" });
  return { id: res.body.user.id as string, email, token: res.body.accessToken as string };
}

async function makeWorkspace(token: string, name = "Team") {
  const res = await request(app)
    .post("/workspaces")
    .set("Authorization", `Bearer ${token}`)
    .send({ name });
  return res.body.workspace.id as string;
}

async function createTask(token: string, wsId: string, body: Record<string, unknown>) {
  const res = await request(app)
    .post(`/workspaces/${wsId}/tasks`)
    .set("Authorization", `Bearer ${token}`)
    .send(body);
  return res;
}

async function ownerAndWs() {
  const user = await makeUser();
  const wsId = await makeWorkspace(user.token);
  return { ...user, wsId };
}

async function addMember(token: string, wsId: string, email: string, role: string) {
  await request(app)
    .post(`/workspaces/${wsId}/members`)
    .set("Authorization", `Bearer ${token}`)
    .send({ email, role })
    .expect(204);
}

describe("POST /workspaces/:id/tasks — create + defaults", () => {
  it("creates a task with defaults and embeddingStatus=dirty", async () => {
    const { token, id, wsId } = await ownerAndWs();
    const res = await createTask(token, wsId, { title: "First task" });
    expect(res.status).toBe(201);
    expect(res.body.task).toMatchObject({
      id: expect.any(String),
      workspaceId: wsId,
      title: "First task",
      description: "",
      status: "todo",
      priority: "medium",
      dueDate: null,
      labels: [],
      assigneeId: null,
      subtasks: [],
      createdBy: id,
      version: 0,
      embeddingStatus: "dirty",
    });
  });

  it("rejects unknown fields (whitelist)", async () => {
    const { token, wsId } = await ownerAndWs();
    const res = await createTask(token, wsId, { title: "x", admin: true });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects subtask array > 30", async () => {
    const { token, wsId } = await ownerAndWs();
    const subtasks = Array.from({ length: 31 }, (_, i) => ({ title: `s${i}`, done: false }));
    const res = await createTask(token, wsId, { title: "big", subtasks });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("accepts exactly 30 subtasks", async () => {
    const { token, wsId } = await ownerAndWs();
    const subtasks = Array.from({ length: 30 }, (_, i) => ({ title: `s${i}`, done: false }));
    const res = await createTask(token, wsId, { title: "edge", subtasks });
    expect(res.status).toBe(201);
    expect(res.body.task.subtasks).toHaveLength(30);
  });
});

describe("GET /workspaces/:id/tasks — filters", () => {
  it("filters by status", async () => {
    const { token, wsId } = await ownerAndWs();
    await createTask(token, wsId, { title: "a", status: "todo" });
    await createTask(token, wsId, { title: "b", status: "done" });
    const res = await request(app)
      .get(`/workspaces/${wsId}/tasks?status=done`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].title).toBe("b");
  });

  it("filters by priority", async () => {
    const { token, wsId } = await ownerAndWs();
    await createTask(token, wsId, { title: "a", priority: "low" });
    await createTask(token, wsId, { title: "b", priority: "high" });
    const res = await request(app)
      .get(`/workspaces/${wsId}/tasks?priority=high`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].title).toBe("b");
  });

  it("filters by label", async () => {
    const { token, wsId } = await ownerAndWs();
    await createTask(token, wsId, { title: "a", labels: ["urgent"] });
    await createTask(token, wsId, { title: "b", labels: ["later"] });
    const res = await request(app)
      .get(`/workspaces/${wsId}/tasks?label=urgent`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].title).toBe("a");
  });

  it("filters by assigneeId", async () => {
    const { token, wsId } = await ownerAndWs();
    const other = await makeUser();
    await addMember(token, wsId, other.email, "member");
    await createTask(token, wsId, { title: "mine", assigneeId: other.id });
    await createTask(token, wsId, { title: "unassigned" });
    const res = await request(app)
      .get(`/workspaces/${wsId}/tasks?assigneeId=${other.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].title).toBe("mine");
  });

  it("filters by dueFrom and dueTo", async () => {
    const { token, wsId } = await ownerAndWs();
    const yesterday = new Date(Date.now() - 86400000).toISOString();
    const tomorrow = new Date(Date.now() + 86400000).toISOString();
    await createTask(token, wsId, { title: "past", dueDate: yesterday });
    await createTask(token, wsId, { title: "future", dueDate: tomorrow });
    const from = new Date().toISOString();
    const res = await request(app)
      .get(`/workspaces/${wsId}/tasks?dueFrom=${from}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].title).toBe("future");
  });

  it("combines status + priority filters", async () => {
    const { token, wsId } = await ownerAndWs();
    await createTask(token, wsId, { title: "a", status: "todo", priority: "high" });
    await createTask(token, wsId, { title: "b", status: "done", priority: "high" });
    await createTask(token, wsId, { title: "c", status: "todo", priority: "low" });
    const res = await request(app)
      .get(`/workspaces/${wsId}/tasks?status=todo&priority=high`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].title).toBe("a");
  });
});

describe("GET /workspaces/:id/tasks — pagination + sort", () => {
  it("paginates across multiple pages without duplicates or misses", async () => {
    const { token, wsId } = await ownerAndWs();
    for (let i = 0; i < 7; i++) {
      await createTask(token, wsId, { title: `t${i}` });
    }
    const seen = new Set<string>();
    let cursor: string | null = null;
    let pages = 0;
    while (true) {
      const url: string = cursor
        ? `/workspaces/${wsId}/tasks?limit=3&cursor=${cursor}`
        : `/workspaces/${wsId}/tasks?limit=3`;
      const res = await request(app).get(url).set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      for (const item of res.body.items) seen.add(item.id);
      cursor = res.body.nextCursor;
      pages++;
      if (!cursor) break;
      if (pages > 10) throw new Error("loop");
    }
    expect(seen.size).toBe(7);
    expect(pages).toBe(3);
  });

  it("sorts dueDate:asc with nulls last", async () => {
    const { token, wsId } = await ownerAndWs();
    const past = new Date(Date.now() - 86400000).toISOString();
    const future = new Date(Date.now() + 86400000).toISOString();
    await createTask(token, wsId, { title: "null-one" });
    await createTask(token, wsId, { title: "past", dueDate: past });
    await createTask(token, wsId, { title: "future", dueDate: future });
    const res = await request(app)
      .get(`/workspaces/${wsId}/tasks?sort=dueDate:asc`)
      .set("Authorization", `Bearer ${token}`);
    const titles = res.body.items.map((t: { title: string }) => t.title);
    expect(titles).toEqual(["past", "future", "null-one"]);
  });

  it("rejects an invalid cursor with 400", async () => {
    const { token, wsId } = await ownerAndWs();
    const res = await request(app)
      .get(`/workspaces/${wsId}/tasks?cursor=notvalid`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("PATCH /workspaces/:id/tasks/:taskId — update contract", () => {
  it("increments version on every update", async () => {
    const { token, wsId } = await ownerAndWs();
    const create = await createTask(token, wsId, { title: "v" });
    const taskId = create.body.task.id;
    const r1 = await request(app)
      .patch(`/workspaces/${wsId}/tasks/${taskId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "in_progress" });
    expect(r1.body.task.version).toBe(1);
    const r2 = await request(app)
      .patch(`/workspaces/${wsId}/tasks/${taskId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ priority: "high" });
    expect(r2.body.task.version).toBe(2);
  });

  it("increments version atomically for concurrent updates", async () => {
    const { token, wsId } = await ownerAndWs();
    const create = await createTask(token, wsId, { title: "concurrent" });
    const taskId = create.body.task.id;

    const updates = await Promise.all([
      request(app)
        .patch(`/workspaces/${wsId}/tasks/${taskId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "in_progress" }),
      request(app)
        .patch(`/workspaces/${wsId}/tasks/${taskId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ priority: "high" }),
    ]);

    expect(updates.map(({ status }) => status)).toEqual([200, 200]);
    expect(updates.map(({ body }) => body.task.version).sort()).toEqual([1, 2]);

    const final = await request(app)
      .get(`/workspaces/${wsId}/tasks`)
      .set("Authorization", `Bearer ${token}`);
    expect(final.body.items).toContainEqual(
      expect.objectContaining({
        id: taskId,
        version: 2,
        status: "in_progress",
        priority: "high",
      }),
    );
  });

  it("stays dirty on non-content updates until the worker re-embeds", async () => {
    const { token, wsId } = await ownerAndWs();
    const create = await createTask(token, wsId, { title: "x" });
    const taskId = create.body.task.id;
    await request(app)
      .patch(`/workspaces/${wsId}/tasks/${taskId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "done", priority: "high" })
      .expect(200);
    const res = await request(app)
      .patch(`/workspaces/${wsId}/tasks/${taskId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(res.body.task.embeddingStatus).toBe("dirty");
  });

  it("rejects unknown fields on update", async () => {
    const { token, wsId } = await ownerAndWs();
    const create = await createTask(token, wsId, { title: "x" });
    const taskId = create.body.task.id;
    const res = await request(app)
      .patch(`/workspaces/${wsId}/tasks/${taskId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ version: 999 });
    expect(res.status).toBe(400);
  });

  it("returns 404 for task in another workspace", async () => {
    const a = await ownerAndWs();
    const b = await ownerAndWs();
    const create = await createTask(a.token, a.wsId, { title: "x" });
    const taskId = create.body.task.id;
    const res = await request(app)
      .patch(`/workspaces/${b.wsId}/tasks/${taskId}`)
      .set("Authorization", `Bearer ${b.token}`)
      .send({ title: "y" });
    expect(res.status).toBe(404);
  });
});

describe("RBAC — viewer cannot write", () => {
  it("viewer cannot create a task", async () => {
    const { token, wsId } = await ownerAndWs();
    const viewer = await makeUser();
    await addMember(token, wsId, viewer.email, "viewer");
    const res = await createTask(viewer.token, wsId, { title: "x" });
    expect(res.status).toBe(403);
  });

  it("viewer cannot update or delete a task", async () => {
    const { token, wsId } = await ownerAndWs();
    const viewer = await makeUser();
    await addMember(token, wsId, viewer.email, "viewer");
    const create = await createTask(token, wsId, { title: "x" });
    const taskId = create.body.task.id;
    const upd = await request(app)
      .patch(`/workspaces/${wsId}/tasks/${taskId}`)
      .set("Authorization", `Bearer ${viewer.token}`)
      .send({ title: "y" });
    expect(upd.status).toBe(403);
    const del = await request(app)
      .delete(`/workspaces/${wsId}/tasks/${taskId}`)
      .set("Authorization", `Bearer ${viewer.token}`);
    expect(del.status).toBe(403);
  });

  it("viewer can list and read tasks", async () => {
    const { token, wsId } = await ownerAndWs();
    const viewer = await makeUser();
    await addMember(token, wsId, viewer.email, "viewer");
    const create = await createTask(token, wsId, { title: "x" });
    const taskId = create.body.task.id;
    const list = await request(app)
      .get(`/workspaces/${wsId}/tasks`)
      .set("Authorization", `Bearer ${viewer.token}`);
    expect(list.status).toBe(200);
    expect(list.body.items).toHaveLength(1);
    const read = await request(app)
      .get(`/workspaces/${wsId}/tasks/${taskId}`)
      .set("Authorization", `Bearer ${viewer.token}`);
    expect(read.status).toBe(200);
  });
});
describe("assignee: must be a workspace member", () => {
  it("create with non-member assignee returns 400 with details", async () => {
    const { token, wsId } = await ownerAndWs();
    const outsider = await makeUser();
    const res = await createTask(token, wsId, { title: "x", assigneeId: outsider.id });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([{ path: "assigneeId", message: expect.any(String) }]),
    );
  });

  it("create with unknown-but-well-formed id returns the same 400", async () => {
    const { token, wsId } = await ownerAndWs();
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await createTask(token, wsId, { title: "x", assigneeId: fakeId });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("create with a member assignee returns 201", async () => {
    const { token, wsId } = await ownerAndWs();
    const member = await makeUser();
    await addMember(token, wsId, member.email, "member");
    const res = await createTask(token, wsId, { title: "x", assigneeId: member.id });
    expect(res.status).toBe(201);
    expect(res.body.task.assigneeId).toBe(member.id);
  });

  it("patch with non-member assignee returns 400", async () => {
    const { token, wsId } = await ownerAndWs();
    const outsider = await makeUser();
    const create = await createTask(token, wsId, { title: "x" });
    const taskId = create.body.task.id;
    const res = await request(app)
      .patch(`/workspaces/${wsId}/tasks/${taskId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ assigneeId: outsider.id });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("removing a member unassigns their tasks and bumps version", async () => {
    const { token, wsId } = await ownerAndWs();
    const member = await makeUser();
    await addMember(token, wsId, member.email, "member");
    const create = await createTask(token, wsId, { title: "x", assigneeId: member.id });
    const taskId = create.body.task.id;
    const versionBefore = create.body.task.version;

    await request(app)
      .delete(`/workspaces/${wsId}/members/${member.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(204);

    const read = await request(app)
      .get(`/workspaces/${wsId}/tasks/${taskId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(read.body.task.assigneeId).toBeNull();
    expect(read.body.task.version).toBe(versionBefore + 1);
  });
});
