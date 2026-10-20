import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ profile: vi.fn(), progress: vi.fn(), benchmarks: vi.fn() }));
vi.mock("@/lib/api-utils", () => ({ withAuth: async () => ({ success: true, userId: "u1", user: { role: "USER" } }) }));
vi.mock("@/lib/db", () => ({ prisma: { benchmark: { findMany: mocks.benchmarks }, category: { findMany: async () => [{ id: "cat-e", name: "Çevre" }] } } }));
vi.mock("@/lib/scoring", () => ({ getScoringProfile: mocks.profile, calculateProgressBreakdown: mocks.progress }));
import { GET } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.profile.mockResolvedValue({ sectorId: "unit-sector", subSectorId: null, sector: { id: "unit-sector", name: "Gıda" }, subSector: null });
  mocks.progress.mockResolvedValue({ scores: { overallScore: 3 }, categories: [{ id: "cat-e", totalScore: 3, responseCount: 4 }] });
  mocks.benchmarks.mockResolvedValue([
    { level: "OVERALL", targetId: null, averageScore: 3, bestScore: 4.5 },
    { level: "CATEGORY", targetId: "cat-e", averageScore: 3, bestScore: 4.2 },
  ]);
});

describe("kişisel panodaki sektör kıyası", () => {
  it("soruları puanlayan kuruluşun sektörüyle kıyaslar", async () => {
    const body = await (await GET(new NextRequest("http://localhost/api/benchmarks/user?surveyId=s1"))).json();
    expect(mocks.benchmarks).toHaveBeenCalledWith({ where: { sectorId: "unit-sector", subSectorId: null, surveyId: "s1" } });
    expect(body.sector).toEqual({ id: "unit-sector", name: "Gıda" });
  });
  it("kategoriyi kıyasla aynı 1-5 ölçeğinde verir; %50 sektör ortalamasının altında görünmez", async () => {
    const body = await (await GET(new NextRequest("http://localhost/api/benchmarks/user?surveyId=s1"))).json();
    expect(body.sectorBenchmark.overall).toMatchObject({ userScore: 3, averageScore: 3 });
    expect(body.sectorBenchmark.categories[0]).toMatchObject({ id: "cat-e", userScore: 3, averageScore: 3 });
  });
  it("sektörü olmayan profilde kıyas istemez", async () => {
    mocks.profile.mockResolvedValue({ sectorId: null, subSectorId: null });
    expect(await (await GET(new NextRequest("http://localhost/api/benchmarks/user"))).json()).toMatchObject({ hasSector: false });
    expect(mocks.progress).not.toHaveBeenCalled();
  });
});
