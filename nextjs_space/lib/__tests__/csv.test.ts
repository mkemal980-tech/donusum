import { describe, expect, it } from "vitest";
import { csvCell, csvRow } from "../csv";

describe("csvCell", () => {
  it("düz değerleri olduğu gibi bırakır", () => {
    expect(csvCell("Örnek Tersane")).toBe("Örnek Tersane");
    expect(csvCell(42)).toBe("42");
  });

  it("boş değerleri boş hücreye çevirir", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });

  it("virgül, tırnak ve satır sonunu kaçırır", () => {
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('a"b')).toBe('"a""b"');
    expect(csvCell("a\nb")).toBe('"a\nb"');
  });

  it("formül karakterlerini nötrler — Excel enjeksiyonu kapanır", () => {
    // Üye kuruluş adları Excel içe aktarımıyla geliyor; girdi kullanıcıda.
    expect(csvCell("=HYPERLINK(\"http://kotu\")")).toBe("\"'=HYPERLINK(\"\"http://kotu\"\")\"");
    expect(csvCell("+1")).toBe("'+1");
    expect(csvCell("-1+2")).toBe("'-1+2");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
  });

  it("JSON kolonlarını geçerli biçimde tırnaklar", () => {
    // Eskiden tırnaklanmadan dönüyordu ve dosya Excel'de yanlış ayrışıyordu.
    expect(csvCell({ a: 1 })).toBe('"{""a"":1}"');
  });

  it("satırı virgülle birleştirir", () => {
    expect(csvRow(["a", "b,c", null])).toBe('a,"b,c",');
  });
});
