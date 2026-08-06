"use client";

import { useCallback, useMemo, useState } from "react";
import { AlertCircle, CheckCircle, Filter, Trash2, X } from "lucide-react";
import {
  AXIS_TYPES,
  FieldError,
  ImportField,
  ImportRow,
  QUESTION_TYPES,
  StructureOption,
  resolveStructure,
  validateQuestionRow,
} from "@/lib/question-import";
import { parseScoredOptions } from "@/lib/question-options";

export type PreviewPayload = {
  rows: { rowNumber: number; values: ImportRow; errors: FieldError[] }[];
  structure: StructureOption[];
  skippedRows: number;
};

type Props = {
  payload: PreviewPayload;
  /** Anket geneli yüklemede kategori kolonları gösterilir. */
  withStructure: boolean;
  saving: boolean;
  onCancel: () => void;
  onConfirm: (rows: ImportRow[]) => void;
};

const TYPE_LABELS: Record<string, string> = {
  COKTAN_SECMELI: "Çoktan seçmeli",
  OLCEK_1_5: "Ölçek 1-5",
  EVET_HAYIR: "Evet / Hayır",
  KADEMELI_PUANLAMA: "Kademeli puanlama",
};

const AXIS_LABELS: Record<string, string> = {
  VELOCITY: "Hız",
  ENDURANCE: "Olgunluk",
};

const inputClass =
  "w-full px-2 py-1.5 text-sm bg-[var(--bg-card)] border border-[var(--border-soft)] rounded " +
  "text-[var(--text-main)] focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent";

/** Kutunun altında "3 şık: Düşük(1), Orta(3), Yüksek(5)" özeti gösterir. */
function optionSummary(raw: string | undefined): string {
  const { options, errors } = parseScoredOptions(raw);
  if (!raw?.trim() || errors.length > 0 || options.length === 0) {
    return 'Şıklar: Etiket = puan, aralarında ";"';
  }
  return `${options.length} şık: ${options.map((option) => `${option.label} (${option.score})`).join(", ")}`;
}

function uniqueSorted(values: (string | null)[]): string[] {
  return Array.from(new Set(values.filter((value): value is string => !!value))).sort((a, b) =>
    a.localeCompare(b, "tr")
  );
}

