export const UNIT_RESULT_LABELS: Record<string, string> = {
  NOT_STARTED: "Başlamadı", IN_PROGRESS: "Devam ediyor", READY_TO_SUBMIT: "Gönderime hazır",
  AWAITING_SUBMISSION: "Gönderim bekliyor", SUBMITTED: "Gönderildi",
};

export const UNIT_ROADMAP_LABELS: Record<string, string> = {
  NOT_STARTED: "Başlamadı", PLANNED: "Planlandı", IN_PROGRESS: "Devam ediyor", COMPLETED: "Tamamlandı", CANCELLED: "İptal edildi",
};

/** Olgunluk seviyesi (%0-19 Başlangıç … %80+ Lider); sunucudaki maturityFromPercentage ile aynı eşikler. */
export function maturityLabel(percentage: number | null) {
  if (percentage === null) return "—";
  if (percentage >= 80) return "Lider";
  if (percentage >= 60) return "Olgun";
  if (percentage >= 40) return "Gelişen";
  if (percentage >= 20) return "Farkındalık";
  return "Başlangıç";
}

/** Birim panosu: birim yöneticisinde ana pano, ADMIN'de birim takibi (ADMIN'in /dashboard'u kişisel panodur). */
export function unitDashboardHref(role: string | undefined, params: Record<string, string | null | undefined>) {
  const query = new URLSearchParams(Object.entries(params).filter((entry): entry is [string, string] => Boolean(entry[1])));
  return (role === "UNIT_MANAGER" ? "/dashboard" : "/unit-manager") + (query.toString() ? "?" + query.toString() : "");
}

export function unitDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul", day: "2-digit", month: "short", year: "numeric" }) : "—";
}

export function unitScore(value: number | null) {
  return value && Number.isFinite(value) ? value.toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 2 }) : "—";
}

export function surveyAnswer(question: { value: string | null; type: string; options: unknown; conditionalOptions: unknown }) {
  if (question.value == null || !question.value.trim()) return "Cevaplanmadı";
  const options = Array.isArray(question.options) ? question.options as { value?: string; label?: string }[] : [];
  const choice = options.find(option => option.value === question.value);
  if (choice?.label) return choice.label;
  if (question.type === "YES_NO") return question.value === "yes" ? "Evet" : question.value === "no" ? "Hayır" : question.value;
  if (question.type === "CONDITIONAL_CHOICE") {
    try {
      const parsed = JSON.parse(question.value) as { threshold?: string; selected?: string[] };
      const conditional = question.conditionalOptions as { options?: { value?: string; label?: string }[] } | null;
      const nestedOptions = conditional?.options;
      const nested = Array.isArray(question.conditionalOptions)
        ? question.conditionalOptions as { value?: string; label?: string }[]
        : Array.isArray(nestedOptions) ? nestedOptions : [];
      const selected = Array.isArray(parsed.selected) ? parsed.selected.map(value => nested.find(option => option.value === value)?.label ?? value) : [];
      return (parsed.threshold === "yes" ? "Evet" : "Hayır") + (selected.length ? " · " + selected.join(", ") : "");
    } catch { return question.value; }
  }
  return question.value;
}
