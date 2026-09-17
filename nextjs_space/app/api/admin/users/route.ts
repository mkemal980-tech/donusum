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
    const action = searchParams.get("action");
    const targetId = searchParams.get("id");

    /**
     * Kalıcı silmenin neyi götüreceği.
     *
     * Şemadaki cascade zinciri kişisel değerlendirmeyi, cevaplarını, puan
     * geçmişini ve yol haritasını da siliyor. Yönetici bunu tıklamadan önce
     * görmeli; anket silmede aynı kalıp zaten var.
     */
    if (action === "delete-impact" && targetId) {
      const target = await prisma.user.findUnique({
        where: { id: targetId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          _count: { select: { ownedAssessments: true, uploadedDocuments: true, authoredResponses: true } },
        },
      });
      if (!target) {
        return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });
      }

      const responsesInOwnAssessments = await prisma.surveyResponse.count({
        where: { assessment: { ownerUserId: targetId } },
      });

      return NextResponse.json({
        user: target,
        impact: {
          // Kişisel değerlendirmeler ve içindeki cevaplar kalıcı silinir.
          assessments: target._count.ownedAssessments,
          responses: responsesInOwnAssessments,
          // Kuruluş değerlendirmesine girdiği cevaplar silinmez; yalnızca
          // "kim yazdı" izi kopar (answeredById SetNull).
          authoredElsewhere: target._count.authoredResponses,
          documents: target._count.uploadedDocuments,
        },
      });
    }

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

    /**
     * Kısmi güncelleme birim ve sektör bağını sessizce koparmasın.
     *
     * `unitId: unitId || null` yazıldığı için gövdesinde bu alanları
     * taşımayan her PUT, kullanıcıyı kuruluşundan ve sektöründen koparıyordu:
     * kuruluş değerlendirmesine erişimi bitiyor, yerine kişisel bir
     * değerlendirme açılıyordu. Alan yalnızca gövdede geçiyorsa yazılır.
     */
    const updateData: Record<string, unknown> = { firstName, lastName, organization };
    if ("role" in body) updateData.role = role;
    if ("unitId" in body) updateData.unitId = unitId || null;
    if ("sectorId" in body) updateData.sectorId = sectorId || null;
    if ("subSectorId" in body) updateData.subSectorId = subSectorId || null;

    // Son yöneticinin yetkisini düşürmek platformu yönetilemez hâle getirir.
    if ("role" in body && role !== "ADMIN") {
      const current = await prisma.user.findUnique({ where: { id }, select: { role: true } });
      if (current?.role === "ADMIN") {
        const otherAdmins = await prisma.user.count({
          where: { role: "ADMIN", isActive: true, NOT: { id } },
        });
        if (otherAdmins === 0) {
          return NextResponse.json(
            { error: "Sistemdeki son yöneticinin yetkisini kaldıramazsınız." },
            { status: 409 }
          );
        }
      }
    }

    if (email) {
      updateData.email = email.toLowerCase();
    }

    if (password) {
      // Yöneticinin belirlediği şifre de kayıt akışıyla aynı kurala tabidir;
      // burada tek karakterli bir şifre atanabiliyordu.
      const passwordCheck = validators.password(password);
      if (!passwordCheck.valid) {
        return NextResponse.json({ error: passwordCheck.message }, { status: 400 });
      }
      updateData.password = await bcrypt.hash(password, 10);
    }

    // Doğrulama durumu yöneticiden düzenlenebilir: sağlayıcı tanımlı değilse
    // doğrulama postası hiç gitmiyor ve kullanıcı kilitli kalıyordu.
    if (typeof emailVerified === "boolean") {
      updateData.emailVerified = emailVerified;
    }

    // Devre dışı bırakılan hesap geri açılabilmeli; aksi hâlde işlem tek yönlü.
    if (typeof body.isActive === "boolean") {
      updateData.isActive = body.isActive;
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
    /**
     * İki mod.
     *
     * Varsayılan devre dışı bırakmadır: kişisel değerlendirmeyi, cevaplarını
     * ve puan geçmişini kalıcı silmek geri alınamaz ve projenin soft-delete
     * ilkesiyle çelişir. Ama gerçekten silmek de gerekebiliyor (veri silme
     * talebi, yanlış açılmış test hesabı), o yüzden yol açıkça duruyor ve
     * çağıran taraf ne götüreceğini `?action=delete-impact` ile görebiliyor.
     */
    const permanent = searchParams.get("permanent") === "true";

    if (!id) {
      return NextResponse.json(
        { error: "Kullanıcı ID gerekli" },
        { status: 400 }
      );
    }

    /**
     * Kullanıcı silinmez, devre dışı bırakılır.
     *
     * `prisma.user.delete()` kalıcı siliyordu ve şemadaki cascade zinciri
     * kişisel değerlendirmeyi, bütün cevaplarını, puan geçmişini ve yol
     * haritasını da götürüyordu. Bu, projenin kendi soft-delete ilkesiyle
     * doğrudan çelişiyordu (bkz. lib/soft-delete: "kullanıcıların
     * SurveyResponse kayıtları KAYBOLMAZ (denetim/uyumluluk)") ve tek bir
     * yanlış tıklamayla geri alınamıyordu. Model bu iş için `isActive`
     * alanını zaten taşıyor.
     *
     * Gerçekten kalıcı silme gerekiyorsa (ör. veri silme talebi) bu ayrı ve
     * bilinçli bir işlemdir; yönetim ekranından tek tıkla yapılmaz.
     */
    if (id === auth.userId) {
      return NextResponse.json(
        { error: "Kendi hesabınızı devre dışı bırakamazsınız." },
        { status: 400 }
      );
    }

    const target = await prisma.user.findUnique({
      where: { id },
      select: { role: true, isActive: true },
    });
    if (!target) {
      return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });
    }

    // Son yöneticiyi devre dışı bırakmak platformu yönetilemez hâle getirir.
    if (target.role === "ADMIN") {
      const activeAdmins = await prisma.user.count({
        where: { role: "ADMIN", isActive: true, NOT: { id } },
      });
      if (activeAdmins === 0) {
        return NextResponse.json(
          { error: "Sistemdeki son yöneticiyi devre dışı bırakamazsınız." },
          { status: 409 }
        );
      }
    }

    if (permanent) {
      const removed = await deleteUserCompletely(id);
      return NextResponse.json({ success: true, deleted: true, removed });
    }

    if (!target.isActive) {
      return NextResponse.json(
        { error: "Bu kullanıcı zaten devre dışı." },
        { status: 409 }
      );
    }

    await prisma.user.update({ where: { id }, data: { isActive: false } });

    return NextResponse.json({ success: true, deactivated: true });
  } catch (error) {
    /**
     * Gerçek sebep ekrana taşınır.
     *
     * Burada her hata "Kullanıcı silinemedi" olarak yutuluyordu. Yönetici
     * silme düğmesine basıyor, kırmızı bir bildirim görüyor (ya da görmüyor)
     * ve neyin engellediğini asla öğrenemiyordu -- ekranda kullanıcı duruyor,
     * sebep yok. Prisma'nın hata kodu ve kısa mesajı yanıta konur.
     */
    console.error("Kullanıcı silme hatası:", error);
    const code = (error as { code?: string })?.code;
    const detail = error instanceof Error ? error.message.split("\n").filter(Boolean).pop() : null;
    return NextResponse.json(
      {
        error: code
          ? `Kullanıcı silinemedi (${code}). ${detail ?? ""}`.trim()
          : `Kullanıcı silinemedi. ${detail ?? ""}`.trim(),
        code,
      },
      { status: 500 }
    );
  }
}

