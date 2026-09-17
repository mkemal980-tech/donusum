import { test, expect, type Browser, type Page } from "@playwright/test";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

/**
 * Birim seviyesinde katılım kodu: üye kuruluşu kaydolan kişi getirir.
 *
 * Kod yalnızca önceden oluşturulmuş bir üye kuruluşu hedefleyebiliyordu; yönetici
 * her şirketi elle açmadan kod dağıtamıyordu. Kullanıcıları doğrudan köke
 * bağlamak da çözüm değildi: Assessment kuruluşa bağlı ve birim başına tekil,
 * yani kökü paylaşan bütün şirketler tek değerlendirmeyi paylaşırdı.
 */

const PASSWORD = "E2eKatilim!123";
const MANAGER = "e2e-katilim-yonetici@example.com";
const ROOT = "E2E Katılım Yapısı";
const FIRST_COMPANY = "E2E Alfa Tersanesi";
const SECOND_COMPANY = "E2E Beta Tersanesi";

let seeded = false;
let rootId = "";
let sectorId = "";

async function removeFixture() {
  await prisma.user.deleteMany({ where: { email: { endsWith: "@e2e-katilim.test" } } });
  await prisma.user.deleteMany({ where: { email: MANAGER } });
  await prisma.unit.deleteMany({ where: { name: { in: [FIRST_COMPANY, SECOND_COMPANY] } } });
  await prisma.unit.deleteMany({ where: { name: ROOT } });
}

test.beforeAll(async () => {
  try {
    await removeFixture();
  } catch (error) {
    console.warn("Veritabanına ulaşılamadı, katılım kodu testi atlanıyor:", error);
    return;
  }

  const sector = await prisma.sector.findFirst({ select: { id: true } });
  if (!sector) return;
  sectorId = sector.id;

  const root = await prisma.unit.create({ data: { name: ROOT } });
  rootId = root.id;

  const manager = await prisma.user.create({
    data: {
      email: MANAGER,
      password: await bcrypt.hash(PASSWORD, 10),
      firstName: "Yapı",
      lastName: "Yöneticisi",
      role: "UNIT_MANAGER",
      unitId: root.id,
      sectorId: sector.id,
      emailVerified: true,
    },
  });
  await prisma.unitAdmin.create({ data: { unitId: root.id, userId: manager.id } });

  seeded = true;
});

test.afterAll(async () => {
  if (seeded) await removeFixture();
  await prisma.$disconnect();
});

async function login(browser: Browser, email: string): Promise<Page> {
  const page = await browser.newPage();
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/(dashboard|organization|survey)/, { timeout: 20_000 }).catch(() => undefined);
  const session = await (await page.request.get("/api/auth/session")).json();
  if (session?.user?.email !== email) throw new Error(`Giriş yapılamadı: ${email}`);
  return page;
}

