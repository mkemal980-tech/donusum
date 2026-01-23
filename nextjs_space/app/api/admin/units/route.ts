import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// Bir birimin tüm üst birimlerini (ebeveynlerini) getir
async function getParentUnits(unitId: string): Promise<string[]> {
  const parentIds: string[] = [];
  let currentId: string | null = unitId;

  while (currentId) {
    const result: { parentId: string | null } | null = await prisma.unit.findUnique({
      where: { id: currentId },
      select: { parentId: true },
    });
    if (result?.parentId) {
      parentIds.push(result.parentId);
      currentId = result.parentId;
    } else {
      currentId = null;
    }
  }

  return parentIds;
}

// Bir birimin efektif adminlerini getir (kendi + üst birimlerin adminleri)
async function getEffectiveAdmins(unitId: string) {
  const parentIds = await getParentUnits(unitId);
  const allUnitIds = [unitId, ...parentIds];

  const admins = await prisma.unitAdmin.findMany({
    where: { unitId: { in: allUnitIds } },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      },
      unit: {
        select: { id: true, name: true },
      },
    },
  });

  // Deduplicate by user id and mark inherited admins
  const adminMap = new Map<string, { user: any; isInherited: boolean; fromUnit: string }>;
  
  for (const admin of admins) {
    if (!adminMap.has(admin.userId)) {
      adminMap.set(admin.userId, {
        user: admin.user,
        isInherited: admin.unitId !== unitId,
        fromUnit: admin.unit.name,
      });
    }
  }

  return Array.from(adminMap.values());
}

export async function GET() {
  try {
    // Sadece üst birimleri (parentId null olanlar) getir, alt birimleri içerecek şekilde
    const units = await prisma.unit.findMany({
      where: { parentId: null },
      include: {
        subUnits: {
          include: {
            admins: {
              include: {
                user: {
                  select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                  },
                },
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
            _count: { select: { users: true, subUnits: true } },
          },
          orderBy: { name: "asc" },
        },
        admins: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
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
        _count: { select: { users: true, subUnits: true } },
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
    const { name, description, organization, parentId, adminIds } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Birim adı gerekli" },
        { status: 400 }
      );
    }

    // Birim oluştur
    const unit = await prisma.unit.create({
      data: {
        name,
        description,
        organization,
        parentId: parentId || null,
      },
    });

    // Adminleri ata
    if (adminIds && adminIds.length > 0) {
      await prisma.unitAdmin.createMany({
        data: adminIds.map((userId: string) => ({
          unitId: unit.id,
          userId,
        })),
        skipDuplicates: true,
      });

      // Admin rolünü güncelle
      await prisma.user.updateMany({
        where: { id: { in: adminIds } },
        data: { role: "UNIT_MANAGER" },
      });
    }

    // Güncel birimi getir
    const updatedUnit = await prisma.unit.findUnique({
      where: { id: unit.id },
      include: {
        parent: { select: { id: true, name: true } },
        subUnits: true,
        admins: {
          include: {
            user: {
              select: { id: true, email: true, firstName: true, lastName: true },
            },
          },
        },
        users: {
          select: { id: true, email: true, firstName: true, lastName: true, role: true },
        },
        _count: { select: { users: true, subUnits: true } },
      },
    });

    return NextResponse.json(updatedUnit);
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
    const { id, name, description, organization, parentId, adminIds } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Birim ID gerekli" },
        { status: 400 }
      );
    }

    // Kendisini kendi parent'ı yapmasını engelle
    if (parentId === id) {
      return NextResponse.json(
        { error: "Bir birim kendisinin üst birimi olamaz" },
        { status: 400 }
      );
    }

    // Birim güncelle
    await prisma.unit.update({
      where: { id },
      data: {
        name,
        description,
        organization,
        parentId: parentId || null,
      },
    });

    // Mevcut adminleri kaldır
    const oldAdmins = await prisma.unitAdmin.findMany({
      where: { unitId: id },
      select: { userId: true },
    });
    const oldAdminIds = oldAdmins.map(a => a.userId);

    await prisma.unitAdmin.deleteMany({
      where: { unitId: id },
    });

    // Yeni adminleri ekle
    if (adminIds && adminIds.length > 0) {
      await prisma.unitAdmin.createMany({
        data: adminIds.map((userId: string) => ({
          unitId: id,
          userId,
        })),
        skipDuplicates: true,
      });

      // Yeni adminlerin rolünü güncelle
      await prisma.user.updateMany({
        where: { id: { in: adminIds } },
        data: { role: "UNIT_MANAGER" },
      });
    }

    // Eski adminlerden artık hiçbir birimi yönetmeyenlerin rolünü USER yap
    const removedAdminIds = oldAdminIds.filter((id: string) => !adminIds?.includes(id));
    for (const userId of removedAdminIds) {
      const stillAdmin = await prisma.unitAdmin.count({
        where: { userId },
      });
      if (stillAdmin === 0) {
        await prisma.user.update({
          where: { id: userId },
          data: { role: "USER" },
        });
      }
    }

    // Güncel birimi getir
    const updatedUnit = await prisma.unit.findUnique({
      where: { id },
      include: {
        parent: { select: { id: true, name: true } },
        subUnits: true,
        admins: {
          include: {
            user: {
              select: { id: true, email: true, firstName: true, lastName: true },
            },
          },
        },
        users: {
          select: { id: true, email: true, firstName: true, lastName: true, role: true },
        },
        _count: { select: { users: true, subUnits: true } },
      },
    });

    return NextResponse.json(updatedUnit);
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

    // Alt birimleri kontrol et
    const subUnitCount = await prisma.unit.count({
      where: { parentId: id },
    });

    if (subUnitCount > 0) {
      return NextResponse.json(
        { error: "Alt birimleri olan bir birim silinemez. Önce alt birimleri silin." },
        { status: 400 }
      );
    }

    // Adminleri bul
    const admins = await prisma.unitAdmin.findMany({
      where: { unitId: id },
      select: { userId: true },
    });
    const adminIds = admins.map(a => a.userId);

    // Birimdeki kullanıcıların unitId'sini null yap
    await prisma.user.updateMany({
      where: { unitId: id },
      data: { unitId: null },
    });

    // Birimi sil (cascade ile adminler de silinir)
    await prisma.unit.delete({
      where: { id },
    });

    // Artık hiçbir birimi yönetmeyen adminlerin rolünü USER yap
    for (const userId of adminIds) {
      const stillAdmin = await prisma.unitAdmin.count({
        where: { userId },
      });
      if (stillAdmin === 0) {
        await prisma.user.update({
          where: { id: userId },
          data: { role: "USER" },
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Birim silme hatası:", error);
    return NextResponse.json(
      { error: "Birim silinemedi" },
      { status: 500 }
    );
  }
}
