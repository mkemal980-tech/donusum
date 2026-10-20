import { test, expect } from "@playwright/test";

/**
 * İki tema, tek token seti — iso2app tasarım dili.
 *
 * Açık tema ilk ziyarette varsayılandır (iso2app ile aynı görünüm). Kullanıcı
 * koyu temayı seçebilir ve bu tercih next-themes tarafından cihazda saklanır.
 * İki tema da aynı `var(--…)` adlarını kullanır; bileşenlerde tema koşulu
 * yoktur. Beklenen değerler iso2app'in kanonik token dosyasından gelir
 * (iso2son: client/src/design-system/tokens/tokens.css).
 */

const readTheme = () => ({
  accent: getComputedStyle(document.documentElement).getPropertyValue("--accent").trim().toLowerCase(),
  accentInk: getComputedStyle(document.documentElement).getPropertyValue("--accent-ink").trim().toLowerCase(),
  bg: getComputedStyle(document.documentElement).getPropertyValue("--bg-main").trim().toLowerCase(),
  body: getComputedStyle(document.body).fontFamily,
});

test("ilk ziyarette açık tema varsayılandır", async ({ page }) => {
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.evaluate(() => window.localStorage.removeItem("theme"));
  await page.reload({ waitUntil: "networkidle" });

  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  const light = await page.evaluate(readTheme);

  // color-brand-500, color-accent-text, color-bg-base
  expect(light.accent).toBe("#fa541c");
  expect(light.accentInk).toBe("#b3380f");
  expect(light.bg).toBe("#f6f8fb");
  // next/font aileyi "__IBM_Plex_Sans_xxxx" adıyla yayınlar.
  expect(light.body).toContain("IBM_Plex_Sans");
  // Değişken zinciri koparsa font-family geçersize düşer ve Times çizilir.
  expect(light.body).not.toContain("Times");

  const heading = page.getByRole("heading").first();
  await expect(heading).toBeVisible();
  expect(await heading.evaluate((el) => getComputedStyle(el).fontFamily)).toContain("Space_Grotesk");
});

test("kullanıcı koyu temayı seçebilir ve tercih yeniden yüklemede korunur", async ({ page }) => {
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.evaluate(() => window.localStorage.removeItem("theme"));
  await page.reload({ waitUntil: "networkidle" });

  await page.getByRole("radio", { name: "Koyu tema" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  const dark = await page.evaluate(readTheme);

  // iso2app .dark: accent-display, accent-text, bg-base
  expect(dark.accent).toBe("#ff7a45");
  expect(dark.accentInk).toBe("#ffb28f");
  expect(dark.bg).toBe("#070d18");
  expect(dark.body).toContain("IBM_Plex_Sans");
  expect(dark.body).not.toContain("Times");
});

test("tanıtım sayfası tema tercihinden bağımsız olarak kendi paletiyle gelir", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await page.evaluate(() => window.localStorage.setItem("theme", "dark"));
  await page.reload({ waitUntil: "networkidle" });

  // Kullanıcının tercihi duruyor...
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  // ...ama sayfa kendi tasarım sistemini taşıyor: siyah zemin, beyaz metin,
  // Inter ailesi. Uygulamanın tema token'larına (--accent, --canvas) hiç bakmaz;
  // kendi `--color-*` ad alanını kullanır.
  //
  // Omurga monokromdur; eylem mavisi yalnızca CTA ve vurgu için ayrılmıştır
  // (bkz. app/landing.css başındaki not). Bu yüzden `--color-accent` beyaz
  // değil, marka mavisidir — asıl bağlanan kural zeminin ve metnin monokrom
  // kalması ve tema tercihinin sayfayı hiç değiştirmemesidir.
  const brand = await page.evaluate(() => {
    const wrap = document.querySelector(".esg-landing") as HTMLElement;
    const style = getComputedStyle(wrap);
    return {
      accent: style.getPropertyValue("--color-accent").trim().toLowerCase(),
      brand: style.getPropertyValue("--color-brand").trim().toLowerCase(),
      surface: style.getPropertyValue("--color-bg").trim().toLowerCase(),
      text: style.getPropertyValue("--color-text").trim().toLowerCase(),
      background: style.backgroundColor,
      body: style.fontFamily,
      // Uygulamanın h1–h6 taban kuralı tanıtım sayfasına sızmamalı: kendi
      // kuralı olmayan başlıklar da (alt bilgi h5) Inter çizilir.
      headings: [...document.querySelectorAll(".esg-landing :is(h1, h2, h3, h4, h5, h6)")].map(
        (el) => getComputedStyle(el).fontFamily,
      ),
    };
  });
  expect(brand.surface).toBe("#000000");
  expect(brand.text).toBe("#ffffff");
  expect(brand.accent).toBe(brand.brand);
  expect(brand.background).toBe("rgb(0, 0, 0)");
  expect(brand.body).toContain("Inter");
  expect(brand.headings.length).toBeGreaterThan(0);
  for (const family of brand.headings) expect(family).toContain("Inter");
});
