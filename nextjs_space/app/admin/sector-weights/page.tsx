"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Info, Loader2 } from "lucide-react";
import { SCOPE_LEVELS, type ScopeLevelKey, levelFromScope } from "@/lib/sector-scope";

/**
 * Sektör × bölüm kapsam matrisi.
 *
 * Tek anket yazılır; bu ekran hangi bölümün hangi sektöre sorulacağını ve
 * ne kadar sayılacağını belirler. Her sektöre ayrı anket yazmak yerine bu
 * yol seçildi: bir düzeltme tek yerde yapılır ve sektörler kıyaslanabilir
 * kalır.
 */

type Survey = { id: string; name: string };
type SubSector = { id: string; name: string };
type Sector = { id: string; name: string; subSectors: SubSector[] };
type SubCategory = { id: string; name: string };
type Category = { id: string; name: string; subCategories: SubCategory[] };
type Rule = {
  sectorId: string;
  subSectorId: string | null;
  subCategoryId: string;
  applicable: boolean;
  weight: number;
};

const LEVEL_STYLE: Record<ScopeLevelKey, string> = {
  EXCLUDED: "bg-[var(--bg-card-2)] text-[var(--text-dim)] border-[var(--border-soft)]",
  LOW: "bg-[rgba(148,163,184,0.15)] text-[var(--text-muted)] border-[var(--border-soft)]",
  NORMAL: "bg-[var(--bg-card)] text-[var(--text-main)] border-[var(--border-soft)]",
  HIGH: "bg-[var(--accent-soft)] text-[var(--accent-ink)] border-[var(--accent)]/50",
};

