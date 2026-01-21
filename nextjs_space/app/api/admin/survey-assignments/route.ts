export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

// Kullanıcıya atanan anketleri getir
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (userId) {
      // Belirli kullanıcının anket atamalarını getir
      const assignments = await prisma.userSurveyAssignment.findMany({
        where: { userId, isActive: true },
        include: {
          survey: {
            select: {
              id: true,
              name: true,
              description: true,
              isActive: true
            }
          }
        },
        orderBy: { assignedAt: 'desc' }
      });
      return NextResponse.json(assignments);
    } else {
      // Tüm atamaları getir
      const assignments = await prisma.userSurveyAssignment.findMany({
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              organization: true
            }
          },
          survey: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: { assignedAt: 'desc' }
      });
      return NextResponse.json(assignments);
    }
  } catch (error) {
    console.error("Error fetching survey assignments:", error);
    return NextResponse.json({ error: "Failed to fetch survey assignments" }, { status: 500 });
  }
}

// Kullanıcıya anket ata
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const body = await request.json();
    const { userId, surveyId } = body;
    
    if (!userId || !surveyId) {
      return NextResponse.json({ error: "userId ve surveyId gerekli" }, { status: 400 });
    }
    
    // Zaten atanmış mı kontrol et
    const existing = await prisma.userSurveyAssignment.findUnique({
      where: { userId_surveyId: { userId, surveyId } }
    });
    
    if (existing) {
      // Eğer pasif ise aktif yap
      if (!existing.isActive) {
        const updated = await prisma.userSurveyAssignment.update({
          where: { id: existing.id },
          data: { isActive: true, assignedAt: new Date() },
          include: { survey: { select: { id: true, name: true } } }
        });
        return NextResponse.json(updated);
      }
      return NextResponse.json({ error: "Bu anket zaten atanmış" }, { status: 400 });
    }
    
    const assignment = await prisma.userSurveyAssignment.create({
      data: {
        userId,
        surveyId,
        assignedBy: (session?.user as any)?.id || null
      },
      include: {
        survey: { select: { id: true, name: true } }
      }
    });
    
    return NextResponse.json(assignment);
  } catch (error: any) {
    console.error("Error creating survey assignment:", error);
    return NextResponse.json({ 
      error: "Failed to create survey assignment",
      details: error?.message 
    }, { status: 500 });
  }
}

// Anket atamasını kaldır
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const userId = searchParams.get('userId');
    const surveyId = searchParams.get('surveyId');
    
    if (id) {
      await prisma.userSurveyAssignment.delete({ where: { id } });
    } else if (userId && surveyId) {
      await prisma.userSurveyAssignment.delete({
        where: { userId_surveyId: { userId, surveyId } }
      });
    } else {
      return NextResponse.json({ error: "id veya userId+surveyId gerekli" }, { status: 400 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting survey assignment:", error);
    return NextResponse.json({ error: "Failed to delete survey assignment" }, { status: 500 });
  }
}
