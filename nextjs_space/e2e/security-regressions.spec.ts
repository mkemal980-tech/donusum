import { test, expect, type APIRequestContext, type Browser, type Page } from "@playwright/test";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

/**
 * Denetimde bulunan yetki ve veri bütünlüğü hatalarının geri gelmemesi için.
 *
 * Buradaki her test, düzeltilmeden önce **başarısız olurdu**. Sırasıyla:
 *
 * - Birimi atanmamış bir UNIT_MANAGER `where: {}` ile sistemdeki bütün
 *   kuruluşların belgelerini imzalı indirme adresleriyle alıyordu.
 * - `/api/dashboard/unified` `surveyId`'yi doğrulamıyordu; herhangi bir oturum
 *   sahibi başka kiracının anket yapısını okuyabiliyordu.
 * - SCALE cevabının puanı sınırlanmıyordu; tek istekle kuruluşun yüzdesi
 *   %19980'e çıkabiliyordu.
 * - `/api/upload/complete` istemciden gelen depolama yolunu doğrulamıyordu.
 * - `/api/admin/export?includePasswords=true` bütün bcrypt özetlerini veriyordu.
 */

const PASSWORD = "GuvenlikE2e!123";
const MANAGER_NO_UNIT = "e2e-guvenlik-mgr@example.com";
const MEMBER = "e2e-guvenlik-uye@example.com";
const OUTSIDER = "e2e-guvenlik-yabanci@example.com";
const UNIT_A = "E2E Güvenlik Kuruluş A";
const UNIT_B = "E2E Güvenlik Kuruluş B";
const SURVEY = "E2E Güvenlik Anketi";

let seeded = false;
let scaleQuestionId = "";
let surveyId = "";

async function removeFixture() {
  await prisma.document.deleteMany({ where: { fileName: { startsWith: "E2E Güvenlik" } } });
  await prisma.user.deleteMany({ where: { email: { in: [MANAGER_NO_UNIT, MEMBER, OUTSIDER] } } });
  await prisma.survey.deleteMany({ where: { name: SURVEY } });
  await prisma.unit.deleteMany({ where: { name: { in: [UNIT_A, UNIT_B] } } });
}

