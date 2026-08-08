import { test, expect, type Browser, type Page } from "@playwright/test";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

/**
 * Çok kullanıcılı değerlendirmenin uçtan uca denemesi.
 *
 * Bu akışın parçaları ayrı ayrı birim testli, ama asıl soru bütünde: iki
 * ayrı oturum, iki ayrı rol ve aralarında bir veritabanı var. Koordinatör bir
 * bölümü dağıtıyor, katkıcı yalnızca onu görüyor, cevabı kuruluşun tek
 * değerlendirmesine düşüyor ve koordinatörün panosunda beliriyor.
 *
 * Fikstürünü kendi kurar ve siler; DATABASE_URL erişilemezse test atlanır.
 */

const PASSWORD = "E2eParola!123";
const COORDINATOR = "e2e-koordinator@example.com";
const CONTRIBUTOR = "e2e-katkici@example.com";
const UNIT = "E2E Kuruluş";
const SURVEY = "E2E Anket";

const SECTION_MINE = "Atık Yönetimi";
const SECTION_OTHER = "Enerji Verimliliği";

let seeded = false;

async function removeFixture() {
  await prisma.survey.deleteMany({ where: { name: SURVEY } });
  await prisma.user.deleteMany({ where: { email: { in: [COORDINATOR, CONTRIBUTOR] } } });
  await prisma.unit.deleteMany({ where: { name: UNIT } });
}

test.beforeAll(async () => {
  try {
    await removeFixture();
  } catch (error) {
    console.warn("Veritabanına ulaşılamadı, test atlanıyor:", error);
    return;
  }

  const password = await bcrypt.hash(PASSWORD, 10);
  const unit = await prisma.unit.create({ data: { name: UNIT } });

  const coordinator = await prisma.user.create({
    data: {
      email: COORDINATOR,
      password,
      firstName: "Kerem",
      lastName: "Koordinatör",
      unitId: unit.id,
      role: "UNIT_MANAGER",
      emailVerified: true,
    },
  });

  const contributor = await prisma.user.create({
    data: {
      email: CONTRIBUTOR,
      password,
      firstName: "Ayşe",
      lastName: "Katkıcı",
      unitId: unit.id,
      emailVerified: true,
    },
  });

  // Koordinatörlük rol alanından değil, birim yöneticiliği kaydından geliyor.
  await prisma.unitAdmin.create({ data: { unitId: unit.id, userId: coordinator.id } });

  const survey = await prisma.survey.create({ data: { name: SURVEY } });
  const category = await prisma.category.create({
    data: { name: "Çevre", surveyId: survey.id },
  });

  for (const [order, name] of [SECTION_MINE, SECTION_OTHER].entries()) {
    const subCategory = await prisma.subCategory.create({
      data: { name, categoryId: category.id, order, hasSubLevels: false },
    });
    await prisma.question.createMany({
      data: [0, 1, 2].map((index) => ({
        text: `${name} sorusu ${index + 1}`,
        type: "SCALE" as const,
        subCategoryId: subCategory.id,
        order: index,
      })),
    });
  }

  for (const user of [coordinator, contributor]) {
    await prisma.userSurveyAssignment.create({
      data: { userId: user.id, surveyId: survey.id },
    });
  }

  seeded = true;
});

test.afterAll(async () => {
  if (seeded) await removeFixture();
  await prisma.$disconnect();
});

async function login(browser: Browser, email: string): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  // Hidrasyon bitmeden tıklanırsa form gönderilmez; önce sayfa otursun.
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
  return page;
}

/**
 * Sayfayı açar ve beklenen metni görene kadar tazeler.
 *
 * Geliştirme sunucusu bir rotayı ilk kez derlerken tek tük istek düşürüyor;
 * ekran o zaman "liste alınamadı" diyor. Uygulama hatası değil, ama testi
 * rastgele düşürüyordu.
 */
async function openUntilVisible(page: Page, url: string, text: string) {
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.goto(url);
    try {
      await expect(page.getByText(text).first()).toBeVisible({ timeout: 15_000 });
      return;
    } catch (error) {
      if (attempt === 2) throw error;
    }
  }
}

