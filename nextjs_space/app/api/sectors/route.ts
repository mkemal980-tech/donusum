import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sectors = await prisma.sector.findMany({
      include: {
        subSectors: {
          orderBy: { order: "asc" }
        }
      },
      orderBy: { order: "asc" }
    });
    return NextResponse.json(sectors);
  } catch (error) {
    console.error("Error fetching sectors:", error);
    return NextResponse.json({ error: "Failed to fetch sectors" }, { status: 500 });
  }
}
