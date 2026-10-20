import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { ManagedAssessmentError } from "@/lib/managed-assessment";
import { managementDashboard } from "../../../../../test-fixtures/unit-management";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), load: vi.fn() }));
vi.mock("@/lib/api-utils", () => ({ withAuth: mocks.auth }));
vi.mock("@/lib/unit-management", () => ({ loadUnitManagementDashboard: mocks.load }));
import { GET } from "./route";
beforeEach(() => { vi.resetAllMocks(); mocks.auth.mockResolvedValue({ success: true, userId: "manager", user: { role: "UNIT_MANAGER" } }); mocks.load.mockResolvedValue(managementDashboard()); });
describe("yönetici raporu erişimi", () => {
  it("yönetici olmayan kullanıcı rapor verisine ulaşamaz", async () => {
    mocks.auth.mockResolvedValue({ success: false, response: NextResponse.json({ error: "Yetkiniz yok" }, { status: 403 }) });
    expect((await GET(new NextRequest("http://localhost/api/unit-manager/management/export?format=xlsx"))).status).toBe(403);
    expect(mocks.load).not.toHaveBeenCalled();
  });
  it("başka bir birime ait raporu indirmez", async () => {
    mocks.load.mockRejectedValue(new ManagedAssessmentError("Bu birime erişiminiz yok."));
    expect((await GET(new NextRequest("http://localhost/api/unit-manager/management/export?unitId=outside&format=xlsx"))).status).toBe(403);
  });
  it("seçili birim, anket ve dönemi raporda korur", async () => {
    const response = await GET(new NextRequest("http://localhost/api/unit-manager/management/export?unitId=root&surveyId=survey-1&periodId=period-2026&format=html"));
    expect(response.status).toBe(200); expect(response.headers.get("content-type")).toContain("text/html");
    expect(mocks.load).toHaveBeenCalledWith(expect.anything(), { unitId: "root", surveyId: "survey-1", periodId: "period-2026" });
    expect(await response.text()).toContain("Öneri durumları");
  });
  it("üyesi olmayan birim için grup raporu üretmez", async () => {
    mocks.load.mockResolvedValue({ kind: "member", unitId: "unit-b" });
    expect((await GET(new NextRequest("http://localhost/api/unit-manager/management/export?unitId=unit-b&format=xlsx"))).status).toBe(404);
  });
  it("tanınmayan biçimde veri yüklemez", async () => {
    expect((await GET(new NextRequest("http://localhost/api/unit-manager/management/export?format=csv"))).status).toBe(400);
    expect(mocks.load).not.toHaveBeenCalled();
  });
});
