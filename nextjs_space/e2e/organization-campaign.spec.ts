import { test, expect, type Browser, type Page } from "@playwright/test";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

const PASSWORD = "E2eParola!123";
const MANAGER = "e2e-oda-yonetici@example.com";
const MEMBER_A = "e2e-oda-uye-a@example.com";
const MEMBER_B = "e2e-oda-uye-b@example.com";
const OUTSIDER = "e2e-baska-oda@example.com";
const INVITED_MEMBER_USER = "e2e-davetli-uye@example.com";
const INVITED_MEMBER_COLLEAGUE = "e2e-davetli-ek-kullanici@example.com";
const ROOT = "E2E Oda";
const MEMBER_A_UNIT = "E2E Üye A";
const MEMBER_B_UNIT = "E2E Üye B";
const OUTSIDE_ROOT = "E2E Başka Oda";
const INVITED_MEMBER_UNIT = "E2E Davetli Üye";
const TEST_SECTOR = "E2E Üye Yönetimi Sektörü";
const SURVEY = "E2E Oda Üye Anketi";
const OWN_SURVEY = "E2E Oda Özel Anketi";
const COPIED_SURVEY = "E2E Oda Üye Anketi (kuruluş kopyası)";
const CAMPAIGN = "E2E 2026 Üye Araştırması";

let seeded = false;
let questionId = "";
let sectorId = "";

async function cleanup() {
  await prisma.survey.deleteMany({ where: { name: { in: [SURVEY, OWN_SURVEY, COPIED_SURVEY] } } });
  await prisma.user.deleteMany({
    where: {
      email: {
        in: [MANAGER, MEMBER_A, MEMBER_B, OUTSIDER, INVITED_MEMBER_USER, INVITED_MEMBER_COLLEAGUE],
      },
    },
  });
  await prisma.unit.deleteMany({
    where: { name: { in: [ROOT, MEMBER_A_UNIT, MEMBER_B_UNIT, OUTSIDE_ROOT, INVITED_MEMBER_UNIT] } },
  });
  await prisma.sector.deleteMany({ where: { name: TEST_SECTOR } });
}

test.beforeAll(async () => {
  try {
    await cleanup();
    const password = await bcrypt.hash(PASSWORD, 10);
    const sector = await prisma.sector.create({ data: { name: TEST_SECTOR, naicsCode: "E2E" } });
    sectorId = sector.id;
    const root = await prisma.unit.create({ data: { name: ROOT } });
    const memberAUnit = await prisma.unit.create({ data: { name: MEMBER_A_UNIT, parentId: root.id } });
    const memberBUnit = await prisma.unit.create({ data: { name: MEMBER_B_UNIT, parentId: root.id } });
    const outsideRoot = await prisma.unit.create({ data: { name: OUTSIDE_ROOT } });

    const manager = await prisma.user.create({
      data: { email: MANAGER, password, role: "UNIT_MANAGER", unitId: root.id, emailVerified: true },
    });
    const memberA = await prisma.user.create({
      data: { email: MEMBER_A, password, role: "UNIT_MANAGER", unitId: memberAUnit.id, emailVerified: true },
    });
    const memberB = await prisma.user.create({
      data: { email: MEMBER_B, password, role: "UNIT_MANAGER", unitId: memberBUnit.id, emailVerified: true },
    });
    const outsider = await prisma.user.create({
      data: { email: OUTSIDER, password, role: "UNIT_MANAGER", unitId: outsideRoot.id, emailVerified: true },
    });
    await prisma.unitAdmin.createMany({
      data: [
        { unitId: root.id, userId: manager.id },
        { unitId: memberAUnit.id, userId: memberA.id },
        { unitId: memberBUnit.id, userId: memberB.id },
        { unitId: outsideRoot.id, userId: outsider.id },
      ],
    });

    const survey = await prisma.survey.create({ data: { name: SURVEY } });
    const category = await prisma.category.create({ data: { name: "Kurumsal Yönetim", surveyId: survey.id } });
    const question = await prisma.question.create({
      data: { text: "Stratejik plan düzenli izleniyor mu?", type: "SCALE", categoryId: category.id },
    });
    questionId = question.id;
    await prisma.userSurveyAssignment.create({ data: { userId: manager.id, surveyId: survey.id } });
    seeded = true;
  } catch (error) {
    console.warn("Kampanya E2E fikstürü kurulamadı:", error);
  }
});

test.afterAll(async () => {
  if (seeded) await cleanup();
  await prisma.$disconnect();
});

async function login(browser: Browser, email: string): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
  return page;
}

