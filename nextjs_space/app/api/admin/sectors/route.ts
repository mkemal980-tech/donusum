import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sectors = await prisma.sector.findMany({
      include: {
        subSectors: {
          orderBy: { order: "asc" }
        },
        _count: {
          select: { users: true }
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

export async function POST(request: NextRequest) {
  const auth = await withAuth(request, { requireAdmin: true, rateLimit: 'admin' });
  if (!auth.success) return auth.response;

  try {
    const { name, naicsCode, order } = await request.json();
    
    if (!name) {
      return NextResponse.json({ error: "Sektör adı gerekli" }, { status: 400 });
    }

    const sector = await prisma.sector.create({
      data: {
        name,
        naicsCode: naicsCode || null,
        order: order || 0
      },
      include: {
        subSectors: true
      }
    });

    return NextResponse.json(sector);
  } catch (error: any) {
    console.error("Error creating sector:", error);
    if (error.code === "P2002") {
      return NextResponse.json({ error: "Bu sektör adı zaten mevcut" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create sector" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const auth = await withAuth(request, { requireAdmin: true, rateLimit: 'admin' });
  if (!auth.success) return auth.response;

  try {
    const { id, name, naicsCode, order } = await request.json();
    
    if (!id || !name) {
      return NextResponse.json({ error: "ID ve sektör adı gerekli" }, { status: 400 });
    }

    const sector = await prisma.sector.update({
      where: { id },
      data: {
        name,
        naicsCode: naicsCode || null,
        order: order !== undefined ? order : undefined
      },
      include: {
        subSectors: true
      }
    });

    return NextResponse.json(sector);
  } catch (error) {
    console.error("Error updating sector:", error);
    return NextResponse.json({ error: "Failed to update sector" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await withAuth(request, { requireAdmin: true, rateLimit: 'admin' });
  if (!auth.success) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    
    if (!id) {
      return NextResponse.json({ error: "ID gerekli" }, { status: 400 });
    }

    await prisma.sector.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting sector:", error);
    return NextResponse.json({ error: "Failed to delete sector" }, { status: 500 });
  }
}
