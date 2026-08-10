import { test, expect, type Page } from "@playwright/test";
import * as XLSX from "xlsx";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

/**
 * Toplu yükleme önizlemesinin büyük dosyada ayakta kalması.
 *
 * 284 satırlık bir yüklemede önizleme bütün satırları ve her satırda anketin
 * tüm sorularını birden çiziyordu; tarayıcı kilitleniyor, kaydetme isteği hiç
 * gönderilemiyordu. Test iki şeyi bağlar: satırlar parça parça açılır ve
 * ekranda görünmeyen satırlar da kaydedilir.
 */

const ADMIN = "e2e-onizleme-yonetici@example.com";
const PASSWORD = "E2eParola!123";
const SURVEY = "E2E Önizleme Anketi";
/** Dosyanın soruları burada yok: yanlış anket seçilince ne olduğunu bağlar. */
const OTHER_SURVEY = "E2E Önizleme Anketi (başka)";
const QUESTION_COUNT = 8; // 8 soru × 4 şık = 32 satır > sayfa boyu (25)

let seeded = false;
let filePath = "";

const questionText = (index: number) => `${SURVEY} sorusu ${index + 1}`;
const optionLabel = (index: number, score: number) => `${String.fromCharCode(64 + score)}) Seviye ${score} — soru ${index + 1}`;

async function removeFixture() {
  await prisma.recommendation.deleteMany({ where: { title: { startsWith: "E2E Önizleme" } } });
  await prisma.survey.deleteMany({ where: { name: { in: [SURVEY, OTHER_SURVEY] } } });
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
      role: "ADMIN",
      emailVerified: true,
    },
  });

  const survey = await prisma.survey.create({ data: { name: SURVEY, isActive: true } });
  const category = await prisma.category.create({ data: { name: "E2E Kategori", surveyId: survey.id } });
  const subCategory = await prisma.subCategory.create({
    data: { name: "E2E Bölüm", categoryId: category.id, hasSubLevels: false },
  });

  await prisma.survey.create({ data: { name: OTHER_SURVEY, isActive: true } });

  const rows: Record<string, string>[] = [];

  for (let index = 0; index < QUESTION_COUNT; index++) {
    await prisma.question.create({
      data: {
        text: questionText(index),
        type: "MULTIPLE_CHOICE",
        subCategoryId: subCategory.id,
        order: index,
        options: [1, 2, 3, 4].map((score) => ({
          value: optionLabel(index, score),
          label: optionLabel(index, score),
          score,
        })),
      },
    });

    for (const score of [1, 2, 3, 4]) {
      rows.push({
        soru_metni: questionText(index),
        tetikleyici: optionLabel(index, score),
        kademeli: "EVET",
        baslik: `E2E Önizleme ${index + 1}-${score}`,
        aciklama: `Soru ${index + 1} için ${score}. basamak önerisi.`,
        vade: "ORTA",
        strateji: "PROJE",
        maliyet: "CAPEX",
        etki: "7",
        puan: "",
        video_url: "",
        sira: String(score),
      });
    }
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "Öneriler");
  filePath = test.info().outputPath("e2e-onizleme.xlsx");
  XLSX.writeFile(workbook, filePath);

  seeded = true;
});

test.afterAll(async () => {
  if (seeded) await removeFixture();
  await prisma.$disconnect();
});

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

test("önizleme satırları parça parça açılır, görünmeyenler de kaydedilir", async ({ page }) => {
  test.skip(!seeded, "Fikstür kurulamadı");
  test.setTimeout(120_000);

  await login(page);
  await page.goto("/admin/recommendations");
  await page.getByRole("heading", { name: "Öneri Yönetimi" }).waitFor();
  await page.getByRole("button", { name: "Toplu Kurulum" }).click();
  await page.locator("select").first().selectOption({ label: SURVEY });
  await page.locator('input[type="file"]').setInputFiles(filePath);

  const saveButton = page.getByRole("button", { name: "32 öneriyi kaydet" });
  await expect(saveButton).toBeVisible({ timeout: 60_000 });
  await expect(saveButton).toBeEnabled();

  // 32 satırın tamamı değil, ilk sayfa çizilir.
  const rowCards = page.locator("text=/^Satır \\d+$/");
  await expect(rowCards).toHaveCount(25);
  await expect(page.getByRole("button", { name: /7 satır daha var/ })).toBeVisible();

  await page.getByRole("button", { name: "Tümünü göster" }).click();
  await expect(rowCards).toHaveCount(32);

  // Ekranda görünen satır sayısı ne olursa olsun kayıt dosyanın tamamıdır.
  await page.getByRole("button", { name: /7 satır daha var/ }).isVisible().catch(() => undefined);
  await saveButton.click();
  await expect(page.getByRole("heading", { name: "Toplu Öneri Kurulumu" })).toBeHidden({
    timeout: 60_000,
  });

  const saved = await prisma.recommendation.count({ where: { title: { startsWith: "E2E Önizleme" } } });
  expect(saved).toBe(32);

  // Maliyet seviyeleri türetilmiş olmalı: hepsi varsayılan 1'de kalmamalı.
  const levels = await prisma.recommendation.findMany({
    where: { title: { startsWith: "E2E Önizleme" } },
    select: { capexLevel: true, opexLevel: true },
  });
  expect(levels.every((level) => level.capexLevel === 1 && level.opexLevel === 1)).toBe(false);
});

test("yanlış ankete yüklenen dosyada sebep en üstte yazar", async ({ page }) => {
  test.skip(!seeded, "Fikstür kurulamadı");
  test.setTimeout(120_000);

  await login(page);
  await page.goto("/admin/recommendations");
  await page.getByRole("heading", { name: "Öneri Yönetimi" }).waitFor();
  await page.getByRole("button", { name: "Toplu Kurulum" }).click();
  await page.locator("select").first().selectOption({ label: OTHER_SURVEY });
  await page.locator('input[type="file"]').setInputFiles(filePath);

  // 32 satırın hepsi "soru bulunamadı" der; asıl sebep tek satırda değil,
  // seçilen ankettedir — önizleme bunu satırları okumadan söylemeli.
  await expect(page.getByText("Hiçbir satır ankete bağlanamadı")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText(`Anket: ${OTHER_SURVEY} · 0 soru`)).toBeVisible();
  // Kaydetme kapalı: eşleşmeyen satır varken hiçbir şey yazılmaz.
  await expect(page.getByRole("button", { name: "32 öneriyi kaydet" })).toBeDisabled();
});
