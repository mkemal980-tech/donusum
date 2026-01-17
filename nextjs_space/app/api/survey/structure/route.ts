export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const surveyId = searchParams.get('surveyId');

    // Anket ID varsa sadece o ankete ait kategorileri getir
    const whereClause = surveyId ? { surveyId } : {};

    const categories = await prisma.category.findMany({
      where: whereClause,
      orderBy: { order: 'asc' },
      include: {
        survey: {
          select: { id: true, name: true }
        },
        subCategories: {
          orderBy: { order: 'asc' },
          include: {
            // Alt seviyeler ve onların soruları
            subLevels: {
              orderBy: { order: 'asc' },
              include: {
                questions: {
                  orderBy: { order: 'asc' }
                }
              }
            },
            // Doğrudan alt kategoriye bağlı sorular (hasSubLevels = false)
            questions: {
              orderBy: { order: 'asc' }
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
