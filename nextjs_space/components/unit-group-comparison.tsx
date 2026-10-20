"use client";
import { useEffect, useState } from "react";
import Panel from "./ui/panel";
import type { UnitGroupComparison as Comparison } from "@/lib/unit-group-comparison";
import { percentage, signed } from "@/lib/unit-management-display";

/**
 * Üyenin kendi panosunda birim ortalamasıyla kıyas. Sunucu yalnızca toplu
 * sayı döndürür; diğer üyelerin adı veya tekil puanı bu bileşene gelmez.
 */
export function UnitGroupComparison({ assessmentId, revision }: { assessmentId: string; revision: number }) {
  const [data, setData] = useState<Comparison | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    setData(null); setFailed(false);
    fetch("/api/unit-manager/group-comparison?assessmentId=" + encodeURIComponent(assessmentId), { cache: "no-store", signal: abort.signal })
      .then(async response => { if (!response.ok) throw new Error(); return response.json(); })
      .then(value => { if (!abort.signal.aborted) setData(value); })
      .catch(() => { if (!abort.signal.aborted) setFailed(true); });
    return () => abort.abort();
  }, [assessmentId, revision]);

  if (failed) return <p className="mb-5 t-sm text-[var(--ink-3)]">Birim kıyası şu anda yüklenemedi.</p>;
  if (!data) return <div className="skeleton mb-6 h-24" aria-label="Birim kıyası yükleniyor" />;
  if (!data.available) {
    if (data.reason === "NO_GROUP") return null;
    return <p className="mb-5 t-sm text-[var(--ink-2)]">{data.reason === "NOT_SUBMITTED"
      ? `${data.groupName} ortalamasıyla kıyas, değerlendirme gönderildiğinde görünür.`
      : `${data.groupName} ortalaması en az ${data.required} üye gönderdiğinde görünür; şu an ${data.count} üye gönderdi.`}</p>;
  }
  return <Panel className="mb-6" title={`${data.groupName} ile kıyas`} description={`Aynı anket ve dönemde gönderen ${data.count} üyenin ortalaması · diğer üyelerin tekil puanı gösterilmez`}
    actions={<span className="badge badge-primary">Yüzdelik dilim %{data.band.value}</span>}>
    <div className="overflow-x-auto"><table className="theme-table"><thead><tr><th>Kapsam</th><th className="!text-right">Siz</th><th className="!text-right">Birim ortalaması</th><th className="!text-right">Fark</th></tr></thead><tbody>
      <tr><td className="font-medium text-[var(--ink)]">Genel puan</td><td className="text-right tabular font-medium text-[var(--ink)]">{percentage(data.overall.mine)}</td><td className="text-right tabular">{percentage(data.overall.average)}</td><td className="text-right tabular">{signed(data.overall.difference)}</td></tr>
      {data.categories.map(row => <tr key={row.id}><td>{row.name}</td><td className="text-right tabular">{percentage(row.mine)}</td><td className="text-right tabular">{percentage(row.average)}</td><td className="text-right tabular">{signed(row.difference)}</td></tr>)}
    </tbody></table></div>
    <p className="mt-3 t-sm text-[var(--ink-3)]">Yüzdelik dilim, üyeler genel puana göre sıralandığında hangi dilimde olduğunuzu gösterir; küçük değer daha önde demektir. Dilim en az %{data.band.width} genişliğindedir ve sıranızı göstermez.</p>
  </Panel>;
}
