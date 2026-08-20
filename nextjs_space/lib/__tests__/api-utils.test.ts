import { describe, it, expect } from "vitest";
import { validators, safeJsonParse } from "../api-utils";

describe("validators.email", () => {
  it("geçerli e-postaları kabul eder", () => {
    expect(validators.email("a@b.com")).toBe(true);
    expect(validators.email("user.name@example.co.uk")).toBe(true);
  });
  it("geçersiz e-postaları reddeder", () => {
    expect(validators.email("a@b")).toBe(false);
    expect(validators.email("no-at-sign")).toBe(false);
    expect(validators.email("a @b.com")).toBe(false);
    expect(validators.email("")).toBe(false);
  });
});

describe("validators.password", () => {
  it("8+ karakter, büyük harf ve rakam gerektirir", () => {
    expect(validators.password("Abcdef12").valid).toBe(true);
  });
  it("kısa şifreyi reddeder", () => {
    const r = validators.password("Ab1");
    expect(r.valid).toBe(false);
    expect(r.message).toContain("8");
  });
  it("büyük harf yoksa reddeder", () => {
    expect(validators.password("abcdef12").valid).toBe(false);
  });
  it("rakam yoksa reddeder", () => {
    expect(validators.password("Abcdefgh").valid).toBe(false);
  });
});

describe("validators.sanitizeString", () => {
  it("boşlukları kırpar ve uzunluğu sınırlar", () => {
    expect(validators.sanitizeString("  merhaba  ")).toBe("merhaba");
    expect(validators.sanitizeString("x".repeat(2000), 10)).toHaveLength(10);
  });
  it("boş/undefined güvenli", () => {
    expect(validators.sanitizeString("")).toBe("");
    // @ts-expect-error runtime null güvenliği
    expect(validators.sanitizeString(null)).toBe("");
  });
});

describe("validators.isValidId (CUID)", () => {
  it("geçerli CUID kabul eder", () => {
    expect(validators.isValidId("c" + "a".repeat(24))).toBe(true);
  });
  it("geçersiz id reddeder", () => {
    expect(validators.isValidId("123")).toBe(false);
    expect(validators.isValidId("not-a-cuid")).toBe(false);
  });
});

describe("validators.fileSize / fileType", () => {
  it("10MB sınırını uygular", () => {
    expect(validators.fileSize(5 * 1024 * 1024)).toBe(true);
    expect(validators.fileSize(11 * 1024 * 1024)).toBe(false);
  });
  it("wildcard ve tam MIME eşleşmesi", () => {
    expect(validators.fileType("image/png", ["image/*"])).toBe(true);
    expect(validators.fileType("application/pdf", ["application/pdf"])).toBe(true);
    expect(validators.fileType("text/html", ["image/*", "application/pdf"])).toBe(false);
  });
});

describe("safeJsonParse", () => {
  it("geçerli JSON'u parse eder", () => {
    expect(safeJsonParse('{"a":1}', {})).toEqual({ a: 1 });
  });
  it("bozuk JSON'da fallback döner", () => {
    expect(safeJsonParse("not-json", { fallback: true })).toEqual({ fallback: true });
  });
});
