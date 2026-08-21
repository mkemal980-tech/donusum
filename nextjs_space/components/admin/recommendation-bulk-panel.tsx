"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, FileSpreadsheet, Loader2, Sparkles, Upload, X } from "lucide-react";
import type { RecommendationImportRow } from "@/lib/recommendation-import";
import RecommendationImportPreview, {
  type RecommendationPreviewPayload,
} from "./recommendation-import-preview";
import { Button } from "@/components/ui/button";

/**
 * Toplu öneri kurulumunun tek giriş noktası.
 *
 * İki kaynak, tek yol: Excel yükleme ve AI taslağı aynı önizlemeye düşer,
 * aynı doğrulamadan geçer, aynı kaydetme uç noktasını kullanır. Aradaki tek
 * fark satırların nereden geldiğidir — onay adımı ikisinde de zorunludur.
 */

type Survey = { id: string; name: string };

type SurveyStructure = {
  id: string;
  name: string;
  subCategories: { id: string; name: string; subLevels: { id: string; name: string }[] }[];
};

type Props = {
  surveys: Survey[];
  /**
   * Listedeki anket filtresi. Panel kendi başına ilk ankete düşerse yönetici
   * ekranda "Tersane" görürken dosyayı başka bir ankete yükler ve bütün
   * satırlar "soru bulunamadı" der; filtre varsa onu devralır.
   */
  initialSurveyId?: string;
  onClose: () => void;
  onSaved: () => void;
};

type Mode = "choose" | "preview";

