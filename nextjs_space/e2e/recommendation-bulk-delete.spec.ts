import { test, expect, type Page } from "@playwright/test";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

/**
 * Önerileri seçip toplu silme.
 *
 * Asıl risk seçimin kapsamı: ekranda görünmeyen bir öneri silinmemeli. Bu
 * yüzden test önce arama kutusuyla listeyi daraltır, "tümünü seç" kutusuna
 * basar ve siler; filtre dışındaki önerinin ayakta kaldığını doğrular.
 *
 * Fikstürünü kendi kurar ve siler; DATABASE_URL erişilemezse test atlanır.
 */

const PASSWORD = "E2eParola!123";
const ADMIN = "e2e-oneri-yonetici@example.com";
const PREFIX = "E2E Toplu Silme";
const OTHER = "E2E Kalıcı Öneri";

let seeded = false;

async function removeFixture() {
  await prisma.recommendation.deleteMany({
    where: { OR: [{ title: { startsWith: PREFIX } }, { title: OTHER }] },
  });
  await prisma.user.deleteMany({ where: { email: ADMIN } });
}

async function seedRecommendations() {
  await prisma.recommendation.deleteMany({
    where: { OR: [{ title: { startsWith: PREFIX } }, { title: OTHER }] },
  });
  await prisma.recommendation.createMany({
    data: [
      { title: `${PREFIX} 1`, description: "birinci" },
      { title: `${PREFIX} 2`, description: "ikinci" },
      { title: `${PREFIX} 3`, description: "üçüncü" },
      { title: OTHER, description: "filtre dışında kalmalı" },
    ],
  });
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

  seeded = true;
});

test.beforeEach(async () => {
  test.skip(!seeded, "Fikstür kurulamadı");
  await seedRecommendations();
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

test("seçilen öneriler tek istekte silinir, listedekiler korunur", async ({ page }) => {
  await login(page);

  const ids = (
    await prisma.recommendation.findMany({
      where: { title: { startsWith: PREFIX } },
      select: { id: true },
    })
  ).map((rec) => rec.id);
  expect(ids).toHaveLength(3);

  const res = await page.request.post("/api/admin/recommendations/bulk-delete", {
    data: { ids: [ids[0], ids[1], "yok-boyle-bir-id"] },
  });

  expect(res.ok()).toBe(true);
  // Bulunamayan id sessizce atlanır; sayı gerçekten silinenleri gösterir.
  expect((await res.json()).deleted).toBe(2);
  expect(await prisma.recommendation.count({ where: { title: { startsWith: PREFIX } } })).toBe(1);
  expect(await prisma.recommendation.count({ where: { title: OTHER } })).toBe(1);
});

test("boş liste silme isteği reddedilir", async ({ page }) => {
  await login(page);

  const res = await page.request.post("/api/admin/recommendations/bulk-delete", {
    data: { ids: [] },
  });

  expect(res.status()).toBe(400);
  expect(await prisma.recommendation.count({ where: { title: { startsWith: PREFIX } } })).toBe(3);
});

test("yönetici olmayan toplu silemez", async ({ request }) => {
  const res = await request.post("/api/admin/recommendations/bulk-delete", {
    data: { ids: ["herhangi"] },
  });

  expect([401, 403]).toContain(res.status());
});

test("ekranda arama ile daraltılan liste seçilip silinir", async ({ page }) => {
  await login(page);

  // Onay ve sonuç kutularını kabul et.
  page.on("dialog", (dialog) => dialog.accept());

  await page.goto("/admin/recommendations", { waitUntil: "networkidle" });
  await page.getByPlaceholder("Öneri ara...").fill(PREFIX);

  const rows = page.locator("tbody tr");
  await expect(rows).toHaveCount(3);

  // "Tümünü seç" düğmesi de tablo başlığındaki kutuyla aynı kapsamı alır:
  // yalnızca filtreden geçen satırlar.
  await page.getByRole("button", { name: "Tümünü seç (3)" }).click();
  await expect(page.getByText("3 öneri seçildi")).toBeVisible();
  await expect(page.getByLabel("Listedeki tüm önerileri seç")).toBeChecked();

  await page.getByRole("button", { name: /Seçilenleri sil/ }).click();

  await expect(page.getByText("Öneri bulunamadı")).toBeVisible({ timeout: 15_000 });
  expect(await prisma.recommendation.count({ where: { title: { startsWith: PREFIX } } })).toBe(0);
  // Arama dışındaki öneri silinmemeli — seçim yalnızca görünen satırları kapsar.
  expect(await prisma.recommendation.count({ where: { title: OTHER } })).toBe(1);
});
