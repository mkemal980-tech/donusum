import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * Kural 2: kademeli öneride puan her zaman 0 — ekran ne gönderirse göndersin.
 */

const mocks = vi.hoisted(() => ({
  prisma: {
    question: { findUnique: vi.fn() },
    recommendation: { create: vi.fn(), update: vi.fn(), findMany: vi.fn() },
  },
  withAuth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/api-utils", () => ({ withAuth: mocks.withAuth }));

import { POST, PUT } from "./route";

const send = (method: "POST" | "PUT", body: unknown) =>
  (method === "POST" ? POST : PUT)(
    new NextRequest("http://localhost/api/admin/recommendations", { method, body: JSON.stringify(body) })
  );

describe("/api/admin/recommendations — puan kuralı", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.withAuth.mockResolvedValue({ success: true, userId: "admin-1", user: { role: "ADMIN" } });
    mocks.prisma.question.findUnique.mockResolvedValue({ id: "q1" });
    mocks.prisma.recommendation.create.mockImplementation(async ({ data }: any) => ({ id: "new", ...data }));
    mocks.prisma.recommendation.update.mockImplementation(async ({ data }: any) => ({ id: "r1", ...data }));
  });

  it("kademeli öneri 0.5 puanla gönderilse de 0 ile saklanır (POST)", async () => {
    await send("POST", { title: "A", questionId: "q1", triggerMaxAnswerScore: 2, points: 0.5 });
    expect(mocks.prisma.recommendation.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ triggerMaxAnswerScore: 2, points: 0 }) })
    );
  });

  it("kademeli öneri düzenlenince eşiği korunur ve puanı 0 kalır (PUT)", async () => {
    // Bağımsız admin sayfası eskiden `points || 0.5` gönderip eşiği düşürüyordu.
    await send("PUT", { id: "r1", title: "A", questionId: "q1", triggerMaxAnswerScore: 1, points: 0.5 });
    expect(mocks.prisma.recommendation.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ triggerMaxAnswerScore: 1, points: 0 }) })
    );
  });

  it("kademesiz öneride puan 0-2 aralığına kırpılır, boşsa 0.5", async () => {
    await send("POST", { title: "A", points: 7 });
    expect(mocks.prisma.recommendation.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ points: 2, triggerMaxAnswerScore: null }) })
    );

    await send("POST", { title: "B" });
    expect(mocks.prisma.recommendation.create).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ points: 0.5 }) })
    );

    await send("POST", { title: "C", points: 0 });
    expect(mocks.prisma.recommendation.create).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ points: 0 }) })
    );
  });

  it("soru geçersizse eşik düşer ve öneri kademesiz sayılır", async () => {
    mocks.prisma.question.findUnique.mockResolvedValue(null);
    await send("POST", { title: "A", questionId: "yok", triggerMaxAnswerScore: 2, points: 1 });
    expect(mocks.prisma.recommendation.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ questionId: null, triggerMaxAnswerScore: null, points: 1 }) })
    );
  });
});
