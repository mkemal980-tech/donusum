import { expect, test, type Page, type Route } from "@playwright/test";

const SURVEY_ID = "survey-result-flow";
const CATEGORY_ID = "category-result-flow";
const SECOND_CATEGORY_ID = "category-second";
const SUBCATEGORY_ID = "subcategory-result-flow";
const CATEGORY_NAME = "E2E Sonuç Kategorisi";
const SECOND_CATEGORY_NAME = "E2E İkinci Kategori";
const SUBCATEGORY_NAME = "E2E Sonuç Alt Kategorisi";
const RECOMMENDATION_PREFIX = "E2E Sonuç Öneri";

const recommendation = (index: number) => ({
  id: `recommendation-${index}`,
  title: `${RECOMMENDATION_PREFIX} ${index}`,
  description: `Alt kategori için öneri ${index}`,
  strategicType: index === 1 ? "QUICK_WIN" : "PROJECT",
  timeframe: index === 1 ? "SHORT_TERM" : "MEDIUM_TERM",
  costType: "OPEX",
  estimatedImpact: 10 - index,
  isInRoadmap: false,
  isActionable: true,
  stepDistance: 0,
  reasons: index === 1 ? ["Kısa vadeli hızlı kazanım"] : ["Yüksek etki"],
});

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

async function mockDashboardApis(page: Page, onRoadmapAdd: (id: string) => void) {
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname === "/api/auth/session") {
      return json(route, {
        user: { email: "e2e-result@example.com", firstName: "Sonuç", role: "USER" },
        expires: "2099-01-01T00:00:00.000Z",
      });
    }

    if (url.pathname === "/api/survey/assigned") {
      return json(route, [
        { id: SURVEY_ID, name: "E2E Sonuç Akışı Anketi", isActive: true, hasResponses: true },
      ]);
    }

    if (url.pathname === "/api/dashboard/unified") {
      return json(route, {
        userProfile: {
          id: "user-1",
          firstName: "Sonuç",
          lastName: "Testi",
          email: "e2e-result@example.com",
          organization: "E2E Kuruluşu",
          sector: null,
          subSector: null,
        },
        assessment: {
          status: "IN_PROGRESS",
          submittedAt: null,
          locked: false,
          isCoordinator: true,
        },
        score: { totalScore: 20, answeredQuestions: 1, totalQuestions: 1, completionPercentage: 100 },
        responses: [{ id: "response-1", questionId: "question-1" }],
        categoryStats: [
          { id: CATEGORY_ID, name: CATEGORY_NAME, answeredQuestions: 1, totalQuestions: 1, recommendationCount: 4 },
          { id: SECOND_CATEGORY_ID, name: SECOND_CATEGORY_NAME, answeredQuestions: 0, totalQuestions: 0, recommendationCount: 0 },
        ],
        categoryScores: {
          overallScore: 1.8,
          overallPercentage: 20,
          categories: [
            { id: CATEGORY_ID, name: CATEGORY_NAME, score: 1.8, percentage: 20 },
            { id: SECOND_CATEGORY_ID, name: SECOND_CATEGORY_NAME, score: 1, percentage: 0 },
          ],
          subCategories: [],
          subLevels: [],
        },
      });
    }

    if (url.pathname === "/api/survey/category-scores") {
      return json(route, {
        overallScore: 1.8,
        overallPercentage: 20,
        categories: [
          {
            id: CATEGORY_ID,
            name: CATEGORY_NAME,
            description: "Birinci kategori",
            score: 1.8,
            percentage: 20,
            weight: 1,
            subCategories: [
              {
                id: SUBCATEGORY_ID,
                name: SUBCATEGORY_NAME,
                score: 1.8,
                percentage: 20,
                target: 5,
                subLevels: [],
              },
            ],
          },
          {
            id: SECOND_CATEGORY_ID,
            name: SECOND_CATEGORY_NAME,
            description: "İkinci kategori",
            score: 1,
            percentage: 0,
            weight: 1,
            subCategories: [],
          },
        ],
      });
    }

    if (url.pathname === "/api/dashboard/subcategory-recommendations") {
      return json(route, {
        groups: {
          [SUBCATEGORY_ID]: {
            total: 4,
            recommendations: [recommendation(1), recommendation(2), recommendation(3)],
          },
        },
      });
    }

    if (url.pathname === "/api/dashboard/kpi") {
      return json(route, {
        overview: {
          totalQuestions: 1,
          answeredQuestions: 1,
          completionPercentage: 100,
          overallScore: 1.8,
          overallPercentage: 20,
          maturityLevel: { level: 1, label: "Başlangıç", color: "#2563eb" },
        },
        ironman: {
          velocity: 1.8,
          endurance: 1.8,
          quadrant: "WALKER",
          quadrantInfo: { title: "Yaya", color: "#2563eb" },
          velocityVsSector: null,
          enduranceVsSector: null,
        },
        categories: { total: 2, completed: 1, stats: [] },
        recommendations: { total: 4, quickWins: 1, projects: 3, bigBets: 0 },
        activity: { lastActivityDate: null, responsesToday: 1 },
        user: { name: "Sonuç Testi", organization: "E2E Kuruluşu", sector: null, subSector: null },
      });
    }

    if (url.pathname === "/api/benchmarks/user") {
      return json(route, { hasSector: false });
    }

    if (url.pathname === "/api/progress-scores") {
      return json(route, {
        categories: [],
        overall: {
          velocity: { baseScore: 1.8, bonusPoints: 0, totalScore: 1.8 },
          endurance: { baseScore: 1.8, bonusPoints: 0, totalScore: 1.8 },
          baselineScore: 1.8,
          currentScore: 1.8,
          delta: 0,
          deltaPercentage: 0,
          totalCompletedRecommendations: 0,
          totalResponses: 1,
        },
      });
    }

    if (url.pathname === "/api/roadmap" && request.method() === "POST") {
      const payload = request.postDataJSON() as { recommendationId: string };
      onRoadmapAdd(payload.recommendationId);
      return json(route, { item: { id: "roadmap-1", recommendationId: payload.recommendationId } });
    }

    return json(route, { error: `E2E mock tanımlı değil: ${url.pathname}` }, 404);
  });
}

