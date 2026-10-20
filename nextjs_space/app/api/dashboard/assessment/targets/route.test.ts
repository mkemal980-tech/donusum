import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ resolve: vi.fn(), save: vi.fn() }));
vi.mock("@/lib/api-utils", () => ({ withAuth: async () => ({ success: true, userId: "u1", user: { role: "UNIT_MANAGER" } }) }));
vi.mock("@/lib/assessment-view", () => ({ resolveViewableAssessment: mocks.resolve }));
vi.mock("@/lib/score-targets", async original => ({ ...(await original<typeof import("@/lib/score-targets")>()), saveAssessmentTargets: mocks.save }));
import { PUT } from "./route";
import { TargetValidationError } from "@/lib/score-targets";

const put = (body: unknown) => PUT(new NextRequest("http://localhost/api/dashboard/assessment/targets", { method: "PUT", body: JSON.stringify(body) }));
beforeEach(() => vi.clearAllMocks());

describe("hedef ucu", () => {
  it("yönetici ya da sahip hedefi açık olan değerlendirmenin sahibine yazar", async () => {
    mocks.resolve.mockResolvedValue({ role: "manager", record: { id: "as-1", surveyId: "s1", unitId: "unit-1" } });
    mocks.save.mockResolvedValue({ overall: { percentage: 70, targetDate: null }, categories: {} });
    const response = await put({ assessmentId: "as-1", overall: { percentage: 70 } });
    expect(response.status).toBe(200);
    expect(mocks.save).toHaveBeenCalledWith("u1", { id: "as-1", surveyId: "s1", unitId: "unit-1" }, { assessmentId: "as-1", overall: { percentage: 70 } });
  });
  it("çalışan hedef koyamaz; geçersiz hedef 400 döner", async () => {
    mocks.resolve.mockResolvedValue({ role: "member", record: {} });
    expect((await put({ assessmentId: "as-1", overall: null })).status).toBe(403);
    expect(mocks.save).not.toHaveBeenCalled();
    mocks.resolve.mockResolvedValue({ role: "owner", record: {} });
    mocks.save.mockRejectedValue(new TargetValidationError("Genel hedefi 0'dan büyük, en çok 100 olmalı."));
    const response = await put({ assessmentId: "as-1", overall: { percentage: 0 } });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Genel hedefi 0'dan büyük, en çok 100 olmalı." });
    expect((await put({})).status).toBe(400);
  });
});
