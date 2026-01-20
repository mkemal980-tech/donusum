"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Header from "@/components/ui/header";
import {
  Users,
  Building2,
  TrendingUp,
  CheckCircle,
  Clock,
  ChevronDown,
  ChevronRight,
  BarChart3,
} from "lucide-react";

interface TeamMember {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  unitId: string;
  unitName: string;
  sector: string | null;
  subSector: string | null;
  responseCount: number;
  score: number;
  maturityScore: number;
}

interface UnitSummary {
  id: string;
  name: string;
  description: string | null;
  userCount: number;
  completedUsers: number;
  averageScore: number;
}

const getScoreColor = (score: number) => {
  if (score >= 80) return "text-green-600 bg-green-100";
  if (score >= 60) return "text-blue-600 bg-blue-100";
  if (score >= 40) return "text-purple-600 bg-purple-100";
  if (score >= 20) return "text-orange-600 bg-orange-100";
  return "text-red-600 bg-red-100";
};

const getMaturityLabel = (score: number) => {
  if (score >= 4.5) return { label: "Lider", color: "text-green-600" };
  if (score >= 3.5) return { label: "Olgun", color: "text-blue-600" };
  if (score >= 2.5) return { label: "Gelişen", color: "text-purple-600" };
  if (score >= 1.5) return { label: "Farkındalık", color: "text-orange-600" };
  return { label: "Başlangıç", color: "text-red-600" };
};

export default function UnitManagerPage() {
  const { data: session, status } = useSession() || {};
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [units, setUnits] = useState<UnitSummary[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [expandedUnits, setExpandedUnits] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }

    const role = (session?.user as any)?.role;
    if (status === "authenticated" && role !== "UNIT_MANAGER" && role !== "ADMIN") {
      router.push("/dashboard");
      return;
    }

    if (status === "authenticated") {
      fetchTeamData();
    }
  }, [status, session, router]);

  const fetchTeamData = async () => {
    try {
      const res = await fetch("/api/unit-manager/team");
      if (res.ok) {
        const data = await res.json();
        setUnits(data.units || []);
        setTeam(data.team || []);
        // Tüm birimleri varsayılan olarak aç
        setExpandedUnits(new Set(data.units?.map((u: UnitSummary) => u.id) || []));
      }
    } catch (error) {
      console.error("Veri çekme hatası:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleUnit = (unitId: string) => {
    setExpandedUnits((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(unitId)) {
        newSet.delete(unitId);
      } else {
        newSet.add(unitId);
      }
      return newSet;
    });
  };

  if (loading || status === "loading") {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center h-[calc(100vh-80px)]">
          <div className="w-12 h-12 border-4 border-[#1e3a8a] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  const totalUsers = team.length;
  const completedUsers = team.filter((m) => m.responseCount > 0).length;
  const avgScore = totalUsers > 0 ? team.reduce((sum, m) => sum + m.score, 0) / totalUsers : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-[1200px] mx-auto px-6 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
            <Building2 className="text-[#1e3a8a]" />
            Birim Yöneticisi Paneli
          </h1>
          <p className="text-gray-600">Biriminizdeki kullanıcıların anket ilerleme ve sonuçlarını takip edin</p>
        </motion.div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-xl shadow-md p-6"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Building2 className="text-[#1e3a8a]" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-500">Birim Sayısı</p>
                <p className="text-2xl font-bold text-gray-900">{units.length}</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-xl shadow-md p-6"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Users className="text-purple-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-500">Toplam Kullanıcı</p>
                <p className="text-2xl font-bold text-gray-900">{totalUsers}</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-xl shadow-md p-6"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="text-green-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-500">Anketi Tamamlayan</p>
                <p className="text-2xl font-bold text-gray-900">
                  {completedUsers} / {totalUsers}
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white rounded-xl shadow-md p-6"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="text-orange-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-500">Ortalama Skor</p>
                <p className="text-2xl font-bold text-gray-900">%{Math.round(avgScore)}</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Units and Team */}
        <div className="space-y-6">
          {units.map((unit) => {
            const unitMembers = team.filter((m) => m.unitId === unit.id);
            const isExpanded = expandedUnits.has(unit.id);

            return (
              <motion.div
                key={unit.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-xl shadow-md overflow-hidden"
              >
                {/* Unit Header */}
                <div
                  className="p-6 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => toggleUnit(unit.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {isExpanded ? (
                        <ChevronDown className="text-gray-400" size={20} />
                      ) : (
                        <ChevronRight className="text-gray-400" size={20} />
                      )}
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{unit.name}</h3>
                        {unit.description && (
                          <p className="text-sm text-gray-500">{unit.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-center">
                        <p className="text-sm text-gray-500">Kullanıcı</p>
                        <p className="font-semibold text-gray-900">{unit.userCount}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-gray-500">Tamamlayan</p>
                        <p className="font-semibold text-green-600">{unit.completedUsers}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-gray-500">Ort. Skor</p>
                        <p className="font-semibold text-[#1e3a8a]">%{unit.averageScore}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Team Members */}
                {isExpanded && unitMembers.length > 0 && (
                  <div className="border-t">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                            Kullanıcı
                          </th>
                          <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                            Sektör
                          </th>
                          <th className="px-6 py-3 text-center text-sm font-semibold text-gray-700">
                            Durum
                          </th>
                          <th className="px-6 py-3 text-center text-sm font-semibold text-gray-700">
                            Skor
                          </th>
                          <th className="px-6 py-3 text-center text-sm font-semibold text-gray-700">
                            Olgunluk
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {unitMembers.map((member) => {
                          const maturity = getMaturityLabel(member.maturityScore);
                          return (
                            <tr key={member.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4">
                                <div>
                                  <p className="font-medium text-gray-900">
                                    {member.firstName} {member.lastName}
                                  </p>
                                  <p className="text-sm text-gray-500">{member.email}</p>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-600">
                                {member.sector || "-"}
                                {member.subSector && (
                                  <span className="text-gray-400"> / {member.subSector}</span>
                                )}
                              </td>
                              <td className="px-6 py-4 text-center">
                                {member.responseCount > 0 ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                                    <CheckCircle size={12} />
                                    Tamamlandı
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
                                    <Clock size={12} />
                                    Bekliyor
                                  </span>
                                )}
                              </td>
                              <td className="px-6 py-4 text-center">
                                <span
                                  className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${getScoreColor(
                                    member.score
                                  )}`}
                                >
                                  <BarChart3 size={14} />
                                  %{member.score}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-center">
                                <span className={`font-medium ${maturity.color}`}>
                                  {member.maturityScore > 0 ? (
                                    <>
                                      {member.maturityScore.toFixed(1)} - {maturity.label}
                                    </>
                                  ) : (
                                    "-"
                                  )}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {isExpanded && unitMembers.length === 0 && (
                  <div className="border-t p-8 text-center text-gray-500">
                    Bu birimde henüz kullanıcı yok
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

        {units.length === 0 && (
          <div className="bg-white rounded-xl shadow-md p-12 text-center">
            <Building2 size={48} className="mx-auto text-gray-300 mb-4" />
            <h2 className="text-xl font-semibold text-gray-700 mb-2">
              Yönettiğiniz Birim Bulunamadı
            </h2>
            <p className="text-gray-500">
              Henüz yöneticiniz olarak atandığınız bir birim bulunmuyor.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
