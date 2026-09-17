import { test, expect, type Browser, type Page } from "@playwright/test";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

/**
 * Anket haritasının uçtan uca denemesi.
 *
 * Haritanın çekirdeği (`buildOutline`) birim testli; buradaki soru başka:
 * haritadaki satır ile ekrandaki bölüm gerçekten aynı şeyi mi gösteriyor.
 * İkisi ayrı kaynaklardan beslenseydi sessizce ayrışabilirlerdi, ve bu
 * ayrışma yalnızca tarayıcıda görülür.
 *
 * Fikstürünü kendi kurar ve siler; DATABASE_URL erişilemezse test atlanır.
 */

const PASSWORD = "E2eParola!123";
const USER = "e2e-harita@example.com";
const UNIT = "E2E Harita Kuruluş";
const SURVEY = "E2E Harita Anketi";

const CATEGORY_ONE = "E2E Çevresel";
const CATEGORY_TWO = "E2E Sosyal";
const SECTION_ENERGY = "E2E Enerji";
const SECTION_WASTE = "E2E Atık";
const SECTION_PEOPLE = "E2E İnsan";

let seeded = false;

async function removeFixture() {
  await prisma.survey.deleteMany({ where: { name: SURVEY } });
  await prisma.user.deleteMany({ where: { email: USER } });
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

  const user = await prisma.user.create({
    data: {
      email: USER,
      password,
      firstName: "Harita",
      lastName: "Kullanıcı",
      unitId: unit.id,
      emailVerified: true,
    },
  });

  const survey = await prisma.survey.create({ data: { name: SURVEY } });

  // İki kategori, üç bölüm, yedi soru — haritanın üç seviyesi de çıksın.
  const plan: [string, number, [string, number][]][] = [
    [CATEGORY_ONE, 0, [[SECTION_ENERGY, 3], [SECTION_WASTE, 2]]],
    [CATEGORY_TWO, 1, [[SECTION_PEOPLE, 2]]],
  ];

  for (const [categoryName, categoryOrder, subCategories] of plan) {
    const category = await prisma.category.create({
      data: { name: categoryName, surveyId: survey.id, order: categoryOrder },
    });

    for (const [order, [name, count]] of subCategories.entries()) {
      const subCategory = await prisma.subCategory.create({
        data: { name, categoryId: category.id, order, hasSubLevels: false },
      });
      await prisma.question.createMany({
        data: Array.from({ length: count }, (_, index) => ({
          text: `${name} sorusu ${index + 1}`,
          type: "SCALE" as const,
          subCategoryId: subCategory.id,
          order: index,
        })),
      });
    }
  }

  await prisma.userSurveyAssignment.create({
    data: { userId: user.id, surveyId: survey.id },
  });

  seeded = true;
});

test.afterAll(async () => {
  if (seeded) await removeFixture();
  await prisma.$disconnect();
});

/** Giriş yapar ve oturumun gerçekten kurulduğunu doğrular (bkz. section-assignment). */
async function login(browser: Browser, viewport: { width: number; height: number }): Promise<Page> {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();

  for (let attempt = 0; attempt < 3; attempt++) {
    await page.goto("/login", { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);
    await page.locator('input[type="email"]').fill(USER);
    await page.locator('input[type="password"]').fill(PASSWORD);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/dashboard/, { timeout: 20_000 }).catch(() => undefined);

    const session = await (await page.request.get("/api/auth/session")).json();
    if (session?.user?.email === USER) return page;
  }

  throw new Error(`Giriş yapılamadı: ${USER}`);
}

/** Harita ile kartlar aynı metinleri taşıyor; iddialar kapsamlanmadan güvenilmez. */
const outlineOf = (page: Page) => page.getByRole("navigation", { name: "Anket haritası" });
const breadcrumbOf = (page: Page) => page.getByRole("navigation", { name: "Bölüm konumu" });

/**
 * Bölüm adı soru metinlerinin içinde de geçiyor ("E2E Atık" ↔ "E2E Atık
 * sorusu 1"), o yüzden düğme adı baştan sabitlenir; yoksa tek tıklama üç
 * öğeyle eşleşiyor ve Playwright katı kipte duruyor.
 */
const rowNamed = (page: Page, name: string) =>
  outlineOf(page).getByRole("button", { name: new RegExp(`^${name}`) });

