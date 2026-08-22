import { test, expect, type Browser, type Page } from "@playwright/test";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

const PASSWORD = "E2eParola!123";
const MANAGER = "e2e-oda-yonetici@example.com";
const MEMBER_A = "e2e-oda-uye-a@example.com";
const MEMBER_B = "e2e-oda-uye-b@example.com";
const OUTSIDER = "e2e-baska-oda@example.com";
const ROOT = "E2E Oda";
const MEMBER_A_UNIT = "E2E Üye A";
const MEMBER_B_UNIT = "E2E Üye B";
const OUTSIDE_ROOT = "E2E Başka Oda";
const SURVEY = "E2E Oda Üye Anketi";
const CAMPAIGN = "E2E 2026 Üye Araştırması";

let seeded = false;
let questionId = "";

async function cleanup() {
  await prisma.survey.deleteMany({ where: { name: SURVEY } });
  await prisma.user.deleteMany({ where: { email: { in: [MANAGER, MEMBER_A, MEMBER_B, OUTSIDER] } } });
  await prisma.unit.deleteMany({
    where: { name: { in: [ROOT, MEMBER_A_UNIT, MEMBER_B_UNIT, OUTSIDE_ROOT] } },
  });
}

test.beforeAll(async () => {
  try {
    await cleanup();
    const password = await bcrypt.hash(PASSWORD, 10);
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

  const outsider = await login(browser, OUTSIDER);
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
