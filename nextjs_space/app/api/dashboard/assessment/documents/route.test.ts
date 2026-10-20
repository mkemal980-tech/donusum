import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ManagedAssessmentError } from "@/lib/managed-assessment";

const mocks = vi.hoisted(() => ({ documents: vi.fn(), url: vi.fn() }));
vi.mock("@/lib/api-utils", () => ({ withAuth: async () => ({ success: true, userId: "u1", user: { role: "USER" } }) }));
vi.mock("@/lib/assessment-view", () => ({ loadAssessmentDocuments: mocks.documents }));
vi.mock("@/lib/s3", () => ({ getFileUrl: mocks.url }));
import { GET } from "./route";

const request = (query = "") => new NextRequest("http://localhost/api/dashboard/assessment/documents" + query);
beforeEach(() => vi.clearAllMocks());

describe("pano belgeleri", () => {
  it("depolama yolunu ve cevap kaydını döndürmez; yalnızca imzalı indirme adresi", async () => {
    mocks.documents.mockResolvedValue([{ id: "d1", fileName: "rapor.pdf", cloudStoragePath: "tenant/a/rapor.pdf", isPublic: false, response: { question: { text: "Soru" } } }]);
    mocks.url.mockResolvedValue("https://imzali.example/rapor.pdf");
    const response = await GET(request("?assessmentId=as-1"));
    const body = await response.json();
    expect(body).toEqual([{ id: "d1", fileName: "rapor.pdf", downloadUrl: "https://imzali.example/rapor.pdf" }]);
    expect(JSON.stringify(body)).not.toContain("cloudStoragePath");
    expect(mocks.url).toHaveBeenCalledWith("tenant/a/rapor.pdf", false);
  });
  it("değerlendirme seçilmeden ve yetkisiz değerlendirmede belge vermez", async () => {
    expect((await GET(request())).status).toBe(400);
    mocks.documents.mockRejectedValue(new ManagedAssessmentError("Bu değerlendirmeye erişiminiz yok."));
    expect((await GET(request("?assessmentId=baska"))).status).toBe(403);
  });
});
