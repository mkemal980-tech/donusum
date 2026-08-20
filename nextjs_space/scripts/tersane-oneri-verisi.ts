/**
 * Tersane ESG Olgunluk Anketi (Revize · Kategorili) — 71 soru × 4 şık = 284 öneri.
 *
 * Öneri metni (aciklama) belgedeki "1. adım" cümlesinden birebir alınır; kaynağı
 * `tersane-adim1.json` dosyasıdır. Buradaki `a` alanı okunabilirlik için tutulur,
 * derleyici metni JSON'dan okur. Başlık (b), vade (v), strateji (s), maliyet (m)
 * ve etki (e) alanları belgede yoktur; bunlar tarafımızca önerilmiştir.
 */

import type { OneriHaritasi } from "./tersane-oneri-tipi";
import { BOLUM_01 } from "./tersane-oneri-verisi-01";
import { BOLUM_02 } from "./tersane-oneri-verisi-02";
import { BOLUM_03 } from "./tersane-oneri-verisi-03";
import { BOLUM_04 } from "./tersane-oneri-verisi-04";
import { BOLUM_05 } from "./tersane-oneri-verisi-05";

export const ONERILER: OneriHaritasi = {
  ...BOLUM_01,
  ...BOLUM_02,
  ...BOLUM_03,
  ...BOLUM_04,
  ...BOLUM_05,
};
