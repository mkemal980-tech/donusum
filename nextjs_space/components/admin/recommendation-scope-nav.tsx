"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import {
  scopeKey,
  scopesEqual,
  type Scope,
  type ScopeNode,
} from "@/lib/recommendation-scope";

/**
 * Öneri ekranının kapsam ağacı.
 *
 * Öneriler ankette dört ayrı seviyeye bağlanabiliyor ama ekranda yalnızca
 * anket ve kategori süzgeci vardı: "şu soruya hangi öneriler bağlı"
 * sorusunun cevabı hiçbir yerde yoktu, dolayısıyla soru bazında toplu işlem
 * de yapılamıyordu.
 *
 * Ağaç, kategori süzgecinin yerini alıyor — ikisini birlikte tutmak aynı iş
 * için iki ayrı doğruluk kaynağı demek olurdu.
 */

type Props = {
  nodes: ScopeNode[];
  scope: Scope;
  onSelect: (scope: Scope) => void;
  /** Anket süzgecinden sonra listedeki toplam öneri. */
  total: number;
  /** Bunların kaçı bir soruya bağlı — çoğu ankette sıfır çıkıyor. */
  questionBound: number;
  /** Hiçbir yere bağlanmamış öneriler; varsa ayrı bir hedef olur. */
  unplaced: number;
};

/** Seçili düğümün bütün ataları açılmalı; yoksa seçim görünmez kalır. */
function ancestorKeys(nodes: ScopeNode[], scope: Scope): string[] {
  const target = scopeKey(scope);
  const found: string[] = [];

  const walk = (list: ScopeNode[], trail: string[]): boolean => {
    for (const node of list) {
      if (node.key === target) {
        found.push(...trail);
        return true;
      }
      if (walk(node.children, [...trail, node.key])) return true;
    }
    return false;
  };

  walk(nodes, []);
  return found;
}

