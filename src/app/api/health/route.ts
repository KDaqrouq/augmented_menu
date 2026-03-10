import { NextResponse } from "next/server";

/**
 * Health check: verifies app and DB connection (Checkpoint 0A).
 * GET /api/health
 */
export async function GET() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      {
        ok: false,
        database: "missing_config",
        error: "DATABASE_URL is not set",
      },
      { status: 503 }
    );
  }

  try {
    const { prisma } = await import("@/lib/db");
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      ok: true,
      database: "connected",
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        database: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 503 }
    );
  }
}
