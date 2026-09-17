"use client";

import { useEffect, useRef } from "react";

/**
 * Soru kartının kaydırma çapası.
 *
 * İki işi var ve ikisi de zamanlamaya duyarlı olduğu için kartın kendisine
 * bırakılamaz:
 *
 * 1. Kendini `IntersectionObserver`'a kaydeder. Gözlemi ebeveynden başlatmak
 *    çalışmıyordu: bölüm geçişi `AnimatePresence mode="wait"` ile animasyonlu
 *    ve yeni kartlar, ebeveynin efekti çalıştığında henüz DOM'da olmuyordu.
 *    Kayıt kartın kendi mount'una bağlanınca sorun tanım gereği ortadan kalkıyor.
 *
 * 2. Haritadan gelen sıçramada hedef kart kendini görünür alana getirir.
 *    Ebeveyn "önce adımı değiştir, sonra kaydır" diye bir gecikme tahmin
 *    etmek zorunda kalmıyor.
 */
export default function QuestionAnchor({
  questionId,
  observer,
  scrollOnMount = false,
  onScrolled,
  children,
}: {
  questionId: string;
  observer?: IntersectionObserver | null;
  scrollOnMount?: boolean;
  onScrolled?: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || !observer) return;
    observer.observe(node);
    return () => observer.unobserve(node);
  }, [observer]);

  useEffect(() => {
    if (!scrollOnMount) return;
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    onScrolled?.();
    // onScrolled her boyamada yeniden üretiliyor olabilir; bağımlılığa
    // alınırsa efekt kendini tetikler.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollOnMount]);

  return (
    <div ref={ref} id={`soru-${questionId}`} data-question-id={questionId} className="survey-question-anchor">
      {children}
    </div>
  );
}
