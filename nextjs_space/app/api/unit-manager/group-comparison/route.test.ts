import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { ManagedAssessmentError } from "@/lib/managed-assessment";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), load: vi.fn() }));
vi.mock("@/lib/api-utils", () => ({ withAuth: mocks.auth }));
vi.mock("@/lib/unit-group-comparison", () => ({ loadUnitGroupComparison: mocks.load }));
import { GET } from "./route";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ success: true, userId: "manager", user: { role: "UNIT_MANAGER" } });
  mocks.load.mockResolvedValue({ available: false, reason: "COHORT", groupName: "Ege Sanayi Odası", count: 2, required: 5 });
});
describe("birim kıyası API'si", () => {
  it("yönetici rolünü doğrular", async () => {
    mocks.auth.mockResolvedValue({ success: false, response: NextResponse.json({ error: "Yetkiniz yok." }, { status: 403 }) });
    expect((await GET(new NextRequest("http://localhost/api/unit-manager/group-comparison?assessmentId=a"))).status).toBe(403);
    expect(mocks.auth).toHaveBeenCalledWith(expect.anything(), { requireUnitManager: true });
    expect(mocks.load).not.toHaveBeenCalled();
  });
  it("değerlendirme seçilmeden veri yüklemez", async () => {
    expect((await GET(new NextRequest("http://localhost/api/unit-manager/group-comparison"))).status).toBe(400);
    expect(mocks.load).not.toHaveBeenCalled();
  });
  it("değerlendirmeyi yetkili servise geçirir", async () => {
    const response = await GET(new NextRequest("http://localhost/api/unit-manager/group-comparison?assessmentId=as-b"));
    expect(response.status).toBe(200); expect(mocks.load).toHaveBeenCalledWith(expect.objectContaining({ userId: "manager" }), "as-b");
  });
  it("erişilemeyen değerlendirmede 403 döner", async () => {
    mocks.load.mockRejectedValue(new ManagedAssessmentError("Bu değerlendirmeye erişiminiz yok."));
    expect((await GET(new NextRequest("http://localhost/api/unit-manager/group-comparison?assessmentId=outside"))).status).toBe(403);
  });
});