test.describe("geniş ekran", () => {
  test("harita anketin tamamını gösterir ve gezinmeyi ekrana bağlar", async ({ browser }) => {
    test.skip(!seeded, "Fikstür kurulamadı (veritabanı yok)");
    test.setTimeout(180_000);

    const page = await login(browser, { width: 1440, height: 900 });
    await page.goto("/survey");

    const outline = outlineOf(page);
    await expect(outline).toBeVisible({ timeout: 30_000 });

    // --- kategori satırları ve toplam ---
    await expect(outline.getByText(CATEGORY_ONE, { exact: true })).toBeVisible();
    await expect(outline.getByText(CATEGORY_TWO, { exact: true })).toBeVisible();
    await expect(outline.getByText("0/7")).toBeVisible();

    // --- bulunulan kategori kendiliğinden açılır, diğeri kapalı kalır ---
    // 13 bölümün hepsi açık gelirse harita kendi çözdüğü sorunu yaratır.
    await expect(outline.getByText(SECTION_ENERGY, { exact: true })).toBeVisible();
    await expect(outline.getByText(SECTION_PEOPLE, { exact: true })).toHaveCount(0);

    // --- soru satırları metinleriyle listelenir ---
    await expect(outline.getByText(`${SECTION_ENERGY} sorusu 1`)).toBeVisible();
    await expect(outline.getByText(`${SECTION_ENERGY} sorusu 3`)).toBeVisible();

    // --- haritadan bölüm değiştirmek ekranı gerçekten taşır ---
    await expect(breadcrumbOf(page).getByText(SECTION_ENERGY, { exact: true })).toBeVisible();
    await rowNamed(page, SECTION_WASTE).click();
    await expect(breadcrumbOf(page).getByText(SECTION_WASTE, { exact: true })).toBeVisible({
      timeout: 10_000,
    });

    // --- kapalı kategori açılıp gezilebilir ---
    await rowNamed(page, CATEGORY_TWO).click();
    await rowNamed(page, SECTION_PEOPLE).click();
    await expect(breadcrumbOf(page).getByText(SECTION_PEOPLE, { exact: true })).toBeVisible({
      timeout: 10_000,
    });

    // --- cevap verilince sayaç haritada da ilerler ---
    await page.getByRole("radio", { name: /Seviye 4/ }).first().click();
    await expect(page.getByText("Otomatik kaydedildi")).toBeVisible({ timeout: 15_000 });
    await expect(outline.getByText("1/7")).toBeVisible({ timeout: 10_000 });

    await page.context().close();
  });

  test("kart numarası haritadaki numarayla aynıdır", async ({ browser }) => {
    test.skip(!seeded, "Fikstür kurulamadı (veritabanı yok)");
    test.setTimeout(120_000);

    const page = await login(browser, { width: 1440, height: 900 });
    await page.goto("/survey");
    await expect(outlineOf(page)).toBeVisible({ timeout: 30_000 });

    // İki sayım ayrı yazılsaydı bölüm atlandığında sessizce ayrışırlardı.
    await expect(page.getByText("Soru 1 / 7")).toBeVisible();
    await expect(page.getByText("Soru 3 / 7")).toBeVisible();
    // Harita satırında ayrıca gizli durum metni var ("— cevaplanmadı"), o
    // yüzden tam eşleşme değil önek aranır.
    await expect(outlineOf(page).getByText(/^Soru 3\b/)).toBeVisible();

    await page.context().close();
  });
});

test.describe("dar ekran", () => {
  test("harita sütunu gizlenir, yerini Bölümler çekmecesi alır", async ({ browser }) => {
    test.skip(!seeded, "Fikstür kurulamadı (veritabanı yok)");
    test.setTimeout(120_000);

    const page = await login(browser, { width: 900, height: 800 });
    await page.goto("/survey");

    const drawerButton = page.getByRole("button", { name: "Bölümler" });
    await expect(drawerButton).toBeVisible({ timeout: 30_000 });
    // Sütun dar ekranda hiç çizilmez; içerik sorulara kalır.
    await expect(outlineOf(page)).toBeHidden();

    await drawerButton.click();
    const outline = outlineOf(page);
    await expect(outline).toBeVisible({ timeout: 10_000 });
    await expect(outline.getByText(CATEGORY_ONE, { exact: true })).toBeVisible();

    // Çekmeceden seçim hem gezinir hem kapanır; açık kalırsa soruyu örter.
    await rowNamed(page, SECTION_WASTE).click();
    await expect(breadcrumbOf(page).getByText(SECTION_WASTE, { exact: true })).toBeVisible({
      timeout: 10_000,
    });
    await expect(outline).toBeHidden();

    await page.context().close();
  });
});
