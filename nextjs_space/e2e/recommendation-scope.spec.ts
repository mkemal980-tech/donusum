import { test, expect, type Page } from "@playwright/test";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

/**
 * Öneri ekranının kapsam ağacı.
 *
 * Çekirdeği (`lib/recommendation-scope`) birim testli; buradaki soru başka:
 * ağaçtaki sayı ile tablodaki satır sayısı gerçekten aynı şeyi mi söylüyor,
 * ve soru kapsamındayken toplu seçim yalnızca o soruyu mu alıyor. Yanlış
 * kapsamda yapılan toplu silme geri alınamaz, o yüzden bu bağ test edilir.
 *
 * Fikstürünü kendi kurar ve siler; DATABASE_URL erişilemezse test atlanır.
 */

const PASSWORD = "E2eParola!123";
const ADMIN = "e2e-kapsam-yonetici@example.com";
const SURVEY = "E2E Kapsam Anketi";
const CATEGORY = "E2E Kapsam Kategorisi";
const SECTION_A = "E2E Enerji Bölümü";
const SECTION_B = "E2E Atık Bölümü";
const QUESTION_ONE = "E2E kapsam sorusu bir";
const QUESTION_TWO = "E2E kapsam sorusu iki";

const REC_Q1_A = "E2E Soruya bağlı öneri A";
const REC_Q1_B = "E2E Soruya bağlı öneri B";
const REC_SECTION_A = "E2E Bölüme bağlı öneri";
const REC_SECTION_B = "E2E Diğer bölümün önerisi";

let seeded = false;
let questionOneId = "";

async function removeFixture() {
  await prisma.recommendation.deleteMany({ where: { title: { startsWith: "E2E " } } });
  await prisma.survey.deleteMany({ where: { name: SURVEY } });
  await prisma.user.deleteMany({ where: { email: ADMIN } });
}

test.beforeAll(async () => {
  try {
    await removeFixture();
  } catch (error) {
    console.warn("Veritabanına ulaşılamadı, test atlanıyor:", error);
    return;
  }

  await prisma.user.create({
    data: {
      email: ADMIN,
      password: await bcrypt.hash(PASSWORD, 10),
      firstName: "Deniz",
      lastName: "Yönetici",
      role: "ADMIN",
      emailVerified: true,
    },
  });

  const survey = await prisma.survey.create({ data: { name: SURVEY } });
  const category = await prisma.category.create({
    data: { name: CATEGORY, surveyId: survey.id },
  });

  const sectionA = await prisma.subCategory.create({
    data: { name: SECTION_A, categoryId: category.id, order: 0, hasSubLevels: false },
  });
  const sectionB = await prisma.subCategory.create({
    data: { name: SECTION_B, categoryId: category.id, order: 1, hasSubLevels: false },
  });

  const questionOne = await prisma.question.create({
    data: { text: QUESTION_ONE, type: "SCALE", subCategoryId: sectionA.id, order: 0 },
  });
  await prisma.question.create({
    data: { text: QUESTION_TWO, type: "SCALE", subCategoryId: sectionA.id, order: 1 },
  });
  questionOneId = questionOne.id;

  // Dört öneri, üç farklı bağlanma biçimi — ağacın ayırt etmesi gereken hâller.
  await prisma.recommendation.createMany({
    data: [
      {
        title: REC_Q1_A,
        description: "ilk soruya bağlı",
        subCategoryId: sectionA.id,
        questionId: questionOne.id,
        triggerOptions: JSON.stringify(["1"]),
      },
      {
        title: REC_Q1_B,
        description: "ilk soruya bağlı ikinci",
        subCategoryId: sectionA.id,
        questionId: questionOne.id,
        triggerOptions: JSON.stringify(["2"]),
      },
      { title: REC_SECTION_A, description: "bölüme bağlı", subCategoryId: sectionA.id },
      { title: REC_SECTION_B, description: "diğer bölüme bağlı", subCategoryId: sectionB.id },
    ],
  });

  seeded = true;
});

