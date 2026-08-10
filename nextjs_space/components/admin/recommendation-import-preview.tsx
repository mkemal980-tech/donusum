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
import { Button } from "@/components/ui/button";

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
  /** Satırların eşleştirildiği anket — hangi ankete baktığımız hep görünür olmalı. */
  surveyName?: string;
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

/**
 * Bir seferde çizilecek satır sayısı.
 *
 * 284 satırlık bir yüklemede her satır kendi soru listesini de çizdiği için
 * (71 şık × 284 satır ≈ 20 bin öğe) tarayıcı kilitleniyordu. Satırlar artık
 * parça parça açılır; onay düğmesi listenin altında beklemez.
 */
const PAGE_SIZE = 25;

export default function RecommendationImportPreview({
  payload,
  saving,
  surveyName,
  onCancel,
  onConfirm,
}: Props) {
  const [rows, setRows] = useState<RecommendationImportRow[]>(() =>
    payload.rows.map((row) => ({ ...row.values }))
  );
  const [onlyErrors, setOnlyErrors] = useState(false);
  const [limit, setLimit] = useState(PAGE_SIZE);
  // Soru listesi ağır olduğu için yalnızca değiştirilmek istenen satırda açılır.
  const [questionEditing, setQuestionEditing] = useState<number[]>([]);

  const questions = payload.questions;

  // Düzenleme yapıldıkça sunucudakiyle aynı kurallarla yeniden doğrulanır.
  const rowErrors = useMemo(
    () =>
      rows.map((row) => {
        const match = matchQuestion(row, questions);
        return validateRecommendationRow(
          row,
          match.found ? match.question : null,
          match.found ? undefined : match.reason
        );
      }),
    [rows, questions]
  );

  // Merdiven uyarıları da canlı güncellenir; satır silince uyarı kaybolmalı.
  const warnings = useMemo(() => checkLadders(rows, questions), [rows, questions]);

  const errorCount = rowErrors.filter((errors) => errors.length > 0).length;
  const validCount = rows.length - errorCount;

  // Soru metni dolu olduğu hâlde ankette karşılığı bulunamayan satırlar.
  // Hepsi birden eşleşmiyorsa sorun satırlarda değil, seçilen ankettedir —
  // 284 satırı tek tek okumak yerine bunu en üstte söylemek gerekir.
  const unmatchedCount = useMemo(
    () =>
      rows.filter((row) => (row.soru_metni ?? "").trim() && !matchQuestion(row, questions).found)
        .length,
    [rows, questions]
  );
  const allUnmatched = rows.length > 0 && unmatchedCount === rows.length;

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

  const matchingIndexes = rows
    .map((_, index) => index)
    .filter((index) => !onlyErrors || rowErrors[index].length > 0);
  const visibleIndexes = matchingIndexes.slice(0, limit);
  const hiddenCount = matchingIndexes.length - visibleIndexes.length;

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
        {/* Satırlar hangi anketle eşleştiriliyor — önizlemede de görünür kalır */}
        <span className="text-sm text-[var(--text-dim)]">
          {surveyName ? `Anket: ${surveyName} · ` : ""}
          {questions.length} soru
        </span>

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

      {/* Tek satır bile eşleşmediyse suç dosyada değil, seçilen ankettedir */}
      {allUnmatched && (
        <div className="p-3 rounded-lg bg-[rgba(239,68,68,0.1)] border border-[var(--error)]/40">
          <p className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--error)] mb-1">
            <AlertCircle size={15} /> Hiçbir satır ankete bağlanamadı
          </p>
          <p className="text-xs text-[var(--text-muted)]">
            Dosyadaki {rows.length} sorunun hiçbiri{" "}
            {surveyName ? `«${surveyName}» anketinde` : "seçili ankette"} bulunamadı
            {questions.length === 0
              ? " — bu ankette hiç soru yok."
              : ` (ankette ${questions.length} soru var).`}{" "}
            Büyük ihtimalle yanlış anket seçildi: <strong>Vazgeç</strong> deyip anketi değiştirin ve
            dosyayı tekrar yükleyin.
          </p>
        </div>
      )}

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
                {/* Soru listesi anketin bütün sorularını taşır; eşleşen satırda
                    metni göstermek yeterli, liste ancak istendiğinde açılır. */}
                {questionEditing.includes(index) || errorFor(index, "soru_metni").length > 0 ? (
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
                ) : (
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm text-[var(--text-main)]">{row.soru_metni}</p>
                    <button
                      onClick={() => setQuestionEditing((current) => [...current, index])}
                      className="shrink-0 text-xs text-[var(--accent)] hover:underline"
                    >
                      Değiştir
                    </button>
                  </div>
                )}
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

        {hiddenCount > 0 && (
          <div className="flex items-center justify-center gap-2 py-2">
            <Button
              onClick={() => setLimit((current) => current + PAGE_SIZE)}
              variant="secondary"
              className="text-sm text-[var(--text-muted)] hover:text-[var(--accent)]"
            >
              {hiddenCount} satır daha var — {Math.min(PAGE_SIZE, hiddenCount)} tanesini göster
            </Button>
            <button
              onClick={() => setLimit(matchingIndexes.length)}
              className="px-4 py-2 rounded-lg text-sm text-[var(--text-dim)] hover:text-[var(--text-main)]"
            >
              Tümünü göster
            </button>
          </div>
        )}
      </div>

      {/* Eylemler — kaydetmek için satırların sonuna inmek gerekmez */}
      <div className="sticky bottom-0 flex items-center justify-end gap-2 pt-2 bg-[var(--bg-card)] border-t border-[var(--border-soft)]">
        <Button
          onClick={onCancel}
          disabled={saving}
          variant="secondary"
          className="text-sm text-[var(--text-muted)]"
        >
          Vazgeç
        </Button>
        <Button
          onClick={() => onConfirm(rows)}
          disabled={saving || rows.length === 0 || errorCount > 0}
          title={errorCount > 0 ? "Önce hatalı satırları düzeltin veya çıkarın" : undefined}
          className="text-sm font-medium text-[var(--bg-deep)] disabled:cursor-not-allowed"
        >
          {saving ? "Kaydediliyor..." : `${rows.length} öneriyi kaydet`}
        </Button>
      </div>
    </div>
  );
}
