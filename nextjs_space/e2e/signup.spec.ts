import { test, expect } from "@playwright/test";
import { prisma } from "@/lib/db";

/**
 * Kayıt akışının iki iş kuralı.
 *
 * Sektör zorunlu: puanın yarısı ona bağlı. Sektörsüz kullanıcı kıyas
 * göremiyor ve sektöre göre kapsam kuralları devreye girmiyor — anketi
 * doldurup eksik bir sonuç alıyor.
 *
 * Tanıtım anketi otomatik atanıyor: aksi hâlde yeni kullanıcı giriş yapıp
 * "Henüz Anket Atanmadı" görüyor ve yönetici ona bir anket atayana kadar
 * hiçbir şey yapamıyor.
 */

const EMAIL = "e2e-kayit@example.com";
const PASSWORD = "E2eParola123";
const DEMO_SURVEY = "E2E Tanıtım Anketi";

let sectorId: string | null = null;

async function cleanup() {
  await prisma.user.deleteMany({ where: { email: EMAIL } });
  await prisma.survey.deleteMany({ where: { name: DEMO_SURVEY } });
}

test.beforeAll(async () => {
  await cleanup();
  await prisma.survey.create({ data: { name: DEMO_SURVEY, isDemo: true, isActive: true } });
  const sector = await prisma.sector.findFirst({ select: { id: true } });
  sectorId = sector?.id ?? null;
});

test.afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

test("sektörsüz kayıt reddedilir", async ({ request }) => {
  test.skip(!sectorId, "Sektör kaydı yok");

  const res = await request.post("/api/signup", {
    data: { email: EMAIL, password: PASSWORD, firstName: "Deneme" },
  });

  expect(res.status()).toBe(400);
  expect((await res.json()).error).toContain("Sektör");
  expect(await prisma.user.count({ where: { email: EMAIL } })).toBe(0);
});

test("kayıt olan kullanıcıya tanıtım anketi otomatik atanır", async ({ request }) => {
  test.skip(!sectorId, "Sektör kaydı yok");

  const res = await request.post("/api/signup", {
    data: { email: EMAIL, password: PASSWORD, firstName: "Deneme", sectorId },
  });
  expect(res.ok()).toBe(true);

  const user = await prisma.user.findUnique({
    where: { email: EMAIL },
    include: { surveyAssignments: { include: { survey: true } } },
  });

  expect(user).not.toBeNull();
  expect(user!.sectorId).toBe(sectorId);
  // Tanıtım anketi atanmış olmalı — kullanıcı boş ekranla karşılaşmasın.
  expect(user!.surveyAssignments.map((a) => a.survey.name)).toContain(DEMO_SURVEY);
  // Tanıtım dışındaki anketler atanmamalı; onları yönetici dağıtır.
  expect(user!.surveyAssignments.every((a) => a.survey.isDemo)).toBe(true);
});

/**
 * Aynı adresle ikinci kayıt, kullanıcının en sık düştüğü yer: hesabını
 * açtığını unutup baştan kaydolmaya çalışıyor. Cevap "hata oluştu" değil,
 * ne yapacağı olmalı — ve form ayakta kalmalı.
 */
test("aynı e-posta ile ikinci kayıt sebebini ve çözümünü söyler", async ({ request, page }) => {
  test.skip(!sectorId, "Sektör kaydı yok");

  const res = await request.post("/api/signup", {
    data: { email: EMAIL, password: PASSWORD, firstName: "Deneme", sectorId },
  });

  expect(res.status()).toBe(409);
  const body = await res.json();
  expect(body.error).toContain("zaten kayıtlı");
  expect(body.reason).toBe("email_taken");

  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/signup", { waitUntil: "networkidle" });
  await page.locator('input[name="firstName"]').fill("Deneme");
  await page.locator('input[name="lastName"]').fill("Kullanıcı");
  await page.locator('input[name="email"]').fill(EMAIL);
  await page.locator('input[name="organization"]').fill("E2E A.Ş.");
  await page.locator('select[name="sectorId"]').selectOption(sectorId!);
  await page.locator('input[name="password"]').fill(PASSWORD);
  await page.locator('input[name="confirmPassword"]').fill(PASSWORD);
  await page.getByRole("button", { name: "Kayıt Ol" }).click();

  // Next'in yönlendirme duyurucusu da role="alert" taşıyor; form içindekini al.
  const alert = page.locator('form [role="alert"]');
  await expect(alert).toContainText("Bu e-posta adresi zaten kayıtlı", { timeout: 20_000 });
  // Çözüm aynı kutuda: giriş, şifre sıfırlama ve doğrulamayı yeniden gönderme.
  await expect(alert.getByRole("link", { name: "giriş yapın" })).toBeVisible();
  await expect(alert.getByRole("link", { name: "şifrenizi sıfırlayın" })).toBeVisible();
  await expect(alert.getByRole("button", { name: "yeniden gönderin" })).toBeVisible();

  // Sayfa ayakta: hata sınırına düşülmedi, form hâlâ doldurulabilir.
  await expect(page.getByRole("heading", { name: "Hesap Oluşturun" })).toBeVisible();
  expect(pageErrors).toEqual([]);
});
