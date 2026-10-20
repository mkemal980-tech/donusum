import { redirect } from "next/navigation";

/** "Birim takibi" tek panoya katıldı; seçim (birim, anket, dönem, sekme) korunur. */
export default function UnitManagerPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const query = new URLSearchParams(Object.entries(searchParams).flatMap(([key, value]) => typeof value === "string" ? [[key, value]] : []));
  redirect("/dashboard" + (query.toString() ? "?" + query.toString() : ""));
}
