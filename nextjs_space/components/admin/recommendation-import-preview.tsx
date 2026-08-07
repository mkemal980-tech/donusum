"use client";

import { useMemo, useState } from "react";
import { AlertCircle, AlertTriangle, CheckCircle, Filter, Sparkles, Trash2 } from "lucide-react";
import {
  COST_KEYS,
  type FieldError,
  type LadderWarning,
  type QuestionContext,
  type RecommendationImportField,
  type RecommendationImportRow,
  STRATEGY_KEYS,
  TIMEFRAME_KEYS,
  checkLadders,
  choicesForRow,
  isCascadeRow,
  matchQuestion,
  validateRecommendationRow,
} from "@/lib/recommendation-import";

/**
 * Toplu öneri yüklemenin ve AI taslaklarının ortak onay ekranı.
 *
 * İki kaynak da aynı satır biçimini ürettiği için tek bileşen yeterlidir —
 * ve daha önemlisi, ikisi de aynı doğrulamadan geçer. AI çıktısı burada
 * elle yazılmış bir Excel satırından farksızdır: yönetici görmeden,
 * düzeltmeden ve onaylamadan hiçbir şey kaydedilmez.
 */

export type RecommendationPreviewPayload = {
  rows: { rowNumber: number; values: RecommendationImportRow; errors: FieldError[] }[];
  questions: QuestionContext[];
  warnings: LadderWarning[];
  skippedRows: number;
  /** AI'dan geldiyse kaynak rozeti gösterilir. */
  source?: "ai" | "excel";
  /** AI modunda üretilemeyen sorular. */
  failures?: string[];
  truncatedQuestions?: number;
};

type Props = {
  payload: RecommendationPreviewPayload;
  saving: boolean;
  onCancel: () => void;
  onConfirm: (rows: RecommendationImportRow[]) => void;
};

const TIMEFRAME_LABELS: Record<string, string> = {
  KISA: "Kısa vade",
  ORTA: "Orta vade",
  UZUN: "Uzun vade",
};

const STRATEGY_LABELS: Record<string, string> = {
  HIZLI_KAZANIM: "Hızlı kazanım",
  PROJE: "Proje",
  BUYUK_YATIRIM: "Büyük yatırım",
};

const inputClass =
  "w-full px-2 py-1.5 text-sm bg-[var(--bg-card)] border border-[var(--border-soft)] rounded " +
  "text-[var(--text-main)] focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent";

