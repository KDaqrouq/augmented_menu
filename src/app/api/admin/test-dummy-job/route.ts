import { NextResponse } from "next/server";
import { enqueueDummyJob } from "@/lib/queue";

/**
 * POST /api/admin/test-dummy-job
 * Enqueues a dummy job for Checkpoint 3A (verify queue + worker).
 */
export async function POST() {
  try {
    const jobId = await enqueueDummyJob();
    return NextResponse.json({ ok: true, jobId });
  } catch (e) {
    return NextResponse.json(
      { error: "Queue not configured (REDIS_URL required)" },
      { status: 503 }
    );
  }
}
