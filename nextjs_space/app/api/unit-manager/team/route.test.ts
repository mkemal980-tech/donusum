import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  prisma: {
    assessment: { findMany: vi.fn() },
    unit: { findMany: vi.fn() },
  },
  getManagedUnitIds: vi.fn(),
  withAuth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/api-utils", () => ({ withAuth: mocks.withAuth }));
vi.mock("@/lib/assessment", () => ({ getManagedUnitIds: mocks.getManagedUnitIds }));

import { GET } from "./route";

const request = () => new NextRequest("http://localhost/api/unit-manager/team");

describe("GET /api/unit-manager/team", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.withAuth.mockResolvedValue({
      success: true,
      userId: "mgr-1",
      user: { role: "UNIT_MANAGER" },
    });
    mocks.prisma.assessment.findMany.mockResolvedValue([]);
  });

  it("değerlendirmesi olmayan birimi de listeler", async () => {
    /**
     * Asıl hata buydu: birim özeti değerlendirme satırlarından türetiliyor ve
     * satırı olmayan birim eleniyordu. Yeni kurulmuş bir kuruluşun yöneticisi
     * ekranda "Yönettiğiniz birim yok" görüyor, yönetici panosunda ise aynı
     * kişi o birimin yöneticisi olarak listeleniyordu.
     */
    mocks.getManagedUnitIds.mockResolvedValue(["unit-1"]);
    mocks.prisma.unit.findMany.mockResolvedValue([
      { id: "unit-1", name: "Tersane2026", description: null },
    ]);

    const body = await (await GET(request())).json();

    expect(body.units).toHaveLength(1);
    expect(body.units[0]).toMatchObject({
      id: "unit-1",
      name: "Tersane2026",
      assessmentCount: 0,
      startedCount: 0,
      averageScore: 0,
    });
  });

  it("birim adını Unit kaydından okur, değerlendirme satırından değil", async () => {
    mocks.getManagedUnitIds.mockResolvedValue(["unit-1"]);
    mocks.prisma.unit.findMany.mockResolvedValue([
      { id: "unit-1", name: "Gerçek Ad", description: "Açıklama" },
    ]);
    mocks.prisma.assessment.findMany.mockResolvedValue([
      {
        id: "a1",
        unit: { id: "unit-1", name: "Eski Ad" },
        survey: { id: "s1", name: "Anket" },
        responses: [],
      },
    ]);

    const body = await (await GET(request())).json();

    expect(body.units[0].name).toBe("Gerçek Ad");
    expect(body.units[0].description).toBe("Açıklama");
  });

  it("başlanan değerlendirmeyi sayar", async () => {
    mocks.getManagedUnitIds.mockResolvedValue(["unit-1"]);
    mocks.prisma.unit.findMany.mockResolvedValue([
      { id: "unit-1", name: "Tersane2026", description: null },
    ]);
    mocks.prisma.assessment.findMany.mockResolvedValue([
      {
        id: "a1",
        unit: { id: "unit-1", name: "Tersane2026" },
        survey: { id: "s1", name: "Anket" },
        responses: [
          { score: 4, updatedAt: new Date(), answeredById: "u1", question: { weight: 1 } },
        ],
      },
      {
        id: "a2",
        unit: { id: "unit-1", name: "Tersane2026" },
        survey: { id: "s2", name: "Anket 2" },
        responses: [],
      },
    ]);

    const body = await (await GET(request())).json();

    expect(body.units[0]).toMatchObject({ assessmentCount: 2, startedCount: 1 });
  });

  it("hiç birim yönetmeyen kullanıcıya 403 döner", async () => {
    mocks.getManagedUnitIds.mockResolvedValue([]);

    const response = await GET(request());

    expect(response.status).toBe(403);
    expect(mocks.prisma.unit.findMany).not.toHaveBeenCalled();
  });

  it("UnitAdmin kaydı olmayan yönetici için kapsam daraltılmaz", async () => {
    mocks.withAuth.mockResolvedValue({
      success: true,
      userId: "admin-1",
      user: { role: "ADMIN" },
    });
    mocks.getManagedUnitIds.mockResolvedValue([]);
    mocks.prisma.unit.findMany.mockResolvedValue([]);

    await GET(request());

    // `in: []` sessizce boş ekran veriyordu.
    expect(mocks.prisma.assessment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { unitId: { not: null } } })
    );
  });
});
