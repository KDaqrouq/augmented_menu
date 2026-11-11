import { NextResponse } from "next/server";

/**
 * Health check: verifies app and DB connection.
 * GET /api/health
 * Error details are only returned outside production (they can leak hostnames/credentials hints).
 */
export async function GET() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { ok: false, database: "missing_config", error: "DATABASE_URL is not set" },
      { status: 503 }
    );
  }

  try {
    const { prisma } = await import("@/lib/db");
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, database: "connected" });
  } catch (error) {
    console.error("[health] Database check failed:", error);
    return NextResponse.json(
      {
        ok: false,
        database: "error",
        ...(process.env.NODE_ENV !== "production" && {
          error: error instanceof Error ? error.message : "Unknown error",
        }),
      },
      { status: 503 }
    );
  }
}
