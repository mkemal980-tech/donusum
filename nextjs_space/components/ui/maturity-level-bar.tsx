"use client";

import { motion } from "framer-motion";

interface MaturityLevelBarProps {
  score: number; // 0-100 percentage or 1-5 score
  isPercentage?: boolean; // if true, converts from percentage to 1-5
}

const levels = [
  { label: "Lider", value: 5, minPercent: 80, color: "var(--level-5)" },
  { label: "Olgun", value: 4, minPercent: 60, color: "var(--level-4)" },
  { label: "Gelişen", value: 3, minPercent: 40, color: "var(--level-3)" },
  { label: "Farkındalık", value: 2, minPercent: 20, color: "var(--level-2)" },
  { label: "Başlangıç", value: 1, minPercent: 0, color: "var(--level-1)" },
];

export function MaturityLevelBar({ score, isPercentage = true }: MaturityLevelBarProps) {
  // Convert percentage to 1-5 score if needed
  const scoreOn5 = isPercentage ? (score / 100) * 4 + 1 : score;
  const percentage = isPercentage ? score : ((score - 1) / 4) * 100;
  
  // Determine current level
  const getCurrentLevel = () => {
    if (percentage >= 80) return levels[0]; // Lider
    if (percentage >= 60) return levels[1]; // Olgun
    if (percentage >= 40) return levels[2]; // Gelişen
    if (percentage >= 20) return levels[3]; // Farkındalık
    return levels[4]; // Başlangıç
  };
  
  const currentLevel = getCurrentLevel();
  
  // Calculate position (0-100% from bottom)
  const barPosition = Math.min(100, Math.max(0, percentage));
  
  return (
    <div className="flex flex-col items-center h-full">
      <h4 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Seviyelendirme</h4>
      
      {/* Current Level Badge */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-4 px-6 py-2 rounded-full text-white font-semibold text-lg"
        style={{ backgroundColor: currentLevel.color }}
      >
        {currentLevel.label}
      </motion.div>
      
      <div className="flex items-start gap-4">
        {/* Levels Labels — yükseklik çubukla aynı, satırlar basamaklara denk gelsin */}
        <div className="flex flex-col justify-between h-64 py-1">
          {levels.map((level) => (
            <div key={level.value} className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: level.color }}
              />
              <span className="text-sm font-medium text-[var(--text-secondary)] w-24">
                {level.label}
              </span>
              <span className="text-sm font-bold text-[var(--text-primary)] w-4">
                {level.value}
              </span>
            </div>
          ))}
        </div>
        
        {/*
          Puan göstergesi daire değil, çubuğu enine kesen ince bir çizgi ve
          yanında sayı. Daire hem kaydırıcı çağrışımı yapıyor ("buraya
          tıklanır") hem de çubuğun içine sığmak için küçülünce okunmuyordu.
          Çizgi konumu tam gösterir, sayı okunur boyutta yanda durur.
        */}
        <div className="relative h-64 w-12">
          <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-12 rounded-full overflow-hidden bg-[var(--border-light)]">
            {/* Gradient Background */}
            <div
              className="absolute inset-x-0 bottom-0"
              style={{
                background: "linear-gradient(to top, var(--level-1), var(--level-2), var(--level-3), var(--level-4), var(--level-5))",
                height: "100%",
                opacity: 0.3
              }}
            />

            {/* Filled Progress */}
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: `${barPosition}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
              className="absolute inset-x-0 bottom-0 rounded-full"
              style={{
                background: "linear-gradient(to top, var(--level-1), var(--level-2), var(--level-3), var(--level-4), var(--level-5))",
              }}
            />

            {/* Level Markers */}
            <div className="absolute inset-0 flex flex-col justify-between py-3">
              {[5, 4, 3, 2, 1].map((val) => (
                <div key={val} className="w-full flex items-center justify-center">
                  <div className="w-2 h-0.5 bg-[var(--bg-card)]/40" />
                </div>
              ))}
            </div>
          </div>

          {/*
            Çizgi çubuğu tam enine keser; uçlarda yarısı dışarı taşmasın diye
            merkezi 1px ile yükseklik-1px arasında dolaşır. Sayı çizginin
            sağında, çubuğun dışında durur — daire içine sıkıştırılınca
            okunmuyordu.
          */}
          <div
            className="absolute left-0 right-0 flex items-center transition-[bottom] duration-700 ease-out"
            style={{ bottom: `calc(1px + (100% - 2px) * ${barPosition / 100})` }}
          >
            <div
              className="h-0.5 w-full rounded-full"
              style={{ backgroundColor: currentLevel.color }}
            />
            {/* Sayı mürekkep renginde: seviye rengi açık tonlarda (Başlangıç,
                Farkındalık) beyaz zeminde okunmuyor. Renk çizgide kalır. */}
            <span className="absolute left-full ml-2 font-mono text-base font-semibold leading-none -translate-y-1/2 top-1/2 text-[var(--text-main)]">
              {scoreOn5.toFixed(1)}
            </span>
          </div>
        </div>

        {/* Sayı çubuğun sağına taşıyor; sütun onun için yer ayırır. */}
        <div className="w-10" aria-hidden />
      </div>
    </div>
  );
}

export default MaturityLevelBar;