test.afterAll(async () => {
  if (seeded) await removeFixture();
  await prisma.$disconnect();
});

/** Giriş yapar ve oturumun gerçekten kurulduğunu doğrular. */
async function login(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.goto("/login", { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);
    await page.locator('input[type="email"]').fill(ADMIN);
    await page.locator('input[type="password"]').fill(PASSWORD);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/dashboard/, { timeout: 20_000 }).catch(() => undefined);
    const session = await (await page.request.get("/api/auth/session")).json();
    if (session?.user?.email === ADMIN) return;
  }
  throw new Error(`Giriş yapılamadı: ${ADMIN}`);
}

const navOf = (page: Page) => page.getByRole("navigation", { name: "Öneri kapsamı" });

/**
 * Her satır iki düğme taşıyor: açma oku ("… alt kırılımını aç") ve süzme
 * satırı ("… <sayı>"). Yalnızca önekle eşleştirmek ikisini birden yakalıyor,
 * o yüzden satırın sonundaki sayı şart koşulur.
 */
const rowNamed = (page: Page, name: string) =>
  navOf(page).getByRole("button", { name: new RegExp(`^${name} \\d+$`) });

/** Sayısı belli satır — ağaçtaki rakamı doğrudan iddia etmek için. */
const rowWithCount = (page: Page, name: string, count: number) =>
  navOf(page).getByRole("button", { name: `${name} ${count}`, exact: true });

/** Açma oku; satırı süzmeden yalnızca alt kırılımı açar. */
const expandArrow = (page: Page, name: string) =>
  navOf(page).getByRole("button", { name: `${name} alt kırılımını aç` });

/** Ağacı fikstürün anketine daraltır; sayılar başka testlerin verisinden etkilenmesin. */
async function openScopedList(page: Page) {
  await page.goto("/admin/recommendations");
  await expect(navOf(page)).toBeVisible({ timeout: 30_000 });
  await page.locator("select").first().selectOption({ label: SURVEY });
  await expect(page.getByText(REC_Q1_A)).toBeVisible({ timeout: 10_000 });
}

