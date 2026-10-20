import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ session: vi.fn(), user: vi.fn(), redirect: vi.fn() }));
vi.mock("next-auth", () => ({ getServerSession: mocks.session }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("../auth-options", () => ({ authOptions: {} }));
vi.mock("../db", () => ({ prisma: { user: { findUnique: mocks.user } } }));
import { redirectUnitMemberToDashboard } from "../dashboard-redirect";

beforeEach(() => vi.clearAllMocks());

describe("eski öneri ve yol haritası sayfaları", () => {
  it("birime bağlı kullanıcıyı panodaki sekmeye gönderir; birimi veritabanından okur", async () => {
    mocks.session.mockResolvedValue({ user: { id: "u1", unitId: null } });
    mocks.user.mockResolvedValue({ role: "USER", unitId: "unit-1" });
    await redirectUnitMemberToDashboard("roadmap");
    expect(mocks.redirect).toHaveBeenCalledWith("/dashboard?tab=roadmap");
    expect(mocks.user).toHaveBeenCalledWith({ where: { id: "u1" }, select: { role: true, unitId: true } });
  });
  it("birimi olmayan kullanıcı, yönetici ve oturumsuz istek sayfada kalır", async () => {
    mocks.session.mockResolvedValue({ user: { id: "u1", unitId: "stale" } });
    mocks.user.mockResolvedValue({ role: "USER", unitId: null });
    await redirectUnitMemberToDashboard("recommendations");
    mocks.user.mockResolvedValue({ role: "ADMIN", unitId: "unit-1" });
    await redirectUnitMemberToDashboard("recommendations");
    mocks.session.mockResolvedValue(null);
    await redirectUnitMemberToDashboard("recommendations");
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(mocks.user).toHaveBeenCalledTimes(2);
  });
});
