"use client";

import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import PageHeader from "@/components/ui/page-header";
import Panel from "@/components/ui/panel";
import EmptyState from "@/components/ui/empty-state";

interface Overview {
  users: { total: number; active: number; admins: number };
  units: { total: number };
  surveys: { active: number; archived: number };
  assignments: { active: number; overdue: number; dueSoon: number };
  assessments: { inProgress: number; submitted: number; submittedLast30Days: number };
  activity: { responsesLast30Days: number };
  upcomingDeadlines: {
    id: string;
    deadline: string | null;
    surveyName: string;
    userName: string;
    organization: string | null;
  }[];
}

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function formatDeadline(deadline: string | null) {
  if (!deadline) return "-";
  const date = new Date(deadline);
  return Number.isNaN(date.getTime()) ? "-" : dateFormatter.format(date);
}

export default function AdminDashboard() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchOverview() {
      try {
        const response = await fetch("/api/admin/overview");
        if (!response.ok) throw new Error("Özet bilgiler alınamadı");
        setOverview(await response.json());
      } catch (err) {
        console.error("Error fetching overview:", err);
        setError(err instanceof Error ? err.message : "Özet bilgiler alınamadı");
      } finally {
        setLoading(false);
      }
    }
    fetchOverview();
  }, []);

  // Sayaçlar yönetim işine yarayacak şekilde seçildi: kaç kişi var, kaç anket
  // yürüyor, ne kadarı tamamlandı. Kategori/soru sayıları yapı ekranına ait.
  // Sayaçlar yönetim işine yarayacak şekilde seçildi: kaç kişi var, kaç anket
  // yürüyor, ne kadarı tamamlandı. Kategori/soru sayıları yapı ekranına ait.
  // Kartlar dekoratif ikon kutusu taşımaz; sayı ve tek satır bağlam yeter.
  const cards = overview
    ? [
        {
          title: "Kullanıcı",
          count: overview.users.total,
          hint: `${overview.users.active} aktif · ${overview.users.admins} yönetici`,
          href: "/admin/users",
        },
        {
          title: "Birim",
          count: overview.units.total,
          hint: "kayıtlı kuruluş birimi",
          href: "/admin/units",
        },
        {
          title: "Aktif anket",
          count: overview.surveys.active,
          hint: overview.surveys.archived
            ? `${overview.surveys.archived} arşivlenmiş`
            : "arşivlenmiş anket yok",
          href: "/admin/surveys",
        },
        {
          title: "Anket ataması",
          count: overview.assignments.active,
          hint:
            overview.assignments.overdue > 0
              ? `${overview.assignments.overdue} süresi geçmiş`
              : `${overview.assignments.dueSoon} atamanın süresi 7 gün içinde doluyor`,
          href: "/admin/survey-assignments",
        },
        {
          title: "Devam eden değerlendirme",
          count: overview.assessments.inProgress,
          hint: `son 30 günde ${overview.activity.responsesLast30Days} cevap girildi`,
          href: "/admin/dashboard",
        },
        {
          title: "Tamamlanan değerlendirme",
          count: overview.assessments.submitted,
          hint: `son 30 günde ${overview.assessments.submittedLast30Days} tamamlandı`,
          href: "/admin/dashboard",
        },
      ]
    : [];

  return (
    <>
      <PageHeader title="Genel bakış" subtitle="Platformun bugünkü durumu." />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="skeleton h-28" />
          ))}
        </div>
      ) : error ? (
        <EmptyState title="Özet alınamadı" description={error} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <Link
              key={card.title}
              href={card.href}
              className="rounded-[var(--radius-lg)] p-5 transition-colors duration-fast ease-out-quart hover:border-[var(--line-strong)]"
              style={{ background: "var(--surface)", border: "1px solid var(--line)" }}
            >
              <span className="block t-label" style={{ color: "var(--ink-2)" }}>
                {card.title}
              </span>
              <span className="mt-2 block t-metric" style={{ color: "var(--ink)" }}>
                {card.count}
              </span>
              <span className="mt-1.5 block t-sm" style={{ color: "var(--ink-3)" }}>
                {card.hint}
              </span>
            </Link>
          ))}
        </div>
      )}

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Panel title="Hızlı işlemler">
          <ul className="flex flex-col">
            {[
              { href: "/admin/survey-assignments", label: "Anket ataması", hint: "Kullanıcılara anket atayın, süre tanımlayın" },
              { href: "/admin/users", label: "Kullanıcı yönetimi", hint: "Kullanıcı ekleyin, rol ve birim atayın" },
              { href: "/admin/categories", label: "Kategori ve soru yönetimi", hint: "Anket yapısını düzenleyin" },
            ].map((action, i) => (
              <li key={action.href} style={{ borderTop: i === 0 ? undefined : "1px solid var(--line)" }}>
                <Link
                  href={action.href}
                  className="group flex items-center justify-between gap-3 py-3"
                >
                  <span>
                    <span className="block t-body" style={{ color: "var(--ink)" }}>
                      {action.label}
                    </span>
                    <span className="block t-sm" style={{ color: "var(--ink-3)" }}>
                      {action.hint}
                    </span>
                  </span>
                  <ChevronRight
                    size={16}
                    style={{ color: "var(--ink-3)" }}
                    className="shrink-0 transition-transform duration-fast ease-out-quart group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel
          title="Süresi dolan atamalar"
          description="Süresi geçmiş ya da 7 gün içinde dolacak atamalar"
        >
          {!overview || overview.upcomingDeadlines.length === 0 ? (
            <p className="t-sm" style={{ color: "var(--ink-3)" }}>
              Süresi yaklaşan atama yok.
            </p>
          ) : (
            <div className="flex flex-col">
              {overview.upcomingDeadlines.map((assignment) => {
                const isOverdue =
                  !!assignment.deadline && new Date(assignment.deadline) < new Date();
                return (
                  <div
                    key={assignment.id}
                    className="flex items-center justify-between gap-4 py-3"
                    style={{ borderBottom: "1px solid var(--line)" }}
                  >
                    <div className="min-w-0">
                      <p className="truncate t-body" style={{ color: "var(--ink)" }}>
                        {assignment.userName}
                      </p>
                      <p className="truncate t-sm" style={{ color: "var(--ink-3)" }}>
                        {assignment.organization
                          ? `${assignment.organization} · ${assignment.surveyName}`
                          : assignment.surveyName}
                      </p>
                    </div>
                    <span
                      className="whitespace-nowrap t-sm tabular"
                      style={{ color: isOverdue ? "var(--warning)" : "var(--ink-3)" }}
                    >
                      {isOverdue ? "süresi geçti · " : ""}
                      {formatDeadline(assignment.deadline)}
                    </span>
                  </div>
                );
              })}
              <Link
                href="/admin/survey-assignments"
                className="mt-3 inline-block t-sm hover:underline"
                style={{ color: "var(--accent)" }}
              >
                Tüm atamaları görüntüle
              </Link>
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