test.describe("geniş ekran", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("ağaç her seviyede öneri sayısını söyler", async ({ page }) => {
    test.skip(!seeded, "Fikstür kurulamadı (veritabanı yok)");
    test.setTimeout(120_000);

    await login(page);
    await openScopedList(page);

    await expect(navOf(page).getByText("2 tanesi bir soruya bağlı")).toBeVisible();

    await expect(rowWithCount(page, CATEGORY, 4)).toBeVisible();

    // Kategoriyi aç: satırın kendisi süzer, ok açar — ikisi farklı niyet.
    await expandArrow(page, CATEGORY).click();
    await expect(rowWithCount(page, SECTION_A, 3)).toBeVisible();
    await expect(rowWithCount(page, SECTION_B, 1)).toBeVisible();

    await expandArrow(page, SECTION_A).click();
    await expect(rowWithCount(page, QUESTION_ONE, 2)).toBeVisible();
    // Önerisi olmayan soru da listelenir; elenirse "buraya hiç öneri
    // bağlanmamış" görünmez olur.
    await expect(rowWithCount(page, QUESTION_TWO, 0)).toBeVisible();
    await expect(rowWithCount(page, "Soruya bağlı olmayanlar", 1)).toBeVisible();
  });

  test("soru seçilince liste yalnızca o sorunun önerilerine iner", async ({ page }) => {
    test.skip(!seeded, "Fikstür kurulamadı (veritabanı yok)");
    test.setTimeout(120_000);

    await login(page);
    await openScopedList(page);

    await expandArrow(page, CATEGORY).click();
    await expandArrow(page, SECTION_A).click();
    await rowNamed(page, QUESTION_ONE).click();

    // Kapsam tablonun üstünde yazılı durur; ağaçtaki seçim kaydırılınca
    // görünmez kalıyor ve liste sebepsiz kısa görünüyordu.
    await expect(page.getByText(`${CATEGORY} › ${SECTION_A} › ${QUESTION_ONE}`)).toBeVisible();

    await expect(page.getByText(REC_Q1_A)).toBeVisible();
    await expect(page.getByText(REC_Q1_B)).toBeVisible();
    await expect(page.getByText(REC_SECTION_A)).toHaveCount(0);
    await expect(page.getByText(REC_SECTION_B)).toHaveCount(0);

    // Toplu işlem kapsama uyar: yanlış kapsamda silme geri alınamaz.
    await expect(page.getByRole("button", { name: "Tümünü seç (2)" })).toBeVisible();
    await page.getByRole("button", { name: "Tümünü seç (2)" }).click();
    await expect(page.getByText("2 öneri seçildi")).toBeVisible();

    // Kapsamı kaldırınca liste geri gelir.
    await page.getByRole("button", { name: "Kapsamı kaldır" }).click();
    await expect(page.getByText(REC_SECTION_B)).toBeVisible();
    await expect(page.getByRole("button", { name: "Tümünü seç (4)" })).toBeVisible();
  });

  test("bölüme bağlı olanlar sorulardan ayrı süzülebilir", async ({ page }) => {
    test.skip(!seeded, "Fikstür kurulamadı (veritabanı yok)");
    test.setTimeout(120_000);

    await login(page);
    await openScopedList(page);

    await expandArrow(page, CATEGORY).click();
    await expandArrow(page, SECTION_A).click();

    // Bölüme tıklamak alttaki soruları da getirir; "yalnızca bölüm
    // seviyesindekiler" bu yüzden ayrı bir hedef.
    await rowNamed(page, SECTION_A).click();
    await expect(page.getByRole("button", { name: "Tümünü seç (3)" })).toBeVisible();

    await rowNamed(page, "Soruya bağlı olmayanlar").click();
    await expect(page.getByText(REC_SECTION_A)).toBeVisible();
    await expect(page.getByText(REC_Q1_A)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Tümünü seç (1)" })).toBeVisible();
  });
});

test.describe("dar ekran", () => {
  test.use({ viewport: { width: 900, height: 800 } });

  test("kapsam sütunu gizlenir, yerini Kapsam çekmecesi alır", async ({ page }) => {
    test.skip(!seeded, "Fikstür kurulamadı (veritabanı yok)");
    test.setTimeout(120_000);

    await login(page);
    await page.goto("/admin/recommendations");

    const drawer = page.getByRole("button", { name: "Kapsam", exact: true });
    await expect(drawer).toBeVisible({ timeout: 30_000 });
    await expect(navOf(page)).toBeHidden();

    await page.locator("select").first().selectOption({ label: SURVEY });
    await drawer.click();
    await expect(navOf(page)).toBeVisible({ timeout: 10_000 });

    // Çekmeceden seçim hem süzer hem kapanır; açık kalırsa listeyi örter.
    await rowNamed(page, CATEGORY).click();
    await expect(navOf(page)).toBeHidden();
    await expect(page.getByRole("button", { name: "Tümünü seç (4)" })).toBeVisible();
  });
});

test("soruya bağlı öneri anket süzgecinden düşmez", async ({ page }) => {
  test.skip(!seeded, "Fikstür kurulamadı (veritabanı yok)");
  test.setTimeout(120_000);

  await login(page);
  await openScopedList(page);

  /**
   * Anket süzgeci önerinin soru yolunu hiç saymıyordu: kategoriye göre
   * süzülünce görünen öneri, ankete göre süzülünce kayboluyordu. Artık her
   * iki süzgeç de aynı çözümleyiciyi kullanıyor.
   */
  await expect(page.getByText(REC_Q1_A)).toBeVisible();
  expect(questionOneId).toBeTruthy();
});
