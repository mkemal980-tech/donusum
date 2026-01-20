import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const units = await prisma.unit.findMany({
      include: {
        manager: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        users: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
        _count: {
          select: {
            users: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(units);
  } catch (error) {
    console.error("Birimleri getirme hatası:", error);
    return NextResponse.json(
      { error: "Birimler getirilemedi" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, organization, managerId } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Birim adı gerekli" },
        { status: 400 }
      );
    }

    const unit = await prisma.unit.create({
      data: {
        name,
        description,
        organization,
        managerId: managerId || null,
      },
      include: {
        manager: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        users: true,
        _count: {
          select: {
            users: true,
          },
        },
      },
    });

    // Eğer yönetici atandıysa, yöneticinin rolünü güncelle
    if (managerId) {
      await prisma.user.update({
        where: { id: managerId },
        data: { role: "UNIT_MANAGER", unitId: unit.id },
      });
    }

    return NextResponse.json(unit);
  } catch (error) {
    console.error("Birim oluşturma hatası:", error);
    return NextResponse.json(
      { error: "Birim oluşturulamadı" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, description, organization, managerId } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Birim ID gerekli" },
        { status: 400 }
      );
    }

    // Eski yöneticiyi bul
    const oldUnit = await prisma.unit.findUnique({
      where: { id },
      select: { managerId: true },
    });

    const unit = await prisma.unit.update({
      where: { id },
      data: {
        name,
        description,
        organization,
        managerId: managerId || null,
      },
      include: {
        manager: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        users: true,
        _count: {
          select: {
            users: true,
          },
        },
      },
    });

    // Eski yöneticinin rolünü USER yap (eğer başka birim yönetmiyorsa)
    if (oldUnit?.managerId && oldUnit.managerId !== managerId) {
      const otherManagedUnits = await prisma.unit.count({
        where: {
          managerId: oldUnit.managerId,
          NOT: { id },
        },
      });
      if (otherManagedUnits === 0) {
        await prisma.user.update({
          where: { id: oldUnit.managerId },
          data: { role: "USER" },
        });
      }
    }

    // Yeni yöneticinin rolünü güncelle
    if (managerId) {
      await prisma.user.update({
        where: { id: managerId },
        data: { role: "UNIT_MANAGER", unitId: unit.id },
      });
    }

    return NextResponse.json(unit);
  } catch (error) {
    console.error("Birim güncelleme hatası:", error);
    return NextResponse.json(
      { error: "Birim güncellenemedi" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Birim ID gerekli" },
        { status: 400 }
      );
    }

    // Önce birimdeki kullanıcıların unitId'sini null yap
    await prisma.user.updateMany({
      where: { unitId: id },
      data: { unitId: null },
    });

    // Yöneticinin rolünü USER yap
    const unit = await prisma.unit.findUnique({
      where: { id },
      select: { managerId: true },
    });

    if (unit?.managerId) {
      const otherManagedUnits = await prisma.unit.count({
        where: {
          managerId: unit.managerId,
          NOT: { id },
        },
      });
      if (otherManagedUnits === 0) {
        await prisma.user.update({
          where: { id: unit.managerId },
          data: { role: "USER" },
        });
      }
    }

    await prisma.unit.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Birim silme hatası:", error);
    return NextResponse.json(
      { error: "Birim silinemedi" },
      { status: 500 }
    );
  }
}