export default function RecommendationScopeNav({
  nodes,
  scope,
  onSelect,
  total,
  questionBound,
  unplaced,
}: Props) {
  /* Varsayılan olarak her şey kapalı: 13 bölüm ve 71 soru birden açılırsa
     ağaç kendi çözdüğü sorunu yaratır. Seçim yapıldıkça yolu açılır. */
  const [expanded, setExpanded] = useState<string[]>([]);

  const needed = useMemo(() => ancestorKeys(nodes, scope), [nodes, scope]);

  useEffect(() => {
    if (needed.length === 0) return;
    setExpanded((current) => {
      const missing = needed.filter((key) => !current.includes(key));
      return missing.length === 0 ? current : [...current, ...missing];
    });
  }, [needed]);

  const toggle = (key: string) =>
    setExpanded((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    );

  const row = (node: ScopeNode, depth: number) => {
    const isOpen = expanded.includes(node.key);
    const isSelected = scopesEqual(node.scope, scope);
    const hasChildren = node.children.length > 0;
    const isQuestion = node.scope.kind === "question";

    return (
      <li key={node.key}>
        <div
          className="flex items-start gap-1 rounded-[var(--radius-xs)]"
          style={isSelected ? { background: "var(--accent-quiet)" } : undefined}
        >
          {/* Açma ve seçme ayrı düğmeler: bir bölümü açmak onu süzmek
              anlamına gelmemeli, ikisi farklı niyet. */}
          {hasChildren ? (
            <button
              type="button"
              onClick={() => toggle(node.key)}
              aria-expanded={isOpen}
              aria-label={`${node.label} alt kırılımını ${isOpen ? "kapat" : "aç"}`}
              className="mt-1 shrink-0 rounded-[var(--radius-xs)] p-1 transition-colors duration-fast ease-out-quart hover:bg-[var(--surface-2)]"
            >
              <ChevronRight
                size={13}
                aria-hidden="true"
                className="transition-transform duration-fast ease-out-quart"
                style={{ color: "var(--ink-3)", transform: isOpen ? "rotate(90deg)" : undefined }}
              />
            </button>
          ) : (
            <span className="w-[21px] shrink-0" aria-hidden="true" />
          )}

          <button
            type="button"
            onClick={() => onSelect(node.scope)}
            aria-current={isSelected ? "true" : undefined}
            className="flex min-w-0 flex-1 items-baseline gap-2 rounded-[var(--radius-xs)] px-1.5 py-1.5 text-left transition-colors duration-fast ease-out-quart hover:bg-[var(--surface-2)]"
          >
            <span
              className={`min-w-0 flex-1 t-sm ${isQuestion ? "line-clamp-2" : "truncate"}`}
              style={{
                color: isSelected ? "var(--ink)" : node.count === 0 ? "var(--ink-3)" : "var(--ink-2)",
                fontWeight: isSelected ? 600 : depth === 0 ? 500 : 400,
              }}
            >
              {node.label}
            </span>
            {/* Sıfır sessizce yazılır: "öneri yok" da bir bilgi ama vurgu
                değil. */}
            <span
              className="shrink-0 t-sm tabular"
              style={{ color: node.count === 0 ? "var(--ink-3)" : "var(--ink-2)" }}
            >
              {node.count}
            </span>
          </button>
        </div>

        {isOpen && hasChildren && (
          <ul
            className="ml-3 flex flex-col gap-0.5 pl-2"
            style={{ borderLeft: "1px solid var(--line)" }}
          >
            {node.children.map((child) => row(child, depth + 1))}
          </ul>
        )}
      </li>
    );
  };

  return (
    <nav
      aria-label="Öneri kapsamı"
      className="flex h-full flex-col overflow-hidden rounded-[var(--radius-lg)]"
      style={{ background: "var(--surface)", border: "1px solid var(--line)" }}
    >
      <div className="shrink-0 px-3 py-3" style={{ borderBottom: "1px solid var(--line)" }}>
        <button
          type="button"
          onClick={() => onSelect({ kind: "all" })}
          aria-current={scope.kind === "all" ? "true" : undefined}
          className="flex w-full items-baseline justify-between gap-2 rounded-[var(--radius-xs)] px-1.5 py-1 text-left transition-colors duration-fast ease-out-quart hover:bg-[var(--surface-2)]"
          style={scope.kind === "all" ? { background: "var(--accent-quiet)" } : undefined}
        >
          <span className="t-sm font-medium" style={{ color: "var(--ink)" }}>
            Tüm öneriler
          </span>
          <span className="t-sm tabular" style={{ color: "var(--ink-2)" }}>
            {total}
          </span>
        </button>

        {/* Çoğu ankette bu sayı sıfır çıkıyor; yönetici öneriyi soruya
            bağlayabildiğini çoğu zaman bilmiyor. */}
        <p className="mt-1.5 px-1.5 t-sm" style={{ color: "var(--ink-3)" }}>
          {questionBound === 0
            ? "Hiçbiri bir soruya bağlı değil"
            : `${questionBound} tanesi bir soruya bağlı`}
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {nodes.length === 0 ? (
          <p className="px-2 py-3 t-sm" style={{ color: "var(--ink-3)" }}>
            Bu ankette kategori yok.
          </p>
        ) : (
          <ul className="flex flex-col gap-0.5">{nodes.map((node) => row(node, 0))}</ul>
        )}
      </div>

      {unplaced > 0 && (
        <div className="shrink-0 p-2" style={{ borderTop: "1px solid var(--line)" }}>
          <button
            type="button"
            onClick={() => onSelect({ kind: "unplaced" })}
            aria-current={scope.kind === "unplaced" ? "true" : undefined}
            className="flex w-full items-baseline justify-between gap-2 rounded-[var(--radius-xs)] px-2 py-1.5 text-left transition-colors duration-fast ease-out-quart hover:bg-[var(--surface-2)]"
            style={scope.kind === "unplaced" ? { background: "var(--accent-quiet)" } : undefined}
          >
            {/* Bu öneriler hiçbir kullanıcıya gösterilemez; sessizce
                kaybolmalarındansa ayrı bir satırda durmaları iyi. */}
            <span className="min-w-0 flex-1 truncate t-sm" style={{ color: "var(--warning)" }}>
              Ankete bağlanmamış
            </span>
            <span className="shrink-0 t-sm tabular" style={{ color: "var(--warning)" }}>
              {unplaced}
            </span>
          </button>
        </div>
      )}
    </nav>
  );
}
