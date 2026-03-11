import { NextResponse } from "next/server";
import { enqueueDummyJob } from "@/lib/queue";

/**
 * POST /api/admin/test-dummy-job
 * Enqueues a dummy job for testing (queue + worker). Disabled in production.
 */
export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 404 });
  }
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
