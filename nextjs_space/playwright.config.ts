import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E yapılandırması.
 *
 * Ön koşullar (yerelde ilk kez):
 *   1) npx playwright install chromium   (tarayıcı ikilisini indirir)
 *   2) Çalışan bir uygulama + tohumlanmış DB (webServer aşağıda otomatik başlatır)
 *
 * Kimlik doğrulama gerektiren akışlar için E2E_TEST_EMAIL / E2E_TEST_PASSWORD
 * ortam değişkenleriyle bir test kullanıcısı sağlayın (auth spec'leri bunları kullanır).
 */
export default defineConfig({
  testDir: "./e2e",
  /**
   * Dev sunucusu rotaları ilk istekte derliyor; ısınma (globalSetup) bunu
   * büyük ölçüde alsa da ağır admin ekranları için pay bırakılır.
   */
  timeout: 60_000,
  globalSetup: "./e2e/global-setup.ts",
  /**
   * Tek işçi: testler tek bir veritabanını ve tek bir sunucuyu paylaşıyor,
   * fikstürler de sabit adlarla kuruluyor. Bu boyuttaki bir süitte
   * paralellikten kazanılacak saniyeler, iki testin aynı kayıtlara aynı anda
   * dokunma riskine değmez.
   */
  fullyParallel: false,
  workers: 1,
  /**
   * Yerelde sıfır: kararsızlık gizlenmesin, görülsün. CI'da bir tekrar,
   * altyapı kaynaklı tek seferlik hataların dalı kırmızıya düşürmemesi için —
   * tekrar edilen test raporda yine işaretlenir.
   */
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  // Uygulama zaten çalışmıyorsa otomatik başlat
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3000",
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