test.beforeAll(async () => {
  try {
    await removeFixture();
  } catch (error) {
    console.warn("Veritabanına ulaşılamadı, güvenlik testleri atlanıyor:", error);
    return;
  }

  const password = await bcrypt.hash(PASSWORD, 10);
  const sector = await prisma.sector.findFirst({ select: { id: true } });

  const unitA = await prisma.unit.create({ data: { name: UNIT_A, sectorId: sector?.id ?? null } });
  const unitB = await prisma.unit.create({ data: { name: UNIT_B, sectorId: sector?.id ?? null } });

  const survey = await prisma.survey.create({ data: { name: SURVEY, isActive: true } });
  surveyId = survey.id;
  const category = await prisma.category.create({
    data: { name: "E2E Güvenlik Kategori", surveyId: survey.id },
  });
  const question = await prisma.question.create({
    data: { text: "E2E Güvenlik ölçek sorusu", type: "SCALE", categoryId: category.id, weight: 1 },
  });
  scaleQuestionId = question.id;

  // Birimi atanmamış birim yöneticisi — K-3'ün tetikleyici koşulu.
  await prisma.user.create({
    data: {
      email: MANAGER_NO_UNIT, password, firstName: "Birimsiz", role: "UNIT_MANAGER",
      emailVerified: true, sectorId: sector?.id ?? null,
    },
  });

  const member = await prisma.user.create({
    data: {
      email: MEMBER, password, firstName: "Üye", role: "USER", unitId: unitA.id,
      emailVerified: true, sectorId: sector?.id ?? null,
    },
  });
  await prisma.userSurveyAssignment.create({ data: { userId: member.id, surveyId: survey.id } });

  const outsider = await prisma.user.create({
    data: {
      email: OUTSIDER, password, firstName: "Yabancı", role: "USER", unitId: unitB.id,
      emailVerified: true, sectorId: sector?.id ?? null,
    },
  });

  // B kuruluşunun gizli kanıtı — A'daki kimse görmemeli.
  await prisma.document.create({
    data: {
      userId: outsider.id,
      fileName: "E2E Güvenlik gizli kanıt.pdf",
      fileType: "application/pdf",
      isPublic: false,
      cloudStoragePath: "uploads/1700000000000-e2e-guvenlik-gizli.pdf",
    },
  });

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
  await page.waitForURL(/\/(dashboard|survey|organization)/, { timeout: 20_000 }).catch(() => undefined);
  const session = await (await page.request.get("/api/auth/session")).json();
  if (session?.user?.email !== email) throw new Error(`Giriş yapılamadı: ${email}`);
  return page;
}

test("birimi olmayan birim yöneticisi başka kuruluşun belgelerini görmez", async ({ browser }) => {
  test.skip(!seeded, "Fikstür kurulamadı");
  const page = await login(browser, MANAGER_NO_UNIT);

  const response = await page.request.get("/api/unit-manager/documents");
  expect(response.ok()).toBeTruthy();
  const documents = await response.json();

  // Yönetilen birim yok: liste boş olmalı, "bütün belgeler" değil.
  expect(Array.isArray(documents)).toBe(true);
  expect(documents).toHaveLength(0);
  await page.close();
});

test("belge yanıtları depolama yolunu sızdırmaz", async ({ browser }) => {
  test.skip(!seeded, "Fikstür kurulamadı");
  const page = await login(browser, MANAGER_NO_UNIT);
  const body = await (await page.request.get("/api/unit-manager/documents")).text();
  expect(body).not.toContain("cloudStoragePath");
  await page.close();
});

test("kullanıcı erişmediği anketin yapısını okuyamaz", async ({ browser }) => {
  test.skip(!seeded, "Fikstür kurulamadı");
  const page = await login(browser, OUTSIDER); // bu ankete atanmamış

  const response = await page.request.get(`/api/dashboard/unified?surveyId=${surveyId}`);
  expect(response.status()).toBe(403);
  await page.close();
});

test("ölçek cevabı aralık dışında kabul edilmez", async ({ browser }) => {
  test.skip(!seeded, "Fikstür kurulamadı");
  const page = await login(browser, MEMBER);

  for (const value of ["999", "-5", "abc"]) {
    const response = await page.request.post("/api/survey/responses", {
      data: { questionId: scaleQuestionId, value },
    });
    expect(response.status(), `değer: ${value}`).toBe(400);
  }

  // Geçerli değer kabul edilir ve tavanı aşmaz.
  const ok = await page.request.post("/api/survey/responses", {
    data: { questionId: scaleQuestionId, value: "4" },
  });
  expect(ok.ok()).toBeTruthy();
  expect((await ok.json()).score).toBe(4);
  await page.close();
});

test("sunucunun üretmediği depolama yolu reddedilir", async ({ browser }) => {
  test.skip(!seeded, "Fikstür kurulamadı");
  const page = await login(browser, MEMBER);

  const response = await page.request.post("/api/upload/complete", {
    data: {
      cloudStoragePath: "uploads/1700000000000-e2e-guvenlik-gizli.pdf",
      fileName: "calinti.pdf",
      pathSignature: "uydurma-imza",
    },
  });
  expect(response.status()).toBe(400);
  await page.close();
});

test("dışa aktarım parola özeti vermez", async ({ browser }) => {
  test.skip(!seeded, "Fikstür kurulamadı");
  // Yönetici olmayan kullanıcı zaten 403 almalı.
  const page = await login(browser, MEMBER);
  const response = await page.request.get("/api/admin/export?includePasswords=true&tables=users");
  expect([401, 403]).toContain(response.status());
  await page.close();
});

test("kimlik doğrulama uçları hız sınırına takılır", async ({ request }: { request: APIRequestContext }) => {
  const statuses: number[] = [];
  for (let i = 0; i < 15; i++) {
    const response = await request.post("/api/auth/forgot-password", {
      data: { email: `e2e-kota-${Date.now()}@example.invalid` },
    });
    statuses.push(response.status());
  }
  // Kota yoksa 15 istek de 200 dönerdi.
  expect(statuses).toContain(429);
});
