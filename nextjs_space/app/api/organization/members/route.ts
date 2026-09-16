import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { validators, withAuth } from "@/lib/api-utils";
import {
  canManageTenantUnit,
  getDescendantUnitIds,
  getOrganizationRoots,
} from "@/lib/organization-campaign";
import {
  buildMemberImportWorkbook,
  parseMemberImportExcel,
  type MemberImportRow,
} from "@/lib/organization-member-import";
import { sendMemberAccountInvitation } from "@/lib/organization-invitations";
import { getAccessibleSurveyIds } from "@/lib/scoring";

export const dynamic = "force-dynamic";

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type InvitationTarget = {
  id: string;
  email: string;
  firstName: string | null;
  token: string;
  memberName: string;
  surveyName?: string | null;
};

const clean = (value: unknown, maxLength: number) =>
  String(value ?? "").trim().slice(0, maxLength);

function invitationToken() {
  return crypto.randomBytes(32).toString("hex");
}

async function placeholderPassword() {
  return bcrypt.hash(crypto.randomBytes(48).toString("base64url"), 10);
}

async function managedTenant(
  userId: string,
  role: string,
  tenantUnitId: string
) {
  if (!(await canManageTenantUnit(userId, role, tenantUnitId))) return null;
  return prisma.unit.findUnique({
    where: { id: tenantUnitId },
    select: { id: true, name: true },
  });
}

async function validateSectorProfile(sectorId: string, subSectorId: string | null) {
  if (!sectorId) return "Sektör seçimi gerekli.";
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

async function deliverInvitations(tenantName: string, targets: InvitationTarget[]) {
  const results = await Promise.all(
    targets.map(async (target) => ({
      target,
      result: await sendMemberAccountInvitation({
        email: target.email,
        firstName: target.firstName,
        tenantName,
        memberName: target.memberName,
        token: target.token,
        surveyName: target.surveyName,
      }),
    }))
  );
  return {
    sent: results.filter(({ result }) => result.success).length,
    failed: results.filter(({ result }) => !result.success && !result.skipped).length,
    skipped: results.filter(({ result }) => result.skipped).length,
  };
}

export async function GET(request: NextRequest) {
  const auth = await withAuth(request, { requireUnitManager: true, rateLimit: "admin" });
  if (!auth.success) return auth.response;

  try {
    if (request.nextUrl.searchParams.get("template") === "excel") {
      const sectors = await prisma.sector.findMany({
        select: {
          name: true,
          naicsCode: true,
          subSectors: { select: { name: true }, orderBy: { order: "asc" } },
        },
        orderBy: { order: "asc" },
      });
      const workbook = buildMemberImportWorkbook(sectors);
      return new NextResponse(workbook, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": 'attachment; filename="uye-aktarma-sablonu.xlsx"',
          "Content-Length": workbook.length.toString(),
          "Cache-Control": "private, no-store",
        },
      });
    }

    const roots = await getOrganizationRoots(auth.userId, auth.user.role);
    const accessibleSurveyIds = await getAccessibleSurveyIds(auth.userId);
    const accessibleSurveyIdSet = new Set(accessibleSurveyIds);
    const surveys = await prisma.survey.findMany({
      where: {
        isActive: true,
        archivedAt: null,
        OR: [
          { id: { in: accessibleSurveyIds } },
          { ownerUnitId: { in: roots.map((root) => root.id) } },
        ],
      },
      select: { id: true, name: true, description: true, ownerUnitId: true },
      orderBy: [{ order: "asc" }, { name: "asc" }],
    });
    const memberGroups = await Promise.all(
      roots.map(async (root) => {
        const descendantIds = await getDescendantUnitIds(root.id);
        const members = await prisma.unit.findMany({
          where: { id: { in: descendantIds } },
          select: {
            id: true,
            name: true,
            description: true,
            parentId: true,
            users: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
                emailVerified: true,
                isActive: true,
                sectorId: true,
                subSectorId: true,
              },
              orderBy: { createdAt: "asc" },
            },
          },
          orderBy: { name: "asc" },
        });
        return {
          ...root,
          members,
          surveys: surveys.filter(
            (survey) => accessibleSurveyIdSet.has(survey.id) || survey.ownerUnitId === root.id
          ),
        };
      })
    );

    return NextResponse.json({ roots: memberGroups });
  } catch (error) {
    console.error("Organization members GET error:", error);
    return NextResponse.json({ error: "Üyeler yüklenemedi." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await withAuth(request, { requireUnitManager: true, rateLimit: "admin" });
  if (!auth.success) return auth.response;

  try {
    const contentType = request.headers.get("content-type") ?? "";
    let body: Record<string, unknown>;
    let importFile: File | null = null;
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      body = {
        action: formData.get("action"),
        tenantUnitId: formData.get("tenantUnitId"),
      };
      const candidate = formData.get("file");
      importFile = candidate instanceof File ? candidate : null;
    } else {
      body = ((await request.json()) ?? {}) as Record<string, unknown>;
    }
    const action = clean(body.action, 40);
    const tenantUnitId = clean(body.tenantUnitId, 64);
    const tenant = await managedTenant(auth.userId, auth.user.role, tenantUnitId);
    if (!tenant) {
      return NextResponse.json(
        { error: "Bu STK için üye yönetme yetkiniz yok." },
        { status: 403 }
      );
    }

    if (action === "create_member") {
      return await createMember(body, tenant, auth.userId);
    }
    if (action === "invite_user") {
      return await inviteUser(body, tenant, auth.userId);
    }
    if (action === "import_excel") {
      return await importMembers(importFile, tenant);
    }
    if (action === "resend_invitation") {
      return await resendInvitation(body, tenant);
    }

    return NextResponse.json({ error: "Geçersiz üye yönetimi işlemi." }, { status: 400 });
  } catch (error) {
    console.error("Organization members POST error:", error);
    return NextResponse.json({ error: "Üye işlemi tamamlanamadı." }, { status: 500 });
  }
}

async function resolveAssignableSurvey(userId: string, tenantUnitId: string, surveyId: string) {
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
    return { survey: null, error: "Bu anketi üyelere atama yetkiniz yok." };
  }
  return { survey, error: null };
}

