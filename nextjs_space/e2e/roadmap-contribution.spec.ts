import { test, expect, type Browser, type Page } from "@playwright/test";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

/**
 * Yol haritası katkısının uçtan uca denemesi (docs/GELISIM-PUANI.md).
 *
 * Parçaları birim testli; asıl soru bütünde: kademeli bir öneri panonun yol
 * haritası sekmesinden tamamlanınca (1) kilit orada da çalışıyor mu, (2) katkı
 * sıfırdan büyük bir sayı gösteriyor mu, (3) pano ve trend grafiği aynı
 * sayıyı söylüyor mu. Pano katkıyı 100 üzerinden gösterir: 1-5'te +0,8 = +20,0.
 *
 * Fikstürünü kendi kurar ve siler; DATABASE_URL erişilemezse test atlanır.
 */

const PASSWORD = "E2eParola!123";
const USER = "e2e-yolharitasi@example.com";
const SURVEY = "E2E Katkı Anketi";
const RUNG = (index: number) => `E2E Katkı Basamak ${index}`;

let seeded = false;
let questionId = "";

async function removeFixture() {
  await prisma.recommendation.deleteMany({ where: { title: { startsWith: "E2E Katkı" } } });
  await prisma.survey.deleteMany({ where: { name: { startsWith: SURVEY } } });
  await prisma.user.deleteMany({ where: { email: USER } });
}

test.beforeAll(async () => {
  try {
    await removeFixture();
  } catch (error) {
    console.warn("Veritabanına ulaşılamadı, test atlanıyor:", error);
    return;
  }

  const password = await bcrypt.hash(PASSWORD, 10);
  const user = await prisma.user.create({
    data: { email: USER, password, firstName: "Yol", lastName: "Haritası", emailVerified: true },
  });

  const survey = await prisma.survey.create({ data: { name: SURVEY } });
  const category = await prisma.category.create({ data: { name: "Çevre", surveyId: survey.id } });
  const subCategory = await prisma.subCategory.create({
    data: { name: "Atık Yönetimi", categoryId: category.id, order: 0, hasSubLevels: false },
  });
  const question = await prisma.question.create({
    data: { text: "Atık envanteri tutuluyor mu?", type: "SCALE", subCategoryId: subCategory.id, order: 0 },
  });
  questionId = question.id;

  // Üç basamaklı merdiven: 1 → 2 → 3 → tavan. Kademeli öneride puan 0'dır.
  for (const threshold of [1, 2, 3]) {
    await prisma.recommendation.create({
      data: {
        title: RUNG(threshold),
        description: `Basamak ${threshold} adımı`,
        categoryId: category.id,
        subCategoryId: subCategory.id,
        questionId: question.id,
        triggerMaxAnswerScore: threshold,
        points: 0,
        order: threshold,
      },
    });
  }

  await prisma.userSurveyAssignment.create({ data: { userId: user.id, surveyId: survey.id } });
  seeded = true;
});

test.afterAll(async () => {
  if (seeded) await removeFixture();
  await prisma.$disconnect();
});

async function login(browser: Browser, email: string): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();

  for (let attempt = 0; attempt < 3; attempt++) {
    await page.goto("/login", { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(PASSWORD);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/dashboard/, { timeout: 20_000 }).catch(() => undefined);

    const session = await (await page.request.get("/api/auth/session")).json();
    if (session?.user?.email === email) return page;
  }

  throw new Error(`Giriş yapılamadı: ${email}`);
}

test("kademeli öneri yol haritasından tamamlanınca katkı, pano ve trend aynı sayıyı söyler", async ({ browser }) => {
  test.skip(!seeded, "Fikstür kurulamadı (veritabanı yok)");
  test.setTimeout(180_000);

  const page = await login(browser, USER);

  // Baseline cevap: 1/5 → taban puan 1.8. Basamak 1 tamamlanınca etkin puan 2 → 2.6.
  const answered = await page.request.post("/api/survey/responses", {
    data: { questionId, value: "1" },
  });
  expect(answered.ok()).toBeTruthy();

  const recommendations = await (await page.request.get("/api/recommendations")).json();
  const rung1 = recommendations.find((rec: any) => rec.title === RUNG(1));
  const rung2 = recommendations.find((rec: any) => rec.title === RUNG(2));
  expect(rung1?.isActionable).toBe(true);
  expect(rung2?.isActionable).toBe(false);
  // Katkı sunucudan gelir: basamak 1 tamamlanınca +0.80.
  expect(rung1?.contribution).toMatchObject({ kind: "cascade", full: 0.8, current: 0, rung: { index: 1, total: 3 } });

  // Sırası gelmemiş basamak yol haritasına eklenemez...
  const lockedAdd = await page.request.post("/api/roadmap", { data: { recommendationId: rung2.id } });
  expect(lockedAdd.status()).toBe(409);

  const added = await page.request.post("/api/roadmap", { data: { recommendationId: rung1.id } });
  expect(added.ok()).toBeTruthy();

  // ...ve yol haritası ucundan da ilerletilemez (eskiden bu uç kilidi atlıyordu).
  const lockedPut = await page.request.put("/api/roadmap", {
    data: { recommendationId: rung2.id, status: "COMPLETED" },
  });
  expect(lockedPut.status()).toBe(409);

  // --- panonun yol haritası sekmesi: tamamlanınca +20,0 puan ---
  await page.goto("/dashboard?tab=roadmap");
  const card = page.getByRole("article").filter({ hasText: RUNG(1) });
  await expect(card.getByText("Tamamlanınca +20,0 puan")).toBeVisible({ timeout: 20_000 });
  await expect(card.getByText(/Şu an/)).toHaveCount(0);

  await card.getByLabel(`${RUNG(1)} durumu`).selectOption("COMPLETED");
  await expect(page.getByText("Öneri tamamlandı · +20,0 puan")).toBeVisible({ timeout: 15_000 });
  await expect(card.getByText("Şu an +20,0 puan")).toBeVisible({ timeout: 15_000 });

  // --- her yer aynı sayıyı söyler ---
  const roadmap = await (await page.request.get("/api/roadmap")).json();
  expect(roadmap.summary).toMatchObject({ completed: 1, baselineScore: 1.8, currentScore: 2.6, delta: 0.8 });

  const progress = await (await page.request.get("/api/progress-scores")).json();
  expect(progress.overall).toMatchObject({ baselineScore: 1.8, currentScore: 2.6, delta: 0.8 });
  expect(progress.categories[0]).toMatchObject({ name: "Çevre", baseScore: 1.8, totalScore: 2.6, bonusPoints: 0.8 });

  // Yol haritasından yapılan tamamlama artık trend grafiğine düşüyor.
  const { history } = await (await page.request.get("/api/score-history")).json();
  expect(history[history.length - 1]).toMatchObject({ triggerType: "RECOMMENDATION_COMPLETED", overallScore: 2.6 });

  // Panonun mevcut puanı: anket %20 (1,8/5) + öneriler +20,0 = %40,0.
  await page.goto("/dashboard");
  await expect(page.getByText(/anket %20 · öneriler \+20,0/)).toBeVisible({ timeout: 20_000 });
});
