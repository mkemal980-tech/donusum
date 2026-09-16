import { describe, expect, it } from "vitest";
import {
  generateJoinCode,
  hashJoinCode,
  joinCodePreview,
  joinCodeUnavailableReason,
  normalizeJoinCode,
} from "@/lib/organization-join-code";

describe("organization join codes", () => {
  it("kodu ayraçlardan bağımsız normalize edip aynı özete dönüştürür", () => {
    expect(normalizeJoinCode(" brm-abcd-2345 ")).toBe("BRMABCD2345");
    expect(hashJoinCode("BRM-ABCD-2345")).toBe(hashJoinCode("brm abcd 2345"));
    expect(joinCodePreview("BRM-ABCD-2345")).toBe("BRM-••••-2345");
  });

  it("tahmin edilmesi zor ve okunabilir biçimde kod üretir", () => {
    const first = generateJoinCode();
    const second = generateJoinCode();
    expect(first).toMatch(/^BRM-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    expect(second).not.toBe(first);
  });

  it("iptal, süre ve kullanım sınırını reddeder", () => {
    const now = new Date("2026-09-16T12:00:00Z");
    expect(joinCodeUnavailableReason({ isActive: false, expiresAt: null, maxUses: null, useCount: 0 }, now)).toContain("iptal");
    expect(joinCodeUnavailableReason({ isActive: true, expiresAt: new Date("2026-09-15"), maxUses: null, useCount: 0 }, now)).toContain("süresi");
    expect(joinCodeUnavailableReason({ isActive: true, expiresAt: null, maxUses: 2, useCount: 2 }, now)).toContain("sınırı");
    expect(joinCodeUnavailableReason({ isActive: true, expiresAt: null, maxUses: 2, useCount: 1 }, now)).toBeNull();
  });
});
