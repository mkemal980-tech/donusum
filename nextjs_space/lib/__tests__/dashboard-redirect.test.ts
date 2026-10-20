import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ session: vi.fn(), redirect: vi.fn() }));
vi.mock("next-auth", () => ({ getServerSession: mocks.session }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("../auth-options", () => ({ authOptions: {} }));
import { redirectToDashboardTab } from "../dashboard-redirect";

beforeEach(() => vi.clearAllMocks());

describe("eski öneri ve yol haritası sayfaları", () => {
  it("oturum açmış kullanıcıyı panodaki sekmeye gönderir", async () => {
    mocks.session.mockResolvedValue({ user: { id: "u1" } });
    await redirectToDashboardTab("roadmap");
    expect(mocks.redirect).toHaveBeenCalledWith("/dashboard?tab=roadmap");
  });
  it("oturumsuz istek sayfada kalır; giriş yönlendirmesini sayfa yapar", async () => {
    mocks.session.mockResolvedValue(null);
    await redirectToDashboardTab("recommendations");
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
