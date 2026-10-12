export const QUADRANT_LABELS: Record<string, string> = { IRONMAN: "Demir Adam", SPRINTER: "Sprinter", MARATHON_RUNNER: "Maraton Koşucusu", WALKER: "Yaya" };
export const STRATEGY_LABELS: Record<string, string> = { QUICK_WIN: "Hızlı kazanım", PROJECT: "Proje", BIG_BET: "Büyük yatırım" };
export const PORTFOLIO_STATUS_LABELS: Record<string, string> = { READY: "Hazır", NOT_STARTED: "Başlamadı", PLANNED: "Planlandı", IN_PROGRESS: "Devam ediyor", COMPLETED: "Tamamlandı", CANCELLED: "İptal edildi" };
export const TIMEFRAME_LABELS: Record<string, string> = { SHORT_TERM: "0–6 ay", MEDIUM_TERM: "6–18 ay", LONG_TERM: "18+ ay" };
export const decimal = (value: number | null | undefined) => value == null ? "—" : value.toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
export const percentage = (value: number | null | undefined) => value == null ? "—" : "%" + decimal(value);
export const signed = (value: number | null | undefined) => value == null ? "—" : (value >= 0 ? "+" : "") + decimal(value);
export function esgSymbol(name: string) {
  const normalized = name.toLocaleLowerCase("tr-TR");
  if (/çevre|environment|ekoloji/.test(normalized)) return "E";
  if (/sosyal|social/.test(normalized)) return "S";
  if (/yöneti|yönetim|governance/.test(normalized)) return "G";
  return null;
}