async function createMember(
  body: Record<string, unknown>,
  tenant: { id: string; name: string },
  assignedBy: string
) {
  const memberName = clean(body.memberName, 160);
  const description = clean(body.description, 500) || null;
  const firstName = clean(body.firstName, 80);
  const lastName = clean(body.lastName, 80) || null;
  const email = clean(body.email, 254).toLowerCase();
  const sectorId = clean(body.sectorId, 64);
  const subSectorId = clean(body.subSectorId, 64) || null;
  const surveyId = clean(body.surveyId, 64);
  const makeUnitManager = body.makeUnitManager === true;

  if (!memberName || !firstName || !validators.email(email)) {
    return NextResponse.json(
      { error: "Üye kuruluş adı, yetkili adı ve geçerli e-posta gerekli." },
      { status: 400 }
    );
  }
  const sectorError = await validateSectorProfile(sectorId, subSectorId);
  if (sectorError) return NextResponse.json({ error: sectorError }, { status: 400 });
  const surveyResolution = await resolveAssignableSurvey(assignedBy, tenant.id, surveyId);
  if (surveyResolution.error) {
    return NextResponse.json({ error: surveyResolution.error }, { status: 403 });
  }
  const assignedSurvey = surveyResolution.survey;

  const [duplicateMember, duplicateUser] = await Promise.all([
    prisma.unit.findFirst({
      where: { parentId: tenant.id, name: { equals: memberName, mode: "insensitive" } },
      select: { id: true },
    }),
    prisma.user.findUnique({ where: { email }, select: { id: true } }),
  ]);
  if (duplicateMember) {
    return NextResponse.json({ error: "Bu isimde bir üye kuruluş zaten mevcut." }, { status: 409 });
  }
  if (duplicateUser) {
    return NextResponse.json({ error: "Bu e-posta adresiyle bir hesap zaten mevcut." }, { status: 409 });
  }

  const token = invitationToken();
  const password = await placeholderPassword();
  const expires = new Date(Date.now() + INVITATION_TTL_MS);
  const created = await prisma.$transaction(async (tx) => {
    const member = await tx.unit.create({
      data: { name: memberName, description, organization: memberName, parentId: tenant.id },
      select: { id: true, name: true },
    });
    const user = await tx.user.create({
      data: {
        email,
        password,
        firstName,
        lastName,
        organization: memberName,
        role: makeUnitManager ? "UNIT_MANAGER" : "USER",
        unitId: member.id,
        sectorId,
        subSectorId,
        emailVerified: false,
        isActive: true,
        passwordResetToken: token,
        passwordResetExpires: expires,
      },
      select: { id: true, email: true, firstName: true, role: true },
    });
    if (makeUnitManager) {
      await tx.unitAdmin.create({
        data: { unitId: member.id, userId: user.id },
      });
    }
    const assignment = assignedSurvey
      ? await tx.userSurveyAssignment.create({
          data: {
            userId: user.id,
            surveyId: assignedSurvey.id,
            assignedBy,
          },
          select: { id: true, surveyId: true },
        })
      : null;
    return { member, user, assignment };
  });

  const invitation = await deliverInvitations(tenant.name, [{
    ...created.user,
    token,
    memberName: created.member.name,
    surveyName: assignedSurvey?.name,
  }]);
  return NextResponse.json({
    success: true,
    ...created,
    assignedSurvey: assignedSurvey
      ? { id: assignedSurvey.id, name: assignedSurvey.name }
      : null,
    invitation,
  }, { status: 201 });
}

