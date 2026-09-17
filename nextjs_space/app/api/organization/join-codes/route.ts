import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/api-utils";
import {
  canManageTenantUnit,
  getDescendantUnitIds,
  getTenantScopeUnitIds,
} from "@/lib/organization-campaign";
import {
  generateJoinCode,
  hashJoinCode,
  joinCodePreview,
  joinCodeUnavailableReason,
} from "@/lib/organization-join-code";
import { getAccessibleSurveyIds } from "@/lib/scoring";

export const dynamic = "force-dynamic";

const clean = (value: unknown, maxLength: number) =>
  String(value ?? "").trim().slice(0, maxLength);

async function managedTenant(userId: string, role: string, tenantUnitId: string) {
  if (!(await canManageTenantUnit(userId, role, tenantUnitId))) return null;
  return prisma.unit.findUnique({
    where: { id: tenantUnitId },
    select: { id: true, name: true },
  });
}

/** Sektör/alt sektör eşleşmesini doğrular (üye davetindeki kuralın aynısı). */
async function validateSectorProfile(sectorId: string, subSectorId: string | null) {
  const sector = await prisma.sector.findUnique({
    where: { id: sectorId },
    select: {
      id: true,
      subSectors: subSectorId ? { where: { id: subSectorId }, select: { id: true } } : false,
    },
  });
  if (!sector) return "Seçilen sektör bulunamadı.";
  if (subSectorId && (!sector.subSectors || sector.subSectors.length === 0)) {
    return "Seçilen alt sektör bu sektöre ait değil.";
  }
  return null;
}

async function resolveSurvey(userId: string, tenantUnitId: string, surveyId: string) {
  if (!surveyId) return { survey: null, error: null };
  const survey = await prisma.survey.findUnique({
    where: { id: surveyId },
    select: { id: true, name: true, ownerUnitId: true, isActive: true, archivedAt: true },
  });
  if (!survey || !survey.isActive || survey.archivedAt) {
    return { survey: null, error: "Seçilen anket aktif değil veya bulunamadı." };
  }
  const accessibleSurveyIds = await getAccessibleSurveyIds(userId, surveyId);
  if (survey.ownerUnitId !== tenantUnitId && !accessibleSurveyIds.includes(surveyId)) {
    return { survey: null, error: "Bu anketi katılım koduna bağlama yetkiniz yok." };
  }
  return { survey, error: null };
}