/**
 * Kullanıcıyı ve ona bağlı her şeyi tek işlemde siler.
 *
 * `prisma.user.delete()` tek başına veritabanındaki cascade kurallarına
 * güveniyordu. O kurallar migration'larla kuruluyor; şema bir noktada
 * `db push` ile senkronlandıysa ya da bir kısıt beklenenden farklıysa silme
 * yabancı anahtar hatasıyla düşüyor ve dışarıdan "hiçbir şey olmadı" gibi
 * görünüyor. Bağımlılıklar artık açıkça, doğru sırayla temizleniyor; sonuç
 * veritabanının kurallarına bağlı değil.
 *
 * Silinen ile kopan ayrımı korunur: kişisel değerlendirme ve içindekiler
 * silinir, kuruluş değerlendirmelerine girilen cevaplar durur ve yalnızca
 * "kim yazdı" izi kopar.
 */
async function deleteUserCompletely(id: string) {
  return prisma.$transaction(async (tx) => {
    const ownAssessments = await tx.assessment.findMany({
      where: { ownerUserId: id },
      select: { id: true },
    });
    const assessmentIds = ownAssessments.map((assessment) => assessment.id);

    // Başkasının değerlendirmesine girdiği cevaplar silinmez; yazar izi kopar.
    await tx.surveyResponse.updateMany({
      where: { answeredById: id },
      data: { answeredById: null },
    });
    await tx.assessment.updateMany({
      where: { submittedById: id },
      data: { submittedById: null },
    });
    await tx.sectionAssignment.updateMany({
      where: { assignedById: id },
      data: { assignedById: null },
    });
    await tx.unitJoinCodeUse.updateMany({ where: { userId: id }, data: { userId: null } });
    await tx.unitJoinCode.updateMany({ where: { createdById: id }, data: { createdById: null } });
    await tx.surveyCampaign.updateMany({ where: { createdById: id }, data: { createdById: null } });
    await tx.survey.updateMany({ where: { createdById: id }, data: { createdById: null } });

    // Kendi değerlendirmesi ve içindekiler gider.
    if (assessmentIds.length > 0) {
      await tx.surveyResponse.deleteMany({ where: { assessmentId: { in: assessmentIds } } });
      await tx.scoreHistory.deleteMany({ where: { assessmentId: { in: assessmentIds } } });
      await tx.roadmapItem.deleteMany({ where: { assessmentId: { in: assessmentIds } } });
      await tx.sectionAssignment.deleteMany({ where: { assessmentId: { in: assessmentIds } } });
    }

    await tx.sectionAssignment.deleteMany({ where: { assigneeId: id } });
    await tx.document.deleteMany({ where: { userId: id } });
    await tx.assessmentScore.deleteMany({ where: { userId: id } });
    await tx.userSurveyAssignment.deleteMany({ where: { userId: id } });
    await tx.unitAdmin.deleteMany({ where: { userId: id } });

    if (assessmentIds.length > 0) {
      await tx.assessment.deleteMany({ where: { id: { in: assessmentIds } } });
    }

    await tx.user.delete({ where: { id } });

    return { assessments: assessmentIds.length };
  });
}
