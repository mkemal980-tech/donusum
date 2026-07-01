export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const startedAt = Date.now();

  try {
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json({
      status: "ready",
      checks: {
        database: "ok"
      },
      latency: Date.now() - startedAt,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Readiness check failed:", error);
    return NextResponse.json(
      {
        status: "not_ready",
        checks: {
          database: "error"
        },
        latency: Date.now() - startedAt,
        timestamp: new Date().toISOString()
      },
      { status: 503 }
    );
  }
}
