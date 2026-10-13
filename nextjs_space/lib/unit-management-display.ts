export const QUADRANT_LABELS: Record<string, string> = { IRONMAN: "Demir Adam", SPRINTER: "Sprinter", MARATHON_RUNNER: "Maraton Koşucusu", WALKER: "Yaya" };
export const STRATEGY_LABELS: Record<string, string> = { QUICK_WIN: "Hızlı kazanım", PROJECT: "Proje", BIG_BET: "Büyük yatırım" };
export const PORTFOLIO_STATUS_LABELS: Record<string, string> = { READY: "Hazır", NOT_STARTED: "Başlamadı", PLANNED: "Planlandı", IN_PROGRESS: "Devam ediyor", COMPLETED: "Tamamlandı", CANCELLED: "İptal edildi" };
export const TIMEFRAME_LABELS: Record<string, string> = { SHORT_TERM: "0–6 ay", MEDIUM_TERM: "6–18 ay", LONG_TERM: "18+ ay" };
export const decimal = (value: number | null | undefined) => value == null ? "—" : value.toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
export const percentage = (value: number | null | undefined) => value == null ? "—" : "%" + decimal(value);
export const signed = (value: number | null | undefined) => value == null ? "—" : (value >= 0 ? "+" : "") + decimal(value);
export function esgSymbol(name: string) {
  const normalized = name.toLocaleLowerCase("tr-TR");
  if (/çevre|environment|ekoloji/.test(normalized)) return "E";
  if (/sosyal|social/.test(normalized)) return "S";
  if (/yöneti|yönetim|governance/.test(normalized)) return "G";
  return null;
}

export type IronmanSummary = {
  count: number; velocity: number | null; endurance: number | null; threshold: number;
  benchmarkVelocity: number | null; benchmarkEndurance: number | null;
  targetVelocity: number | null; targetEndurance: number | null;
  quadrant: string | null; distribution: { key: string; count: number }[];
};
const QUADRANT_MEANINGS: Record<string, string> = {
  IRONMAN: "birimler hem hızlı aksiyon alıyor hem de bunu politika ve süreçlerle kalıcı hâle getiriyor.",
  SPRINTER: "birimler hızlı aksiyon alıyor ama politika, süreç ve dokümantasyon geride; kazanımlar kalıcı olmayabilir.",
  MARATHON_RUNNER: "politika ve süreçler sağlam ama aksiyonlar yavaş ilerliyor.",
  WALKER: "iki eksen de henüz eşiğin altında; birimler iç veya dış bir sarsıntıya karşı kırılgan.",
};
const versus = (axis: string, diff: number) =>
  Math.abs(diff) < 0.05 ? `${axis} aynı seviyede` : `${axis} ${decimal(Math.abs(diff))} puan ${diff > 0 ? "önde" : "geride"}`;

/**
 * Ironman kadranının düz Türkçe yorumu.
 *
 * Grafik yalnızca noktaları çiziyordu; kadran adı, kıyas karesi ve hedef
 * halkası açıklamasız kaldığı için yönetici konumun ne anlama geldiğini ve
 * neye öncelik vereceğini okuyamıyordu. Cümleler yalnızca ölçülen değerlerden
 * kurulur; kıyas veya hedef kaydı yoksa o karşılaştırma yapılmaz.
 */
export function ironmanInsight(data: IronmanSummary): { headline: string; points: string[] } {
  const { velocity: v, endurance: e, threshold: t } = data;
  if (v == null || e == null || !data.quadrant) {
    return {
      headline: "Henüz hız ve dayanıklılığın birlikte ölçüldüğü bir değerlendirme yok.",
      points: ["Konum, ankette hız ve dayanıklılık eksenine bağlı sorular cevaplanıp değerlendirmeler gönderildikçe oluşur."],
    };
  }
  const subject = data.count === 1 ? "Tek değerlendirme" : `${data.count} değerlendirmenin ortalaması`;
  const points = [
    `Hız aksiyon alma kapasitesini, dayanıklılık bu aksiyonları politika, süreç ve dokümantasyonla kalıcı kılma olgunluğunu ölçer. İki eksende de ${decimal(t)} eşiği güçlü ile gelişmeli arasındaki sınırdır.`,
  ];

  if (data.benchmarkVelocity != null && data.benchmarkEndurance != null) {
    points.push(`Sektör ortalamasına (hız ${decimal(data.benchmarkVelocity)} · dayanıklılık ${decimal(data.benchmarkEndurance)}) göre ${versus("hızda", v - data.benchmarkVelocity)}, ${versus("dayanıklılıkta", e - data.benchmarkEndurance)}.`);
  } else {
    points.push("Bu kapsamdaki sektörler için kayıtlı Ironman kıyası yok; konum sektöre göre yorumlanamıyor.");
  }

  if (data.targetVelocity != null && data.targetEndurance != null) {
    const target = `Sektörün gelecek yıl için beklenen ortalaması (hız ${decimal(data.targetVelocity)} · dayanıklılık ${decimal(data.targetEndurance)})`;
    const gaps = [["hızda", data.targetVelocity - v], ["dayanıklılıkta", data.targetEndurance - e]] as const;
    const missing = gaps.filter(([, gap]) => gap >= 0.05);
    if (!missing.length) points.push(`${target} iki eksende de şimdiden aşılmış.`);
    else {
      const passed = gaps.length - missing.length ? ` ${missing[0][0] === "hızda" ? "Dayanıklılık" : "Hız"} bu seviyeyi zaten aşmış.` : "";
      points.push(`${target} için ${missing.map(([axis, gap]) => `${axis} ${decimal(gap)} puan`).join(" ve ")} artış gerekiyor.${passed}`);
    }
  }

  const weaker = v <= e ? ["hız", v] as const : ["dayanıklılık", e] as const;
  if (data.quadrant === "IRONMAN") {
    points.push(`Öncelik konumu korumak. Görece zayıf eksen ${weaker[0]} (${decimal(weaker[1])}); ilerleme en çok burada kazanılır.`);
  } else if (data.quadrant === "SPRINTER") {
    points.push("Öncelik dayanıklılık: yapılan işleri yazılı politika, süreç ve ölçümle kalıcı hâle getirmek.");
  } else if (data.quadrant === "MARATHON_RUNNER") {
    points.push("Öncelik hız: hazır politikaları takvimli, sorumlusu belli aksiyonlara dönüştürmek.");
  } else {
    const closer = v >= e ? ["hız", v, "SPRINTER"] as const : ["dayanıklılık", e, "MARATHON_RUNNER"] as const;
    points.push(`Öncelik eşiğe en yakın eksen olan ${closer[0]} (${decimal(closer[1])}): ${decimal(t - closer[1])} puanlık artış birimleri ${QUADRANT_LABELS[closer[2]]} kadranına taşır.`);
  }

  const occupied = data.distribution.filter(item => item.count > 0);
  if (occupied.length > 1) {
    const walkers = data.distribution.find(item => item.key === "WALKER")?.count ?? 0;
    points.push(`Ortalama dağılımı gizler: ${occupied.map(item => `${QUADRANT_LABELS[item.key]} ${item.count}`).join(" · ")} değerlendirme.${walkers && data.quadrant !== "WALKER" ? " Yaya kadranındaki birimler ayrıca ele alınmalı." : ""}`);
  }
  if (data.count < 3) points.push(`Yorum yalnızca ${data.count} değerlendirmeye dayanıyor; daha çok birim gönderdikçe netleşir.`);

  return { headline: `${subject} ${QUADRANT_LABELS[data.quadrant]} kadranında: ${QUADRANT_MEANINGS[data.quadrant]}`, points };
}
