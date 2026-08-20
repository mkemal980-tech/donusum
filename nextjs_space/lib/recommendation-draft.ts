/**
 * AI öneri taslağının prompt'u ve çıktı dönüşümü.
 *
 * Rotadan ayrı durur çünkü iki yerden kullanılır: `/api/admin/recommendations/
 * ai-draft` ve `scripts/check-ai-draft.ts` sağlık kontrolü. Böylece sağlık
 * kontrolü gerçekten üretimdeki prompt'u sınar, benzerini değil.
 *
 * Saf modül — prisma ve ağ bağımlılığı yoktur.
 */

import type { TriggerChoice } from "./recommendation-triggers";
import type { LadderWarning, RecommendationImportRow } from "./recommendation-import";

export const DRAFT_SYSTEM_PROMPT =
  "Sen bir sürdürülebilirlik olgunluk danışmanısın. Bir anket sorusunun her şıkkı için, o şıkkı seçen kurumu BİR ÜST olgunluk basamağına çıkaracak somut bir aksiyon önerisi yazarsın. SADECE geçerli JSON döndür.";

export type DraftedRecommendation = {
  tetikleyici?: string;
  baslik?: string;
  aciklama?: string;
  vade?: string;
  strateji?: string;
  maliyet?: string;
  etki?: number | string;
};

export type DraftResponse = {
  oneriler?: DraftedRecommendation[];
};

export type DraftQuestion = {
  text: string;
  choices: TriggerChoice[];
};

export function buildDraftPrompt(
  question: DraftQuestion,
  sectorName: string,
  pool: string[] = []
): string {
  const ladder = question.choices
    .map((choice, index) => `${index + 1}. "${choice.label}" (olgunluk puanı ${choice.score})`)
    .join("\n");

  const poolBlock = pool.length
    ? `\nSADECE aşağıdaki öneri havuzundan seç. Havuz dışında yeni öneri yazma; uygun olmayan şık için havuzdaki en yakın öneriyi kullan.\nHAVUZ:\n${pool
        .map((entry, index) => `${index + 1}. ${entry}`)
        .join("\n")}\n`
    : "";

  return `Sektör: ${sectorName}

Soru: ${question.text}

Şıklar (en olgunsuz → en olgun):
${ladder}
${poolBlock}
Her şık için bir öneri yaz. Öneri, o şıkkı seçen kurumun bir sonraki basamağa çıkması için yapması gerekeni anlatmalı. En olgun şık için ise mevcut durumu daha da ileri taşıyacak bir aksiyon yaz.

Kurallar:
- "tetikleyici" alanına şıkkın etiketini BİREBİR yaz. Yukarıdaki tırnak içindeki metni harfi harfine kopyala, kendi kelimelerinle değiştirme.
- "baslik" tek cümle, emir kipi, en fazla 12 kelime.
- "aciklama" nasıl yapılacağını anlatan 1-2 cümle.
- "vade": KISA, ORTA veya UZUN
- "strateji": HIZLI_KAZANIM, PROJE veya BUYUK_YATIRIM
- "maliyet": OPEX veya CAPEX
- "etki": 1-10 arası tam sayı
- Olgunluk arttıkça vade uzar ve strateji ağırlaşır.
- Şık sayısı kadar öneri döndür, ne eksik ne fazla.

JSON:
{"oneriler":[{"tetikleyici":"...","baslik":"...","aciklama":"...","vade":"KISA","strateji":"HIZLI_KAZANIM","maliyet":"OPEX","etki":7}]}`;
}

/** Model çıktısını içe aktarma satırına çevirir — Excel satırıyla aynı biçim. */
export function draftToImportRow(
  draft: DraftedRecommendation,
  questionText: string,
  order: number
): RecommendationImportRow {
  return {
    soru_metni: questionText,
    tetikleyici: String(draft.tetikleyici ?? "").trim(),
    // Taslaklar her zaman kademeli kurulur; merdiven kurmak asıl amaç.
    kademeli: "EVET",
    baslik: String(draft.baslik ?? "").trim(),
    aciklama: String(draft.aciklama ?? "").trim(),
    vade: String(draft.vade ?? "").trim().toLocaleUpperCase("tr"),
    strateji: String(draft.strateji ?? "").trim().toLocaleUpperCase("tr"),
    maliyet: String(draft.maliyet ?? "OPEX").trim().toLocaleUpperCase("tr"),
    etki: String(draft.etki ?? ""),
    puan: "",
    video_url: "",
    sira: String(order),
  };
}

/** Havuz eşleştirmesi için başlıkları normalize eder. */
function normalizeTitle(title: string): string {
  return title.trim().toLocaleLowerCase("tr").replace(/\s+/g, " ").replace(/[.!?]+$/, "");
}

/**
 * Havuz verildiğinde modelin gerçekten havuzdan seçtiğini doğrular.
 *
 * Gözlemlenen davranış: prompt "SADECE havuzdan seç" dese bile model zaman
 * zaman kendi başlığını yazıyor. Havuzun varlık sebebi uydurmayı engellemek
 * olduğu için buna prompt'la değil kodla bakılır — uymayan satırlar önizlemede
 * uyarı olarak görünür ve yönetici bilerek onaylar ya da düzeltir.
 *
 * Kullanılmayan havuz maddeleri de bildirilir; genelde o basamağa uygun bir
 * öneri havuzda vardır ama model atlamıştır.
 */
export function checkPoolAdherence(
  rows: RecommendationImportRow[],
  pool: string[],
  questionText: string
): LadderWarning[] {
  if (pool.length === 0) return [];

  const normalizedPool = new Map(pool.map((entry) => [normalizeTitle(entry), entry]));
  const warnings: LadderWarning[] = [];
  const used = new Set<string>();

  const offPool: string[] = [];
  for (const row of rows) {
    const title = (row.baslik ?? "").trim();
    if (!title) continue;
    const key = normalizeTitle(title);
    if (normalizedPool.has(key)) {
      used.add(key);
    } else {
      offPool.push(title);
    }
  }

  if (offPool.length > 0) {
    warnings.push({
      questionText,
      message: `Havuz dışından ${offPool.length} öneri üretildi: ${offPool
        .map((title) => `"${title}"`)
        .join(", ")}. Havuzdaki bir maddeyle değiştirin ya da bilerek onaylayın.`,
    });
  }

  const unused = [...normalizedPool.entries()]
    .filter(([key]) => !used.has(key))
    .map(([, original]) => original);

  if (unused.length > 0 && offPool.length > 0) {
    warnings.push({
      questionText,
      message: `Havuzda kullanılmayan madde(ler): ${unused.map((entry) => `"${entry}"`).join(", ")}`,
    });
  }

  return warnings;
}
