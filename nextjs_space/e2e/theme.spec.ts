import { test, expect } from "@playwright/test";

/**
 * İki tema, tek token seti.
 *
 * Koyu tema platformun bugünkü görünümüdür ve değişmemelidir; açık tema
 * ESG LAB kurumsal kimliğidir. İkisi de aynı `var(--…)` adlarını kullanır —
 * bileşenlerde tema koşulu yoktur. Test bunu bağlar: aynı token, temaya göre
 * farklı değer; ve yazı aileleri gerçekten yüklenir (değişken zinciri
 * koptuğunda tarayıcı sessizce Times'a düşüyordu).
 */

const readTheme = () => ({
  accent: getComputedStyle(document.documentElement).getPropertyValue("--accent").trim(),
  bg: getComputedStyle(document.documentElement).getPropertyValue("--bg-main").trim(),
  body: getComputedStyle(document.body).fontFamily,
});

test("koyu tema varsayılandır ve turkuaz kalır", async ({ page }) => {
  await page.goto("/login", { waitUntil: "networkidle" });

  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const dark = await page.evaluate(readTheme);

  expect(dark.accent.toLowerCase()).toBe("#0cc1c3");
  expect(dark.bg.toLowerCase()).toBe("#1d1b30");
  expect(dark.body).toContain("Poppins");
  // Değişken zinciri koparsa font-family geçersize düşer ve Times çizilir.
  expect(dark.body).not.toContain("Times");
});

test("açık tema ESG LAB kimliğiyle gelir", async ({ page }) => {
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.evaluate(() => window.localStorage.setItem("theme", "light"));
  await page.reload({ waitUntil: "networkidle" });

  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  const light = await page.evaluate(readTheme);

  expect(light.accent.toLowerCase()).toBe("#fa541c");
  expect(light.bg.toLowerCase()).toBe("#f6f8fb");
  expect(light.body).toContain("Plex");
  expect(light.body).not.toContain("Times");

  const heading = page.getByRole("heading").first();
  await expect(heading).toBeVisible();
  expect(await heading.evaluate((el) => getComputedStyle(el).fontFamily)).toContain("Space_Grotesk");
});

test("tanıtım sayfası tema tercihinden bağımsız olarak marka kimliğiyle gelir", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await page.evaluate(() => window.localStorage.setItem("theme", "dark"));
  await page.reload({ waitUntil: "networkidle" });

  // Kullanıcının tercihi duruyor...
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  // ...ama sayfa kendi paletini açıyor: turuncu vurgu, açık zemin.
  const brand = await page.evaluate(() => {
    const wrap = document.querySelector('div[data-theme="light"]') as HTMLElement;
    return {
      accent: getComputedStyle(wrap).getPropertyValue("--accent").trim().toLowerCase(),
      background: getComputedStyle(wrap).backgroundColor,
    };
  });
  expect(brand.accent).toBe("#fa541c");
  expect(brand.background).toBe("rgb(246, 248, 251)");
});