test("yapı seviyesinde kod: üye kuruluş kaydolanın adından açılır", async ({ browser, request }) => {
  test.skip(!seeded, "Fikstür kurulamadı");
  test.setTimeout(120_000);

  // --- Yönetici üye kuruluş oluşturmadan kod açıyor ---
  const manager = await login(browser, MANAGER);
  const created = await manager.request.post("/api/organization/join-codes", {
    data: {
      tenantUnitId: rootId,
      action: "create",
      memberUnitId: rootId,
      createsMemberUnit: true,
      sectorId,
      label: "E2E yapı kodu",
    },
  });
  expect(created.status()).toBe(201);
  const { code, record } = await created.json();
  expect(code).toMatch(/^BRM-/);
  expect(record.createsMemberUnit).toBe(true);

  // --- Kod doğrulaması şirket adı isteyeceğini bildiriyor ---
  const verified = await request.post("/api/signup/join-code", { data: { joinCode: code } });
  expect(verified.ok()).toBeTruthy();
  expect((await verified.json()).requiresOrganization).toBe(true);

  // --- Birinci şirket kaydoluyor ---
  const first = await request.post("/api/signup", {
    data: {
      email: `alfa@e2e-katilim.test`,
      password: PASSWORD,
      firstName: "Alfa",
      organization: FIRST_COMPANY,
      joinCode: code,
    },
  });
  expect(first.status()).toBe(200);
  expect((await first.json()).joinedUnit.name).toBe(FIRST_COMPANY);

  const alfaUnit = await prisma.unit.findFirst({ where: { name: FIRST_COMPANY } });
  expect(alfaUnit).not.toBeNull();
  // Kuruluş yapının altında ve kodun sektörünü devraldı.
  expect(alfaUnit).toMatchObject({ parentId: rootId, sectorId });

  // --- İkinci şirket kaydoluyor: ayrı kuruluş, ayrı değerlendirme ---
  const second = await request.post("/api/signup", {
    data: {
      email: `beta@e2e-katilim.test`,
      password: PASSWORD,
      firstName: "Beta",
      organization: SECOND_COMPANY,
      joinCode: code,
    },
  });
  expect(second.status()).toBe(200);

  const betaUnit = await prisma.unit.findFirst({ where: { name: SECOND_COMPANY } });
  expect(betaUnit?.id).not.toBe(alfaUnit?.id);

  // --- Aynı şirketten ikinci kişi: yeni kuruluş açılmaz ---
  const colleague = await request.post("/api/signup", {
    data: {
      email: `alfa-2@e2e-katilim.test`,
      password: PASSWORD,
      firstName: "Alfa İkinci",
      organization: FIRST_COMPANY.toLocaleLowerCase("tr-TR"), // harf durumu farklı
      joinCode: code,
    },
  });
  expect(colleague.status()).toBe(200);
  expect(await prisma.unit.count({ where: { parentId: rootId } })).toBe(2);

  const colleagueUser = await prisma.user.findUnique({ where: { email: "alfa-2@e2e-katilim.test" } });
  expect(colleagueUser?.unitId).toBe(alfaUnit!.id);

  // --- Şirket adı olmadan kaydolunamaz ---
  const missingName = await request.post("/api/signup", {
    data: {
      email: `adsiz@e2e-katilim.test`,
      password: PASSWORD,
      firstName: "Adsız",
      joinCode: code,
    },
  });
  expect(missingName.status()).toBe(400);

  // --- Yönetici açılan kuruluşları üye listesinde görüyor ---
  const members = await (await manager.request.get("/api/organization/members")).json();
  const names = members.roots
    ?.flatMap((root: any) => root.members ?? [])
    .map((member: any) => member.name);
  expect(names).toEqual(expect.arrayContaining([FIRST_COMPANY, SECOND_COMPANY]));

  await manager.close();
});

test("üye kuruluşu olmayan yönetici katılım kodu ekranını açabilir", async ({ browser }) => {
  test.skip(!seeded, "Fikstür kurulamadı");

  /**
   * Asıl çıkmaz buydu: form yapı seviyesini destekliyordu ama formu açan
   * "Katılım kodları" düğmesi `members.length` koşuluna bağlıydı. Üye kuruluşu
   * olmayan yönetici -- yani özelliğin tam olarak çözdüğü durumdaki kişi --
   * ekrana hiç ulaşamıyordu.
   */
  const manager = await login(browser, MANAGER);
  await manager.goto("/organization/members", { waitUntil: "domcontentloaded" });

  const button = manager.getByRole("button", { name: "Katılım kodları" });
  await expect(button).toBeEnabled();

  await button.click();
  await expect(manager.getByText("Birim katılım kodları")).toBeVisible();

  // Varsayılan hedef yapının kendisi: üye kuruluş seçmeden kod açılabilmeli.
  await expect(
    manager.getByRole("option", { name: new RegExp(`${ROOT} — kaydolan kendi şirketini yazsın`) })
  ).toBeAttached();

  // Boş durumda da kod yolu sunuluyor.
  await expect(manager.getByRole("button", { name: "Katılım kodu oluştur" })).toBeVisible();

  await manager.close();
});
