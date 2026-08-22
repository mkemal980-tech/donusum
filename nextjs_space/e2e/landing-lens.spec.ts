import { expect, test } from "@playwright/test";

test("dönüşüm merceği masaüstü hero alanının sağında görünür", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/", { waitUntil: "networkidle" });

  const heading = page.getByRole("heading", { name: "Kurumsal dönüşüm ölçümü basitleşti" });
  const lens = page.locator(".landing-lens-wrap");

  await expect(heading).toBeVisible();
  await expect(lens).toBeVisible();
  await expect(lens.getByText("Dijital olgunluk", { exact: true }).first()).toBeVisible();
  await expect(lens.getByText("Sürdürülebilirlik", { exact: true }).first()).toBeVisible();
  await expect(lens.getByText("Karbon görünürlüğü", { exact: true }).first()).toBeVisible();

  const headingBox = await heading.boundingBox();
  const lensBox = await lens.boundingBox();
  expect(headingBox).not.toBeNull();
  expect(lensBox).not.toBeNull();
  expect(lensBox!.x).toBeGreaterThan(headingBox!.x + headingBox!.width);
  expect(Math.abs(lensBox!.y - headingBox!.y)).toBeLessThan(40);
});

test("dar ekranda mercek hero metninin altına iner ve azaltılmış harekete uyar", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 900 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await page.goto("/", { waitUntil: "networkidle" });

  const actions = page.locator(".hero-actions");
  const lens = page.locator(".landing-lens-wrap");
  const card = page.locator(".landing-lens-card");
  const actionsBox = await actions.boundingBox();
  const lensBox = await lens.boundingBox();

  expect(actionsBox).not.toBeNull();
  expect(lensBox).not.toBeNull();
  expect(lensBox!.y).toBeGreaterThan(actionsBox!.y + actionsBox!.height);
  expect(lensBox!.width).toBeLessThanOrEqual(342);
  await expect(card).toHaveAttribute("data-motion", "static");

  await context.close();
});
