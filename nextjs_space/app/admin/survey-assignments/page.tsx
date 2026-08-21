"use client";

import { useEffect, useState } from "react";
import { Users, FileText, Plus, Trash2, Search, UserCheck, Calendar, Building2, Clock, AlertTriangle, RefreshCw, Timer, TimerOff } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  hasDeadline: boolean;
  deadline: string | null;
  deadlineExtendedAt: string | null;
  deadlineExtendedBy: string | null;
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
  
  // Süre sınırı ayarları
  const [hasDeadline, setHasDeadline] = useState(false);
  const [deadline, setDeadline] = useState("");
  
  // Süre uzatma modalı
  const [extendModal, setExtendModal] = useState<Assignment | null>(null);
  const [newDeadline, setNewDeadline] = useState("");

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
    
    if (hasDeadline && !deadline) {
      setMessage({ type: "error", text: "Süre sınırı aktifse bitiş tarihi seçmelisiniz" });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/survey-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          userId: selectedUserId, 
          surveyId: selectedSurveyId,
          hasDeadline,
          deadline: hasDeadline ? deadline : null
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Atama başarısız");
      }

      setMessage({ type: "success", text: "Anket başarıyla atandı" });
      setSelectedUserId("");
      setSelectedSurveyId("");
      setHasDeadline(false);
      setDeadline("");
      fetchData();
    } catch (error: any) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setSaving(false);
    }
  };
  
  const handleExtendDeadline = async () => {
    if (!extendModal || !newDeadline) return;
    
    setSaving(true);
    try {
      const res = await fetch("/api/admin/survey-assignments", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          id: extendModal.id,
          extendDeadline: true,
          deadline: newDeadline
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Süre uzatma başarısız");
      }

      setMessage({ type: "success", text: "Süre başarıyla uzatıldı" });
      setExtendModal(null);
      setNewDeadline("");
      fetchData();
    } catch (error: any) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setSaving(false);
    }
  };
  
  const handleToggleDeadline = async (assignment: Assignment, enable: boolean) => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/survey-assignments", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          id: assignment.id,
          hasDeadline: enable,
          deadline: enable ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : null
        })
      });

      if (!res.ok) {
        throw new Error("İşlem başarısız");
      }

      setMessage({ type: "success", text: enable ? "Süre sınırı aktifleştirildi (varsayılan 7 gün)" : "Süre sınırı kaldırıldı" });
      fetchData();
    } catch (error: any) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setSaving(false);
    }
  };
  
  const isExpired = (assignment: Assignment) => {
    if (!assignment.hasDeadline || !assignment.deadline) return false;
    return new Date(assignment.deadline) < new Date();
  };
  
  const getDaysRemaining = (deadline: string) => {
    const diff = new Date(deadline).getTime() - new Date().getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days;
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
          <h1 className="t-display" style={{ color: "var(--ink)" }}>
            Anket atamaları
          </h1>
          <p className="mt-1 t-sm" style={{ color: "var(--ink-2)" }}>
            Kullanıcılara anket atayın, süre tanımlayın.
          </p>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-lg ${
          message.type === "success" ? "bg-[var(--accent-soft)] text-[var(--accent-ink)] border border-[var(--accent)]" : "bg-[var(--error-bg)] text-[var(--error-ink)] border border-[var(--error)]/50"
        }`}>
          {message.text}
          <button onClick={() => setMessage(null)} className="float-right font-semibold">×</button>
        </div>
      )}

      {/* Yeni Atama Formu */}
      <div className="theme-card border border-[var(--border-soft)] p-6">
        <h2 className="text-lg font-semibold text-[var(--text-main)] mb-4 flex items-center gap-2">
          <Plus className="w-5 h-5 text-[var(--accent)]" />
          Yeni Anket Ata
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">Kullanıcı</label>
            <select
              value={selectedUserId}
              onChange={(e) => {
                setSelectedUserId(e.target.value);
                setSelectedSurveyId("");
              }}
              className="w-full px-3 py-2 border border-[var(--border-soft)] rounded-lg focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] bg-[var(--bg-card)] text-[var(--text-main)]"
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
              className="w-full px-3 py-2 border border-[var(--border-soft)] rounded-lg focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] disabled:bg-[var(--bg-card-2)] disabled:cursor-not-allowed bg-[var(--bg-card)] text-[var(--text-main)]"
            >
              <option value="">{selectedUserId ? "Anket seçin..." : "Önce kullanıcı seçin"}</option>
              {availableSurveysForUser.map(survey => (
                <option key={survey.id} value={survey.id}>
                  {survey.name}
                </option>
              ))}
            </select>
            {selectedUserId && availableSurveysForUser.length === 0 && (
              <p className="text-sm text-[var(--warning)] mt-1">Bu kullanıcıya atanabilecek aktif anket kalmadı</p>
            )}
          </div>
          
          {/* Süre Sınırı Ayarları */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">Süre Sınırı</label>
            <div className="flex items-center gap-3">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasDeadline}
                  onChange={(e) => {
                    setHasDeadline(e.target.checked);
                    if (!e.target.checked) setDeadline("");
                  }}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-[var(--ui-passive)] peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[var(--accent)]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--accent)]"></div>
              </label>
              <span className="text-sm text-[var(--text-muted)]">{hasDeadline ? "Aktif" : "Pasif"}</span>
            </div>
            {hasDeadline && (
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full mt-2 px-3 py-2 border border-[var(--border-soft)] rounded-lg focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] bg-[var(--bg-card)] text-[var(--text-main)]"
              />
            )}
          </div>
          
          <div className="flex items-end">
            <Button
              onClick={handleAssign}
              disabled={!selectedUserId || !selectedSurveyId || saving || (hasDeadline && !deadline)}
              className="w-full disabled:cursor-not-allowed"
            >
              {saving ? (
                <div className="spinner-sm" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Ata
            </Button>
          </div>
        </div>
      </div>

      {/* Atamalar Listesi */}
      <div className="theme-card border border-[var(--border-soft)] overflow-hidden">
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
            <UserCheck className="w-12 h-12 mx-auto mb-4 text-[var(--ui-passive)]" />
            <p>Henüz anket ataması yapılmamış</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="theme-table">
              <thead>
                <tr>
                  <th>Kullanıcı</th>
                  <th>Anket</th>
                  <th>Atama Tarihi</th>
                  <th>Süre Sınırı</th>
                  <th>Durum</th>
                  <th className="text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {filteredAssignments.map((assignment) => {
                  const expired = isExpired(assignment);
                  const daysLeft = assignment.deadline ? getDaysRemaining(assignment.deadline) : null;
                  
                  return (
                  <tr key={assignment.id} className={`hover:bg-[var(--bg-card-2)] ${expired ? 'bg-[var(--error-bg)]' : ''}`}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[var(--accent-quiet)] flex items-center justify-center">
                          <Users className="w-4 h-4 text-[var(--accent)]" />
                        </div>
                        <div>
                          <p className="font-medium text-[var(--text-main)]">{getUserName(assignment.user)}</p>
                          <p className="text-sm text-[var(--text-dim)]">{assignment.user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-[var(--accent)]" />
                        <span className="font-medium text-[var(--text-main)]">{assignment.survey.name}</span>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-2 text-[var(--text-muted)]">
                        <Calendar className="w-4 h-4" />
                        {new Date(assignment.assignedAt).toLocaleDateString("tr-TR")}
                      </div>
                    </td>
                    <td>
                      {assignment.hasDeadline && assignment.deadline ? (
                        <div className="space-y-1">
                          <div className={`flex items-center gap-2 ${expired ? 'text-[var(--error)]' : daysLeft !== null && daysLeft <= 3 ? 'text-[var(--warning)]' : 'text-[var(--text-muted)]'}`}>
                            <Clock className="w-4 h-4" />
                            <span>{new Date(assignment.deadline).toLocaleDateString("tr-TR")}</span>
                          </div>
                          {expired ? (
                            <span className="inline-flex items-center gap-1 text-xs text-[var(--error)]">
                              <AlertTriangle className="w-3 h-3" />
                              Süresi doldu
                            </span>
                          ) : daysLeft !== null && (
                            <span className={`text-xs ${daysLeft <= 3 ? 'text-[var(--warning)]' : 'text-[var(--text-dim)]'}`}>
                              {daysLeft} gün kaldı
                            </span>
                          )}
                          {assignment.deadlineExtendedAt && (
                            <span className="block text-xs text-[var(--accent)]">
                              Uzatıldı: {new Date(assignment.deadlineExtendedAt).toLocaleDateString("tr-TR")}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[var(--text-dim)] text-sm flex items-center gap-1">
                          <TimerOff className="w-4 h-4" />
                          Sınırsız
                        </span>
                      )}
                    </td>
                    <td>
                      {expired ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--error-bg)] text-[var(--error-ink)]">
                          Süresi Doldu
                        </span>
                      ) : (
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          assignment.isActive
                            ? "bg-[var(--accent-soft)] text-[var(--accent-bright)]"
                            : "bg-[var(--bg-card-2)] text-[var(--text-main)]"
                        }`}>
                          {assignment.isActive ? "Aktif" : "Pasif"}
                        </span>
                      )}
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* Süre sınırı toggle */}
                        {!assignment.hasDeadline ? (
                          <Button
                            onClick={() => handleToggleDeadline(assignment, true)}
                            title="Süre sınırı ekle"
                            variant="ghost"
                            size="icon"
                            className="text-[var(--accent)]"
                          >
                            <Timer className="w-4 h-4" />
                          </Button>
                        ) : (
                          <>
                            <Button
                              onClick={() => {
                                setExtendModal(assignment);
                                setNewDeadline(assignment.deadline ? new Date(new Date(assignment.deadline).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : '');
                              }}
                              title="Süre uzat"
                              variant="ghost"
                              size="icon"
                              className="text-[var(--blue-main)]"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </Button>
                            <Button
                              onClick={() => handleToggleDeadline(assignment, false)}
                              title="Süre sınırını kaldır"
                              variant="ghost"
                              size="icon"
                              className="text-[var(--warning)]"
                            >
                              <TimerOff className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                        <Button
                          onClick={() => handleRemove(assignment.id)}
                          title="Atamayı Kaldır"
                          variant="ghost"
                          size="icon"
                          className="text-[var(--error-ink)] hover:bg-[var(--error-bg)]"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Kullanıcı Bazlı Özet */}
      <div className="theme-card border border-[var(--border-soft)] p-6">
        <h2 className="text-lg font-semibold text-[var(--text-main)] mb-4">Kullanıcı Bazlı Özet</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {users.slice(0, 9).map(user => {
            const userAssignments = assignments.filter(a => a.userId === user.id && a.isActive);
            return (
              <div key={user.id} className="p-4 border border-[var(--border-soft)] rounded-lg">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-full bg-[var(--accent-quiet)] flex items-center justify-center">
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
                        <span key={a.id} className="inline-flex items-center px-2 py-1 rounded text-xs bg-[var(--accent-quiet)] text-[var(--accent-ink)]">
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
      
      {/* Süre Uzatma Modalı */}
      {extendModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="theme-card p-6 w-full max-w-md mx-4 border border-[var(--border-soft)]">
            <h3 className="text-lg font-semibold text-[var(--text-main)] mb-4 flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-[var(--accent)]" />
              Süre Uzat
            </h3>
            
            <div className="space-y-4">
              <div className="p-3 bg-[var(--bg-card-2)] rounded-lg">
                <p className="text-sm text-[var(--text-muted)]">Kullanıcı</p>
                <p className="font-medium text-[var(--text-main)]">{getUserName(extendModal.user)}</p>
                <p className="text-sm text-[var(--text-muted)]">Anket</p>
                <p className="font-medium text-[var(--text-main)]">{extendModal.survey.name}</p>
                {extendModal.deadline && (
                  <>
                    <p className="text-sm text-[var(--text-muted)] mt-2">Mevcut Bitiş Tarihi</p>
                    <p className={`font-medium ${isExpired(extendModal) ? 'text-[var(--error)]' : 'text-[var(--text-main)]'}`}>
                      {new Date(extendModal.deadline).toLocaleDateString("tr-TR")}
                      {isExpired(extendModal) && ' (Süresi doldu)'}
                    </p>
                  </>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">Yeni Bitiş Tarihi</label>
                <input
                  type="date"
                  value={newDeadline}
                  onChange={(e) => setNewDeadline(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border border-[var(--border-soft)] rounded-lg focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] bg-[var(--bg-card)] text-[var(--text-main)]"
                />
              </div>
              
              <div className="flex gap-3 pt-2">
                <Button
                  onClick={() => {
                    setExtendModal(null);
                    setNewDeadline("");
                  }}
                  variant="outline"
                  className="flex-1 text-[var(--text-muted)]"
                >
                  İptal
                </Button>
                <Button
                  onClick={handleExtendDeadline}
                  disabled={!newDeadline || saving}
                  className="flex-1 disabled:cursor-not-allowed"
                >
                  {saving ? "Kaydediliyor..." : "Süreyi Uzat"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
