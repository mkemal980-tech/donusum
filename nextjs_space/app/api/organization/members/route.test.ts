import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => {
  const tx = {
    unitAdmin: { deleteMany: vi.fn(), create: vi.fn() },
    userSurveyAssignment: { deleteMany: vi.fn(), create: vi.fn() },
    user: { update: vi.fn() },
  };
  return {
    tx,
    prisma: {
      unit: { findUnique: vi.fn() },
      user: { findFirst: vi.fn(), delete: vi.fn() },
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    },
    canManageTenantUnit: vi.fn(),
    getDescendantUnitIds: vi.fn(),
    buildMemberAccountInvitation: vi.fn(),
    queueEmails: vi.fn(),
  };
});

vi.mock("@/lib/db", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/api-utils", () => ({
  validators: { email: (value: string) => /^[^@]+@[^@]+\.[^@]+$/.test(value) },
  withAuth: vi.fn(async () => ({
    success: true,
    userId: "manager-1",
    user: { role: "UNIT_MANAGER" },
  })),
}));
vi.mock("@/lib/organization-campaign", () => ({
  canManageTenantUnit: mocks.canManageTenantUnit,
  getDescendantUnitIds: mocks.getDescendantUnitIds,
  getOrganizationRoots: vi.fn(),
}));
vi.mock("@/lib/organization-invitations", () => ({
  // Davet artık kurulup kuyruğa veriliyor; gönderim ayrı bir katmanda.
  buildMemberAccountInvitation: mocks.buildMemberAccountInvitation,
}));
vi.mock("@/lib/email-queue", () => ({ queueEmails: mocks.queueEmails }));
vi.mock("@/lib/scoring", () => ({ getAccessibleSurveyIds: vi.fn(async () => []) }));

import { POST } from "./route";

function actionRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/organization/members", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tenantUnitId: "tenant-1", ...body }),
  });
}

describe("organization pending invitations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.canManageTenantUnit.mockResolvedValue(true);
    mocks.getDescendantUnitIds.mockResolvedValue(["member-1", "member-2"]);
    mocks.prisma.unit.findUnique.mockResolvedValue({ id: "tenant-1", name: "Tersane STK" });
    mocks.buildMemberAccountInvitation.mockImplementation((input: any) => ({
      to: input.email,
      subject: `${input.tenantName} — Dönüşüm Platformu daveti`,
      html: "<p>davet</p>",
      text: "davet",
    }));
    mocks.queueEmails.mockResolvedValue(1);
  });

  it("bekleyen daveti günceller, eski atamayı değiştirir ve yeni bağlantı yollar", async () => {
    mocks.prisma.unit.findUnique
      .mockResolvedValueOnce({ id: "tenant-1", name: "Tersane STK" })
      .mockResolvedValueOnce({
        id: "member-2",
        name: "Yeni Tersane",
        // Sektör profili artık kuruluşun kendi alanı (bkz. migration 000014);
        // eskiden "birimdeki en eski aktif kullanıcı"dan türetiliyordu.
        sectorId: "sector-c",
        subSectorId: "sub-30-1",
      });
    mocks.prisma.user.findFirst
      .mockResolvedValueOnce({
        id: "user-1",
        email: "eski@example.com",
        emailVerified: false,
        unitId: "member-1",
        sectorId: "sector-c",
        subSectorId: "sub-30-1",
      })
      .mockResolvedValueOnce(null);

    const response = await POST(actionRequest({
      action: "update_invitation",
      userId: "user-1",
      memberUnitId: "member-2",
      firstName: "Ayşe",
      lastName: "Yılmaz",
      email: "YENI@EXAMPLE.COM",
      surveyId: "",
      makeUnitManager: true,
    }));

    expect(response.status).toBe(200);
    expect(mocks.tx.userSurveyAssignment.deleteMany).toHaveBeenCalledWith({ where: { userId: "user-1" } });
    expect(mocks.tx.user.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "user-1" },
      data: expect.objectContaining({
        email: "yeni@example.com",
        firstName: "Ayşe",
        unitId: "member-2",
        role: "UNIT_MANAGER",
        sectorId: "sector-c",
        subSectorId: "sub-30-1",
        // Davet artık kendi alanını kullanıyor ve özetlenerek saklanıyor;
        // "şifremi unuttum" bekleyen daveti öldürmüyor (bkz. migration 000015).
        invitationTokenHash: expect.any(String),
        invitationExpires: expect.any(Date),
      }),
    }));
    expect(mocks.tx.unitAdmin.create).toHaveBeenCalledWith({
      data: { unitId: "member-2", userId: "user-1" },
    });
    expect(mocks.buildMemberAccountInvitation).toHaveBeenCalledWith(expect.objectContaining({
      email: "yeni@example.com",
      tenantName: "Tersane STK",
      memberName: "Yeni Tersane",
    }));
    // Gönderim kuyruğa gider, istek içinde beklenmez.
    expect(mocks.queueEmails).toHaveBeenCalledWith([
      expect.objectContaining({ to: "yeni@example.com", dedupeKey: expect.any(String) }),
    ]);
  });

  it("bekleyen daveti siler", async () => {
    mocks.prisma.user.findFirst.mockResolvedValue({ id: "user-1", emailVerified: false });

    const response = await POST(actionRequest({
      action: "delete_invitation",
      userId: "user-1",
    }));

    expect(response.status).toBe(200);
    expect(mocks.prisma.user.delete).toHaveBeenCalledWith({ where: { id: "user-1" } });
  });

  it("etkinleşmiş hesabın davetini silmez", async () => {
    mocks.prisma.user.findFirst.mockResolvedValue({ id: "user-1", emailVerified: true });

    const response = await POST(actionRequest({
      action: "delete_invitation",
      userId: "user-1",
    }));

    expect(response.status).toBe(409);
    expect(mocks.prisma.user.delete).not.toHaveBeenCalled();
  });
});
