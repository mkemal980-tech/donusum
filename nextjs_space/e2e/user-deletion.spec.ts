import { test, expect, type Browser, type Page } from "@playwright/test";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

/**
 * Kullanıcı silmenin gerçekten sildiğini ve e-postayı serbest bıraktığını bağlar.
 *
 * Çöp kutusu düğmesi hesabı yalnızca devre dışı bırakıyordu; liste `isActive`'i
 * ne süzüyor ne gösteriyordu ve bildirim "Kullanıcı silindi" diyordu. Yönetici
 * onay veriyor, başarı mesajı alıyor, satır olduğu gibi kalıyordu. Üstüne
 * e-posta da kalıcı olarak bloke oluyordu: aynı adresle yeniden kayıt
 * "zaten kayıtlı" diyordu ve önerilen üç çıkış da devre dışı hesapta çalışmıyordu.
 */

const PASSWORD = "E2eSilme!123";
const ADMIN = "e2e-silme-admin@example.com";
const VICTIM = "e2e-silme-hedef@example.com";

let seeded = false;
let sectorId = "";

async function removeFixture() {
  await prisma.user.deleteMany({ where: { email: { in: [ADMIN, VICTIM] } } });
}

test.beforeAll(async () => {
  try {
    await removeFixture();
  } catch (error) {
    console.warn("Veritabanına ulaşılamadı, silme testi atlanıyor:", error);
    return;
  }
  const sector = await prisma.sector.findFirst({ select: { id: true } });
  if (!sector) return;
  sectorId = sector.id;

  await prisma.user.create({
    data: {
      email: ADMIN,
      password: await bcrypt.hash(PASSWORD, 10),
      firstName: "Silme",
      role: "ADMIN",
      emailVerified: true,
    },
  });
  seeded = true;
});

test.afterAll(async () => {
  if (seeded) await removeFixture();
  await prisma.$disconnect();
});

async function loginAdmin(browser: Browser): Promise<Page> {
  const page = await browser.newPage();
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.locator('input[type="email"]').fill(ADMIN);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/(dashboard|admin)/, { timeout: 20_000 }).catch(() => undefined);
  const session = await (await page.request.get("/api/auth/session")).json();
  if (session?.user?.email !== ADMIN) throw new Error("Yönetici girişi yapılamadı");
  return page;
}

async function createVictim(page: Page) {
  // Her test kendi hedefini taze açar; önceki testin bıraktığı kayıt adresi
  // bloke eder (asıl konu da bu zaten).
  await prisma.user.deleteMany({ where: { email: VICTIM } });
  const response = await page.request.post("/api/admin/users", {
    data: {
      email: VICTIM,
      password: PASSWORD,
      firstName: "Hedef",
      lastName: "Kullanıcı",
      role: "USER",
      sectorId,
    },
  });
  expect(response.ok()).toBeTruthy();
  return (await response.json()).id as string;
}

test("devre dışı bırakma hesabı listede bırakır ve e-postayı serbest bırakmaz", async ({ browser, request }) => {
  test.skip(!seeded, "Fikstür kurulamadı");
  const admin = await loginAdmin(browser);
  const id = await createVictim(admin);

  const deactivate = await admin.request.delete(`/api/admin/users?id=${id}`);
  expect((await deactivate.json())).toMatchObject({ deactivated: true });

  // Kayıt duruyor ama pasif — liste bunu rozetle gösteriyor.
  expect(await prisma.user.findUnique({ where: { id } })).toMatchObject({ isActive: false });

  // İkinci kez devre dışı bırakılamaz; sessiz başarı dönmez.
  expect((await admin.request.delete(`/api/admin/users?id=${id}`)).status()).toBe(409);

  // E-posta hâlâ bloke, ama sebebi artık doğru söyleniyor.
  const signup = await request.post("/api/signup", {
    data: { email: VICTIM, password: PASSWORD, firstName: "Yeni", sectorId },
  });
  expect(signup.status()).toBe(409);
  expect((await signup.json()).reason).toBe("email_disabled");

  await admin.close();
});

test("kalıcı silme hesabı gerçekten siler ve e-postayı serbest bırakır", async ({ browser, request }) => {
  test.skip(!seeded, "Fikstür kurulamadı");
  const admin = await loginAdmin(browser);
  const id = await createVictim(admin);

  // Silmeden önce ne gideceği sayılıyor.
  const impact = await admin.request.get(`/api/admin/users?action=delete-impact&id=${id}`);
  expect(impact.ok()).toBeTruthy();
  expect((await impact.json()).impact).toMatchObject({ assessments: 0, responses: 0 });

  const removed = await admin.request.delete(`/api/admin/users?id=${id}&permanent=true`);
  expect((await removed.json())).toMatchObject({ deleted: true });

  // Kayıt gerçekten yok.
  expect(await prisma.user.findUnique({ where: { id } })).toBeNull();

  // Asıl kontrol: aynı e-postayla yeniden kaydolunabiliyor.
  const signup = await request.post("/api/signup", {
    data: { email: VICTIM, password: PASSWORD, firstName: "Yeni", sectorId },
  });
  expect(signup.status()).toBe(200);

  await admin.close();
});
