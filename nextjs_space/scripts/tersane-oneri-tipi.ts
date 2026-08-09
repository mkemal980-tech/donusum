/**
 * Tersane ESG anketi için hazırlanan öneri metinlerinin ortak tipi.
 *
 * Kaynak: "Tersane ESG Olgunluk Anketi (Revize · Kategorili)" belgesi.
 * Belgede her şık için o şıktan sonraki BÜTÜN adımlar tekrar tekrar yazılı;
 * sisteme yalnızca her şıkkın **1. adımı** giriliyor. Kademeli tetikleme
 * gerisini kendisi hallediyor: A şıkkına yazılan öneri yalnızca A'ya,
 * B'ninki A ve B'ye, C'ninki A-B-C'ye, D'ninki herkese görünür. Böylece
 * A seçen kullanıcı dört öneriyi de sırayla görür — belgedeki A bloğunun
 * aynısı — ama metin bir kez yazılır.
 *
 * Alan adları kısa: 284 satırlık veri dosyasında okunabilirliği artırıyor.
 */

export type Vade = "KISA" | "ORTA" | "UZUN";
export type Strateji = "HIZLI_KAZANIM" | "PROJE" | "BUYUK_YATIRIM";
export type Maliyet = "OPEX" | "CAPEX";

export type Oneri = {
  /** Başlık — emir kipi, tek cümle. Belgede yok, metinden türetildi. */
  b: string;
  /** Açıklama — belgedeki "1. adım" metni. */
  a: string;
  /** Vade. Belgede yok; adımın içeriğine göre belirlendi. */
  v: Vade;
  /** Strateji. Belgede yok. */
  s: Strateji;
  /** Maliyet tipi. Belgede yok. */
  m: Maliyet;
  /** Etki (1-10). Belgede yok. */
  e: number;
};

/** Soru numarası (1-71) → şık harfi → öneri. */
export type OneriHaritasi = Record<number, Partial<Record<"A" | "B" | "C" | "D", Oneri>>>;
