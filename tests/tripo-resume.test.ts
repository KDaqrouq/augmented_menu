import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { generateFromImages } from "@/lib/tripo";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

/** Fake Tripo API: tasks listed in `statuses` report that status; POSTs create "new-N" tasks that succeed. */
function mockTripo(statuses: Record<string, string>) {
  const posts: unknown[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (init?.method === "POST") {
      posts.push(JSON.parse(String(init.body)));
      return Response.json({ code: 0, data: { task_id: `new-${posts.length}`, status: "queued" } });
    }
    const id = url.split("/task/")[1];
    const status = statuses[id] ?? "success";
    return Response.json({
      code: 0,
      data: { task_id: id, status, output: status === "success" ? { model: `https://tripo/${id}.glb` } : {} },
    });
  }) as typeof fetch;
  return posts;
}

const photos = ["a", "b", "c", "d"].map((p) => `https://img/${p}.jpg`);

test("a retry with both task ids only polls (no paid task is created)", async () => {
  process.env.TRIPO_API_KEY = "tsk_test";
  const posts = mockTripo({});
  const created: string[] = [];
  const result = await generateFromImages(photos, {
    resume: { baseTaskId: "base-1", lowpolyTaskId: "low-1" },
    onTaskCreated: (stage, id) => void created.push(`${stage}:${id}`),
  });
  assert.equal(posts.length, 0);
  assert.deepEqual(created, []);
  assert.equal(result.finalTaskId, "low-1");
  assert.equal(result.glbUrl, "https://tripo/low-1.glb");
});

test("a retry after the base model finished only pays for the low-poly step", async () => {
  process.env.TRIPO_API_KEY = "tsk_test";
  const posts = mockTripo({});
  const created: string[] = [];
  await generateFromImages(photos, {
    resume: { baseTaskId: "base-1" },
    onTaskCreated: (stage, id) => void created.push(`${stage}:${id}`),
  });
  assert.equal(posts.length, 1);
  assert.equal((posts[0] as { type: string }).type, "highpoly_to_lowpoly");
  assert.deepEqual(created, ["lowpoly:new-1"]);
});

test("a stored task that failed on Tripo's side is replaced", async () => {
  process.env.TRIPO_API_KEY = "tsk_test";
  const posts = mockTripo({ "base-1": "failed" });
  const created: string[] = [];
  await generateFromImages(photos, {
    resume: { baseTaskId: "base-1", lowpolyTaskId: "low-1" },
    onTaskCreated: (stage, id) => void created.push(`${stage}:${id}`),
  });
  // New base task, and the old low-poly (built from the failed base) is not reused.
  assert.deepEqual(
    posts.map((p) => (p as { type: string }).type),
    ["multiview_to_model", "highpoly_to_lowpoly"]
  );
  assert.deepEqual(created, ["base:null", "base:new-1", "lowpoly:new-2"]);
});