test("dağıt, doldur, gönder: çok kullanıcılı değerlendirmenin tam turu", async ({ browser }) => {
  test.skip(!seeded, "Fikstür kurulamadı (veritabanı yok)");
  // İki oturum, sekiz sayfa yüklemesi ve bir dev sunucusu; cömert olmak lazım.
  test.setTimeout(240_000);

  // --- koordinatör dağıtır ---
  const coordinator = await login(browser, COORDINATOR);
  await openUntilVisible(coordinator, "/unit-manager/assignments", SECTION_MINE);
  await expect(coordinator.getByText(SECTION_OTHER)).toBeVisible();

  // 0: anket seçici, 1: Atık Yönetimi, 2: Enerji Verimliliği
  await coordinator.locator("select").nth(1).selectOption({ label: "Ayşe Katkıcı" });
  await expect(coordinator.getByText("Bölüm atandı")).toBeVisible({ timeout: 10_000 });

  // --- katkıcı yalnızca kendi bölümünü görür ---
  const contributor = await login(browser, CONTRIBUTOR);
  await openUntilVisible(contributor, "/survey", "Size atanan 1 bölüm gösteriliyor.");
  await expect(contributor.getByText(SECTION_MINE).first()).toBeVisible();
  await expect(contributor.getByText(SECTION_OTHER)).toHaveCount(0);

  // Ölçek düğmeleri role="radio" taşıyor.
  await contributor.getByRole("radio", { name: /Seviye 4/ }).first().click();
  await expect(contributor.getByText("Cevap kaydedildi")).toBeVisible({ timeout: 10_000 });

  // --- kendine atanmayan bölüme cevap yazamaz (asıl yaptırım sunucuda) ---
  const assigned = await (await coordinator.request.get("/api/survey/assigned")).json();
  const surveyId = assigned[0].id;
  const structure = await (
    await coordinator.request.get(`/api/survey/structure?surveyId=${surveyId}`)
  ).json();

  const structureSections = structure.flatMap((category: any) => category.subCategories ?? []);
  const mineSection = structureSections.find((section: any) => section.name === SECTION_MINE);
  const otherSection = structureSections.find((section: any) => section.name === SECTION_OTHER);
  const mineQuestionId = mineSection?.questions?.[0]?.id;
  const otherSectionId = otherSection?.id;
  const otherQuestionId = otherSection?.questions?.[0]?.id;

  expect(mineQuestionId).toBeTruthy();
  expect(otherQuestionId).toBeTruthy();
  const forbidden = await contributor.request.post("/api/survey/responses", {
    data: { questionId: otherQuestionId, value: "5" },
  });
  expect(forbidden.status()).toBe(403);

  // --- pano ilerlemeyi gösterir ---
  await coordinator.reload();
  await expect(coordinator.getByText("1/3 soru").first()).toBeVisible({ timeout: 20_000 });
  await expect(coordinator.getByText("Devam ediyor")).toBeVisible();
  await expect(coordinator.getByText("Başlanmadı")).toBeVisible();

  // --- birim panosunun satırı kişi değil değerlendirme ---
  await openUntilVisible(coordinator, "/unit-manager", SURVEY);
  await expect(coordinator.getByRole("columnheader", { name: "Değerlendirme" })).toBeVisible();
  await expect(coordinator.getByText("1 kişi")).toBeVisible();

  // --- gönderim: eksik varken uyarır, onaydan sonra kilitler ---
  await openUntilVisible(coordinator, "/unit-manager/assignments", "Değerlendirmeyi gönder");
  await expect(coordinator.getByText("2 bölümde 5 soru boş.")).toBeVisible();

  await coordinator.getByRole("button", { name: "Değerlendirmeyi gönder" }).click();
  await expect(coordinator.getByText("Boş sorularla gönderiyorsunuz:")).toBeVisible();
  await coordinator.getByRole("button", { name: "Yine de gönder" }).click();
  await expect(coordinator.getByText("Değerlendirme gönderildi").first()).toBeVisible({
    timeout: 15_000,
  });

  // Kilitliyken cevap da dağıtım da yazılamaz.
  const lockedAnswer = await contributor.request.post("/api/survey/responses", {
    data: { questionId: mineQuestionId, value: "3" },
  });
  expect(lockedAnswer.status()).toBe(403);

  const lockedAssignment = await coordinator.request.post("/api/assessment/sections", {
    data: { surveyId, subCategoryId: otherSectionId, assigneeId: null },
  });
  expect(lockedAssignment.status()).toBe(403);

  // Katkıcı ankette kilidi görür.
  await openUntilVisible(contributor, "/survey", "Bu değerlendirme gönderildi");

  // Panoda puan taslak olmaktan çıkar.
  await openUntilVisible(coordinator, "/dashboard", "Kesin puan");

  // --- geri alma kilidi açar ---
  await openUntilVisible(coordinator, "/unit-manager/assignments", "Gönderimi geri al");
  await coordinator.getByRole("button", { name: "Gönderimi geri al" }).click();
  await expect(coordinator.getByRole("button", { name: "Değerlendirmeyi gönder" })).toBeVisible({
    timeout: 15_000,
  });

  const reopenedAnswer = await contributor.request.post("/api/survey/responses", {
    data: { questionId: mineQuestionId, value: "3" },
  });
  expect(reopenedAnswer.status()).toBe(200);
});
