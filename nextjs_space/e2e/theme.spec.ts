import { test, expect } from "@playwright/test";

/**
 * İki tema, tek token seti.
 *
 * Koyu tema ilk ziyarette varsayılandır. Kullanıcı açık temayı seçebilir ve
 * bu tercih next-themes tarafından cihazda saklanır. İki tema da aynı
 * `var(--…)` adlarını kullanır; bileşenlerde tema koşulu yoktur.
 */

const readTheme = () => ({
  accent: getComputedStyle(document.documentElement).getPropertyValue("--accent").trim(),
  bg: getComputedStyle(document.documentElement).getPropertyValue("--bg-main").trim(),
  body: getComputedStyle(document.body).fontFamily,
});

test("ilk ziyarette koyu tema varsayılandır", async ({ page }) => {
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.evaluate(() => window.localStorage.removeItem("theme"));
  await page.reload({ waitUntil: "networkidle" });

  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const dark = await page.evaluate(readTheme);

  expect(dark.accent).toBe("oklch(0.635 0.191 258)");
  expect(dark.bg).toBe("oklch(0.185 0.012 264)");
  expect(dark.body).toContain("Inter");
  // Değişken zinciri koparsa font-family geçersize düşer ve Times çizilir.
  expect(dark.body).not.toContain("Times");
});

test("kullanıcı açık temayı seçebilir ve tercih yeniden yüklemede korunur", async ({ page }) => {
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.evaluate(() => window.localStorage.removeItem("theme"));
  await page.reload({ waitUntil: "networkidle" });

  await page.getByRole("radio", { name: "Açık tema" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

  const light = await page.evaluate(readTheme);

  expect(light.accent).toBe("oklch(0.505 0.181 262)");
  expect(light.bg).toBe("oklch(0.952 0.005 264)");
  expect(light.body).toContain("Inter");
  expect(light.body).not.toContain("Times");

  const heading = page.getByRole("heading").first();
  await expect(heading).toBeVisible();
  expect(await heading.evaluate((el) => getComputedStyle(el).fontFamily)).toContain("Inter");
});

test("tanıtım sayfası tema tercihinden bağımsız olarak kendi paletiyle gelir", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await page.evaluate(() => window.localStorage.setItem("theme", "dark"));
  await page.reload({ waitUntil: "networkidle" });

  // Kullanıcının tercihi duruyor...
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  // ...ama sayfa kendi tasarım sistemini taşıyor: siyah zemin, monokrom
  // palet, Inter ailesi. Uygulamanın tema token'larına hiç bakmaz.
  const brand = await page.evaluate(() => {
    const wrap = document.querySelector(".esg-landing") as HTMLElement;
    const style = getComputedStyle(wrap);
    return {
      accent: style.getPropertyValue("--color-accent").trim().toLowerCase(),
      background: style.backgroundColor,
      body: style.fontFamily,
      heading: getComputedStyle(document.querySelector(".esg-landing h1")!).fontFamily,
    };
  });
  expect(brand.accent).toBe("#ffffff");
  expect(brand.background).toBe("rgb(0, 0, 0)");
  expect(brand.body).toContain("Inter");
  expect(brand.heading).toContain("Inter");
});
