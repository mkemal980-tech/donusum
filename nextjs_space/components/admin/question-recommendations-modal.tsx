"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, ChevronDown, ChevronRight, Edit, Lightbulb, Loader2, Plus, Sparkles, Trash2, X } from "lucide-react";
import { supportsCascadeByChoice, triggerChoicesFor } from "@/lib/recommendation-triggers";
import { derivePosition } from "@/lib/recommendation-position";
import {
  type QuestionContext,
  type RecommendationImportRow,
  buildRecommendationPayload,
} from "@/lib/recommendation-import";
import { Button } from "@/components/ui/button";

type QuestionForRecommendations = {
  id: string;
  text: string;
  type: string;
  options?: unknown;
};

/** Önerinin bağlanacağı yer — soru zaten bir alt kategori/alt seviye altında. */
export type RecommendationTarget = {
  categoryId: string | null;
  subCategoryId: string | null;
  subLevelId: string | null;
};

type Recommendation = {
  id: string;
  title: string;
  description: string;
  videoUrl: string | null;
  triggerOptions: string | null;
  triggerMaxAnswerScore: number | null;
  points: number;
  costType: string;
  timeframe: string;
  strategicType: string;
  estimatedImpact: number;
  minScoreThreshold: number;
  maxScoreThreshold: number;
  order: number;
  xPosition: number;
  yPosition: number;
  capexLevel: number;
  opexLevel: number;
};

type Props = {
  question: QuestionForRecommendations;
  target: RecommendationTarget;
  onClose: () => void;
  onChanged?: () => void;
};

const COST_TYPES = [
  { value: "OPEX", label: "OPEX (İşletme)" },
  { value: "CAPEX", label: "CAPEX (Yatırım)" },
];

const TIMEFRAMES = [
  { value: "SHORT_TERM", label: "Kısa vade (0-6 ay)" },
  { value: "MEDIUM_TERM", label: "Orta vade (6-18 ay)" },
  { value: "LONG_TERM", label: "Uzun vade (18+ ay)" },
];

const STRATEGIC_TYPES = [
  { value: "QUICK_WIN", label: "Hızlı kazanım" },
  { value: "PROJECT", label: "Proje" },
  { value: "BIG_BET", label: "Büyük yatırım" },
];

const STRATEGIC_LABELS: Record<string, string> = Object.fromEntries(
  STRATEGIC_TYPES.map((entry) => [entry.value, entry.label])
);

const inputClass =
  "w-full p-2.5 rounded-lg text-sm bg-[var(--bg-card-2)] border border-[var(--border-soft)] " +
  "text-[var(--text-main)] focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent";

type FormState = {
  id?: string;
  title: string;
  description: string;
  videoUrl: string;
  triggers: string[];
  /** Kademeli tetikleme: seçilen şık ve altındaki tüm şıklarda göster. */
  cascade: boolean;
  /** Kademeli tetiklemede eşik — şık listesi yoksa elle girilir. */
  cascadeScore: number;
  points: number;
  costType: string;
  timeframe: string;
  strategicType: string;
  estimatedImpact: number;
  minScoreThreshold: number;
  maxScoreThreshold: number;
  order: number;
  /** Grafikteki konum otomatik türetilsin mi, yoksa elle mi girildi? */
  manualPosition: boolean;
  xPosition: number;
  yPosition: number;
  capexLevel: number;
  opexLevel: number;
};

function emptyForm(order: number): FormState {
  return {
    title: "",
    description: "",
    videoUrl: "",
    triggers: [],
    cascade: false,
    cascadeScore: 0,
    points: 0.5,
    costType: "OPEX",
    timeframe: "SHORT_TERM",
    strategicType: "QUICK_WIN",
    estimatedImpact: 5,
    minScoreThreshold: 0,
    maxScoreThreshold: 70,
    order,
    manualPosition: false,
    xPosition: 5,
    yPosition: 5,
    capexLevel: 1,
    opexLevel: 1,
  };
}

/** Formun o anki değerlerine göre grafikte duracağı yer. */
function positionOf(form: FormState) {
  if (form.manualPosition) {
    return { xPosition: form.xPosition, yPosition: form.yPosition };
  }
  return derivePosition({
    strategicType: form.strategicType,
    timeframe: form.timeframe,
    estimatedImpact: form.estimatedImpact,
  });
}

