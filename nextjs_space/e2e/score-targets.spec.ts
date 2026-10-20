import { test, expect, type Browser, type Page } from "@playwright/test";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

/**
 * Kuruluş hedefinin gerçek veritabanıyla tam turu: birim yöneticisi hedef
 * koyar ve değiştirir, çalışan görür ama değiştiremez, kişisel değerlendirmenin
 * sahibi kendi hedefini koyar. Tekillik ve aralık kısıtları veritabanında
 * (migration 000020). Fikstürünü kendi kurar; DATABASE_URL yoksa atlanır.
 */
const PASSWORD = "HedefE2e!123";
const MANAGER = "e2e-hedef-yonetici@example.com";
const MEMBER = "e2e-hedef-uye@example.com";
const OWNER = "e2e-hedef-bireysel@example.com";
const UNIT = "E2E Hedef Kuruluşu";
const SURVEY = "E2E Hedef Anketi";

let seeded = false;
let unitAssessmentId = "";
let personalAssessmentId = "";
let categoryId = "";

async function removeFixture() {
  await prisma.user.deleteMany({ where: { email: { in: [MANAGER, MEMBER, OWNER] } } });
  await prisma.survey.deleteMany({ where: { name: SURVEY } });
  await prisma.unit.deleteMany({ where: { name: UNIT } });
}

test.beforeAll(async () => {
  try {
    await removeFixture();
  } catch (error) {
    console.warn("Veritabanına ulaşılamadı, hedef testleri atlanıyor:", error);
    return;
  }
  const password = await bcrypt.hash(PASSWORD, 10);
  const unit = await prisma.unit.create({ data: { name: UNIT } });
  const survey = await prisma.survey.create({ data: { name: SURVEY, isActive: true } });
  const category = await prisma.category.create({ data: { name: "E2E Hedef Kategori", surveyId: survey.id } });
  categoryId = category.id;
  await prisma.question.create({ data: { text: "E2E hedef sorusu", type: "SCALE", categoryId: category.id, weight: 1 } });
  const manager = await prisma.user.create({ data: { email: MANAGER, password, firstName: "Hedef", role: "UNIT_MANAGER", unitId: unit.id, emailVerified: true } });
  await prisma.user.create({ data: { email: MEMBER, password, firstName: "Üye", role: "USER", unitId: unit.id, emailVerified: true } });
  const owner = await prisma.user.create({ data: { email: OWNER, password, firstName: "Bireysel", role: "USER", emailVerified: true } });
  await prisma.unitAdmin.create({ data: { unitId: unit.id, userId: manager.id } });
  unitAssessmentId = (await prisma.assessment.create({ data: { surveyId: survey.id, unitId: unit.id } })).id;
  personalAssessmentId = (await prisma.assessment.create({ data: { surveyId: survey.id, ownerUserId: owner.id } })).id;
  seeded = true;
});

test.afterAll(async () => {
  if (seeded) await removeFixture();
  await prisma.$disconnect();
});

async function login(browser: Browser, email: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/(dashboard|survey|organization)/, { timeout: 20_000 }).catch(() => undefined);
  const session = await (await page.request.get("/api/auth/session")).json();
  if (session?.user?.email !== email) throw new Error(`Giriş yapılamadı: ${email}`);
  return page;
}

test("yönetici hedef koyar ve değiştirir; çalışan görür ama değiştiremez", async ({ browser }) => {
  test.skip(!seeded, "Fikstür kurulamadı (veritabanı yok)");
  test.setTimeout(120_000);
  const manager = await login(browser, MANAGER);
  const put = (page: Page, data: unknown) => page.request.put("/api/dashboard/assessment/targets", { data });

  const first = await put(manager, { assessmentId: unitAssessmentId, overall: { percentage: 70, targetDate: "2027-12-31" }, categories: [{ categoryId, percentage: 60, targetDate: null }] });
  expect(first.status()).toBe(200);
  // İkinci kayıt öncekinin yerine geçer: mükerrer satır oluşmaz (tekil indeks).
  const second = await put(manager, { assessmentId: unitAssessmentId, overall: { percentage: 75, targetDate: null }, categories: [] });
  expect(await second.json()).toEqual({ overall: { percentage: 75, targetDate: null }, categories: {} });
  expect(await prisma.scoreTarget.count({ where: { unit: { name: UNIT } } })).toBe(1);
  expect((await put(manager, { assessmentId: unitAssessmentId, overall: { percentage: 120 } })).status()).toBe(400);

  const member = await login(browser, MEMBER);
  const view = await (await member.request.get(`/api/dashboard/assessment?assessmentId=${unitAssessmentId}`)).json();
  expect(view.targets.overall).toEqual({ percentage: 75, targetDate: null });
  expect(view.viewer.canSetTargets).toBe(false);
  expect((await put(member, { assessmentId: unitAssessmentId, overall: null })).status()).toBe(403);
  await member.goto("/dashboard");
  await expect(member.locator("p.t-label").getByText("Hedefe göre", { exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(member.getByRole("button", { name: /Hedef/ })).toHaveCount(0);
});

test("kişisel değerlendirmenin sahibi kendi hedefini koyar; başkası koyamaz", async ({ browser }) => {
  test.skip(!seeded, "Fikstür kurulamadı (veritabanı yok)");
  test.setTimeout(120_000);
  const owner = await login(browser, OWNER);
  const saved = await owner.request.put("/api/dashboard/assessment/targets", { data: { assessmentId: personalAssessmentId, overall: { percentage: 50, targetDate: "2027-06-30" } } });
  expect(saved.status()).toBe(200);
  expect((await saved.json()).overall).toEqual({ percentage: 50, targetDate: "2027-06-30T20:59:59.999Z" });
  const stored = await prisma.scoreTarget.findFirst({ where: { owner: { email: OWNER } } });
  expect(stored).toMatchObject({ unitId: null, categoryId: null, percentage: 50 });

  const manager = await login(browser, MANAGER);
  const foreign = await manager.request.put("/api/dashboard/assessment/targets", { data: { assessmentId: personalAssessmentId, overall: { percentage: 90 } } });
  expect(foreign.status()).toBe(403);
});