export default function RecommendationImportPreview({ payload, saving, onCancel, onConfirm }: Props) {
  const [rows, setRows] = useState<RecommendationImportRow[]>(() =>
    payload.rows.map((row) => ({ ...row.values }))
  );
  const [onlyErrors, setOnlyErrors] = useState(false);

  const questions = payload.questions;

  // Düzenleme yapıldıkça sunucudakiyle aynı kurallarla yeniden doğrulanır.
  const rowErrors = useMemo(
    () =>
      rows.map((row) => {
        const match = matchQuestion(row, questions);
        return validateRecommendationRow(row, match.found ? match.question : null);
      }),
    [rows, questions]
  );

  // Merdiven uyarıları da canlı güncellenir; satır silince uyarı kaybolmalı.
  const warnings = useMemo(() => checkLadders(rows, questions), [rows, questions]);

  const errorCount = rowErrors.filter((errors) => errors.length > 0).length;
  const validCount = rows.length - errorCount;

  const updateRow = (index: number, field: RecommendationImportField, value: string) => {
    setRows((current) =>
      current.map((row, rowIndex) => {
        if (rowIndex !== index) return row;
        const next = { ...row, [field]: value };
        // Soru değişince eski tetikleyici büyük ihtimalle geçersizdir.
        if (field === "soru_metni") next.tetikleyici = "";
        return next;
      })
    );
  };

  const removeRow = (index: number) => {
    setRows((current) => current.filter((_, rowIndex) => rowIndex !== index));
  };

  const removeErrorRows = () => {
    setRows((current) => current.filter((_, index) => rowErrors[index].length === 0));
  };

  const visibleIndexes = rows
    .map((_, index) => index)
    .filter((index) => !onlyErrors || rowErrors[index].length > 0);

  const errorFor = (index: number, field: RecommendationImportField) =>
    rowErrors[index].filter((error) => error.field === field);

  const cellClass = (index: number, field: RecommendationImportField) =>
    errorFor(index, field).length > 0
      ? `${inputClass} border-[var(--error)] ring-1 ring-[var(--error)]`
      : inputClass;


  const fieldMessages = (index: number, field: RecommendationImportField) =>
    errorFor(index, field).map((error) => (
      <p key={error.message} className="text-[11px] text-[var(--error)] mt-0.5">
        {error.message}
      </p>
    ));

  return (
    <div className="space-y-4">
      {/* Özet */}
      <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg bg-[var(--bg-card-2)] border border-[var(--border-soft)]">
        {payload.source === "ai" && (
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold bg-[rgba(12,193,195,0.15)] text-[var(--accent)]">
            <Sparkles size={13} /> AI taslağı
          </span>
        )}
        <span className="inline-flex items-center gap-1.5 text-sm text-[var(--accent)]">
          <CheckCircle size={16} /> {validCount} satır hazır
        </span>
        {errorCount > 0 && (
          <span className="inline-flex items-center gap-1.5 text-sm text-[var(--error)]">
            <AlertCircle size={16} /> {errorCount} satırda hata
          </span>
        )}
        {payload.skippedRows > 0 && (
          <span className="text-sm text-[var(--text-dim)]">
            {payload.skippedRows} boş satır atlandı
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setOnlyErrors((current) => !current)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs ${
              onlyErrors
                ? "bg-[var(--accent)] text-[var(--bg-deep)]"
                : "bg-[var(--bg-card)] text-[var(--text-muted)]"
            }`}
          >
            <Filter size={13} /> Sadece hatalılar
          </button>
          {errorCount > 0 && (
            <button
              onClick={removeErrorRows}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-[var(--bg-card)] text-[var(--error)]"
            >
              <Trash2 size={13} /> Hatalı satırları çıkar
            </button>
          )}
        </div>
      </div>

      {/* AI kısmi başarısızlıkları — sessizce yutulmaz */}
      {payload.failures && payload.failures.length > 0 && (
        <div className="p-3 rounded-lg bg-[rgba(245,158,11,0.1)] border border-[var(--warning)]/40">
          <p className="text-sm font-medium text-[var(--warning)] mb-1">
            Bazı sorular için taslak üretilemedi
          </p>
          <ul className="text-xs text-[var(--text-muted)] space-y-0.5">
            {payload.failures.map((failure) => (
              <li key={failure}>• {failure}</li>
            ))}
          </ul>
        </div>
      )}

      {payload.truncatedQuestions ? (
        <p className="text-xs text-[var(--text-dim)]">
          Tek seferde en fazla 10 soru işlenir; {payload.truncatedQuestions} soru bu turda dışarıda
          kaldı. Kaydettikten sonra tekrar çalıştırabilirsiniz.
        </p>
      ) : null}

      {/* Merdiven uyarıları — hata değil, ama onaylamadan önce görülmeli */}
      {warnings.length > 0 && (
        <div className="p-3 rounded-lg bg-[rgba(245,158,11,0.1)] border border-[var(--warning)]/40">
          <p className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--warning)] mb-1">
            <AlertTriangle size={15} /> Merdiven kontrolü
          </p>
          <ul className="text-xs text-[var(--text-muted)] space-y-1">
            {warnings.map((warning, index) => (
              <li key={`${warning.questionText}-${index}`}>
                <span className="text-[var(--text-main)]">{warning.questionText}</span>
                <br />
                {warning.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Satırlar */}
      <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
        {visibleIndexes.map((index) => {
          const row = rows[index];
          const cascade = isCascadeRow(row);
          const choices = choicesForRow(row, questions);

          return (
            <div
              key={index}
              className={`p-3 rounded-lg border space-y-2 ${
                rowErrors[index].length > 0
                  ? "border-[var(--error)]/50 bg-[rgba(239,68,68,0.05)]"
                  : "border-[var(--border-soft)] bg-[var(--bg-card-2)]"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs text-[var(--text-dim)]">Satır {index + 1}</span>
                <button
                  onClick={() => removeRow(index)}
                  className="p-1 rounded hover:bg-[rgba(239,68,68,0.15)] text-[var(--error)]"
                  title="Satırı çıkar"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              <div>
                <label className="block text-[11px] text-[var(--text-dim)] mb-0.5">Soru</label>
                <select
                  className={cellClass(index, "soru_metni")}
                  value={row.soru_metni ?? ""}
                  onChange={(event) => updateRow(index, "soru_metni", event.target.value)}
                >
                  <option value="">— Soru seçin —</option>
                  {/* Dosyadaki metin ankette yoksa seçim kaybolmasın diye korunur */}
                  {row.soru_metni &&
                    !questions.some((question) => question.text === row.soru_metni) && (
                      <option value={row.soru_metni}>{row.soru_metni} (eşleşmiyor)</option>
                    )}
                  {questions.map((question) => (
                    <option key={question.id} value={question.text}>
                      {question.text}
                    </option>
                  ))}
                </select>
                {fieldMessages(index, "soru_metni")}
              </div>

              <div className="grid sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-[var(--text-dim)] mb-0.5">
                    Tetikleyici şık
                  </label>
                  <select
                    className={cellClass(index, "tetikleyici")}
                    value={row.tetikleyici ?? ""}
                    onChange={(event) => updateRow(index, "tetikleyici", event.target.value)}
                    disabled={choices.length === 0}
                  >
                    <option value="">— Şık seçin —</option>
                    {row.tetikleyici &&
                      !choices.some(
                        (choice) =>
                          choice.label === row.tetikleyici || choice.value === row.tetikleyici
                      ) && <option value={row.tetikleyici}>{row.tetikleyici} (eşleşmiyor)</option>}
                    {choices.map((choice) => (
                      <option key={choice.value} value={choice.label}>
                        {choice.label} ({choice.score} puan)
                      </option>
                    ))}
                  </select>
                  {fieldMessages(index, "tetikleyici")}
                </div>

                <div>
                  <label className="block text-[11px] text-[var(--text-dim)] mb-0.5">
                    Tetikleme biçimi
                  </label>
                  <select
                    className={cellClass(index, "kademeli")}
                    value={cascade ? "EVET" : "HAYIR"}
                    onChange={(event) => updateRow(index, "kademeli", event.target.value)}
                  >
                    <option value="EVET">Kademeli — bu şık ve altındakiler</option>
                    <option value="HAYIR">Tam eşleşme — yalnızca bu şık</option>
                  </select>
                  {fieldMessages(index, "kademeli")}
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-[var(--text-dim)] mb-0.5">Başlık</label>
                <input
                  className={cellClass(index, "baslik")}
                  value={row.baslik ?? ""}
                  onChange={(event) => updateRow(index, "baslik", event.target.value)}
                />
                {fieldMessages(index, "baslik")}
              </div>

              <div>
                <label className="block text-[11px] text-[var(--text-dim)] mb-0.5">Açıklama</label>
                <textarea
                  className={`${cellClass(index, "aciklama")} resize-y`}
                  rows={2}
                  value={row.aciklama ?? ""}
                  onChange={(event) => updateRow(index, "aciklama", event.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <label className="block text-[11px] text-[var(--text-dim)] mb-0.5">Vade</label>
                  <select
                    className={cellClass(index, "vade")}
                    value={(row.vade ?? "").toLocaleUpperCase("tr")}
                    onChange={(event) => updateRow(index, "vade", event.target.value)}
                  >
                    <option value="">—</option>
                    {TIMEFRAME_KEYS.map((key) => (
                      <option key={key} value={key}>
                        {TIMEFRAME_LABELS[key]}
                      </option>
                    ))}
                  </select>
                  {fieldMessages(index, "vade")}
                </div>

                <div>
                  <label className="block text-[11px] text-[var(--text-dim)] mb-0.5">Strateji</label>
                  <select
                    className={cellClass(index, "strateji")}
                    value={(row.strateji ?? "").toLocaleUpperCase("tr")}
                    onChange={(event) => updateRow(index, "strateji", event.target.value)}
                  >
                    <option value="">—</option>
                    {STRATEGY_KEYS.map((key) => (
                      <option key={key} value={key}>
                        {STRATEGY_LABELS[key]}
                      </option>
                    ))}
                  </select>
                  {fieldMessages(index, "strateji")}
                </div>

                <div>
                  <label className="block text-[11px] text-[var(--text-dim)] mb-0.5">Maliyet</label>
                  <select
                    className={cellClass(index, "maliyet")}
                    value={(row.maliyet ?? "").toLocaleUpperCase("tr")}
                    onChange={(event) => updateRow(index, "maliyet", event.target.value)}
                  >
                    {COST_KEYS.map((key) => (
                      <option key={key} value={key}>
                        {key}
                      </option>
                    ))}
                  </select>
                  {fieldMessages(index, "maliyet")}
                </div>

                <div>
                  <label className="block text-[11px] text-[var(--text-dim)] mb-0.5">Etki (1-10)</label>
                  <input
                    className={cellClass(index, "etki")}
                    value={row.etki ?? ""}
                    onChange={(event) => updateRow(index, "etki", event.target.value)}
                  />
                  {fieldMessages(index, "etki")}
                </div>
              </div>

              {/* Puan yalnızca kademesiz öneride anlamlı */}
              {!cascade && (
                <div className="grid sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-[var(--text-dim)] mb-0.5">
                      Puan (kaç soruluk ilerleme)
                    </label>
                    <input
                      className={cellClass(index, "puan")}
                      value={row.puan ?? ""}
                      placeholder="0,5"
                      onChange={(event) => updateRow(index, "puan", event.target.value)}
                    />
                    {fieldMessages(index, "puan")}
                  </div>
                  <div>
                    <label className="block text-[11px] text-[var(--text-dim)] mb-0.5">
                      Video bağlantısı
                    </label>
                    <input
                      className={cellClass(index, "video_url")}
                      value={row.video_url ?? ""}
                      onChange={(event) => updateRow(index, "video_url", event.target.value)}
                    />
                    {fieldMessages(index, "video_url")}
                  </div>
                </div>
              )}

              {cascade && (
                <div>
                  <label className="block text-[11px] text-[var(--text-dim)] mb-0.5">
                    Video bağlantısı
                  </label>
                  <input
                    className={cellClass(index, "video_url")}
                    value={row.video_url ?? ""}
                    onChange={(event) => updateRow(index, "video_url", event.target.value)}
                  />
                  {fieldMessages(index, "video_url")}
                  <p className="text-[11px] text-[var(--text-dim)] mt-1">
                    Kademeli öneride puan elle girilmez — tamamlanınca kullanıcı bir üst şıkka çıkar.
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Eylemler */}
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border-soft)]">
        <button
          onClick={onCancel}
          disabled={saving}
          className="px-4 py-2 rounded-lg text-sm bg-[var(--bg-card-2)] text-[var(--text-muted)] disabled:opacity-50"
        >
          Vazgeç
        </button>
        <button
          onClick={() => onConfirm(rows)}
          disabled={saving || rows.length === 0 || errorCount > 0}
          title={errorCount > 0 ? "Önce hatalı satırları düzeltin veya çıkarın" : undefined}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--accent)] text-[var(--bg-deep)] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? "Kaydediliyor..." : `${rows.length} öneriyi kaydet`}
        </button>
      </div>
    </div>
  );
}