export default function RecommendationBulkPanel({
  surveys,
  initialSurveyId,
  onClose,
  onSaved,
}: Props) {
  const [surveyId, setSurveyId] = useState(initialSurveyId || surveys[0]?.id || "");
  const [mode, setMode] = useState<Mode>("choose");
  const [payload, setPayload] = useState<RecommendationPreviewPayload | null>(null);
  const [busy, setBusy] = useState<"upload" | "ai" | "save" | null>(null);
  const [error, setError] = useState<string | null>(null);

  // AI taslağı için hedef seçimi
  const [categories, setCategories] = useState<SurveyStructure[]>([]);
  const [aiTarget, setAiTarget] = useState<{ kind: "subLevel" | "subCategory"; id: string } | null>(
    null
  );
  const [pool, setPool] = useState("");

  const loadStructure = useCallback(async () => {
    if (!surveyId) {
      setCategories([]);
      return;
    }
    try {
      const response = await fetch(`/api/admin/categories?surveyId=${surveyId}`);
      const data = response.ok ? await response.json() : [];
      setCategories(Array.isArray(data) ? data : []);
    } catch (loadError) {
      console.error("Error loading structure:", loadError);
      setCategories([]);
    }
  }, [surveyId]);

  useEffect(() => {
    loadStructure();
    setAiTarget(null);
  }, [loadStructure]);

  const handleFile = async (file: File) => {
    if (!surveyId) {
      setError("Önce anket seçin.");
      return;
    }
    setBusy("upload");
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("surveyId", surveyId);

      const response = await fetch("/api/admin/recommendations/bulk-upload", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Dosya işlenemedi.");
        return;
      }

      setPayload({ ...data, source: "excel" });
      setMode("preview");
    } catch (uploadError) {
      console.error("Error uploading file:", uploadError);
      setError("Dosya yüklenirken hata oluştu.");
    } finally {
      setBusy(null);
    }
  };

  const handleAiDraft = async () => {
    if (!surveyId) {
      setError("Önce anket seçin.");
      return;
    }
    if (!aiTarget) {
      setError("Taslak üretilecek alt kategori veya alt seviyeyi seçin.");
      return;
    }

    setBusy("ai");
    setError(null);
    try {
      const response = await fetch("/api/admin/recommendations/ai-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          surveyId,
          ...(aiTarget.kind === "subLevel"
            ? { subLevelId: aiTarget.id }
            : { subCategoryId: aiTarget.id }),
          pool: pool
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean),
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Taslak üretilemedi.");
        return;
      }

      setPayload({ ...data, source: "ai" });
      setMode("preview");
    } catch (aiError) {
      console.error("Error drafting recommendations:", aiError);
      setError("Taslak üretilirken hata oluştu.");
    } finally {
      setBusy(null);
    }
  };

  const handleConfirm = async (rows: RecommendationImportRow[]) => {
    setBusy("save");
    setError(null);
    try {
      const response = await fetch("/api/admin/recommendations/bulk-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ surveyId, rows }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.error || "Öneriler kaydedilemedi.");
        return;
      }

      onSaved();
      onClose();
    } catch (saveError) {
      console.error("Error saving recommendations:", saveError);
      setError("Kaydedilirken hata oluştu.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="theme-card w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 space-y-4">
          <div className="flex justify-between items-start gap-4">
            <div>
              <h2 className="text-xl font-semibold text-[var(--text-main)] flex items-center gap-2">
                <FileSpreadsheet size={20} className="text-[var(--accent)]" />
                Toplu Öneri Kurulumu
              </h2>
              <p className="text-sm text-[var(--text-muted)] mt-1">
                Excel&apos;den yükleyin ya da AI&apos;a taslak ürettirin — ikisi de onayınızdan
                geçmeden kaydedilmez.
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-[var(--bg-card-2)] text-[var(--text-dim)]"
            >
              <X size={24} />
            </button>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-[var(--error)]/10 border border-[var(--error)]/40">
              <p className="text-sm text-[var(--error)]">{error}</p>
            </div>
          )}

          {mode === "preview" && payload ? (
            <RecommendationImportPreview
              payload={payload}
              saving={busy === "save"}
              surveyName={surveys.find((survey) => survey.id === surveyId)?.name}
              onCancel={() => {
                setMode("choose");
                setPayload(null);
              }}
              onConfirm={handleConfirm}
            />
          ) : (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">
                  Anket
                </label>
                <select
                  value={surveyId}
                  onChange={(event) => setSurveyId(event.target.value)}
                  className="w-full p-2.5 rounded-lg text-sm bg-[var(--bg-card-2)] border border-[var(--border-soft)] text-[var(--text-main)]"
                >
                  {surveys.length === 0 && <option value="">Anket bulunamadı</option>}
                  {surveys.map((survey) => (
                    <option key={survey.id} value={survey.id}>
                      {survey.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Aşama 1 — Excel */}
              <div className="p-4 rounded-lg bg-[var(--bg-card-2)] border border-[var(--border-soft)] space-y-3">
                <h3 className="font-medium text-[var(--text-main)]">1. Excel ile yükle</h3>
                <p className="text-xs text-[var(--text-dim)]">
                  Şablonu indirin, doldurun, geri yükleyin. Şablonda anketin soruları ve şıkları da
                  yer alır; soru metnini oradan kopyalayın.
                </p>
                <div className="flex flex-wrap gap-2">
                  <a
                    href={`/api/admin/recommendations/template${surveyId ? `?surveyId=${surveyId}` : ""}`}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--accent)]"
                  >
                    <Download size={16} /> Şablonu indir
                  </a>
                  <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-[var(--accent)] text-[var(--bg-deep)] cursor-pointer hover:opacity-90">
                    {busy === "upload" ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                    {busy === "upload" ? "İşleniyor..." : "Dosya seç"}
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      className="hidden"
                      disabled={busy !== null}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) handleFile(file);
                        event.target.value = "";
                      }}
                    />
                  </label>
                </div>
              </div>

              {/* Aşama 2 — AI taslağı */}
              <div className="p-4 rounded-lg bg-[var(--bg-card-2)] border border-[var(--border-soft)] space-y-3">
                <h3 className="font-medium text-[var(--text-main)] flex items-center gap-2">
                  <Sparkles size={16} className="text-[var(--accent)]" />
                  2. AI&apos;a taslak ürettir
                </h3>
                <p className="text-xs text-[var(--text-dim)]">
                  Seçtiğiniz gruptaki her sorunun her şıkkı için kademeli öneri taslağı üretilir.
                  Taslaklar doğrudan kaydedilmez; aynı önizleme ekranında düzenleyip onaylarsınız.
                </p>

                <div>
                  <label className="block text-xs text-[var(--text-dim)] mb-1">Hedef grup</label>
                  <select
                    value={aiTarget ? `${aiTarget.kind}:${aiTarget.id}` : ""}
                    onChange={(event) => {
                      const [kind, id] = event.target.value.split(":");
                      setAiTarget(id ? { kind: kind as "subLevel" | "subCategory", id } : null);
                    }}
                    className="w-full p-2.5 rounded-lg text-sm bg-[var(--bg-card)] border border-[var(--border-soft)] text-[var(--text-main)]"
                  >
                    <option value="">— Seçin —</option>
                    {categories.map((category) =>
                      category.subCategories.map((subCategory) =>
                        subCategory.subLevels.length > 0 ? (
                          subCategory.subLevels.map((subLevel) => (
                            <option key={subLevel.id} value={`subLevel:${subLevel.id}`}>
                              {category.name} › {subCategory.name} › {subLevel.name}
                            </option>
                          ))
                        ) : (
                          <option key={subCategory.id} value={`subCategory:${subCategory.id}`}>
                            {category.name} › {subCategory.name}
                          </option>
                        )
                      )
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-[var(--text-dim)] mb-1">
                    Öneri havuzu (opsiyonel — her satıra bir öneri)
                  </label>
                  <textarea
                    rows={3}
                    value={pool}
                    onChange={(event) => setPool(event.target.value)}
                    placeholder={"Kapsam 1-2 emisyon envanteri oluşturun\nAzaltım hedefi belirleyin\n..."}
                    className="w-full p-2.5 rounded-lg text-sm bg-[var(--bg-card)] border border-[var(--border-soft)] text-[var(--text-main)] resize-y"
                  />
                  <p className="text-[11px] text-[var(--text-dim)] mt-1">
                    Havuz verirseniz model yeni metin uydurmak yerine buradan seçer — kurum diliniz
                    korunur, uydurma riski düşer.
                  </p>
                </div>

                <Button
                  onClick={handleAiDraft}
                  disabled={busy !== null || !aiTarget}
                  className="text-sm text-[var(--bg-deep)] disabled:cursor-not-allowed"
                >
                  {busy === "ai" ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                  {busy === "ai" ? "Taslak üretiliyor..." : "Taslak üret"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
