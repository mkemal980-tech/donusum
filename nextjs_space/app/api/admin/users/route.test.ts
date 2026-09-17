import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  prisma: {
    user: { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn(), update: vi.fn(), delete: vi.fn() },
    surveyResponse: { count: vi.fn() },
  },
  withAuth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/api-utils", () => ({
  withAuth: mocks.withAuth,
  validators: { password: () => ({ valid: true }), email: () => true },
  logError: vi.fn(),
}));
vi.mock("bcryptjs", () => ({ default: { hash: vi.fn(async () => "hash") } }));

import { DELETE, GET } from "./route";

const del = (query: string) =>
  DELETE(new NextRequest(`http://localhost/api/admin/users?${query}`, { method: "DELETE" }));

describe("DELETE /api/admin/users", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.withAuth.mockResolvedValue({ success: true, userId: "admin-1", user: { role: "ADMIN" } });
    mocks.prisma.user.count.mockResolvedValue(1);
    mocks.prisma.user.update.mockResolvedValue({});
    mocks.prisma.user.delete.mockResolvedValue({});
  });

  it("varsayılan olarak siler değil, devre dışı bırakır", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({ role: "USER", isActive: true });

    const body = await (await del("id=u1")).json();

    expect(body).toMatchObject({ success: true, deactivated: true });
    expect(mocks.prisma.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { isActive: false },
    });
    expect(mocks.prisma.user.delete).not.toHaveBeenCalled();
  });

  it("zaten devre dışı hesabı tekrar devre dışı bırakmaz", async () => {
    /**
     * Eskiden sessizce başarı dönüyordu; yönetici "sildim ama silinmedi"
     * görüyordu çünkü ekranda hiçbir şey değişmiyordu.
     */
    mocks.prisma.user.findUnique.mockResolvedValue({ role: "USER", isActive: false });

    const response = await del("id=u1");

    expect(response.status).toBe(409);
    expect(mocks.prisma.user.update).not.toHaveBeenCalled();
  });

  it("permanent=true ile gerçekten siler", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({ role: "USER", isActive: true });

    const body = await (await del("id=u1&permanent=true")).json();

    expect(body).toMatchObject({ success: true, deleted: true });
    expect(mocks.prisma.user.delete).toHaveBeenCalledWith({ where: { id: "u1" } });
  });

  it("kendi hesabını kapatamaz", async () => {
    const response = await del("id=admin-1");
    expect(response.status).toBe(400);
  });

  it("son yöneticiyi kapatamaz", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({ role: "ADMIN", isActive: true });
    mocks.prisma.user.count.mockResolvedValue(0); // başka aktif yönetici yok

    const response = await del("id=u1");

    expect(response.status).toBe(409);
    expect(mocks.prisma.user.update).not.toHaveBeenCalled();
  });

  it("yönetici olmayan silemez", async () => {
    mocks.withAuth.mockResolvedValue({
      success: false,
      response: new Response(null, { status: 403 }),
    });
    const response = await del("id=u1");
    expect(response.status).toBe(403);
  });
});

describe("GET /api/admin/users?action=delete-impact", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.withAuth.mockResolvedValue({ success: true, userId: "admin-1", user: { role: "ADMIN" } });
  });

  it("neyin silineceğini sayar", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({
      id: "u1",
      email: "a@b.test",
      firstName: "Ali",
      lastName: null,
      role: "USER",
      isActive: true,
      _count: { ownedAssessments: 2, uploadedDocuments: 3, authoredResponses: 7 },
    });
    mocks.prisma.surveyResponse.count.mockResolvedValue(41);

    const body = await (
      await GET(new NextRequest("http://localhost/api/admin/users?action=delete-impact&id=u1"))
    ).json();

    expect(body.impact).toEqual({
      assessments: 2,
      responses: 41,
      authoredElsewhere: 7,
      documents: 3,
    });
  });

  it("olmayan kullanıcı için 404", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue(null);
    const response = await GET(
      new NextRequest("http://localhost/api/admin/users?action=delete-impact&id=yok")
    );
    expect(response.status).toBe(404);
  });
});