export default function QuestionImportPreview({
  payload,
  withStructure,
  saving,
  onCancel,
  onConfirm,
}: Props) {
  const [rows, setRows] = useState<ImportRow[]>(() => payload.rows.map((row) => ({ ...row.values })));
  const [onlyErrors, setOnlyErrors] = useState(false);

  const structure = payload.structure;

  // Düzenleme yapıldıkça sunucudakiyle aynı kurallarla yeniden doğrulanır.
  const rowErrors = useMemo(
    () =>
      rows.map((row) => {
        const errors = withStructure ? [...resolveStructure(row, structure).errors] : [];
        errors.push(...validateQuestionRow(row));
        return errors;
      }),
    [rows, structure, withStructure]
  );

  const errorCount = rowErrors.filter((errors) => errors.length > 0).length;
  const validCount = rows.length - errorCount;

  const categories = useMemo(() => uniqueSorted(structure.map((option) => option.category)), [structure]);

  const subCategoriesFor = useCallback(
    (category: string) =>
      uniqueSorted(
        structure.filter((option) => option.category === category).map((option) => option.subCategory)
      ),
    [structure]
  );

  const subLevelsFor = useCallback(
    (category: string, subCategory: string) =>
      uniqueSorted(
        structure
          .filter((option) => option.category === category && option.subCategory === subCategory)
          .map((option) => option.subLevel)
      ),
    [structure]
  );

  const updateRow = (index: number, field: ImportField, value: string) => {
    setRows((current) =>
      current.map((row, rowIndex) => {
        if (rowIndex !== index) return row;
        const next = { ...row, [field]: value };

        // Üst seviye değişince alttaki seçim geçersizleşir.
        if (field === "kategori_adi") {
          next.alt_kategori_adi = "";
          next.alt_seviye_adi = "";
        }
        if (field === "alt_kategori_adi") {
          next.alt_seviye_adi = "";
        }
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

  const errorFor = (index: number, field: ImportField) =>
    rowErrors[index].filter((error) => error.field === field);

  const cellClass = (index: number, field: ImportField) =>
    errorFor(index, field).length > 0
      ? `${inputClass} border-[var(--error)] ring-1 ring-[var(--error)]`
      : inputClass;

  const renderTypeFields = (row: ImportRow, index: number) => {
    const type = (row.soru_tipi ?? "").toUpperCase();

    if (type === "COKTAN_SECMELI") {
      return (
        <div>
          <textarea
            className={`${cellClass(index, "secenekler")} resize-y`}
            rows={2}
            value={row.secenekler ?? ""}
            placeholder="Düşük = 1; Orta = 3; Yüksek = 5"
            onChange={(event) => updateRow(index, "secenekler", event.target.value)}
          />
          <p className="text-[11px] text-[var(--text-dim)] mt-1">
            {optionSummary(row.secenekler)}
          </p>
        </div>
      );
    }

    if (type === "EVET_HAYIR") {
      return (
        <div className="flex gap-2">
          <label className="flex-1">
            <span className="block text-[11px] text-[var(--text-dim)] mb-0.5">Evet puanı</span>
            <input
              className={cellClass(index, "evet_puani")}
              value={row.evet_puani ?? ""}
              onChange={(event) => updateRow(index, "evet_puani", event.target.value)}
            />
          </label>
          <label className="flex-1">
            <span className="block text-[11px] text-[var(--text-dim)] mb-0.5">Hayır puanı</span>
            <input
              className={cellClass(index, "hayir_puani")}
              value={row.hayir_puani ?? ""}
              onChange={(event) => updateRow(index, "hayir_puani", event.target.value)}
            />
          </label>
        </div>
      );
    }

    if (type === "KADEMELI_PUANLAMA") {
      return (
        <div className="space-y-1.5">
          <input
            className={cellClass(index, "esik_sorusu")}
            value={row.esik_sorusu ?? ""}
            placeholder="Eşik sorusu — örn: ISO sertifikalarınız var mı?"
            onChange={(event) => updateRow(index, "esik_sorusu", event.target.value)}
          />
          <textarea
            className={`${cellClass(index, "alt_secenekler")} resize-y`}
            rows={2}
            value={row.alt_secenekler ?? ""}
            placeholder="ISO 9001 = 2; ISO 14001 = 2"
            onChange={(event) => updateRow(index, "alt_secenekler", event.target.value)}
          />
          <p className="text-[11px] text-[var(--text-dim)]">{optionSummary(row.alt_secenekler)}</p>
        </div>
      );
    }

    return <span className="text-xs text-[var(--text-dim)]">Puanlama 1-5 arası otomatik</span>;
  };

  return (
    <div className="space-y-4">
      {/* Özet */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="text-center p-2 bg-[var(--bg-card)] rounded-lg">
          <div className="text-lg font-bold text-[var(--text-muted)]">{rows.length}</div>
          <div className="text-xs text-[var(--text-dim)]">Okunan Satır</div>
        </div>
        <div className="text-center p-2 bg-[var(--bg-card)] rounded-lg">
          <div className="text-lg font-bold text-[var(--success)]">{validCount}</div>
          <div className="text-xs text-[var(--text-dim)]">Aktarılacak</div>
        </div>
        <div className="text-center p-2 bg-[var(--bg-card)] rounded-lg">
          <div className="text-lg font-bold text-[var(--error)]">{errorCount}</div>
          <div className="text-xs text-[var(--text-dim)]">Düzeltilecek</div>
        </div>
        <div className="text-center p-2 bg-[var(--bg-card)] rounded-lg">
          <div className="text-lg font-bold text-[var(--text-dim)]">{payload.skippedRows}</div>
          <div className="text-xs text-[var(--text-dim)]">Atlanan (boş)</div>
        </div>
      </div>

      {errorCount > 0 ? (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-[var(--error)]/10 border border-[var(--error)]/40">
          <AlertCircle size={18} className="text-[var(--error)] shrink-0 mt-0.5" />
          <p className="text-sm text-[var(--error)]">
            {errorCount} satırda düzeltilmesi gereken alan var. Kırmızı kutuları düzeltin ya da o satırları silin;
            hatalı satır kaldığı sürece <strong>hiçbir soru aktarılmaz</strong>.
          </p>
        </div>
      ) : (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-[var(--success)]/10 border border-[var(--success)]/40">
          <CheckCircle size={18} className="text-[var(--success)] shrink-0 mt-0.5" />
          <p className="text-sm text-[var(--success)]">
            Tüm satırlar geçerli. Aşağıdaki listeyi kontrol edip &quot;Onayla ve Aktar&quot; deyin.
          </p>
        </div>
      )}

      {/* Araç çubuğu */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setOnlyErrors((current) => !current)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border ${
            onlyErrors
              ? "bg-[var(--accent-dark)] text-white border-transparent"
              : "bg-[var(--bg-card)] text-[var(--text-muted)] border-[var(--border-soft)]"
          }`}
        >
          <Filter size={15} />
          Sadece hatalılar
        </button>
        {errorCount > 0 && (
          <button
            type="button"
            onClick={removeErrorRows}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm bg-[var(--bg-card)] text-[var(--error)] border border-[var(--error)]/40"
          >
            <Trash2 size={15} />
            Hatalı {errorCount} satırı sil
          </button>
        )}
        <span className="text-xs text-[var(--text-dim)] ml-auto">
          Değişiklikler yalnızca bu ekranda; Excel dosyanız değişmez.
        </span>
      </div>

      {/* Satırlar */}
      <div className="max-h-[55vh] overflow-auto rounded-lg border border-[var(--border-soft)]">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-[var(--bg-card-2)] z-10">
            <tr className="text-left text-xs text-[var(--text-dim)]">
              <th className="p-2 w-10">#</th>
              {withStructure && <th className="p-2 min-w-[300px]">Konum</th>}
              <th className="p-2 min-w-[280px]">Soru</th>
              <th className="p-2 min-w-[150px]">Tip</th>
              <th className="p-2 w-24">Ağırlık</th>
              <th className="p-2 w-32">Eksen</th>
              <th className="p-2 min-w-[280px]">Tipe özel alanlar</th>
              <th className="p-2 w-10" />
            </tr>
          </thead>
          <tbody>
            {visibleIndexes.map((index) => {
              const row = rows[index];
              const errors = rowErrors[index];
              const hasError = errors.length > 0;

              return (
                <tr
                  key={index}
                  className={`border-t border-[var(--border-soft)] align-top ${
                    hasError ? "bg-[var(--error)]/5" : ""
                  }`}
                >
                  <td className="p-2 text-xs text-[var(--text-dim)] pt-4">{index + 1}</td>

                  {withStructure && (
                    <td className="p-2 space-y-1.5">
                      <select
                        className={cellClass(index, "kategori_adi")}
                        value={row.kategori_adi ?? ""}
                        onChange={(event) => updateRow(index, "kategori_adi", event.target.value)}
                      >
                        <option value="">— Kategori seçin —</option>
                        {categories.map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </select>
                      <select
                        className={cellClass(index, "alt_kategori_adi")}
                        value={row.alt_kategori_adi ?? ""}
                        onChange={(event) => updateRow(index, "alt_kategori_adi", event.target.value)}
                      >
                        <option value="">— Alt kategori seçin —</option>
                        {subCategoriesFor(row.kategori_adi ?? "").map((subCategory) => (
                          <option key={subCategory} value={subCategory}>
                            {subCategory}
                          </option>
                        ))}
                      </select>
                      {subLevelsFor(row.kategori_adi ?? "", row.alt_kategori_adi ?? "").length > 0 && (
                        <select
                          className={cellClass(index, "alt_seviye_adi")}
                          value={row.alt_seviye_adi ?? ""}
                          onChange={(event) => updateRow(index, "alt_seviye_adi", event.target.value)}
                        >
                          <option value="">— Alt seviye seçin —</option>
                          {subLevelsFor(row.kategori_adi ?? "", row.alt_kategori_adi ?? "").map((subLevel) => (
                            <option key={subLevel} value={subLevel}>
                              {subLevel}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                  )}

                  <td className="p-2">
                    <textarea
                      className={`${cellClass(index, "soru_metni")} resize-y`}
                      rows={2}
                      value={row.soru_metni ?? ""}
                      onChange={(event) => updateRow(index, "soru_metni", event.target.value)}
                    />
                  </td>

                  <td className="p-2">
                    <select
                      className={cellClass(index, "soru_tipi")}
                      value={(row.soru_tipi ?? "").toUpperCase()}
                      onChange={(event) => updateRow(index, "soru_tipi", event.target.value)}
                    >
                      <option value="">— Seçin —</option>
                      {QUESTION_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {TYPE_LABELS[type]}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td className="p-2">
                    <input
                      className={cellClass(index, "soru_agirligi")}
                      value={row.soru_agirligi ?? ""}
                      onChange={(event) => updateRow(index, "soru_agirligi", event.target.value)}
                    />
                  </td>

                  <td className="p-2">
                    <select
                      className={cellClass(index, "ironman_ekseni")}
                      value={(row.ironman_ekseni ?? "").toUpperCase()}
                      onChange={(event) => updateRow(index, "ironman_ekseni", event.target.value)}
                    >
                      <option value="">— Seçin —</option>
                      {AXIS_TYPES.map((axis) => (
                        <option key={axis} value={axis}>
                          {AXIS_LABELS[axis]}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td className="p-2">
                    {renderTypeFields(row, index)}
                    {hasError && (
                      <ul className="mt-2 space-y-0.5">
                        {errors.map((error, errorIndex) => (
                          <li key={errorIndex} className="text-[11px] text-[var(--error)]">
                            • {error.message}
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>

                  <td className="p-2 pt-3">
                    <button
                      type="button"
                      onClick={() => removeRow(index)}
                      title="Bu satırı aktarma"
                      className="text-[var(--text-dim)] hover:text-[var(--error)]"
                    >
                      <X size={16} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {visibleIndexes.length === 0 && (
          <p className="p-6 text-center text-sm text-[var(--text-dim)]">
            {rows.length === 0 ? "Aktarılacak satır kalmadı." : "Hatalı satır yok."}
          </p>
        )}
      </div>

      {/* Aksiyonlar */}
      <div className="flex flex-wrap justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="px-4 py-2 bg-[var(--border-soft)] text-[var(--text-muted)] rounded-lg hover:bg-[var(--ui-passive)] disabled:opacity-50"
        >
          Vazgeç
        </button>
        <button
          type="button"
          onClick={() => onConfirm(rows)}
          disabled={saving || rows.length === 0 || errorCount > 0}
          className="px-4 py-2 bg-[var(--accent-dark)] text-white rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? "Aktarılıyor..." : `Onayla ve Aktar (${rows.length} soru)`}
        </button>
      </div>
    </div>
  );
}