export async function GET(request: NextRequest) {
  const auth = await withAuth(request, { requireUnitManager: true, rateLimit: "admin" });
  if (!auth.success) return auth.response;

  const tenantUnitId = clean(request.nextUrl.searchParams.get("tenantUnitId"), 64);
  const tenant = await managedTenant(auth.userId, auth.user.role, tenantUnitId);
  if (!tenant) {
    return NextResponse.json({ error: "Bu STK için katılım kodlarını yönetme yetkiniz yok." }, { status: 403 });
  }

  try {
    // Kök birimin kendi kodu da listelenir (bkz. getTenantScopeUnitIds).
    const scopeIds = await getTenantScopeUnitIds(tenant.id);
    const codes = await prisma.unitJoinCode.findMany({
      where: { unitId: { in: scopeIds } },
      select: {
        id: true,
        label: true,
        codePreview: true,
        expiresAt: true,
        maxUses: true,
        useCount: true,
        isActive: true,
        createdAt: true,
        createsMemberUnit: true,
        unit: { select: { id: true, name: true } },
        survey: { select: { id: true, name: true } },
        sector: { select: { id: true, name: true } },
        subSector: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({
      codes: codes.map((code) => ({
        ...code,
        unavailableReason: joinCodeUnavailableReason(code),
      })),
    });
  } catch (error) {
    console.error("Organization join codes GET error:", error);
    return NextResponse.json({ error: "Katılım kodları yüklenemedi." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await withAuth(request, { requireUnitManager: true, rateLimit: "admin" });
  if (!auth.success) return auth.response;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const tenantUnitId = clean(body.tenantUnitId, 64);
    const tenant = await managedTenant(auth.userId, auth.user.role, tenantUnitId);
    if (!tenant) {
      return NextResponse.json({ error: "Bu STK için katılım kodlarını yönetme yetkiniz yok." }, { status: 403 });
    }

    const action = clean(body.action, 32);
    if (action === "revoke") {
      return revokeCode(body, tenant.id);
    }
    if (action !== "create") {
      return NextResponse.json({ error: "Geçersiz katılım kodu işlemi." }, { status: 400 });
    }

    const memberUnitId = clean(body.memberUnitId, 64);
    const label = clean(body.label, 100) || null;
    const surveyId = clean(body.surveyId, 64);
    const expiresInDaysRaw = clean(body.expiresInDays, 8);
    const maxUsesRaw = clean(body.maxUses, 8);
    const expiresInDays = expiresInDaysRaw ? Number(expiresInDaysRaw) : null;
    const maxUses = maxUsesRaw ? Number(maxUsesRaw) : null;

    if (expiresInDays !== null && (!Number.isInteger(expiresInDays) || expiresInDays < 1 || expiresInDays > 365)) {
      return NextResponse.json({ error: "Kod süresi 1–365 gün arasında olmalı." }, { status: 400 });
    }
    if (maxUses !== null && (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 10000)) {
      return NextResponse.json({ error: "Kullanım sınırı 1–10000 arasında olmalı." }, { status: 400 });
    }

    /**
     * İki tür kod var:
     *
     * - **Üye kuruluşa katılım**: hedef önceden oluşturulmuş bir alt birim.
     *   Sektör o kuruluştan gelir.
     * - **Birim seviyesi katılım** (`createsMemberUnit`): hedef yapının kendisi.
     *   Kaydolan kişi şirket adını yazar, üye kuruluş o addan otomatik açılır.
     *   Sektör kodun kendisinde durur, çünkü henüz bir kuruluş yok.
     */
    const createsMemberUnit = body.createsMemberUnit === true;
    const scopeIds = await getTenantScopeUnitIds(tenant.id);

    if (!memberUnitId || !scopeIds.includes(memberUnitId)) {
      return NextResponse.json({ error: "Seçilen birim bu yapının kapsamında değil." }, { status: 403 });
    }

    const [member, surveyResolution] = await Promise.all([
      prisma.unit.findUnique({
        where: { id: memberUnitId },
        select: { id: true, name: true, sectorId: true, subSectorId: true },
      }),
      resolveSurvey(auth.userId, tenant.id, surveyId),
    ]);
    if (!member) return NextResponse.json({ error: "Birim bulunamadı." }, { status: 404 });

    let codeSectorId: string | null = null;
    let codeSubSectorId: string | null = null;

    if (createsMemberUnit) {
      // Sektör koda yazılır ve açılacak her üye kuruluşa aktarılır.
      codeSectorId = clean(body.sectorId, 64) || member.sectorId || null;
      codeSubSectorId = clean(body.subSectorId, 64) || null;

      if (!codeSectorId) {
        return NextResponse.json(
          { error: "Bu kodla kaydolanların sektörünü seçin." },
          { status: 400 }
        );
      }

      const sectorError = await validateSectorProfile(codeSectorId, codeSubSectorId);
      if (sectorError) {
        return NextResponse.json({ error: sectorError }, { status: 400 });
      }
    } else if (!member.sectorId) {
      return NextResponse.json({ error: "Üye kuruluşun sektör profili olmadan katılım kodu oluşturulamaz." }, { status: 409 });
    }
    if (surveyResolution.error) {
      return NextResponse.json({ error: surveyResolution.error }, { status: 403 });
    }

    const rawCode = generateJoinCode();
    const created = await prisma.unitJoinCode.create({
      data: {
        unitId: member.id,
        label,
        codeHash: hashJoinCode(rawCode),
        codePreview: joinCodePreview(rawCode),
        expiresAt: expiresInDays
          ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
          : null,
        maxUses,
        createsMemberUnit,
        sectorId: codeSectorId,
        subSectorId: codeSubSectorId,
        surveyId: surveyResolution.survey?.id ?? null,
        createdById: auth.userId,
      },
      select: {
        id: true,
        label: true,
        codePreview: true,
        expiresAt: true,
        maxUses: true,
        useCount: true,
        isActive: true,
        createdAt: true,
        createsMemberUnit: true,
        unit: { select: { id: true, name: true } },
        survey: { select: { id: true, name: true } },
        sector: { select: { id: true, name: true } },
        subSector: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ code: rawCode, record: { ...created, unavailableReason: null } }, { status: 201 });
  } catch (error) {
    console.error("Organization join codes POST error:", error);
    return NextResponse.json({ error: "Katılım kodu işlemi tamamlanamadı." }, { status: 500 });
  }
}

async function revokeCode(body: Record<string, unknown>, tenantUnitId: string) {
  const codeId = clean(body.codeId, 64);
  const scopeIds = await getTenantScopeUnitIds(tenantUnitId);
  const code = await prisma.unitJoinCode.findFirst({
    where: { id: codeId, unitId: { in: scopeIds } },
    select: { id: true },
  });
  if (!code) return NextResponse.json({ error: "Katılım kodu bulunamadı." }, { status: 404 });
  await prisma.unitJoinCode.update({ where: { id: code.id }, data: { isActive: false } });
  return NextResponse.json({ success: true });
}
