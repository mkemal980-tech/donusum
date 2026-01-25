"use client";

import { useEffect, useState } from "react";
import { Users, FileText, Plus, Trash2, Search, UserCheck, Calendar, Building2 } from "lucide-react";

interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  organization: string | null;
}

interface Survey {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
}

interface Assignment {
  id: string;
  userId: string;
  surveyId: string;
  assignedAt: string;
  isActive: boolean;
  user: User;
  survey: { id: string; name: string };
}

export default function SurveyAssignmentsPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedSurveyId, setSelectedSurveyId] = useState<string>("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [usersRes, surveysRes, assignmentsRes] = await Promise.all([
        fetch("/api/admin/users"),
        fetch("/api/admin/surveys"),
        fetch("/api/admin/survey-assignments")
      ]);
      
      const usersData = await usersRes.json();
      const surveysData = await surveysRes.json();
      const assignmentsData = await assignmentsRes.json();
      
      setUsers(usersData);
      setSurveys(surveysData);
      setAssignments(assignmentsData);
    } catch (error) {
      console.error("Error fetching data:", error);
      setMessage({ type: "error", text: "Veri yüklenirken hata oluştu" });
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedUserId || !selectedSurveyId) {
      setMessage({ type: "error", text: "Lütfen kullanıcı ve anket seçin" });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/survey-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedUserId, surveyId: selectedSurveyId })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Atama başarısız");
      }

      setMessage({ type: "success", text: "Anket başarıyla atandı" });
      setSelectedUserId("");
      setSelectedSurveyId("");
      fetchData();
    } catch (error: any) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (assignmentId: string) => {
    if (!confirm("Bu anket atamasını kaldırmak istediğinize emin misiniz?")) return;

    try {
      const res = await fetch(`/api/admin/survey-assignments?id=${assignmentId}`, {
        method: "DELETE"
      });

      if (!res.ok) throw new Error("Silme başarısız");

      setMessage({ type: "success", text: "Atama kaldırıldı" });
      fetchData();
    } catch (error) {
      setMessage({ type: "error", text: "Atama kaldırılırken hata oluştu" });
    }
  };

  const filteredAssignments = assignments.filter(a => {
    const searchLower = searchTerm.toLowerCase();
    return (
      a.user.email.toLowerCase().includes(searchLower) ||
      (a.user.firstName?.toLowerCase() || "").includes(searchLower) ||
      (a.user.lastName?.toLowerCase() || "").includes(searchLower) ||
      a.survey.name.toLowerCase().includes(searchLower)
    );
  });

  const getUserName = (user: User) => {
    if (user.firstName || user.lastName) {
      return `${user.firstName || ""} ${user.lastName || ""}`.trim();
    }
    return user.email;
  };

  // Kullanıcının zaten atanmış anketlerini bul
  const getUserAssignedSurveys = (userId: string) => {
    return assignments
      .filter(a => a.userId === userId && a.isActive)
      .map(a => a.surveyId);
  };

  const availableSurveysForUser = selectedUserId
    ? surveys.filter(s => s.isActive && !getUserAssignedSurveys(selectedUserId).includes(s.id))
    : surveys.filter(s => s.isActive);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-main)] flex items-center gap-2">
            <UserCheck className="w-7 h-7 text-[var(--accent)]" />
            Anket Atamaları
          </h1>
          <p className="text-[var(--text-muted)] mt-1">Kullanıcılara anket atayın ve yönetin</p>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-lg ${
          message.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"
        }`}>
          {message.text}
          <button onClick={() => setMessage(null)} className="float-right font-bold">×</button>
        </div>
      )}

      {/* Yeni Atama Formu */}
      <div className="bg-[var(--bg-card)] rounded-xl shadow-sm border border-[var(--border-soft)] p-6">
        <h2 className="text-lg font-semibold text-[var(--text-main)] mb-4 flex items-center gap-2">
          <Plus className="w-5 h-5 text-[var(--accent)]" />
          Yeni Anket Ata
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">Kullanıcı</label>
            <select
              value={selectedUserId}
              onChange={(e) => {
                setSelectedUserId(e.target.value);
                setSelectedSurveyId("");
              }}
              className="w-full px-3 py-2 border border-[var(--border-soft)] rounded-lg focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)]"
            >
              <option value="">Kullanıcı seçin...</option>
              {users.map(user => (
                <option key={user.id} value={user.id}>
                  {getUserName(user)} ({user.email})
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">Anket</label>
            <select
              value={selectedSurveyId}
              onChange={(e) => setSelectedSurveyId(e.target.value)}
              disabled={!selectedUserId}
              className="w-full px-3 py-2 border border-[var(--border-soft)] rounded-lg focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] disabled:bg-[var(--bg-card-2)] disabled:cursor-not-allowed"
            >
              <option value="">{selectedUserId ? "Anket seçin..." : "Önce kullanıcı seçin"}</option>
              {availableSurveysForUser.map(survey => (
                <option key={survey.id} value={survey.id}>
                  {survey.name}
                </option>
              ))}
            </select>
            {selectedUserId && availableSurveysForUser.length === 0 && (
              <p className="text-sm text-amber-600 mt-1">Bu kullanıcıya atanabilecek aktif anket kalmadı</p>
            )}
          </div>
          
          <div className="flex items-end">
            <button
              onClick={handleAssign}
              disabled={!selectedUserId || !selectedSurveyId || saving}
              className="w-full px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-dark)] disabled:bg-[var(--ui-passive)] disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
            >
              {saving ? (
                <div className="spinner-sm" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Ata
            </button>
          </div>
        </div>
      </div>

      {/* Atamalar Listesi */}
      <div className="bg-[var(--bg-card)] rounded-xl shadow-sm border border-[var(--border-soft)] overflow-hidden">
        <div className="p-4 border-b border-[var(--border-soft)]">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-dim)]" />
              <input
                type="text"
                placeholder="Kullanıcı veya anket ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-[var(--border-soft)] rounded-lg focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)]"
              />
            </div>
            <div className="text-sm text-[var(--text-dim)]">
              Toplam: <span className="font-semibold text-[var(--text-main)]">{filteredAssignments.length}</span> atama
            </div>
          </div>
        </div>

        {filteredAssignments.length === 0 ? (
          <div className="p-12 text-center text-[var(--text-dim)]">
            <UserCheck className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>Henüz anket ataması yapılmamış</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[var(--bg-card-2)]">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-dim)] uppercase">Kullanıcı</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-dim)] uppercase">Organizasyon</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-dim)] uppercase">Anket</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-dim)] uppercase">Atama Tarihi</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-dim)] uppercase">Durum</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-[var(--text-dim)] uppercase">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredAssignments.map((assignment) => (
                  <tr key={assignment.id} className="hover:bg-[var(--bg-card-2)]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[var(--accent)]/15 flex items-center justify-center">
                          <Users className="w-4 h-4 text-[var(--accent)]" />
                        </div>
                        <div>
                          <p className="font-medium text-[var(--text-main)]">{getUserName(assignment.user)}</p>
                          <p className="text-sm text-[var(--text-dim)]">{assignment.user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-[var(--text-muted)]">
                        <Building2 className="w-4 h-4" />
                        {assignment.user.organization || "-"}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-[var(--accent)]" />
                        <span className="font-medium text-[var(--text-main)]">{assignment.survey.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-[var(--text-muted)]">
                        <Calendar className="w-4 h-4" />
                        {new Date(assignment.assignedAt).toLocaleDateString("tr-TR")}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        assignment.isActive
                          ? "bg-green-100 text-green-800"
                          : "bg-[var(--bg-card-2)] text-[var(--text-main)]"
                      }`}>
                        {assignment.isActive ? "Aktif" : "Pasif"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleRemove(assignment.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Atamayı Kaldır"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Kullanıcı Bazlı Özet */}
      <div className="bg-[var(--bg-card)] rounded-xl shadow-sm border border-[var(--border-soft)] p-6">
        <h2 className="text-lg font-semibold text-[var(--text-main)] mb-4">Kullanıcı Bazlı Özet</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {users.slice(0, 9).map(user => {
            const userAssignments = assignments.filter(a => a.userId === user.id && a.isActive);
            return (
              <div key={user.id} className="p-4 border border-[var(--border-soft)] rounded-lg">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-full bg-[var(--accent)]/15 flex items-center justify-center">
                    <Users className="w-5 h-5 text-[var(--accent)]" />
                  </div>
                  <div>
                    <p className="font-medium text-[var(--text-main)]">{getUserName(user)}</p>
                    <p className="text-xs text-[var(--text-dim)]">{user.email}</p>
                  </div>
                </div>
                <div className="mt-3">
                  {userAssignments.length === 0 ? (
                    <p className="text-sm text-[var(--text-dim)]">Atanmış anket yok</p>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {userAssignments.map(a => (
                        <span key={a.id} className="inline-flex items-center px-2 py-1 rounded text-xs bg-[var(--accent)]/15 text-primary-700">
                          {a.survey.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {users.length > 9 && (
          <p className="text-sm text-[var(--text-dim)] mt-4 text-center">ve {users.length - 9} kullanıcı daha...</p>
        )}
      </div>
    </div>
  );
}