test("oda kampanya açar, üye gönderir ve yalnızca kendi sonuçlarını görür", async ({ browser }) => {
  test.skip(!seeded, "Fikstür kurulamadı");
  test.setTimeout(180_000);

  const manager = await login(browser, MANAGER);
  await manager.goto("/organization");
  await expect(manager.getByRole("heading", { name: "Üye anketleri" })).toBeVisible();

  // Birim yöneticisi kendi kökünde üye kuruluş ve kullanıcı oluşturabilir.
  // Hesap geçici parola ile değil, tek kullanımlık şifre belirleme davetiyle açılır.
  const rootUnit = await prisma.unit.findFirst({ where: { name: ROOT } });
  const memberCreate = await manager.request.post("/api/organization/members", {
    data: {
      action: "create_member",
      tenantUnitId: rootUnit!.id,
      memberName: INVITED_MEMBER_UNIT,
      firstName: "Davetli",
      lastName: "Üye",
      email: INVITED_MEMBER_USER,
      sectorId,
      makeUnitManager: true,
    },
  });
  expect(memberCreate.status()).toBe(201);
  const invited = await prisma.user.findUnique({ where: { email: INVITED_MEMBER_USER } });
  expect(invited).toMatchObject({ role: "UNIT_MANAGER", sectorId, emailVerified: false, isActive: true });
  expect(invited?.passwordResetToken).toBeTruthy();
  expect(await prisma.unitAdmin.count({ where: { userId: invited!.id } })).toBe(1);

  const activate = await manager.request.post("/api/auth/reset-password", {
    data: { token: invited!.passwordResetToken, password: PASSWORD },
  });
  expect(activate.ok()).toBe(true);
  expect(await prisma.user.findUnique({ where: { email: INVITED_MEMBER_USER } })).toMatchObject({
    emailVerified: true,
    passwordResetToken: null,
  });

  const invitedUnit = await prisma.unit.findFirst({ where: { name: INVITED_MEMBER_UNIT } });
  const colleagueCreate = await manager.request.post("/api/organization/members", {
    data: {
      action: "invite_user",
      tenantUnitId: rootUnit!.id,
      memberUnitId: invitedUnit!.id,
      firstName: "Ek",
      lastName: "Kullanıcı",
      email: INVITED_MEMBER_COLLEAGUE,
    },
  });
  expect(colleagueCreate.status()).toBe(201);
  expect(await prisma.user.findUnique({ where: { email: INVITED_MEMBER_COLLEAGUE } })).toMatchObject({
    role: "USER",
    unitId: invitedUnit!.id,
    sectorId,
    emailVerified: false,
  });

  await manager.locator('input[placeholder="2026 Üye Olgunluk Araştırması"]').fill(CAMPAIGN);
  await manager.locator(`label:has-text("${MEMBER_A_UNIT}") input[type="checkbox"]`).check();
  await manager.locator(`label:has-text("${MEMBER_B_UNIT}") input[type="checkbox"]`).check();
  await manager.getByRole("button", { name: "Kampanyayı başlat" }).click();
  await expect(manager.getByText("Kampanya açıldı ve anket üyelere atandı")).toBeVisible({ timeout: 20_000 });

  const campaign = await prisma.surveyCampaign.findFirst({
    where: { name: CAMPAIGN },
    include: { recipients: true },
  });
  expect(campaign).not.toBeNull();
  expect(campaign!.recipients).toHaveLength(2);

  const member = await login(browser, MEMBER_A);
  const answer = await member.request.post("/api/survey/responses", {
    data: { questionId, value: "4" },
  });
  expect(answer.ok()).toBe(true);
  const submit = await member.request.post("/api/assessment/submission", {
    data: { surveyId: campaign!.surveyId, action: "submit" },
  });
  expect(submit.ok()).toBe(true);

  await manager.reload({ waitUntil: "networkidle" });
  await expect(manager.getByText("50% katılım")).toBeVisible({ timeout: 20_000 });
  await expect(manager.getByRole("cell", { name: MEMBER_A_UNIT })).toBeVisible();
  await expect(manager.getByRole("cell", { name: MEMBER_B_UNIT })).toBeVisible();
  await expect(manager.getByRole("cell", { name: "Gönderildi" })).toBeVisible();
  await expect(manager.getByRole("cell", { name: "Başlamadı" })).toBeVisible();

  // Anonim kampanya üye satırlarını hiç döndürmez ve eşik dolmadan toplu
  // puanı da açmaz. İlk kampanyayı kapatıyoruz; aynı anket/üye için iki aktif
  // kampanya oluşturma koruması bilinçli olarak buna izin vermezdi.
  const closeCampaign = await manager.request.patch(
    `/api/organization/campaigns/${campaign!.id}`,
    { data: { action: "close" } }
  );
  expect(closeCampaign.ok()).toBe(true);
  const closedMemberAccess = await member.request.post("/api/survey/responses", {
    data: { questionId, value: "3" },
  });
  expect(closedMemberAccess.status()).toBe(403);
  const root = await prisma.unit.findFirst({ where: { name: ROOT } });
  const memberUnits = await prisma.unit.findMany({
    where: { name: { in: [MEMBER_A_UNIT, MEMBER_B_UNIT] } },
    select: { id: true },
  });
  const anonymousCreate = await manager.request.post("/api/organization/campaigns", {
    data: {
      name: "E2E Anonim Üye Araştırması",
      tenantUnitId: root!.id,
      surveyId: campaign!.surveyId,
      memberUnitIds: memberUnits.map((unit) => unit.id),
      privacyMode: "ANONYMOUS",
      minimumCohortSize: 3,
    },
  });
  expect(anonymousCreate.status()).toBe(201);
  const anonymousId = (await anonymousCreate.json()).campaign.id;
  const anonymousDashboard = await manager.request.get(
    `/api/organization/dashboard?campaignId=${anonymousId}`
  );
  expect(anonymousDashboard.ok()).toBe(true);
  const anonymousData = await anonymousDashboard.json();
  expect(anonymousData.results.visible).toBe(false);
  expect(anonymousData.members).toEqual([]);

  // Yönetici kendi tenant anketini oluşturup tüm soru özelliklerini yönetir.
  const ownSurveyCreate = await manager.request.post("/api/admin/surveys", {
    data: {
      name: OWN_SURVEY,
      description: "Kuruluşa özel anket",
      ownerUnitId: rootUnit!.id,
      order: 999,
      isActive: true,
    },
  });
  expect(ownSurveyCreate.status()).toBe(200);
  const ownSurvey = await ownSurveyCreate.json();
  expect(ownSurvey.ownerUnitId).toBe(rootUnit!.id);

  const ownCategoryCreate = await manager.request.post("/api/admin/categories", {
    data: { name: "Özel kategori", surveyId: ownSurvey.id, order: 1 },
  });
  expect(ownCategoryCreate.status()).toBe(200);
  const ownCategory = await ownCategoryCreate.json();
  const ownQuestionCreate = await manager.request.post("/api/admin/questions", {
    data: {
      text: "Kuruluşa özel soru",
      type: "MULTIPLE_CHOICE",
      categoryId: ownCategory.id,
      options: [
        { label: "Evet", value: "yes", score: 5 },
        { label: "Hayır", value: "no", score: 0 },
      ],
      weight: 2.5,
      axisType: "ENDURANCE",
      requiresEvidence: true,
    },
  });
  expect(ownQuestionCreate.status()).toBe(200);
  expect(await ownQuestionCreate.json()).toMatchObject({
    weight: 2.5,
    axisType: "ENDURANCE",
    requiresEvidence: true,
  });

  const tenantCopy = await manager.request.post("/api/admin/surveys/duplicate", {
    data: { surveyId: campaign!.surveyId, ownerUnitId: rootUnit!.id, name: COPIED_SURVEY },
  });
  expect(tenantCopy.status()).toBe(200);
  expect(await prisma.survey.findFirst({ where: { name: COPIED_SURVEY } })).toMatchObject({
    ownerUnitId: rootUnit!.id,
    sourceSurveyId: campaign!.surveyId,
  });

  const outsider = await login(browser, OUTSIDER);
  const forbiddenSurveyEdit = await outsider.request.put("/api/admin/surveys", {
    data: { id: ownSurvey.id, name: "Yetkisiz değişiklik", isActive: true, order: 1 },
  });
  expect(forbiddenSurveyEdit.status()).toBe(403);
  const forbiddenMemberCreate = await outsider.request.post("/api/organization/members", {
    data: {
      action: "create_member",
      tenantUnitId: rootUnit!.id,
      memberName: "Yetkisiz Üye",
      firstName: "Yetkisiz",
      email: "e2e-yetkisiz@example.com",
      sectorId,
    },
  });
  expect(forbiddenMemberCreate.status()).toBe(403);
  const forbidden = await outsider.request.get(
    `/api/organization/dashboard?campaignId=${campaign!.id}`
  );
  expect(forbidden.status()).toBe(403);

  const recipients = await prisma.campaignRecipient.findMany({
    where: { campaignId: campaign!.id },
    include: { assessment: true },
    orderBy: { memberUnit: { name: "asc" } },
  });
  expect(recipients.filter((recipient) => recipient.assessment)).toHaveLength(1);
});
