"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ClipboardList,
  FileText,
  Users,
} from "lucide-react";
import Link from "next/link";

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
  const cards = overview
    ? [
        {
          title: "Kullanıcılar",
          count: overview.users.total,
          hint: `${overview.users.active} aktif • ${overview.users.admins} yönetici`,
          icon: Users,
          bgColor: "var(--info-bg)",
          iconColor: "#2E86FF",
          href: "/admin/users",
        },
        {
          title: "Birimler",
          count: overview.units.total,
          hint: "Kayıtlı kuruluş birimi",
          icon: Building2,
          bgColor: "var(--accent-soft)",
          iconColor: "#0CC1C3",
          href: "/admin/units",
        },
        {
          title: "Aktif Anketler",
          count: overview.surveys.active,
          hint: overview.surveys.archived
            ? `${overview.surveys.archived} arşivlenmiş`
            : "Arşivlenmiş anket yok",
          icon: FileText,
          bgColor: "var(--info-bg)",
          iconColor: "#0A7DAF",
          href: "/admin/surveys",
        },
        {
          title: "Anket Atamaları",
          count: overview.assignments.active,
          hint:
            overview.assignments.overdue > 0
              ? `${overview.assignments.overdue} süresi geçmiş`
              : `${overview.assignments.dueSoon} atamanın süresi 7 gün içinde doluyor`,
          icon: ClipboardList,
          bgColor: "rgba(22, 212, 216, 0.15)",
          iconColor: "#16D4D8",
          href: "/admin/survey-assignments",
        },
        {
          title: "Devam Eden Değerlendirmeler",
          count: overview.assessments.inProgress,
          hint: `Son 30 günde ${overview.activity.responsesLast30Days} cevap girildi`,
          icon: AlertTriangle,
          bgColor: "var(--warning-bg)",
          iconColor: "#F5A623",
          href: "/admin/dashboard",
        },
        {
          title: "Tamamlanan Değerlendirmeler",
          count: overview.assessments.submitted,
          hint: `Son 30 günde ${overview.assessments.submittedLast30Days} tamamlandı`,
          icon: CheckCircle2,
          bgColor: "rgba(52, 199, 89, 0.15)",
          iconColor: "#34C759",
          href: "/admin/dashboard",
        },
      ]
    : [];

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6" style={{ color: "var(--text-main)" }}>
        Yönetim Paneli - Genel Bakış
      </h1>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="spinner" />
        </div>
      ) : error ? (
        <div
          className="rounded-xl p-6"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border-soft)" }}
        >
          <p style={{ color: "var(--text-main)" }}>{error}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.title}
                href={card.href}
                className="rounded-xl p-6 transition-all duration-200 hover:shadow-glow"
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-soft)",
                }}
              >
                <div
                  className="w-12 h-12 rounded-lg flex items-center justify-center mb-4"
                  style={{ background: card.bgColor }}
                >
                  <Icon size={24} style={{ color: card.iconColor }} />
                </div>
                <p className="text-sm" style={{ color: "var(--text-dim)" }}>
                  {card.title}
                </p>
                <p
                  className="text-3xl font-semibold font-numeric"
                  style={{ color: "var(--text-main)" }}
                >
                  {card.count}
                </p>
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                  {card.hint}
                </p>
              </Link>
            );
          })}
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div
          className="rounded-xl p-6"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border-soft)" }}
        >
          <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--text-main)" }}>
            Hızlı İşlemler
          </h2>
          <div className="space-y-3">
            <Link
              href="/admin/survey-assignments"
              className="block p-4 rounded-lg transition-all duration-200"
              style={{
                background: "var(--info-bg)",
                border: "1px solid var(--info-bg)",
              }}
            >
              <p className="font-medium" style={{ color: "var(--blue-main)" }}>
                Anket Ataması
              </p>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                Kullanıcılara anket atayın, süre tanımlayın
              </p>
            </Link>
            <Link
              href="/admin/users"
              className="block p-4 rounded-lg transition-all duration-200"
              style={{
                background: "var(--accent-soft)",
                border: "1px solid var(--accent-soft)",
              }}
            >
              <p className="font-medium" style={{ color: "#0CC1C3" }}>
                Kullanıcı Yönetimi
              </p>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                Kullanıcı ekleyin, rol ve birim atayın
              </p>
            </Link>
            <Link
              href="/admin/categories"
              className="block p-4 rounded-lg transition-all duration-200"
              style={{
                background: "var(--warning-bg)",
                border: "1px solid var(--warning-bg)",
              }}
            >
              <p className="font-medium" style={{ color: "#F5A623" }}>
                Kategori & Soru Yönetimi
              </p>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                Anket yapısını düzenleyin
              </p>
            </Link>
          </div>
        </div>

        <div
          className="rounded-xl p-6"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border-soft)" }}
        >
          <h2 className="text-lg font-semibold mb-1" style={{ color: "var(--text-main)" }}>
            Süresi Dolan Atamalar
          </h2>
          <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
            Süresi geçmiş veya 7 gün içinde dolacak anket atamaları
          </p>
          {!overview || overview.upcomingDeadlines.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Süresi yaklaşan atama yok.
            </p>
          ) : (
            <div className="space-y-3">
              {overview.upcomingDeadlines.map((assignment) => {
                const isOverdue =
                  !!assignment.deadline && new Date(assignment.deadline) < new Date();
                return (
                  <div
                    key={assignment.id}
                    className="flex items-center justify-between gap-4 pb-3"
                    style={{ borderBottom: "1px solid var(--border-soft)" }}
                  >
                    <div className="min-w-0">
                      <p
                        className="text-sm font-medium truncate"
                        style={{ color: "var(--text-main)" }}
                      >
                        {assignment.userName}
                      </p>
                      <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                        {assignment.organization
                          ? `${assignment.organization} • ${assignment.surveyName}`
                          : assignment.surveyName}
                      </p>
                    </div>
                    <span
                      className="text-xs whitespace-nowrap font-numeric"
                      style={{ color: isOverdue ? "#F5A623" : "var(--text-dim)" }}
                    >
                      {isOverdue ? "Süresi geçti • " : ""}
                      {formatDeadline(assignment.deadline)}
                    </span>
                  </div>
                );
              })}
              <Link
                href="/admin/survey-assignments"
                className="text-sm inline-block"
                style={{ color: "var(--blue-main)" }}
              >
                Tüm atamaları görüntüle →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