async function inviteUser(
  body: Record<string, unknown>,
  tenant: { id: string; name: string },
  assignedBy: string
) {
  const memberUnitId = clean(body.memberUnitId, 64);
  const firstName = clean(body.firstName, 80);
  const lastName = clean(body.lastName, 80) || null;
  const email = clean(body.email, 254).toLowerCase();
  const surveyId = clean(body.surveyId, 64);
  const descendantIds = new Set(await getDescendantUnitIds(tenant.id));
  if (!memberUnitId || !descendantIds.has(memberUnitId)) {
    return NextResponse.json({ error: "Üye kuruluş bu STK kapsamına ait değil." }, { status: 403 });
  }
  if (!firstName || !validators.email(email)) {
    return NextResponse.json({ error: "Yetkili adı ve geçerli e-posta gerekli." }, { status: 400 });
  }
  const surveyResolution = await resolveAssignableSurvey(assignedBy, tenant.id, surveyId);
  if (surveyResolution.error) {
    return NextResponse.json({ error: surveyResolution.error }, { status: 403 });
  }
  const assignedSurvey = surveyResolution.survey;

  const [member, duplicateUser] = await Promise.all([
    prisma.unit.findUnique({
      where: { id: memberUnitId },
      select: {
        id: true,
        name: true,
        users: {
          where: { isActive: true },
          select: { sectorId: true, subSectorId: true },
          orderBy: { createdAt: "asc" },
          take: 1,
        },
      },
    }),
    prisma.user.findUnique({ where: { email }, select: { id: true } }),
  ]);
  if (!member) return NextResponse.json({ error: "Üye kuruluş bulunamadı." }, { status: 404 });
  if (duplicateUser) {
    return NextResponse.json({ error: "Bu e-posta adresiyle bir hesap zaten mevcut." }, { status: 409 });
  }
  const profile = member.users[0];
  if (!profile?.sectorId) {
    return NextResponse.json(
      { error: "Üye kuruluşun sektör profili eksik; önce platform yöneticisi profili düzeltmeli." },
      { status: 409 }
    );
  }

  const token = invitationToken();
  const password = await placeholderPassword();
  const created = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        password,
        firstName,
        lastName,
        organization: member.name,
        role: "USER",
        unitId: member.id,
        sectorId: profile.sectorId,
        subSectorId: profile.subSectorId,
        emailVerified: false,
        isActive: true,
        passwordResetToken: token,
        passwordResetExpires: new Date(Date.now() + INVITATION_TTL_MS),
      },
      select: { id: true, email: true, firstName: true },
    });
    const assignment = assignedSurvey
      ? await tx.userSurveyAssignment.create({
          data: {
            userId: user.id,
            surveyId: assignedSurvey.id,
            assignedBy,
          },
          select: { id: true, surveyId: true },
        })
      : null;
    return { user, assignment };
  });
  const invitation = await deliverInvitations(tenant.name, [{
    ...created.user,
    token,
    memberName: member.name,
    surveyName: assignedSurvey?.name,
  }]);
  return NextResponse.json({
    success: true,
    ...created,
    assignedSurvey: assignedSurvey
      ? { id: assignedSurvey.id, name: assignedSurvey.name }
      : null,
    invitation,
  }, { status: 201 });
}