test("sonuç ekranı kategori analizini ve alt kategoriye ait üç başlangıç önerisini gösterir", async ({ page }) => {
  let addedRecommendationId = "";
  await mockDashboardApis(page, (id) => {
    addedRecommendationId = id;
  });

  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Değerlendirme sonucu" })).toBeVisible();
  await expect(page.getByText("Tüm sorular yanıtlandı").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Değerlendirmeyi gönder" })).toBeVisible();

  const analysisFollowsScore = await page.evaluate(() => {
    const score = document.getElementById("score-heading")?.closest("section");
    const analysis = document.getElementById("category-analysis-section");
    return Boolean(
      score &&
      analysis &&
      score.compareDocumentPosition(analysis) & Node.DOCUMENT_POSITION_FOLLOWING
    );
  });
  expect(analysisFollowsScore).toBe(true);

  const scorePanel = page.locator('section[aria-labelledby="category-heading"]');
  await scorePanel.getByRole("button", { name: new RegExp(CATEGORY_NAME) }).click();
  await expect(page.locator("#category-analysis-heading")).toBeFocused();

  const firstTab = page.getByRole("tab", { name: new RegExp(CATEGORY_NAME) });
  const secondTab = page.getByRole("tab", { name: new RegExp(SECOND_CATEGORY_NAME) });
  await expect(firstTab).toHaveAttribute("aria-selected", "true");
  await firstTab.focus();
  await firstTab.press("ArrowRight");
  await expect(secondTab).toBeFocused();
  await expect(secondTab).toHaveAttribute("aria-selected", "true");
  await secondTab.press("ArrowLeft");
  await expect(firstTab).toBeFocused();

  const subCategoryCard = page.getByRole("button", { name: new RegExp(SUBCATEGORY_NAME) });
  await subCategoryCard.click();
  await expect(page.locator("#subcategory-detail-heading")).toBeFocused();

  const recommendationSection = page.locator(
    'section[aria-labelledby="starting-recommendations-heading"]'
  );
  await expect(recommendationSection.getByRole("article")).toHaveCount(3);
  await expect(
    recommendationSection.getByRole("link", { name: "Tüm önerileri gör (4)" })
  ).toBeVisible();
  await expect(recommendationSection).toContainText(`${RECOMMENDATION_PREFIX} 1`);
  await expect(recommendationSection).toContainText(`${RECOMMENDATION_PREFIX} 2`);
  await expect(recommendationSection).toContainText(`${RECOMMENDATION_PREFIX} 3`);
  await expect(recommendationSection).not.toContainText(`${RECOMMENDATION_PREFIX} 4`);

  const firstRecommendation = recommendationSection
    .getByRole("article")
    .filter({ hasText: `${RECOMMENDATION_PREFIX} 1` });
  await firstRecommendation.getByRole("button", { name: "Yol haritasına ekle" }).click();
  await expect(page.getByText("Öneri yol haritasına eklendi")).toBeVisible();
  await expect(firstRecommendation.getByRole("link", { name: "Yol haritasında" })).toBeVisible();
  expect(addedRecommendationId).toBe("recommendation-1");

  await page.getByRole("button", { name: "Kategori kırılımına dön" }).click();
  await expect(subCategoryCard).toBeFocused();
});
