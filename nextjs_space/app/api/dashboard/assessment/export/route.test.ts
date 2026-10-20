import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { assessmentView } from "@/test-fixtures/unit-dashboard";

const mocks = vi.hoisted(() => ({ view: vi.fn() }));
vi.mock("@/lib/api-utils", () => ({ withAuth: async () => ({ success: true, userId: "member-1", user: { role: "USER" } }) }));
vi.mock("@/lib/assessment-view", () => ({ loadAssessmentView: mocks.view }));
import { GET } from "./route";

const request = (query: string) => new NextRequest("http://localhost/api/dashboard/assessment/export?" + query);
beforeEach(() => vi.clearAllMocks());

describe("pano raporu", () => {
  it("değerlendirme ve biçim seçilmeden rapor üretmez", async () => {
    expect((await GET(request("format=html"))).status).toBe(400);
    expect((await GET(request("assessmentId=as-1&format=csv"))).status).toBe(400);
    expect(mocks.view).not.toHaveBeenCalled();
  });
  it("PDF için HTML'i herkese ekrandaki görünümden üretir", async () => {
    mocks.view.mockResolvedValue(assessmentView(undefined, "member"));
    const response = await GET(request("assessmentId=as-1&format=html"));
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("Esra&#39;nın birimi");
    expect(mocks.view).toHaveBeenCalledWith(expect.objectContaining({ userId: "member-1" }), "as-1");
  });
  it("ayrıntılı Excel'i yalnızca yöneticiye verir", async () => {
    mocks.view.mockResolvedValue(assessmentView(undefined, "member"));
    expect((await GET(request("assessmentId=as-1&format=xlsx"))).status).toBe(403);
    mocks.view.mockResolvedValue(assessmentView());
    const response = await GET(request("assessmentId=as-1&format=xlsx"));
    expect(response.status).toBe(200);
    const workbook = XLSX.read(Buffer.from(await response.arrayBuffer()), { type: "buffer" });
    expect(workbook.SheetNames).toContain("Cevaplar");
  });
});
