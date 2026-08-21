"use client";

import { useEffect, useState } from "react";

/**
 * Tuvale çizen grafikler için tema köprüsü.
 *
 * `<canvas>` `var(--…)` anlamaz; renkler kök öğeden okunup gerçek değere
 * çevrilmek zorunda. Tema değiştiğinde bu değerler değişir ama tuval kendini
 * yeniden çizmez — bu kanca `data-theme` değişimini izler ve her değişimde
 * artan bir sayaç döndürür. Grafikler onu bağımlılık listesine koyar.
 */
export function useThemeVersion() {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const target = document.documentElement;
    const observer = new MutationObserver(() => setVersion((v) => v + 1));
    observer.observe(target, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  return version;
}

/** Kök öğedeki bir CSS değişkenini okur; yoksa yedeği döndürür. */
export function readToken(name: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}
