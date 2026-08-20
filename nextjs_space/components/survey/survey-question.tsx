"use client";

import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Upload, X, FileText, Check, Loader2 } from "lucide-react";

interface Question {
  id: string;
  text: string;
  type: string;
  options?: any[] | null;
  conditionalOptions?: any;
  requiresEvidence: boolean;
}

interface SurveyQuestionProps {
  question: Question;
  value?: string;
  onAnswer: (questionId: string, value: string) => void;
  onUpload?: (questionId: string, file: File) => void;
  onRemoveFile?: (questionId: string) => void;
  uploadedFile?: string | null;
  isUploading?: boolean;
  /** Yönetici önizlemesi: kanıt alanı gösterilir ama dosya yüklenemez. */
  previewMode?: boolean;
}

export default function SurveyQuestion({
  question,
  value,
  onAnswer,
  onUpload,
  onRemoveFile,
  uploadedFile,
  isUploading = false,
  previewMode = false
}: SurveyQuestionProps) {
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const q = question ?? {};

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const files = e.dataTransfer?.files;
    if (files?.[0] && onUpload) {
      onUpload(q?.id, files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target?.files;
    if (files?.[0] && onUpload) {
      onUpload(q?.id, files[0]);
    }
  };

  const renderInput = () => {
    switch (q?.type) {
      case "SCALE":
        return (
          <div className="flex flex-col gap-3">
            <div className="flex justify-between text-sm text-[var(--text-dim)] px-1">
              <span>Düşük Olgunluk</span>
              <span>Yüksek Olgunluk</span>
            </div>
            <div className="flex gap-2" role="radiogroup" aria-label="Olgunluk seviyesi (1 en düşük, 5 en yüksek)">
              {[1, 2, 3, 4, 5].map((num) => (
                <button
                  key={num}
                  type="button"
                  role="radio"
                  aria-checked={value === String(num)}
                  aria-label={`Seviye ${num}${num === 1 ? " - en düşük olgunluk" : num === 5 ? " - en yüksek olgunluk" : ""}`}
                  onClick={() => onAnswer?.(q?.id, String(num))}
                  className={`flex-1 py-4 rounded-lg font-semibold text-lg transition-all border-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-card)] ${
                    value === String(num)
                      ? "bg-[var(--accent-solid)] text-[var(--on-accent)] border-[var(--accent)] shadow-[0_0_20px_rgba(12,193,195,0.6)] scale-105 ring-2 ring-[var(--accent)]/30"
                      : "bg-[var(--bg-card-2)] text-[var(--text-muted)] border-[var(--border-soft)] hover:bg-[var(--border-soft)] hover:border-[var(--accent)]/50"
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>
        );

      case "YES_NO":
        return (
          <div className="flex gap-4">
            {["yes", "no"].map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={value === option}
                aria-label={option === "yes" ? "Evet" : "Hayır"}
                onClick={() => onAnswer?.(q?.id, option)}
                className={`flex-1 py-4 rounded-lg font-medium text-lg capitalize transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-card)] ${
                  value === option
                    ? "bg-[var(--accent-solid)] text-[var(--on-accent)] shadow-lg"
                    : "bg-[var(--bg-card-2)] text-[var(--text-muted)] hover:bg-[var(--border-soft)]"
                }`}
              >
                {option === "yes" ? <Check className="inline mr-2" size={20} /> : null}
                {option === "yes" ? "Evet" : "Hayır"}
              </button>
            ))}
          </div>
        );

      case "MULTIPLE_CHOICE":
        const options = q?.options as any[] ?? [];
        return (
          <div className="grid gap-3">
            {options?.map((option: any) => (
              <button
                key={option?.value}
                type="button"
                aria-pressed={value === option?.value}
                onClick={() => onAnswer?.(q?.id, option?.value)}
                className={`p-4 rounded-lg text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-card)] ${
                  value === option?.value
                    ? "bg-[var(--accent-solid)] text-[var(--on-accent)] shadow-lg"
                    : "bg-[var(--bg-card-2)] text-[var(--text-muted)] hover:bg-[var(--border-soft)]"
                }`}
              >
                {option?.label ?? option?.value ?? ''}
              </button>
            ))}
          </div>
        );

      case "CONDITIONAL_CHOICE":
        const condOpts = q?.conditionalOptions || {};
        const thresholdQuestion = condOpts.thresholdQuestion || q?.text;
        const yesLabel = condOpts.yesLabel || 'Evet';
        const noLabel = condOpts.noLabel || 'Hayır';
        const subOptions = condOpts.options || [];
        
        // Parse value: { threshold: 'yes'|'no', selected: string[] }
        let parsedValue = { threshold: '', selected: [] as string[] };
        try {
          if (value) {
            parsedValue = JSON.parse(value);
          }
        } catch {
          // Ignore parse errors
        }

        const handleThresholdChange = (choice: string) => {
          if (choice === 'no') {
            // If "no" is selected, reset and save 0 score
            onAnswer?.(q?.id, JSON.stringify({ threshold: 'no', selected: [] }));
          } else {
            // If "yes" is selected, keep previous selections if any
            onAnswer?.(q?.id, JSON.stringify({ threshold: 'yes', selected: parsedValue.selected || [] }));
          }
        };

        const handleOptionToggle = (optionValue: string) => {
          const currentSelected = parsedValue.selected || [];
          const newSelected = currentSelected.includes(optionValue)
            ? currentSelected.filter(v => v !== optionValue)
            : [...currentSelected, optionValue];
          onAnswer?.(q?.id, JSON.stringify({ threshold: 'yes', selected: newSelected }));
        };

        return (
          <div className="space-y-4">
            {/* Threshold Question */}
            <div>
              <p className="text-sm font-medium text-[var(--text-muted)] mb-3">{thresholdQuestion}</p>
              <div className="flex gap-4">
                {[{ value: 'yes', label: yesLabel }, { value: 'no', label: noLabel }].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={parsedValue.threshold === option.value}
                    onClick={() => handleThresholdChange(option.value)}
                    className={`flex-1 py-3 rounded-lg font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-card)] ${
                      parsedValue.threshold === option.value
                        ? "bg-[var(--accent-solid)] text-[var(--on-accent)] shadow-lg"
                        : "bg-[var(--bg-card-2)] text-[var(--text-muted)] hover:bg-[var(--border-soft)]"
                    }`}
                  >
                    {option.value === "yes" ? <Check className="inline mr-2" size={18} /> : null}
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Sub Options (only shown if "yes" is selected) */}
            {parsedValue.threshold === 'yes' && subOptions.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2 pt-4 border-t border-[var(--border-soft)]"
              >
                <p className="text-sm font-medium text-[var(--text-muted)] mb-2">
                  Lütfen sahip olduklarınızı seçin (birden fazla seçilebilir):
                </p>
                {subOptions.map((option: any) => {
                  const isSelected = parsedValue.selected.includes(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => handleOptionToggle(option.value)}
                      className={`w-full p-4 rounded-lg text-left transition-all flex items-center justify-between focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-card)] ${
                        isSelected
                          ? "bg-[var(--accent-solid)] text-[var(--on-accent)] shadow-lg"
                          : "bg-[var(--bg-card-2)] text-[var(--text-muted)] hover:bg-[var(--border-soft)]"
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        <span className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                          isSelected ? "border-white bg-[var(--bg-card)]/20" : "border-[var(--border-soft)]"
                        }`}>
                          {isSelected && <Check size={14} />}
                        </span>
                        {option.label}
                      </span>
                      <span className={`text-sm font-medium ${isSelected ? "text-white/90" : "text-[var(--accent)]"}`}>
                        +{option.score}p
                      </span>
                    </button>
                  );
                })}
              </motion.div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <motion.div
      className="theme-card p-6 border border-[var(--border-soft)]"
    >
      <h3 className="text-lg font-medium text-[var(--text-main)] mb-6">{q?.text ?? ''}</h3>
      
      {renderInput()}

      {q?.requiresEvidence && (
        <div className="mt-6 pt-6 border-t border-[var(--border-soft)]">
          <p className="text-sm text-[var(--text-muted)] mb-3 flex items-center gap-2">
            <FileText size={16} className="text-[var(--accent-alt)]" />
            Bu soru için kanıt belgesi gereklidir
          </p>
          
          {previewMode ? (
            <div className="border-2 border-dashed border-[var(--border-soft)] rounded-lg p-6 text-center opacity-60">
              <Upload className="mx-auto text-[var(--text-dim)] mb-2" size={24} />
              <p className="text-sm text-[var(--text-dim)]">Kullanıcı burada belge yükler</p>
              <p className="text-xs text-[var(--text-dim)] mt-1">Önizlemede dosya yüklenemez</p>
            </div>
          ) : isUploading ? (
            <div className="flex items-center justify-center p-6 bg-[var(--accent-quiet)] rounded-lg border-2 border-[var(--accent)]/30">
              <Loader2 className="animate-spin text-[var(--accent)] mr-2" size={20} />
              <span className="text-[var(--accent)] text-sm">Dosya yükleniyor...</span>
            </div>
          ) : uploadedFile ? (
            <div className="flex items-center justify-between p-3 bg-[var(--accent-soft)] rounded-lg border border-[var(--accent)]">
              <span className="text-[var(--accent)] text-sm flex items-center gap-2">
                <Check size={16} /> {uploadedFile}
              </span>
              <button 
                onClick={() => onRemoveFile?.(q?.id)}
                className="text-[var(--text-dim)] hover:text-[var(--error)] transition-colors p-1 rounded hover:bg-[var(--error-bg)]"
                title="Dosyayı kaldır"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <div
              role="button"
              tabIndex={0}
              aria-label="Kanıt belgesi yükle: dosyayı buraya bırakın veya seçmek için tıklayın"
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                dragActive
                  ? "border-[var(--accent-alt)] bg-[var(--accent-quiet)]"
                  : "border-[var(--border-soft)] hover:border-[var(--accent-alt)] hover:bg-[var(--bg-card-2)]"
              }`}
            >
              <Upload className="mx-auto text-[var(--text-dim)] mb-2" size={24} />
              <p className="text-sm text-[var(--text-dim)]">Dosyayı buraya bırakın veya yüklemek için tıklayın</p>
              <p className="text-xs text-[var(--text-dim)] mt-1">PDF, 10MB&apos;a kadar görseller</p>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                onChange={handleFileChange}
              />
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}