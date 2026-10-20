import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { ManagedAssessmentError } from "@/lib/managed-assessment";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), load: vi.fn(), update: vi.fn() }));
vi.mock("@/lib/api-utils", () => ({ withAuth: mocks.auth }));
vi.mock("@/lib/unit-management", () => ({ loadUnitManagementDashboard: mocks.load, updateManagedEmployeeCount: mocks.update }));
import { GET, PATCH } from "./route";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ success: true, userId: "manager", user: { role: "UNIT_MANAGER" } });
  mocks.load.mockResolvedValue({ selection: { unitId: "unit-a" } }); mocks.update.mockResolvedValue({ id: "unit-a", employeeCount: 10 });
});
describe("birim yönetim API'si", () => {
  it("okuma ve yazmada yönetici rolünü doğrular", async () => {
    mocks.auth.mockResolvedValue({ success: false, response: NextResponse.json({ error: "Yetkiniz yok." }, { status: 403 }) });
    expect((await GET(new NextRequest("http://localhost/api/unit-manager/management"))).status).toBe(403);
    expect((await PATCH(new NextRequest("http://localhost/api/unit-manager/management", { method: "PATCH" }))).status).toBe(403);
    expect(mocks.auth).toHaveBeenCalledWith(expect.anything(), { requireUnitManager: true });
    expect(mocks.load).not.toHaveBeenCalled(); expect(mocks.update).not.toHaveBeenCalled();
  });
  it("birim, anket ve dönemi doğrulanan servise geçirir", async () => {
    const response = await GET(new NextRequest("http://localhost/api/unit-manager/management?unitId=unit-a&surveyId=s1&periodId=p1"));
    expect(response.status).toBe(200);
    expect(mocks.load).toHaveBeenCalledWith(expect.objectContaining({ userId: "manager" }), { unitId: "unit-a", surveyId: "s1", periodId: "p1" });
  });
  it("kapsam dışı birimi boş veri gibi göstermeden 403 döner", async () => {
    mocks.load.mockRejectedValue(new ManagedAssessmentError("Bu birime erişiminiz yok."));
    expect((await GET(new NextRequest("http://localhost/api/unit-manager/management?unitId=outside"))).status).toBe(403);
  });
  it("profil değişikliğini yetkili servise geçirir", async () => {
    const response = await PATCH(new NextRequest("http://localhost/api/unit-manager/management", { method: "PATCH", body: JSON.stringify({ unitId: "unit-a", employeeCount: 10 }) }));
    expect(response.status).toBe(200); expect(mocks.update).toHaveBeenCalledWith(expect.anything(), { unitId: "unit-a", employeeCount: 10 });
  });
  it("bozuk JSON ile profil güncellemez", async () => {
    expect((await PATCH(new NextRequest("http://localhost/api/unit-manager/management", { method: "PATCH", body: "{" }))).status).toBe(400);
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
