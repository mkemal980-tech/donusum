import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  withAuth: vi.fn(),
  getRecommendationsForUser: vi.fn(),
}));

vi.mock("@/lib/api-utils", () => ({ withAuth: mocks.withAuth }));
vi.mock("@/lib/scoring", () => ({
  getRecommendationsForUser: mocks.getRecommendationsForUser,
}));

import { GET } from "./route";

const recommendation = (
  id: string,
  overrides: Record<string, unknown> = {}
) => ({
  id,
  title: `Öneri ${id}`,
  description: `${id} açıklaması`,
  strategicType: "PROJECT",
  timeframe: "MEDIUM_TERM",
  costType: "MEDIUM",
  estimatedImpact: 5,
  order: 10,
  triggeredByQuestion: false,
  isActionable: true,
  stepDistance: 0,
  isInRoadmap: false,
  subCategoryId: null,
  ...overrides,
});

describe("GET /api/dashboard/subcategory-recommendations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.withAuth.mockResolvedValue({ success: true, userId: "user-1" });
  });

  it("yetkisiz istekte kimlik doğrulama yanıtını geçirir", async () => {
    mocks.withAuth.mockResolvedValue({
      success: false,
      response: NextResponse.json({ error: "Yetkisiz" }, { status: 401 }),
    });

    const response = await GET(
      new NextRequest("http://localhost/api/dashboard/subcategory-recommendations?surveyId=survey-1")
    );

    expect(response.status).toBe(401);
    expect(mocks.getRecommendationsForUser).not.toHaveBeenCalled();
  });

  it("anket kimliği olmadan hesaplama yapmaz", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/dashboard/subcategory-recommendations")
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "surveyId gerekli" });
    expect(mocks.getRecommendationsForUser).not.toHaveBeenCalled();
  });

  it("önerileri alt kategoriye çözümler, önceliklendirir ve ilk üçle sınırlar", async () => {
    mocks.getRecommendationsForUser.mockResolvedValue([
      recommendation("impact", {
        subCategoryId: "sub-1",
        estimatedImpact: 9,
      }),
      recommendation("triggered", {
        resolvedSubCategoryId: "sub-1",
        triggeredByQuestion: true,
        estimatedImpact: 4,
      }),
      recommendation("quick", {
        subLevel: { subCategoryId: "sub-1" },
        strategicType: "QUICK_WIN",
        timeframe: "SHORT_TERM",
      }),
      recommendation("locked", {
        subCategoryId: "sub-1",
        isActionable: false,
        stepDistance: 1,
      }),
      recommendation("roadmap", {
        subCategoryId: "sub-2",
        isInRoadmap: true,
      }),
      recommendation("unscoped"),
    ]);

    const response = await GET(
      new NextRequest("http://localhost/api/dashboard/subcategory-recommendations?surveyId=survey-1")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.getRecommendationsForUser).toHaveBeenCalledWith("user-1", {
      surveyId: "survey-1",
    });
    expect(body.groups["sub-1"].total).toBe(4);
    expect(body.groups["sub-1"].recommendations).toHaveLength(3);
    expect(body.groups["sub-1"].recommendations.map((item: { id: string }) => item.id)).toEqual([
      "triggered",
      "impact",
      "quick",
    ]);
    expect(body.groups["sub-1"].recommendations[0].reasons).toEqual([
      "Yanıtınıza göre",
      "Şimdi uygulanabilir",
    ]);
    expect(body.groups["sub-2"]).toEqual({
      total: 1,
      recommendations: [
        expect.objectContaining({ id: "roadmap", isInRoadmap: true }),
      ],
    });
    expect(body.groups).not.toHaveProperty("null");
    expect(body.groups).not.toHaveProperty("undefined");
  });

  it("hesaplama hatasını güvenli bir sunucu yanıtına dönüştürür", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.getRecommendationsForUser.mockRejectedValue(new Error("database unavailable"));

    const response = await GET(
      new NextRequest("http://localhost/api/dashboard/subcategory-recommendations?surveyId=survey-1")
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Alt kategori önerileri alınamadı" });
    errorSpy.mockRestore();
  });
});
