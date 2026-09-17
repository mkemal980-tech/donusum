import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => {
  const tx = {
    unitJoinCode: { updateMany: vi.fn() },
    user: { create: vi.fn() },
    unitJoinCodeUse: { create: vi.fn() },
    userSurveyAssignment: { create: vi.fn() },
  };
  return {
    tx,
    prisma: {
      user: { findUnique: vi.fn(), create: vi.fn() },
      survey: { findMany: vi.fn() },
      userSurveyAssignment: { createMany: vi.fn() },
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    },
    resolveJoinCodeProfile: vi.fn(),
    sendEmail: vi.fn(),
  };
});

vi.mock("@/lib/db", () => ({
  prisma: mocks.prisma,
  withRetry: (operation: () => Promise<unknown>) => operation(),
}));
vi.mock("@/lib/api-utils", () => ({
  // Kota kontrolü ayrı test ediliyor; burada hep geçirir (null = sınır aşılmadı).
  enforcePublicRateLimit: vi.fn(async () => null),
  checkRateLimit: vi.fn(() => ({ allowed: true, resetIn: 0 })),
  getClientIP: vi.fn(() => "127.0.0.1"),
  validators: {
    email: (value: string) => /^[^@]+@[^@]+\.[^@]+$/.test(value),
    password: () => ({ valid: true }),
  },
}));
vi.mock("@/lib/email", () => ({
  logDevEmailLink: vi.fn(),
  sendEmail: mocks.sendEmail,
  // Şablona gömülen kullanıcı metni artık kaçırılıyor (kimlik avı vektörü).
  escapeHtml: (value: unknown) => String(value ?? ""),
}));
vi.mock("@/lib/organization-join-code-server", () => ({
  resolveJoinCodeProfile: mocks.resolveJoinCodeProfile,
}));

import { POST } from "./route";

function signupRequest(joinCode = "BRM-ABCD-2345") {
  return new NextRequest("http://localhost/api/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "uye@example.com",
      password: "GucluParola1",
      firstName: "Ayşe",
      lastName: "Yılmaz",
      joinCode,
    }),
  });
}

describe("signup with unit join code", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.user.findUnique.mockResolvedValue(null);
    mocks.tx.unitJoinCode.updateMany.mockResolvedValue({ count: 1 });
    mocks.tx.user.create.mockResolvedValue({
      id: "user-1",
      email: "uye@example.com",
      firstName: "Ayşe",
      lastName: "Yılmaz",
    });
    mocks.sendEmail.mockResolvedValue({ success: true });
    mocks.resolveJoinCodeProfile.mockResolvedValue({
      code: {
        id: "code-1",
        createdById: "manager-1",
        unit: { id: "member-1", name: "Örnek Tersane" },
        maxUses: 10,
      },
      profile: { sectorId: "sector-c", subSectorId: "sub-30-1" },
      survey: { id: "survey-1", name: "Olgunluk Anketi" },
      error: null,
    });
  });

  it("kullanıcıyı standart rolle birime bağlar, profili devralır ve kodu atomik tüketir", async () => {
    const response = await POST(signupRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.joinedUnit).toEqual({ id: "member-1", name: "Örnek Tersane" });
    expect(mocks.tx.unitJoinCode.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: "code-1", isActive: true, useCount: { lt: 10 } }),
      data: { useCount: { increment: 1 } },
    }));
    expect(mocks.tx.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        role: "USER",
        unitId: "member-1",
        organization: "Örnek Tersane",
        sectorId: "sector-c",
        subSectorId: "sub-30-1",
      }),
    });
    expect(mocks.tx.unitJoinCodeUse.create).toHaveBeenCalledWith({
      data: { joinCodeId: "code-1", userId: "user-1" },
    });
    expect(mocks.tx.userSurveyAssignment.create).toHaveBeenCalledWith({
      data: { userId: "user-1", surveyId: "survey-1", assignedBy: "manager-1" },
    });
    expect(mocks.prisma.userSurveyAssignment.createMany).not.toHaveBeenCalled();
  });

  it("kod son hakkını başka işlemde tükettiyse kaydı reddeder", async () => {
    mocks.tx.unitJoinCode.updateMany.mockResolvedValue({ count: 0 });

    const response = await POST(signupRequest());

    expect(response.status).toBe(409);
    expect(mocks.tx.user.create).not.toHaveBeenCalled();
  });

  it("geçersiz kodla bağımsız hesap açmaz", async () => {
    mocks.resolveJoinCodeProfile.mockResolvedValue({
      code: null,
      profile: null,
      error: "Katılım kodu geçersiz.",
    });

    const response = await POST(signupRequest());

    expect(response.status).toBe(400);
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe("signup — devre dışı hesabın e-postası", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveJoinCodeProfile.mockResolvedValue({
      code: null,
      profile: null,
      error: null,
    });
  });

  it("devre dışı hesapta sebebi ayrı söyler", async () => {
    /**
     * Hesap devre dışı bırakıldığında kayıt kalıyor ve adres bloke oluyor.
     * Ekran "zaten kayıtlı" deyip giriş / şifre sıfırlama / doğrulama
     * yeniden gönderme öneriyordu; üçü de devre dışı hesapta çalışmaz.
     */
    mocks.prisma.user.findUnique.mockResolvedValue({
      id: "u1",
      email: "uye@example.com",
      isActive: false,
    });

    const response = await POST(
      new NextRequest("http://localhost/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "uye@example.com",
          password: "GucluParola1",
          firstName: "Ayşe",
          sectorId: "sector-1",
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.reason).toBe("email_disabled");
    expect(body.error).toContain("devre dışı");
  });

  it("aktif hesapta eski davranış korunur", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({
      id: "u1",
      email: "uye@example.com",
      isActive: true,
    });

    const response = await POST(
      new NextRequest("http://localhost/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "uye@example.com",
          password: "GucluParola1",
          firstName: "Ayşe",
          sectorId: "sector-1",
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.reason).toBe("email_taken");
  });
});
