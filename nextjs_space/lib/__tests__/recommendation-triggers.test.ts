import { describe, expect, it } from "vitest";
import { supportsCascadeByChoice, triggerChoicesFor } from "../recommendation-triggers";

describe("triggerChoicesFor", () => {
  it("ölçek sorusunda 1-5 puanları verir — anket cevabı bu metinlerle kaydedilir", () => {
    const result = triggerChoicesFor({ type: "SCALE" });

    expect(result.supported).toBe(true);
    if (!result.supported) return;
    expect(result.choices.map((choice) => choice.value)).toEqual(["1", "2", "3", "4", "5"]);
    // Kademeli tetikleme eşiği bu puanlardan hesaplanır.
    expect(result.choices.map((choice) => choice.score)).toEqual([1, 2, 3, 4, 5]);
  });

  it("evet/hayır sorusunda anket ekranının kaydettiği yes/no değerlerini verir", () => {
    // Soru kaydında şık değerleri farklı yazılmış olsa bile tetikleme
    // yes/no ile çalışır; anket ekranı her zaman bunları gönderir.
    const result = triggerChoicesFor({
      type: "YES_NO",
      options: [
        { value: "evet", label: "Evet", score: 5 },
        { value: "hayir", label: "Hayır", score: 1 },
      ],
    });

    expect(result.supported).toBe(true);
    if (!result.supported) return;
    expect(result.choices).toEqual([
      { value: "yes", label: "Evet", score: 5 },
      { value: "no", label: "Hayır", score: 1 },
    ]);
  });

  it("çoktan seçmelide sorunun kendi şık değerlerini verir", () => {
    const result = triggerChoicesFor({
      type: "MULTIPLE_CHOICE",
      options: [
        { value: "takip_yok", label: "Takip yok", score: 1 },
        { value: "entegre_sistem", label: "Entegre sistem", score: 5 },
      ],
    });

    expect(result.supported).toBe(true);
    if (!result.supported) return;
    expect(result.choices).toEqual([
      { value: "takip_yok", label: "Takip yok", score: 1 },
      { value: "entegre_sistem", label: "Entegre sistem", score: 5 },
    ]);
  });

  it("şıksız çoktan seçmelide tetiklemeyi desteklemez", () => {
    const result = triggerChoicesFor({ type: "MULTIPLE_CHOICE", options: [] });

    expect(result.supported).toBe(false);
    if (result.supported) return;
    expect(result.reason).toContain("şık");
  });

  it("kademeli puanlamada tetiklemeyi desteklemez — cevap JSON olarak saklanır", () => {
    const result = triggerChoicesFor({ type: "CONDITIONAL_CHOICE" });

    expect(result.supported).toBe(false);
    if (result.supported) return;
    expect(result.reason).toContain("kademeli tetiklemeyi");
  });

  it("bilinmeyen tipte tetiklemeyi desteklemez", () => {
    expect(triggerChoicesFor({ type: "SOMETHING_ELSE" }).supported).toBe(false);
  });

  it("şık puanı yazılmamışsa 0 kabul eder (kademeli eşik hesabı bozulmasın)", () => {
    const result = triggerChoicesFor({
      type: "MULTIPLE_CHOICE",
      options: [{ value: "a", label: "A" }],
    });

    expect(result.supported).toBe(true);
    if (!result.supported) return;
    expect(result.choices[0].score).toBe(0);
  });

  it("evet/hayır şık puanları yazılmamışsa anket motoruyla aynı varsayılanı verir", () => {
    const result = triggerChoicesFor({ type: "YES_NO" });

    expect(result.supported).toBe(true);
    if (!result.supported) return;
    expect(result.choices.map((choice) => choice.score)).toEqual([5, 1]);
  });
});

describe("supportsCascadeByChoice", () => {
  it("şık listesi kurulabilen tiplerde true döner", () => {
    expect(supportsCascadeByChoice({ type: "SCALE" })).toBe(true);
    expect(
      supportsCascadeByChoice({ type: "MULTIPLE_CHOICE", options: [{ value: "a", score: 1 }] })
    ).toBe(true);
  });

  it("kademeli puanlamada false döner — eşik elle sayı olarak girilir", () => {
    expect(supportsCascadeByChoice({ type: "CONDITIONAL_CHOICE" })).toBe(false);
  });
});
