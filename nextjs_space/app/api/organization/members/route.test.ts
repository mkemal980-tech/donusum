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
    sendMemberAccountInvitation: vi.fn(),
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
  sendMemberAccountInvitation: mocks.sendMemberAccountInvitation,
}));
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
    mocks.sendMemberAccountInvitation.mockResolvedValue({ success: true });
  });

  it("bekleyen daveti günceller, eski atamayı değiştirir ve yeni bağlantı yollar", async () => {
    mocks.prisma.unit.findUnique
      .mockResolvedValueOnce({ id: "tenant-1", name: "Tersane STK" })
      .mockResolvedValueOnce({
        id: "member-2",
        name: "Yeni Tersane",
        users: [{ sectorId: "sector-c", subSectorId: "sub-30-1" }],
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
        passwordResetToken: expect.any(String),
        passwordResetExpires: expect.any(Date),
      }),
    }));
    expect(mocks.tx.unitAdmin.create).toHaveBeenCalledWith({
      data: { unitId: "member-2", userId: "user-1" },
    });
    expect(mocks.sendMemberAccountInvitation).toHaveBeenCalledWith(expect.objectContaining({
      email: "yeni@example.com",
      tenantName: "Tersane STK",
      memberName: "Yeni Tersane",
    }));
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
