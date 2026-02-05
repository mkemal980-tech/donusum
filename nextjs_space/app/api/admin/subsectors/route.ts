import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await withAuth(request, { requireAdmin: true, rateLimit: 'admin' });
  if (!auth.success) return auth.response;

  try {
    const { name, sectorId, order } = await request.json();
    
    if (!name || !sectorId) {
      return NextResponse.json({ error: "Alt sektör adı ve sektör ID gerekli" }, { status: 400 });
    }

    const subSector = await prisma.subSector.create({
      data: {
        name,
        sectorId,
        order: order || 0
      }
    });

    return NextResponse.json(subSector);
  } catch (error: any) {
    console.error("Error creating subsector:", error);
    if (error.code === "P2002") {
      return NextResponse.json({ error: "Bu alt sektör adı zaten mevcut" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create subsector" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const auth = await withAuth(request, { requireAdmin: true, rateLimit: 'admin' });
  if (!auth.success) return auth.response;

  try {
    const { id, name, order } = await request.json();
    
    if (!id || !name) {
      return NextResponse.json({ error: "ID ve alt sektör adı gerekli" }, { status: 400 });
    }

    const subSector = await prisma.subSector.update({
      where: { id },
      data: {
        name,
        order: order || 0
      }
    });

    return NextResponse.json(subSector);
  } catch (error) {
    console.error("Error updating subsector:", error);
    return NextResponse.json({ error: "Failed to update subsector" }, { status: 500 });
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

    await prisma.subSector.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting subsector:", error);
    return NextResponse.json({ error: "Failed to delete subsector" }, { status: 500 });
  }
}