async function importMembers(file: File | null, tenant: { id: string; name: string }) {
  if (!file) {
    return NextResponse.json({ error: "Excel dosyası gerekli." }, { status: 400 });
  }
  if (!file.name.toLocaleLowerCase("tr-TR").endsWith(".xlsx")) {
    return NextResponse.json({ error: "Yalnızca .xlsx Excel dosyası yükleyebilirsiniz." }, { status: 400 });
  }
  const parsed = parseMemberImportExcel(new Uint8Array(await file.arrayBuffer()));
  if (parsed.errors.length > 0) {
    return NextResponse.json({ error: "Excel doğrulanamadı.", errors: parsed.errors }, { status: 400 });
  }
  if (parsed.rows.length === 0) {
    return NextResponse.json({ error: "Excel içinde aktarılacak satır yok." }, { status: 400 });
  }

  const emails = parsed.rows.map((row) => row.email);
  const existingUsers = await prisma.user.findMany({
    where: { email: { in: emails } },
    select: { email: true },
  });
  if (existingUsers.length > 0) {
    return NextResponse.json(
      {
        error: "Bazı e-posta adresleri zaten kayıtlı.",
        errors: existingUsers.map((user) => user.email),
      },
      { status: 409 }
    );
  }

  const catalog = await prisma.sector.findMany({
    select: { id: true, naicsCode: true, subSectors: { select: { id: true, name: true } } },
  });
  const sectorByCode = new Map(
    catalog.filter((sector) => sector.naicsCode).map((sector) => [sector.naicsCode!.toUpperCase(), sector])
  );
  const validationErrors: string[] = [];
  const resolvedRows = parsed.rows.map((row) => {
    const sector = sectorByCode.get(row.sectorCode);
    const subSector = row.subSectorCode
      ? sector?.subSectors.find((item) => item.name.startsWith(`[${row.subSectorCode}] `))
      : null;
    if (!sector) validationErrors.push(`${row.rowNumber}. satır: ${row.sectorCode} sektör kodu bulunamadı.`);
    if (row.subSectorCode && !subSector) {
      validationErrors.push(`${row.rowNumber}. satır: ${row.subSectorCode} alt sektör kodu bulunamadı.`);
    }
    return { ...row, sectorId: sector?.id ?? "", subSectorId: subSector?.id ?? null };
  });
  validateMemberProfiles(resolvedRows, validationErrors);
  if (validationErrors.length > 0) {
    return NextResponse.json({ error: "Excel doğrulanamadı.", errors: validationErrors }, { status: 400 });
  }

  const existingMembers = await prisma.unit.findMany({
    where: { parentId: tenant.id },
    select: {
      id: true,
      name: true,
      users: {
        where: { isActive: true },
        select: { sectorId: true, subSectorId: true },
        orderBy: { createdAt: "asc" },
        take: 1,
      },
    },
  });
  const existingByName = new Map(existingMembers.map((member) => [member.name.toLocaleLowerCase("tr-TR"), member]));
  for (const row of resolvedRows) {
    const existing = existingByName.get(row.memberName.toLocaleLowerCase("tr-TR"));
    const profile = existing?.users[0];
    if (profile?.sectorId && (profile.sectorId !== row.sectorId || profile.subSectorId !== row.subSectorId)) {
      validationErrors.push(`${row.rowNumber}. satır: Üye kuruluşun mevcut sektör profiliyle uyuşmuyor.`);
    }
  }
  if (validationErrors.length > 0) {
    return NextResponse.json({ error: "Excel doğrulanamadı.", errors: validationErrors }, { status: 400 });
  }

  const password = await placeholderPassword();
  const targets = await prisma.$transaction(async (tx) => {
    const units = new Map(
      existingMembers.map((member) => [
        member.name.toLocaleLowerCase("tr-TR"),
        { id: member.id, name: member.name },
      ])
    );
    const invitationTargets: InvitationTarget[] = [];
    for (const row of resolvedRows) {
      const key = row.memberName.toLocaleLowerCase("tr-TR");
      let member = units.get(key);
      if (!member) {
        member = await tx.unit.create({
          data: {
            name: row.memberName,
            organization: row.memberName,
            parentId: tenant.id,
          },
          select: { id: true, name: true },
        });
        units.set(key, member);
      }
      const token = invitationToken();
      const user = await tx.user.create({
        data: {
          email: row.email,
          password,
          firstName: row.firstName,
          lastName: row.lastName || null,
          organization: member.name,
          role: "USER",
          unitId: member.id,
          sectorId: row.sectorId,
          subSectorId: row.subSectorId,
          emailVerified: false,
          isActive: true,
          passwordResetToken: token,
          passwordResetExpires: new Date(Date.now() + INVITATION_TTL_MS),
        },
        select: { id: true, email: true, firstName: true },
      });
      invitationTargets.push({ ...user, token, memberName: member.name });
    }
    return invitationTargets;
  });

  const invitation = await deliverInvitations(tenant.name, targets);
  return NextResponse.json({
    success: true,
    importedUsers: targets.length,
    memberCount: new Set(resolvedRows.map((row) => row.memberName.toLocaleLowerCase("tr-TR"))).size,
    invitation,
  }, { status: 201 });
}

