import { expect, test, type Browser, type Page } from "@playwright/test";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

const PASSWORD = "DemoE2e!123";
const ADMIN_EMAIL = "e2e-demo-admin@example.com";
const USER_EMAIL = "e2e-demo-user@example.com";

let seeded = false;

async function removeFixture() {
  await prisma.user.deleteMany({ where: { email: { in: [ADMIN_EMAIL, USER_EMAIL] } } });
}

test.beforeAll(async () => {
  try {
    await removeFixture();
    const password = await bcrypt.hash(PASSWORD, 10);
    await prisma.user.createMany({
      data: [
        {
          email: ADMIN_EMAIL,
          password,
          firstName: "Demo",
          lastName: "Yönetici",
          role: "ADMIN",
          emailVerified: true,
        },
        {
          email: USER_EMAIL,
          password,
          firstName: "Demo",
          lastName: "Kullanıcı",
          role: "USER",
          emailVerified: true,
        },
      ],
    });
    seeded = true;
  } catch (error) {
    console.warn("Veritabanına ulaşılamadı, demo erişim testi atlanıyor:", error);
  }
});

test.afterAll(async () => {
  if (seeded) await removeFixture();
  await prisma.$disconnect();
});

async function login(browser: Browser, email: string): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
  return page;
}

test("ADMIN demo dashboardunu ve 2.000 tamamlanmış yanıtı görür", async ({ browser }) => {
  test.skip(!seeded, "Fikstür kurulamadı (veritabanı yok)");
  const page = await login(browser, ADMIN_EMAIL);

  await page.goto("/admin/demo-manager");

  await expect(page.getByRole("heading", { name: "Demo yönetici alanı" })).toBeVisible();
  await expect(page.getByText("Marmara Ticaret Odası").first()).toBeVisible();
  await expect(page.getByText("2.000 tamamlanmış üye yanıtıyla")).toBeVisible();
  await expect(page.getByText("Tamamlanan yanıt")).toBeVisible();
  await expect(page.getByRole("link", { name: "Demo yönetici" })).toBeVisible();
});

test("normal kullanıcı demo yönetici alanından panoya yönlendirilir", async ({ browser }) => {
  test.skip(!seeded, "Fikstür kurulamadı (veritabanı yok)");
  const page = await login(browser, USER_EMAIL);

  await page.goto("/admin/demo-manager");

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByTestId("demo-manager-dashboard")).toHaveCount(0);
});
