"use client";

import { LensCard } from "@/components/ui/lens-card";

const transformationMetrics = [
  {
    label: "Dijital olgunluk",
    value: "3,7",
    unit: "/5",
    note: "+0,6 sektör ort.",
  },
  {
    label: "Sürdürülebilirlik",
    value: "3,4",
    unit: "/5",
    note: "+0,5 sektör ort.",
  },
  {
    label: "Karbon görünürlüğü",
    value: "%68",
    unit: "",
    note: "Kapsam 1–2 ölçülüyor",
  },
  {
    label: "Enerji verimliliği",
    value: "%24",
    unit: "",
    note: "tasarruf potansiyeli",
  },
  {
    label: "Veri odaklı süreç",
    value: "%72",
    unit: "",
    note: "+18 puan gelişim",
  },
  {
    label: "Öncelikli aksiyon",
    value: "12",
    unit: "",
    note: "5 hızlı kazanım",
  },
] as const;

/** Landing hero'sunda ürünün iki değerlendirme alanını sayılarla örnekler. */
export function LandingTransformationLens() {
  return (
    <div className="landing-lens-wrap">
      <LensCard
        className="landing-lens-card"
        radius={96}
        magnification={1.28}
        chromatic={0.55}
        lag={{ stiffness: 260, damping: 26 }}
        gridBend
        idleDrift
        showRing
        seed={42}
        aria-label="Dijitalleşme ve sürdürülebilirlik dönüşüm göstergeleri"
      >
        <div className="landing-lens-content">
          <div className="landing-lens-head">
            <div>
              <span className="kicker">Dönüşüm radarı</span>
              <h2>Bugünden hedefe</h2>
            </div>
            <span className="tag-outline">Örnek veri</span>
          </div>

          <div className="landing-lens-overall">
            <div>
              <strong>3,6</strong>
              <span>/ 5 bileşik dönüşüm skoru</span>
            </div>
            <span className="landing-lens-delta">↗ +0,6 gelişim alanı</span>
          </div>

          <div className="landing-lens-grid">
            {transformationMetrics.map((metric) => (
              <div key={metric.label} className="landing-lens-metric">
                <p>{metric.label}</p>
                <div>
                  <strong>{metric.value}</strong>
                  {metric.unit && <span>{metric.unit}</span>}
                </div>
                <small>{metric.note}</small>
              </div>
            ))}
          </div>

          <div className="landing-lens-foot">
            <span>ESG + dijital dönüşüm</span>
            <span>Ölç · kıyasla · harekete geç</span>
          </div>
        </div>
      </LensCard>
      <p className="landing-lens-hint">Merceği hareket ettirerek veriyi inceleyin</p>
    </div>
  );
}

export default LandingTransformationLens;
