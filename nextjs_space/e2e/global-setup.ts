import type { FullConfig } from "@playwright/test";

/**
 * Rotaları testlerden önce ısıtır.
 *
 * `npm run dev` rotaları ilk istekte derliyor; ilk teste denk gelen rota
 * saniyelerce bekletiyordu ve süit rastgele kırmızıya düşüyordu (aynı test
 * bir koşuda geçip diğerinde düşüyordu). Isınma, derleme maliyetini testlerin
 * dışına taşır; üretim derlemesine karşı koşulduğunda da zararsızdır.
 */
const ROUTES = [
  "/",
  "/login",
  "/signup",
  "/dashboard",
  "/survey",
  "/admin/recommendations",
  "/admin/surveys",
  "/organization",
  "/unit-manager",
  "/api/health/ready",
  "/api/auth/session",
];

export default async function globalSetup(config: FullConfig) {
  const baseURL =
    process.env.E2E_BASE_URL ??
    config.projects[0]?.use?.baseURL ??
    "http://localhost:3000";

  await Promise.all(
    ROUTES.map(async (route) => {
      try {
        // Yönlendirmeleri izlemeye gerek yok; amaç rotayı derletmek.
        await fetch(`${baseURL}${route}`, { redirect: "manual" });
      } catch {
        // Sunucu henüz hazır değilse testler kendi bekleme mantığını kullanır.
      }
    })
  );
}
