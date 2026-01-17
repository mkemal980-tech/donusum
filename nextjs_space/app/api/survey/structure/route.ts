export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { order: 'asc' },
      include: {
        subCategories: {
          orderBy: { order: 'asc' },
          include: {
            subLevels: {
              orderBy: { order: 'asc' },
              include: {
                questions: {
                  orderBy: { order: 'asc' }
                }
              }
            }
          }
        }
      }
    });

    return NextResponse.json(categories ?? []);
  } catch (error) {
    console.error("Error fetching survey structure:", error);
    return NextResponse.json(
      { error: "Failed to fetch survey structure" },
      { status: 500 }
    );
  }
}