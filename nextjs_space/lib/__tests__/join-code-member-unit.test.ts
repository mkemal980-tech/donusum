import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  unitJoinCode: { findUnique: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ prisma: mocks }));

import { resolveJoinCodeProfile } from "../organization-join-code-server";

const base = {
  id: "code-1",
  unitId: "root-1",
  createdById: "mgr-1",
  isActive: true,
  expiresAt: null,
  maxUses: null,
  useCount: 0,
  survey: null,
  unit: {
    id: "root-1",
    name: "Tersane2026",
    sectorId: null,
    subSectorId: null,
    sector: null,
    subSector: null,
  },
};

describe("resolveJoinCodeProfile — iki kod türü", () => {
  beforeEach(() => vi.clearAllMocks());

  it("yapı seviyesi kodda profil kodun kendisinden gelir", async () => {
    /**
     * Kök birimin sektörü yok ve olması da gerekmiyor: kod kendi profilini
     * taşıyor, açılacak her şirkete o aktarılıyor.
     */
    mocks.unitJoinCode.findUnique.mockResolvedValue({
      ...base,
      createsMemberUnit: true,
      sectorId: "sector-c",
      subSectorId: "sub-30-1",
      sector: { name: "İmalat" },
      subSector: { name: "[30.1] Gemi inşası" },
    });

    const result = await resolveJoinCodeProfile("BRM-ABCD-2345");

    expect(result.error).toBeNull();
    expect(result.profile).toMatchObject({ sectorId: "sector-c", subSectorId: "sub-30-1" });
  });

  it("yapı seviyesi kodda sektör yoksa reddeder", async () => {
    mocks.unitJoinCode.findUnique.mockResolvedValue({
      ...base,
      createsMemberUnit: true,
      sectorId: null,
      subSectorId: null,
      sector: null,
      subSector: null,
    });

    const result = await resolveJoinCodeProfile("BRM-ABCD-2345");

    expect(result.profile).toBeNull();
    expect(result.error).toContain("sektör profili eksik");
  });

  it("üye kuruluş kodunda profil kuruluşun kendi alanından gelir", async () => {
    mocks.unitJoinCode.findUnique.mockResolvedValue({
      ...base,
      createsMemberUnit: false,
      sectorId: null,
      subSectorId: null,
      sector: null,
      subSector: null,
      unit: {
        id: "member-1",
        name: "X Tersanesi",
        sectorId: "sector-c",
        subSectorId: null,
        sector: { name: "İmalat" },
        subSector: null,
      },
    });

    const result = await resolveJoinCodeProfile("BRM-ABCD-2345");

    expect(result.error).toBeNull();
    expect(result.profile).toMatchObject({ sectorId: "sector-c" });
  });

  it("kodun kendi sektörü, üye kuruluş kodunda kullanılmaz", async () => {
    // Karışmasın: üye kuruluş kodunda kaynak her zaman kuruluştur.
    mocks.unitJoinCode.findUnique.mockResolvedValue({
      ...base,
      createsMemberUnit: false,
      sectorId: "sector-yanlis",
      subSectorId: null,
      sector: { name: "Yanlış" },
      subSector: null,
      unit: {
        id: "member-1",
        name: "X Tersanesi",
        sectorId: "sector-dogru",
        subSectorId: null,
        sector: { name: "Doğru" },
        subSector: null,
      },
    });

    const result = await resolveJoinCodeProfile("BRM-ABCD-2345");
    expect(result.profile).toMatchObject({ sectorId: "sector-dogru" });
  });
});
