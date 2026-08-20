export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

function validateRuntimeConfig() {
  const missing: string[] = [];
  const invalid: string[] = [];

  if (!process.env.NEXTAUTH_SECRET && !process.env.AUTH_SECRET) {
    missing.push("NEXTAUTH_SECRET");
  }

  if (!process.env.NEXTAUTH_URL) {
    missing.push("NEXTAUTH_URL");
  } else {
    try {
      const url = new URL(process.env.NEXTAUTH_URL);
      if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
        invalid.push("NEXTAUTH_URL must use https:// in production");
      }
    } catch {
      invalid.push("NEXTAUTH_URL must be a valid absolute URL");
    }
  }

  if (missing.length > 0 || invalid.length > 0) {
    throw new Error(
      `Runtime configuration error. Missing: ${missing.join(", ") || "none"}. Invalid: ${invalid.join(", ") || "none"}.`
    );
  }
}

export async function GET() {
  const startedAt = Date.now();

  try {
    validateRuntimeConfig();
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json({
      status: "ready",
      checks: {
        runtimeConfig: "ok",
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
          runtimeConfig: "error",
          database: "error"
        },
        latency: Date.now() - startedAt,
        timestamp: new Date().toISOString()
      },
      { status: 503 }
    );
  }
}
