import { describe, expect, it } from "vitest";
import { createToken, hashToken, tokenMatches } from "../tokens";

describe("tokens", () => {
  it("her çağrıda farklı ve yeterince uzun token üretir", () => {
    const a = createToken();
    const b = createToken();
    expect(a).not.toBe(b);
    expect(a).toHaveLength(64); // 32 bayt hex
  });

  it("özet tek yönlüdür ve token'ın kendisini içermez", () => {
    const token = createToken();
    const hash = hashToken(token);
    expect(hash).not.toBe(token);
    expect(hash).toHaveLength(64);
    expect(hashToken(token)).toBe(hash); // kararlı
  });

  it("doğru token eşleşir", () => {
    const token = createToken();
    expect(tokenMatches(token, hashToken(token))).toBe(true);
  });

  it("yanlış token, boş değer ve tip uyuşmazlığı eşleşmez", () => {
    const token = createToken();
    const hash = hashToken(token);
    expect(tokenMatches(createToken(), hash)).toBe(false);
    expect(tokenMatches("", hash)).toBe(false);
    expect(tokenMatches(token, null)).toBe(false);
    expect(tokenMatches(token, undefined)).toBe(false);
    expect(tokenMatches(null, hash)).toBe(false);
    expect(tokenMatches(123, hash)).toBe(false);
  });

  it("farklı uzunluktaki özet güvenle reddedilir (timingSafeEqual patlamaz)", () => {
    expect(tokenMatches(createToken(), "kisa")).toBe(false);
  });
});