function validateMemberProfiles(
  rows: Array<MemberImportRow & { sectorId: string; subSectorId: string | null }>,
  errors: string[]
) {
  const profiles = new Map<string, { sectorId: string; subSectorId: string | null }>();
  for (const row of rows) {
    const key = row.memberName.toLocaleLowerCase("tr-TR");
    const current = profiles.get(key);
    if (current && (current.sectorId !== row.sectorId || current.subSectorId !== row.subSectorId)) {
      errors.push(`${row.rowNumber}. satır: Aynı üye kuruluş için sektör kodları farklı olamaz.`);
    } else {
      profiles.set(key, { sectorId: row.sectorId, subSectorId: row.subSectorId });
    }
  }
}

async function resendInvitation(body: Record<string, unknown>, tenant: { id: string; name: string }) {
  const userId = clean(body.userId, 64);
  const descendantIds = await getDescendantUnitIds(tenant.id);
  const user = await prisma.user.findFirst({
    where: { id: userId, unitId: { in: descendantIds }, isActive: true },
    select: {
      id: true,
      email: true,
      firstName: true,
      emailVerified: true,
      unit: { select: { name: true } },
    },
  });
  if (!user?.unit) return NextResponse.json({ error: "Davet edilecek kullanıcı bulunamadı." }, { status: 404 });
  if (user.emailVerified) {
    return NextResponse.json(
      { error: "Bu kullanıcı hesabını zaten etkinleştirmiş; davet yenilenemez." },
      { status: 409 }
    );
  }

  const token = invitationToken();
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetToken: token,
      passwordResetExpires: new Date(Date.now() + INVITATION_TTL_MS),
    },
  });
  const invitation = await deliverInvitations(tenant.name, [{
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    token,
    memberName: user.unit.name,
  }]);
  return NextResponse.json({ success: true, invitation });
}
