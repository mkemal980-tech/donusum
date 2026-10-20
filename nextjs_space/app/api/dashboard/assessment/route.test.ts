import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ManagedAssessmentError } from "@/lib/managed-assessment";

const mocks = vi.hoisted(() => ({ view: vi.fn(), resolve: vi.fn(), save: vi.fn(), index: vi.fn() }));
vi.mock("@/lib/api-utils", () => ({ withAuth: async () => ({ success: true, userId: "member-1", user: { role: "USER" } }) }));
vi.mock("@/lib/assessment-view", () => ({ loadAssessmentView: mocks.view, resolveViewableAssessment: mocks.resolve, loadAssessmentIndex: mocks.index }));
vi.mock("@/lib/unit-roadmap", () => ({ saveAssessmentRoadmap: mocks.save }));
import { GET } from "./route";
import { POST } from "./roadmap/route";
import { GET as INDEX } from "../assessments/route";

beforeEach(() => vi.clearAllMocks());

describe("tek pano API'si", () => {
  it("değerlendirme seçilmeden veri yüklemez; yetkisizi 403 ile geri çevirir", async () => {
    expect((await GET(new NextRequest("http://localhost/api/dashboard/assessment"))).status).toBe(400);
    mocks.view.mockRejectedValue(new ManagedAssessmentError("Bu değerlendirmeye erişiminiz yok."));
    expect((await GET(new NextRequest("http://localhost/api/dashboard/assessment?assessmentId=other"))).status).toBe(403);
  });
  it("görünümü oturumdaki kullanıcıyla yükler", async () => {
    mocks.view.mockResolvedValue({ viewer: { role: "member" } });
    const response = await GET(new NextRequest("http://localhost/api/dashboard/assessment?assessmentId=as-1"));
    expect(await response.json()).toEqual({ viewer: { role: "member" } });
    expect(mocks.view).toHaveBeenCalledWith(expect.objectContaining({ userId: "member-1" }), "as-1");
  });
  it("yol haritası kaydını açılan değerlendirmeye ve role göre yönlendirir", async () => {
    mocks.resolve.mockResolvedValue({ role: "member", record: { id: "as-1" } });
    mocks.save.mockResolvedValue({ status: 403, body: { error: "yetki yok" } });
    const response = await POST(new NextRequest("http://localhost/api/dashboard/assessment/roadmap", { method: "POST", body: JSON.stringify({ assessmentId: "as-1", recommendationId: "r1", status: "COMPLETED" }) }));
    expect(response.status).toBe(403);
    expect(mocks.save).toHaveBeenCalledWith(expect.anything(), "member", { id: "as-1" }, { assessmentId: "as-1", recommendationId: "r1", status: "COMPLETED" });
    expect((await POST(new NextRequest("http://localhost/api/dashboard/assessment/roadmap", { method: "POST", body: "{" }))).status).toBe(400);
  });
  it("listeyi oturumdaki kullanıcının rolüne göre verir", async () => {
    mocks.index.mockResolvedValue({ role: "member", units: [], assessments: [] });
    expect(await (await INDEX(new NextRequest("http://localhost/api/dashboard/assessments"))).json()).toMatchObject({ role: "member" });
  });
});