export default function SectorScopePage() {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [surveyId, setSurveyId] = useState("");
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingCell, setSavingCell] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Boşsa sektör geneli; doluysa o alt sektöre özel kural düzenlenir. */
  const [subSectorId, setSubSectorId] = useState<string>("");
  const [activeSectorId, setActiveSectorId] = useState<string>("");

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/admin/surveys");
        if (!res.ok) {
          setError("Anket listesi alınamadı. Sayfayı yenilemeyi deneyin.");
          return;
        }
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        setSurveys(list);
        setSurveyId((current) => current || list[0]?.id || "");
      } catch (loadError) {
        console.error("Error loading surveys:", loadError);
        setError("Anket listesi alınırken hata oluştu.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const loadScope = useCallback(async () => {
    if (!surveyId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/sector-scope?surveyId=${surveyId}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Kapsam kuralları alınamadı");
        return;
      }
      setSectors(data.sectors ?? []);
      setCategories(data.categories ?? []);
      setRules(data.rules ?? []);
    } catch (loadError) {
      console.error("Error loading scope:", loadError);
      setError("Kapsam kuralları alınırken hata oluştu");
    } finally {
      setLoading(false);
    }
  }, [surveyId]);

  useEffect(() => {
    loadScope();
    setSubSectorId("");
    setActiveSectorId("");
  }, [loadScope]);

  /** Hücrenin o an geçerli seviyesi — kural yoksa varsayılan "Orta". */
  const levelOf = (sectorId: string, subCategoryId: string): ScopeLevelKey => {
    const exact =
      subSectorId && activeSectorId === sectorId
        ? rules.find(
            (rule) =>
              rule.sectorId === sectorId &&
              rule.subSectorId === subSectorId &&
              rule.subCategoryId === subCategoryId
          )
        : undefined;

    const rule =
      exact ??
      rules.find(
        (r) => r.sectorId === sectorId && r.subSectorId === null && r.subCategoryId === subCategoryId
      );

    if (!rule) return "NORMAL";
    return levelFromScope({ applicable: rule.applicable, weight: rule.weight });
  };

  const setLevel = async (sectorId: string, subCategoryId: string, level: ScopeLevelKey) => {
    const cellKey = `${sectorId}:${subCategoryId}`;
    setSavingCell(cellKey);
    setError(null);
    try {
      const res = await fetch("/api/admin/sector-scope", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sectorId,
          surveyId,
          subCategoryId,
          level,
          subSectorId: activeSectorId === sectorId && subSectorId ? subSectorId : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Kural kaydedilemedi");
        return;
      }
      await loadScope();
    } catch (saveError) {
      console.error("Error saving rule:", saveError);
      setError("Kural kaydedilirken hata oluştu");
    } finally {
      setSavingCell(null);
    }
  };

  const allSubCategories = categories.flatMap((category) =>
    category.subCategories.map((subCategory) => ({ category, subCategory }))
  );

  return (
    <div>
      <div className="mb-6">
        <h1 className="t-display" style={{ color: "var(--ink)" }}>Sektör kapsamı</h1>
        <p className="text-[var(--text-muted)]">
          Hangi bölümün hangi sektöre sorulacağını ve ne kadar sayılacağını belirleyin.
        </p>
      </div>

      <div className="mb-4 p-3 rounded-lg bg-[var(--bg-card-2)] border border-[var(--border-soft)] flex items-start gap-2">
        <Info size={18} className="text-[var(--accent)] shrink-0 mt-0.5" />
        <div className="text-sm text-[var(--text-muted)]">
          <p>
            Kural girilmemiş her bölüm <strong>&quot;Orta&quot;</strong> kabul edilir — yani sorulur
            ve normal ağırlıkta sayılır. Ankete yeni bölüm eklediğinizde hiçbir sektörde kaybolmaz.
          </p>
          <p className="mt-1">
            <strong>&quot;Sorma&quot;</strong> seçilen bölüm o sektördeki kullanıcıya hiç
            gösterilmez ve puana girmez.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select
          value={surveyId}
          onChange={(event) => setSurveyId(event.target.value)}
          className="px-4 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border-soft)] text-[var(--text-main)] text-sm"
        >
          {surveys.length === 0 && <option value="">Anket yok</option>}
          {surveys.map((survey) => (
            <option key={survey.id} value={survey.id}>
              {survey.name}
            </option>
          ))}
        </select>

        {/* Alt sektör istisnası — boşken sektör geneli düzenlenir. */}
        {sectors.length > 0 && (
          <div className="flex items-center gap-2">
            <select
              value={activeSectorId}
              onChange={(event) => {
                setActiveSectorId(event.target.value);
                setSubSectorId("");
              }}
              className="px-3 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border-soft)] text-[var(--text-main)] text-sm"
            >
              <option value="">Alt sektör istisnası yok</option>
              {sectors
                .filter((sector) => sector.subSectors.length > 0)
                .map((sector) => (
                  <option key={sector.id} value={sector.id}>
                    {sector.name} için istisna
                  </option>
                ))}
            </select>

            {activeSectorId && (
              <select
                value={subSectorId}
                onChange={(event) => setSubSectorId(event.target.value)}
                className="px-3 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border-soft)] text-[var(--text-main)] text-sm"
              >
                <option value="">— Alt sektör seçin —</option>
                {sectors
                  .find((sector) => sector.id === activeSectorId)
                  ?.subSectors.map((subSector) => (
                    <option key={subSector.id} value={subSector.id}>
                      {subSector.name}
                    </option>
                  ))}
              </select>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-[var(--error)]/10 border border-[var(--error)]/40 flex items-center gap-2">
          <AlertCircle size={18} className="text-[var(--error)]" />
          <p className="text-sm text-[var(--error)]">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={32} className="animate-spin text-[var(--accent)]" />
        </div>
      ) : surveys.length === 0 ? (
        <div className="p-8 rounded-xl bg-[var(--bg-card)] text-center">
          <p className="text-[var(--text-muted)]">
            Henüz anket yok. Kapsam kuralı yazabilmek için önce{" "}
            <a href="/admin/surveys" className="text-[var(--accent)] underline">
              Anketler
            </a>{" "}
            ekranından bir anket oluşturun.
          </p>
        </div>
      ) : !surveyId ? (
        // Anket seçilmeden kurallar çekilmez; bunu "sektör yok" diye
        // göstermek yanıltıcı olurdu.
        <div className="p-8 rounded-xl bg-[var(--bg-card)] text-center">
          <p className="text-[var(--text-muted)]">Kapsamı düzenlemek için bir anket seçin.</p>
        </div>
      ) : sectors.length === 0 ? (
        <div className="p-8 rounded-xl bg-[var(--bg-card)] text-center">
          <p className="text-[var(--text-muted)]">
            Henüz sektör tanımlanmamış. Kapsam kuralı yazabilmek için önce{" "}
            <a href="/admin/sectors" className="text-[var(--accent)] underline">
              Sektörler
            </a>{" "}
            ekranından sektör ekleyin.
          </p>
        </div>
      ) : allSubCategories.length === 0 ? (
        <div className="p-8 rounded-xl bg-[var(--bg-card)] text-center">
          <p className="text-[var(--text-muted)]">Bu ankette henüz bölüm yok.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--border-soft)]">
          <table className="theme-table">
            <thead>
              <tr className="bg-[var(--bg-card-2)]">
                <th>
                  Bölüm
                </th>
                {sectors.map((sector) => (
                  <th
                    key={sector.id}
                    className="p-3 font-medium text-[var(--text-muted)] min-w-[140px] text-left"
                  >
                    {sector.name}
                    {activeSectorId === sector.id && subSectorId && (
                      <span className="block text-[11px] font-normal text-[var(--accent)]">
                        {sectors
                          .find((s) => s.id === sector.id)
                          ?.subSectors.find((s) => s.id === subSectorId)?.name}{" "}
                        istisnası
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {categories.map((category) =>
                category.subCategories.map((subCategory, index) => (
                  <tr key={subCategory.id} className="border-t border-[var(--border-soft)]">
                    <td className="p-3 sticky left-0 bg-[var(--bg-card)] align-top">
                      {index === 0 && (
                        <span className="block text-[11px] uppercase tracking-wide text-[var(--text-dim)] mb-0.5">
                          {category.name}
                        </span>
                      )}
                      <span className="text-[var(--text-main)]">{subCategory.name}</span>
                    </td>

                    {sectors.map((sector) => {
                      const level = levelOf(sector.id, subCategory.id);
                      const cellKey = `${sector.id}:${subCategory.id}`;
                      const isSaving = savingCell === cellKey;

                      return (
                        <td key={sector.id} className="p-2 align-top">
                          <select
                            value={level}
                            disabled={isSaving || (!!activeSectorId && activeSectorId !== sector.id)}
                            onChange={(event) =>
                              setLevel(sector.id, subCategory.id, event.target.value as ScopeLevelKey)
                            }
                            className={`w-full px-2 py-1.5 rounded-lg border text-xs disabled:opacity-40 ${LEVEL_STYLE[level]}`}
                          >
                            {SCOPE_LEVELS.map((entry) => (
                              <option key={entry.key} value={entry.key}>
                                {entry.label}
                              </option>
                            ))}
                          </select>
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
