import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/api-utils";
import { getAccessibleSurveyIds } from "@/lib/scoring";
import {
  canManageTenantUnit,
  getDescendantUnitIds,
  getOrganizationRoots,
} from "@/lib/organization-campaign";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await withAuth(request, { requireUnitManager: true });
  if (!auth.success) return auth.response;

  try {
    const roots = await getOrganizationRoots(auth.userId, auth.user.role);
    const rootIds = roots.map((root) => root.id);
    const surveyIds = await getAccessibleSurveyIds(auth.userId);

    const [surveys, campaigns, allUnits] = await Promise.all([
      prisma.survey.findMany({
        where: { id: { in: surveyIds }, isActive: true, archivedAt: null },
        select: { id: true, name: true, description: true },
        orderBy: { order: "asc" },
      }),
      prisma.surveyCampaign.findMany({
        where: auth.user.role === "ADMIN" ? {} : { tenantUnitId: { in: rootIds } },
        select: {
          id: true,
          name: true,
          status: true,
          privacyMode: true,
          deadline: true,
          createdAt: true,
          tenantUnit: { select: { id: true, name: true } },
          survey: { select: { id: true, name: true } },
          _count: { select: { recipients: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.unit.findMany({
        select: {
          id: true,
          name: true,
          parentId: true,
          _count: { select: { users: { where: { isActive: true } } } },
        },
        orderBy: { name: "asc" },
      }),
    ]);

    const children = new Map<string, string[]>();
    for (const unit of allUnits) {
      if (!unit.parentId) continue;
      const rows = children.get(unit.parentId) ?? [];
      rows.push(unit.id);
      children.set(unit.parentId, rows);
    }

    const descendantsOf = (rootId: string) => {
      const result: string[] = [];
      const seen = new Set([rootId]);
      const queue = [...(children.get(rootId) ?? [])];
      while (queue.length > 0) {
        const id = queue.shift()!;
        if (seen.has(id)) continue;
        seen.add(id);
        result.push(id);
        queue.push(...(children.get(id) ?? []));
      }
      return result;
    };

    return NextResponse.json({
      roots: roots.map((root) => ({
        ...root,
        members: descendantsOf(root.id).map((id) => {
          const unit = allUnits.find((candidate) => candidate.id === id)!;
          return {
            id: unit.id,
            name: unit.name,
            activeUserCount: unit._count.users,
          };
        }),
      })),
      surveys,
      campaigns: campaigns.map((campaign) => ({
        ...campaign,
        recipientCount: campaign._count.recipients,
        _count: undefined,
      })),
    });
  } catch (error) {
    console.error("Organization campaigns GET error:", error);
    return NextResponse.json({ error: "Kampanyalar yüklenemedi" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await withAuth(request, { requireUnitManager: true, rateLimit: "admin" });
  if (!auth.success) return auth.response;

  try {
    const body = (await request.json()) ?? {};
    const name = String(body.name ?? "").trim().slice(0, 120);
    const tenantUnitId = String(body.tenantUnitId ?? "");
    const surveyId = String(body.surveyId ?? "");
    const memberUnitIds: string[] = Array.from(
      new Set<string>(
        Array.isArray(body.memberUnitIds)
          ? body.memberUnitIds.map((value: unknown) => String(value))
          : []
      )
    );
    const privacyMode = body.privacyMode === "ANONYMOUS" ? "ANONYMOUS" : "IDENTIFIED";
    const minimumCohortSize = Math.min(100, Math.max(3, Number(body.minimumCohortSize) || 5));
    const deadlineText = String(body.deadline ?? "").trim();
    // Tarih alanı gün seçtirir; çıplak YYYY-MM-DD gece 00:00'a çevrilirse üye
    // son günün tamamını kaybeder. Kampanya günün sonunda kapanır.
    const deadline = deadlineText
      ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(deadlineText) ? `${deadlineText}T23:59:59.999Z` : deadlineText)
      : null;

    if (!name || !tenantUnitId || !surveyId || memberUnitIds.length === 0) {
      return NextResponse.json(
        { error: "Kampanya adı, kuruluş, anket ve en az bir üye gerekli." },
        { status: 400 }
      );
    }
    if (deadline && Number.isNaN(deadline.getTime())) {
      return NextResponse.json({ error: "Geçerli bir son tarih girin." }, { status: 400 });
    }
    if (!(await canManageTenantUnit(auth.userId, auth.user.role, tenantUnitId))) {
      return NextResponse.json({ error: "Bu kuruluş için kampanya açamazsınız." }, { status: 403 });
    }

    const accessibleSurveyIds = await getAccessibleSurveyIds(auth.userId, surveyId);
    if (!accessibleSurveyIds.includes(surveyId)) {
      return NextResponse.json({ error: "Bu ankete erişiminiz yok." }, { status: 403 });
    }

    const descendantIds = new Set(await getDescendantUnitIds(tenantUnitId));
    if (memberUnitIds.some((id) => !descendantIds.has(id))) {
      return NextResponse.json(
        { error: "Seçilen üyelerden biri kuruluşunuzun kapsamı dışında." },
        { status: 403 }
      );
    }

    const memberUnits = await prisma.unit.findMany({
      where: { id: { in: memberUnitIds } },
      select: {
        id: true,
        name: true,
        users: {
          where: { isActive: true },
          select: { id: true },
        },
      },
    });
    const missingUsers = memberUnits.filter((unit) => unit.users.length === 0);
    if (memberUnits.length !== memberUnitIds.length || missingUsers.length > 0) {
      return NextResponse.json(
        {
          error:
            missingUsers.length > 0
              ? `Aktif kullanıcısı olmayan üyeler var: ${missingUsers.map((unit) => unit.name).join(", ")}`
              : "Üye kuruluşlardan biri bulunamadı.",
        },
        { status: 400 }
      );
    }

    // Aynı üye aynı anket için iki aktif kampanyaya düşerse hangi
    // değerlendirmeye yazacağı belirsizleşir; bunu kampanya açılırken engelle.
    const overlap = await prisma.campaignRecipient.findFirst({
      where: {
        memberUnitId: { in: memberUnitIds },
        campaign: { surveyId, status: "ACTIVE" },
      },
      select: { memberUnit: { select: { name: true } }, campaign: { select: { name: true } } },
    });
    if (overlap) {
      return NextResponse.json(
        {
          error: `${overlap.memberUnit.name}, aynı anketin “${overlap.campaign.name}” kampanyasında zaten aktif.`,
        },
        { status: 409 }
      );
    }

    const campaign = await prisma.$transaction(async (tx) => {
      const created = await tx.surveyCampaign.create({
        data: {
          name,
          tenantUnitId,
          surveyId,
          privacyMode,
          minimumCohortSize,
          deadline,
          createdById: auth.userId,
          recipients: {
            create: memberUnitIds.map((memberUnitId) => ({
              memberUnit: { connect: { id: memberUnitId } },
            })),
          },
        },
        select: { id: true, name: true },
      });

      const userIds = memberUnits.flatMap((unit) => unit.users.map((user) => user.id));
      for (const userId of userIds) {
        await tx.userSurveyAssignment.upsert({
          where: { userId_surveyId: { userId, surveyId } },
          update: {
            isActive: true,
            assignedAt: new Date(),
            assignedBy: auth.userId,
            hasDeadline: Boolean(deadline),
            deadline,
          },
          create: {
            userId,
            surveyId,
            assignedBy: auth.userId,
            hasDeadline: Boolean(deadline),
            deadline,
          },
        });
      }
      return created;
    });

    return NextResponse.json({ success: true, campaign }, { status: 201 });
  } catch (error) {
    console.error("Organization campaigns POST error:", error);
    return NextResponse.json({ error: "Kampanya oluşturulamadı" }, { status: 500 });
  }
}
