import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth, validators, logError } from "@/lib/api-utils";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // Admin authentication check
  const auth = await withAuth(request, { requireAdmin: true, rateLimit: 'admin' });
  if (!auth.success) return auth.response;

  try {
    const searchParams = request.nextUrl.searchParams;
    const unitId = searchParams.get("unitId");
    const role = searchParams.get("role");

    const where: Record<string, unknown> = {};
    if (unitId) where.unitId = unitId;
    if (role) where.role = role;

    const users = await prisma.user.findMany({
      where,
      include: {
        unit: true,
        sector: true,
        subSector: true,
        _count: {
          select: {
            authoredResponses: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Parola özeti tarayıcıya hiç gitmemeli: yönetici ekranının ona ihtiyacı
    // yok ve listeyi gören herkesin eline kırılmaya hazır bir özet geçer.
    const safeUsers = users.map(({ password, ...user }) => user);

    return NextResponse.json(safeUsers);
  } catch (error) {
    console.error("Kullanıcıları getirme hatası:", error);
    return NextResponse.json(
      { error: "Kullanıcılar getirilemedi" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await withAuth(request, { requireAdmin: true, rateLimit: 'admin' });
  if (!auth.success) return auth.response;

  try {
    const body = await request.json();
    const {
      email,
      password,
      firstName,
      lastName,
      organization,
      role,
      unitId,
      sectorId,
      subSectorId,
    } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email ve şifre gerekli" },
        { status: 400 }
      );
    }

    // Email kontrolü
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Bu email adresi zaten kayıtlı" },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        password: hashedPassword,
        firstName,
        lastName,
        organization,
        role: role || "USER",
        unitId: unitId || null,
        sectorId: sectorId || null,
        subSectorId: subSectorId || null,
        /**
         * Yöneticinin açtığı hesap doğrulanmış sayılır.
         *
         * Doğrulama akışı kendi kaydolan kullanıcı için var: adresin gerçekten
         * o kişiye ait olduğunu kanıtlar. Yönetici bir hesabı elle açarken bu
         * güvenceyi zaten veriyor. Aksi hâlde panelden açılan hesap giriş
         * yapamıyordu — giriş emailVerified şartı arıyor, yöneticinin bunu
         * düzeltecek bir düğmesi yoktu ve e-posta sağlayıcısı tanımlı
         * olmayan kurulumda doğrulama postası da hiç gitmiyor.
         */
        emailVerified: true,
      },
      include: {
        unit: true,
        sector: true,
        subSector: true,
      },
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error("Kullanıcı oluşturma hatası:", error);
    return NextResponse.json(
      { error: "Kullanıcı oluşturulamadı" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const auth = await withAuth(request, { requireAdmin: true, rateLimit: 'admin' });
  if (!auth.success) return auth.response;

  try {
    const body = await request.json();
    const {
      id,
      email,
      password,
      firstName,
      lastName,
      organization,
      role,
      unitId,
      sectorId,
      subSectorId,
      emailVerified,
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Kullanıcı ID gerekli" },
        { status: 400 }
      );
    }

    // Email benzersizlik kontrolü
    if (email) {
      const existingUser = await prisma.user.findFirst({
        where: {
          email: email.toLowerCase(),
          NOT: { id },
        },
      });

      if (existingUser) {
        return NextResponse.json(
          { error: "Bu email adresi zaten kullanılıyor" },
          { status: 400 }
        );
      }
    }

    const updateData: Record<string, unknown> = {
      firstName,
      lastName,
      organization,
      role,
      unitId: unitId || null,
      sectorId: sectorId || null,
      subSectorId: subSectorId || null,
    };

    if (email) {
      updateData.email = email.toLowerCase();
    }

    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    // Doğrulama durumu yöneticiden düzenlenebilir: sağlayıcı tanımlı değilse
    // doğrulama postası hiç gitmiyor ve kullanıcı kilitli kalıyordu.
    if (typeof emailVerified === "boolean") {
      updateData.emailVerified = emailVerified;
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      include: {
        unit: true,
        sector: true,
        subSector: true,
      },
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error("Kullanıcı güncelleme hatası:", error);
    return NextResponse.json(
      { error: "Kullanıcı güncellenemedi" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await withAuth(request, { requireAdmin: true, rateLimit: 'admin' });
  if (!auth.success) return auth.response;

  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Kullanıcı ID gerekli" },
        { status: 400 }
      );
    }

    await prisma.user.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Kullanıcı silme hatası:", error);
    return NextResponse.json(
      { error: "Kullanıcı silinemedi" },
      { status: 500 }
    );
  }
}