function parseTriggers(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export default function QuestionRecommendationsModal({ question, target, onClose, onChanged }: Props) {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drafting, setDrafting] = useState(false);
  // AI taslakları sırayla forma yüklenir; her biri ayrı ayrı onaylanır.
  const [draftQueue, setDraftQueue] = useState<RecommendationImportRow[]>([]);

  const triggerSupport = triggerChoicesFor(question);
  // Şık listesi kurulabiliyorsa kademeli eşik şıktan seçilir; kurulamıyorsa
  // (kademeli puanlama sorusu) elle sayı olarak girilir.
  const cascadeByChoice = supportsCascadeByChoice(question);

  /**
   * Kayıtlı öneriyi forma geri yüklerken işaretlenecek şıklar.
   * Kademeli öneride eşik puanına karşılık gelen tek şık, aksi hâlde
   * tam eşleşme listesinin tamamı.
   */
  const cascadeAnchorFor = (recommendation: Recommendation): string[] => {
    if (recommendation.triggerMaxAnswerScore === null) {
      return parseTriggers(recommendation.triggerOptions);
    }
    if (!triggerSupport.supported) return [];
    const anchor = triggerSupport.choices.find(
      (choice) => choice.score === recommendation.triggerMaxAnswerScore
    );
    return anchor ? [anchor.value] : [];
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/recommendations?questionId=${question.id}`);
      const data = response.ok ? await response.json() : [];
      setRecommendations(Array.isArray(data) ? data : []);
    } catch (loadError) {
      console.error("Error loading recommendations:", loadError);
      setRecommendations([]);
    } finally {
      setLoading(false);
    }
  }, [question.id]);

  useEffect(() => {
    load();
  }, [load]);

  /** Soru bağlamı — taslak satırını forma çevirirken kullanılır. */
  const questionContext = (): QuestionContext => ({
    id: question.id,
    text: question.text,
    type: question.type,
    options: question.options,
    categoryId: target.categoryId,
    subCategoryId: target.subCategoryId,
    subLevelId: target.subLevelId,
  });

  /** Taslak satırını, kaydetme akışının beklediği form durumuna çevirir. */
  const formFromDraft = (draft: RecommendationImportRow, order: number): FormState => {
    const payload = buildRecommendationPayload(draft, questionContext(), order);
    const triggers = payload.triggerMaxAnswerScore !== null && triggerSupport.supported
      ? triggerSupport.choices
          .filter((choice) => choice.score === payload.triggerMaxAnswerScore)
          .slice(0, 1)
          .map((choice) => choice.value)
      : [];

    return {
      ...emptyForm(order),
      title: payload.title,
      description: payload.description,
      triggers,
      cascade: payload.triggerMaxAnswerScore !== null,
      cascadeScore: payload.triggerMaxAnswerScore ?? 0,
      costType: payload.costType,
      timeframe: payload.timeframe,
      strategicType: payload.strategicType,
      estimatedImpact: payload.estimatedImpact,
    };
  };

  /** Kuyruktaki bir sonraki taslağı forma alır; kuyruk bittiyse formu kapatır. */
  const loadNextDraft = (queue: RecommendationImportRow[]) => {
    const [next, ...rest] = queue;
    setDraftQueue(rest);
    if (!next) {
      setForm(null);
      return;
    }
    setError(null);
    setShowAdvanced(false);
    setForm(formFromDraft(next, recommendations.length + 1));
  };

  /**
   * Bu sorunun her şıkkı için kademeli öneri taslağı ürettirir.
   *
   * Taslaklar doğrudan kaydedilmez: üretilen ilk satır forma yüklenir,
   * yönetici görüp düzenledikten sonra tek tek onaylar. Toplu onay için
   * Öneri Yönetimi ekranındaki "Toplu Kurulum" panelini kullanın.
   */
  const draftWithAI = async () => {
    setDrafting(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/recommendations/ai-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionIds: [question.id] }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Taslak üretilemedi.");
        return;
      }

      const drafted: RecommendationImportRow[] = (data.rows ?? []).map(
        (entry: { values: RecommendationImportRow }) => entry.values
      );
      if (drafted.length === 0) {
        setError("Model taslak üretmedi. Tekrar deneyebilirsiniz.");
        return;
      }
      loadNextDraft(drafted);
    } catch (draftError) {
      console.error("Error drafting recommendations:", draftError);
      setError("Taslak üretilirken hata oluştu.");
    } finally {
      setDrafting(false);
    }
  };

  const startCreate = () => {
    setError(null);
    setShowAdvanced(false);
    setForm(emptyForm(recommendations.length + 1));
  };

  const startEdit = (recommendation: Recommendation) => {
    setError(null);
    setShowAdvanced(false);

    // Kayıtlı konum türetilenle aynıysa hâlâ otomatik sayılır; farklıysa
    // yönetici elle ayarlamış demektir ve o değerler korunur.
    const derived = derivePosition({
      strategicType: recommendation.strategicType,
      timeframe: recommendation.timeframe,
      estimatedImpact: recommendation.estimatedImpact,
    });
    const manualPosition =
      recommendation.xPosition !== derived.xPosition || recommendation.yPosition !== derived.yPosition;

    setForm({
      manualPosition,
      id: recommendation.id,
      title: recommendation.title,
      description: recommendation.description,
      videoUrl: recommendation.videoUrl ?? "",
      triggers: cascadeAnchorFor(recommendation),
      cascade: recommendation.triggerMaxAnswerScore !== null,
      cascadeScore: recommendation.triggerMaxAnswerScore ?? 0,
      points: recommendation.points,
      costType: recommendation.costType,
      timeframe: recommendation.timeframe,
      strategicType: recommendation.strategicType,
      estimatedImpact: recommendation.estimatedImpact,
      minScoreThreshold: recommendation.minScoreThreshold,
      maxScoreThreshold: recommendation.maxScoreThreshold,
      order: recommendation.order,
      xPosition: recommendation.xPosition,
      yPosition: recommendation.yPosition,
      capexLevel: recommendation.capexLevel,
      opexLevel: recommendation.opexLevel,
    });
  };

  const toggleTrigger = (value: string) => {
    setForm((current) => {
      if (!current) return current;
      // Kademeli tetiklemede eşik tek bir şıktan okunur; çoklu seçim
      // anlamsız olacağı için seçim tekile indirilir.
      if (current.cascade) {
        return { ...current, triggers: [value] };
      }
      return {
        ...current,
        triggers: current.triggers.includes(value)
          ? current.triggers.filter((entry) => entry !== value)
          : [...current.triggers, value],
      };
    });
  };

  /** Kademeli eşik — şıktan ya da elle girilen sayıdan. */
  const cascadeThresholdOf = (state: FormState): number | null => {
    if (!state.cascade) return null;
    if (!cascadeByChoice) return state.cascadeScore;
    if (!triggerSupport.supported) return null;
    const anchor = triggerSupport.choices.find((choice) => choice.value === state.triggers[0]);
    return anchor ? anchor.score : null;
  };

  const handleSave = async () => {
    if (!form) return;

    if (!form.title.trim()) {
      setError("Öneri başlığı boş olamaz.");
      return;
    }
    if (form.cascade && cascadeByChoice && form.triggers.length === 0) {
      setError("Kademeli tetikleme için bir başlangıç şıkkı seçin.");
      return;
    }
    if (!form.cascade && triggerSupport.supported && form.triggers.length === 0) {
      setError("En az bir tetikleyici cevap seçin — öneri yalnızca o cevaplarda gösterilir.");
      return;
    }

    const cascadeThreshold = cascadeThresholdOf(form);

    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/recommendations", {
        method: form.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: form.id,
          title: form.title.trim(),
          description: form.description.trim(),
          videoUrl: form.videoUrl.trim() || null,
          // Hedef alan sorudan geliyor; yönetici ayrıca seçim yapmıyor.
          categoryId: target.categoryId,
          subCategoryId: target.subLevelId ? null : target.subCategoryId,
          subLevelId: target.subLevelId,
          questionId: question.id,
          // Kademeli eşik varsa tam eşleşme listesi kullanılmaz.
          triggerOptions:
            cascadeThreshold === null && triggerSupport.supported ? form.triggers : null,
          triggerMaxAnswerScore: cascadeThreshold,
          points: form.points,
          costType: form.costType,
          timeframe: form.timeframe,
          strategicType: form.strategicType,
          estimatedImpact: form.estimatedImpact,
          minScoreThreshold: form.minScoreThreshold,
          maxScoreThreshold: form.maxScoreThreshold,
          order: form.order,
          ...positionOf(form),
          capexLevel: form.capexLevel,
          opexLevel: form.opexLevel,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setError(payload.error || "Öneri kaydedilemedi.");
        return;
      }

      await load();
      onChanged?.();

      // Taslak kuyruğu varsa sıradakine geç; yoksa formu kapat.
      if (draftQueue.length > 0) {
        loadNextDraft(draftQueue);
      } else {
        setForm(null);
      }
    } catch (saveError) {
      console.error("Error saving recommendation:", saveError);
      setError("Öneri kaydedilirken hata oluştu.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (recommendation: Recommendation) => {
    if (!confirm(`"${recommendation.title}" önerisi silinsin mi?`)) return;

    try {
      const response = await fetch(`/api/admin/recommendations?id=${recommendation.id}`, { method: "DELETE" });
      if (!response.ok) {
        setError("Öneri silinemedi.");
        return;
      }
      await load();
      onChanged?.();
    } catch (deleteError) {
      console.error("Error deleting recommendation:", deleteError);
      setError("Öneri silinirken hata oluştu.");
    }
  };

  const triggerLabel = (value: string) => {
    if (!triggerSupport.supported) return value;
    return triggerSupport.choices.find((choice) => choice.value === value)?.label ?? value;
  };

  /** Kademeli eşiği yöneticiye şık adıyla gösterir, bulunamazsa puanla. */
  const cascadeLabel = (threshold: number) => {
    if (!triggerSupport.supported) return `${threshold} puan`;
    const anchor = triggerSupport.choices.find((choice) => choice.score === threshold);
    return anchor ? anchor.label : `${threshold} puan`;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="theme-card w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-start gap-4 mb-4">
            <div className="min-w-0">
              <h2 className="text-xl font-semibold text-[var(--text-main)] flex items-center gap-2">
                <Lightbulb size={20} className="text-[var(--warning)]" />
                Bu Sorunun Önerileri
              </h2>
              <p className="text-sm text-[var(--text-muted)] mt-1">{question.text}</p>
            </div>
            <button onClick={onClose} className="text-[var(--text-dim)] hover:text-[var(--text-muted)] shrink-0">
              <X size={24} />
            </button>
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 mb-4 rounded-lg bg-[var(--error)]/10 border border-[var(--error)]/40">
              <AlertCircle size={18} className="text-[var(--error)] shrink-0 mt-0.5" />
              <p className="text-sm text-[var(--error)]">{error}</p>
            </div>
          )}

          {/* Mevcut öneriler */}
          {loading ? (
            <p className="text-sm text-[var(--text-dim)] py-6 text-center">Öneriler yükleniyor...</p>
          ) : recommendations.length === 0 ? (
            <p className="text-sm text-[var(--text-dim)] py-6 text-center">
              Bu soruya bağlı öneri yok. Aşağıdan ilkini ekleyebilirsiniz.
            </p>
          ) : (
            <div className="space-y-2 mb-4">
              {recommendations.map((recommendation) => {
                const triggers = parseTriggers(recommendation.triggerOptions);
                return (
                  <div
                    key={recommendation.id}
                    className="flex items-start justify-between gap-3 p-3 rounded-lg bg-[var(--bg-card-2)] border border-[var(--border-soft)]"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-[var(--text-main)]">{recommendation.title}</p>
                      {recommendation.description && (
                        <p className="text-xs text-[var(--text-dim)] mt-0.5 line-clamp-2">
                          {recommendation.description}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {recommendation.triggerMaxAnswerScore !== null ? (
                          <span className="text-[11px] px-2 py-0.5 rounded bg-[var(--accent-soft)] text-[var(--accent-ink)]">
                            {cascadeLabel(recommendation.triggerMaxAnswerScore)} ve altındaki cevaplarda
                          </span>
                        ) : triggers.length > 0 ? (
                          triggers.map((trigger) => (
                            <span
                              key={trigger}
                              className="text-[11px] px-2 py-0.5 rounded bg-[var(--accent-soft)] text-[var(--accent-ink)]"
                            >
                              {triggerLabel(trigger)} cevabında
                            </span>
                          ))
                        ) : (
                          <span className="text-[11px] px-2 py-0.5 rounded bg-[var(--bg-card)] text-[var(--text-dim)]">
                            %{recommendation.minScoreThreshold}-{recommendation.maxScoreThreshold} puan aralığında
                          </span>
                        )}
                        <span className="text-[11px] px-2 py-0.5 rounded bg-[var(--bg-card)] text-[var(--text-dim)]">
                          {STRATEGIC_LABELS[recommendation.strategicType] ?? recommendation.strategicType}
                        </span>
                        <span className="text-[11px] px-2 py-0.5 rounded bg-[var(--bg-card)] text-[var(--text-dim)]">
                          {recommendation.triggerMaxAnswerScore !== null
                            ? "bir basamak ilerletir"
                            : `${recommendation.points} soruluk ilerleme`}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => startEdit(recommendation)}
                        className="p-1.5 rounded hover:bg-[var(--bg-card)] text-[var(--blue-main)]"
                        title="Düzenle"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(recommendation)}
                        className="p-1.5 rounded hover:bg-[var(--error-bg)] text-[var(--error-ink)]"
                        title="Sil"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Ekleme / düzenleme formu */}
          {form ? (
            <div className="p-4 rounded-lg bg-[var(--bg-card-2)] border border-[var(--accent)]/40 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-medium text-[var(--text-main)]">
                  {form.id ? "Öneriyi Düzenle" : "Yeni Öneri"}
                </h3>
                {draftQueue.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs bg-[var(--accent-soft)] text-[var(--accent-ink)]">
                    <Sparkles size={12} />
                    AI taslağı — sırada {draftQueue.length} tane daha
                  </span>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Başlık *</label>
                <input
                  className={inputClass}
                  value={form.title}
                  placeholder="Örn: Kapsam 1-2 emisyon envanteri oluşturun"
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Açıklama</label>
                <textarea
                  className={`${inputClass} resize-y`}
                  rows={3}
                  value={form.description}
                  placeholder="Kullanıcının ne yapması gerektiğini anlatın."
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">
                  Nasıl yapılır videosu (opsiyonel)
                </label>
                <input
                  className={inputClass}
                  value={form.videoUrl}
                  placeholder="https://www.youtube.com/watch?v=..."
                  onChange={(event) => setForm({ ...form, videoUrl: event.target.value })}
                />
              </div>

              {/* Tetikleme — soru zaten belli olduğu için tek seçim burası */}
              <div className="p-3 rounded-lg bg-[var(--bg-card)] border border-[var(--border-soft)]">
                <p className="text-sm font-medium text-[var(--text-muted)] mb-2">
                  Bu öneri hangi cevaplarda gösterilsin?
                </p>

                {/* Kademeli tetikleme — devralma anahtarı */}
                <label className="flex items-start gap-2 mb-3 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.cascade}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        cascade: event.target.checked,
                        // Kademeliye geçerken çoklu seçim tekile iner.
                        triggers: event.target.checked ? form.triggers.slice(0, 1) : form.triggers,
                      })
                    }
                    className="accent-[var(--accent)] mt-0.5"
                  />
                  <span className="text-[var(--text-muted)]">
                    Bu şık <strong>ve altındaki</strong> tüm şıklarda göster
                    <span className="block text-xs text-[var(--text-dim)] mt-0.5">
                      Daha düşük basamaktaki kullanıcılar bu öneriyi de devralır; olgunluk
                      basamakları atlanamaz.
                    </span>
                  </span>
                </label>

                {triggerSupport.supported ? (
                  <div className="grid sm:grid-cols-2 gap-2">
                    {triggerSupport.choices.map((choice) => (
                      <label
                        key={choice.value}
                        className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer border text-sm ${
                          form.triggers.includes(choice.value)
                            ? "bg-[var(--accent-soft)] border-[var(--accent)] text-[var(--accent-ink)]"
                            : "bg-[var(--bg-card-2)] border-[var(--border-soft)] text-[var(--text-muted)]"
                        }`}
                      >
                        <input
                          type={form.cascade ? "radio" : "checkbox"}
                          checked={form.triggers.includes(choice.value)}
                          onChange={() => toggleTrigger(choice.value)}
                          className="accent-[var(--accent)]"
                        />
                        <span className="flex-1">{choice.label}</span>
                        <span className="text-[11px] text-[var(--text-dim)]">{choice.score} puan</span>
                      </label>
                    ))}
                  </div>
                ) : form.cascade ? (
                  <div>
                    <label className="block text-xs text-[var(--text-dim)] mb-1">
                      Cevap puanı bu değere kadar olanlara göster
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min={0}
                      max={5}
                      className={inputClass}
                      value={form.cascadeScore}
                      onChange={(event) =>
                        setForm({ ...form, cascadeScore: Number(event.target.value) })
                      }
                    />
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-[var(--warning)] mb-3">{triggerSupport.reason}</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-[var(--text-dim)] mb-1">Minimum puan (%)</label>
                        <input
                          type="number"
                          className={inputClass}
                          value={form.minScoreThreshold}
                          onChange={(event) =>
                            setForm({ ...form, minScoreThreshold: Number(event.target.value) })
                          }
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-[var(--text-dim)] mb-1">Maksimum puan (%)</label>
                        <input
                          type="number"
                          className={inputClass}
                          value={form.maxScoreThreshold}
                          onChange={(event) =>
                            setForm({ ...form, maxScoreThreshold: Number(event.target.value) })
                          }
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="grid sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Strateji</label>
                  <select
                    className={inputClass}
                    value={form.strategicType}
                    onChange={(event) => setForm({ ...form, strategicType: event.target.value })}
                  >
                    {STRATEGIC_TYPES.map((entry) => (
                      <option key={entry.value} value={entry.value}>
                        {entry.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Maliyet</label>
                  <select
                    className={inputClass}
                    value={form.costType}
                    onChange={(event) => setForm({ ...form, costType: event.target.value })}
                  >
                    {COST_TYPES.map((entry) => (
                      <option key={entry.value} value={entry.value}>
                        {entry.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Vade</label>
                  <select
                    className={inputClass}
                    value={form.timeframe}
                    onChange={(event) => setForm({ ...form, timeframe: event.target.value })}
                  >
                    {TIMEFRAMES.map((entry) => (
                      <option key={entry.value} value={entry.value}>
                        {entry.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {form.cascade ? (
                // Kademeli öneride puan elle girilmez: tamamlanınca kullanıcı
                // bir üst basamağa çıkar ve katkı bundan türetilir.
                <div className="p-3 rounded-lg bg-[var(--bg-card)] border border-[var(--border-soft)]">
                  <p className="text-sm font-medium text-[var(--text-muted)] mb-1">
                    Gelişim skoru puanı: otomatik
                  </p>
                  <p className="text-xs text-[var(--text-dim)]">
                    Kullanıcı bu öneriyi tamamladığında bu sorudaki basamağı bir üst şıkka
                    çıkar; gelişim skoruna katkısı sorunun ağırlığından ve anketin
                    boyutundan türetilir. Elle puan girilmesi gerekmez.
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">
                    Gelişim skoru puanı: <span className="text-[var(--accent)]">{form.points.toFixed(1)}</span>
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={2}
                    step={0.1}
                    value={form.points}
                    onChange={(event) => setForm({ ...form, points: parseFloat(event.target.value) })}
                    className="w-full accent-[var(--accent)]"
                  />
                  <p className="text-xs text-[var(--text-dim)]">
                    Kaç soruluk ilerlemeye denk olduğunu belirtir: <strong>1.0</strong> bir soruyu
                    en alttan tavana çıkarmakla aynı, <strong>0.5</strong> onun yarısı. Kullanıcı
                    öneriyi &quot;Tamamlandı&quot; işaretlediğinde gelişim skoruna eklenir;
                    &quot;Devam ediyor&quot; durumunda puan verilmez.
                  </p>
                </div>
              )}

              {/* Nadiren değiştirilen alanlar katlanmış durur */}
              <div>
                <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">
                  Tahmini etki: <span className="text-[var(--accent)]">{form.estimatedImpact}</span> / 10
                </label>
                <input
                  type="range"
                  min={1}
                  max={10}
                  step={1}
                  value={form.estimatedImpact}
                  onChange={(event) => setForm({ ...form, estimatedImpact: Number(event.target.value) })}
                  className="w-full accent-[var(--accent)]"
                />
                <p className="text-xs text-[var(--text-dim)]">
                  Öneri grafiğinde baloncuğun büyüklüğünü ve önerilerin sıralamasını belirler.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowAdvanced((current) => !current)}
                className="flex items-center gap-1 text-sm text-[var(--text-muted)] hover:text-[var(--accent)]"
              >
                {showAdvanced ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                Maliyet seviyeleri ve grafik konumu
              </button>

              {showAdvanced && (
                <div className="space-y-3 pt-1">
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-[var(--text-dim)] mb-1">CAPEX seviyesi (1-5)</label>
                      <input
                        type="number"
                        min={1}
                        max={5}
                        className={inputClass}
                        value={form.capexLevel}
                        onChange={(event) => setForm({ ...form, capexLevel: Number(event.target.value) })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[var(--text-dim)] mb-1">OPEX seviyesi (1-5)</label>
                      <input
                        type="number"
                        min={1}
                        max={5}
                        className={inputClass}
                        value={form.opexLevel}
                        onChange={(event) => setForm({ ...form, opexLevel: Number(event.target.value) })}
                      />
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-[var(--bg-card)] border border-[var(--border-soft)]">
                    <label className="flex items-center gap-2 text-sm text-[var(--text-muted)] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.manualPosition}
                        onChange={(event) => {
                          const derived = positionOf({ ...form, manualPosition: false });
                          setForm({
                            ...form,
                            manualPosition: event.target.checked,
                            // Elle ayara geçerken otomatik konumdan başla.
                            xPosition: derived.xPosition,
                            yPosition: derived.yPosition,
                          });
                        }}
                        className="accent-[var(--accent)]"
                      />
                      Grafikteki konumu elle ayarla
                    </label>

                    {form.manualPosition ? (
                      <div className="grid sm:grid-cols-2 gap-3 mt-3">
                        <div>
                          <label className="block text-xs text-[var(--text-dim)] mb-1">
                            Kaynak → Aciliyet ({form.xPosition})
                          </label>
                          <input
                            type="range"
                            min={0}
                            max={10}
                            step={0.5}
                            value={form.xPosition}
                            onChange={(event) => setForm({ ...form, xPosition: parseFloat(event.target.value) })}
                            className="w-full accent-[var(--accent)]"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-[var(--text-dim)] mb-1">
                            Öncelik puanı ({form.yPosition})
                          </label>
                          <input
                            type="range"
                            min={0}
                            max={10}
                            step={0.5}
                            value={form.yPosition}
                            onChange={(event) => setForm({ ...form, yPosition: parseFloat(event.target.value) })}
                            className="w-full accent-[var(--accent)]"
                          />
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-[var(--text-dim)] mt-2">
                        Strateji, vade ve tahmini etkiden hesaplanıyor — şu an{" "}
                        <span className="text-[var(--accent)]">
                          ({positionOf(form).xPosition}, {positionOf(form).yPosition})
                        </span>
                        . Bu alanları değiştirdikçe konum da güncellenir.
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                {draftQueue.length > 0 && (
                  <Button
                    onClick={() => loadNextDraft(draftQueue)}
                    disabled={saving}
                    variant="secondary"
                    className="text-sm text-[var(--text-muted)]"
                  >
                    Bu taslağı atla
                  </Button>
                )}
                <button
                  onClick={() => {
                    // Vazgeçmek kuyruğu da iptal eder; yarım kalmış taslak
                    // dizisi arka planda beklemesin.
                    setDraftQueue([]);
                    setForm(null);
                  }}
                  disabled={saving}
                  className="px-4 py-2 rounded-lg text-sm bg-[var(--border-soft)] text-[var(--text-muted)] disabled:opacity-50"
                >
                  Vazgeç
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 rounded-lg text-sm bg-[var(--accent-solid)] text-[var(--on-accent)] disabled:opacity-50"
                >
                  {saving ? "Kaydediliyor..." : form.id ? "Güncelle" : "Öneriyi Ekle"}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Button
                onClick={startCreate}
                variant="outline"
                className="w-full text-[var(--accent)] hover:bg-[rgba(12,193,195,0.08)]"
              >
                <Plus size={18} />
                Bu soruya öneri ekle
              </Button>
              {cascadeByChoice && (
                <Button
                  onClick={draftWithAI}
                  disabled={drafting}
                  variant="secondary"
                  className="w-full text-sm text-[var(--text-muted)] hover:text-[var(--accent)]"
                >
                  {drafting ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                  {drafting ? "Taslak üretiliyor..." : "AI ile her şık için taslak üret"}
                </Button>
              )}
            </div>
          )}

          <div className="flex justify-end mt-6">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-[var(--border-soft)] text-[var(--text-muted)] hover:bg-[var(--ui-passive)]"
            >
              Kapat
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
