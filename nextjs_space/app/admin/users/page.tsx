"use client";

import { useEffect, useState } from "react";
import { Plus, Edit, Trash2, X, Save, Search, FileText, Check, UserX, UserCheck, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/ui/page-header";
import StatCard from "@/components/ui/stat-card";

interface Unit {
  id: string;
  name: string;
}

interface Sector {
  id: string;
  name: string;
  naicsCode: string | null;
  subSectors: { id: string; name: string }[];
}

interface Survey {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
}

interface SurveyAssignment {
  id: string;
  surveyId: string;
  survey: { id: string; name: string };
  assignedAt: string;
}

interface UserType {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  organization: string | null;
  role: "USER" | "UNIT_MANAGER" | "ADMIN";
  emailVerified: boolean;
  /** Devre dışı hesap listede kalır ama giriş yapamaz. */
  isActive: boolean;
  unitId: string | null;
  sectorId: string | null;
  subSectorId: string | null;
  createdAt: string;
  unit: Unit | null;
  sector: { id: string; name: string } | null;
  subSector: { id: string; name: string } | null;
  _count: {
    surveyResponses: number;
  };
}

const roleLabels: Record<string, string> = {
  USER: "Kullanıcı",
  UNIT_MANAGER: "Birim Yöneticisi",
  ADMIN: "Yönetici",
};

const roleColors: Record<string, string> = {
  USER: "bg-[var(--bg-card-2)] text-[var(--text-muted)]",
  UNIT_MANAGER: "bg-[var(--accent-quiet)] text-[var(--accent-ink)]",
  ADMIN: "bg-[var(--bg-card-2)] text-[var(--accent)]",
};

export default function UsersPage() {
  const [users, setUsers] = useState<UserType[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserType | null>(null);
  const [userAssignments, setUserAssignments] = useState<SurveyAssignment[]>([]);
  const [editingUser, setEditingUser] = useState<UserType | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  /** Kalıcı silme onayı: ne götüreceği gösterilmeden onaylanmaz. */
  const [deleteTarget, setDeleteTarget] = useState<{
    user: UserType;
    impact: {
      assessments: number;
      responses: number;
      authoredElsewhere: number;
      documents: number;
    } | null;
    loading: boolean;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [roleFilter, setRoleFilter] = useState("");
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    organization: "",
    role: "USER" as "USER" | "UNIT_MANAGER" | "ADMIN",
    // Yönetici hesabı elle açıyorsa adresi zaten doğruluyor demektir.
    emailVerified: true,
    unitId: "",
    sectorId: "",
    subSectorId: "",
  });

  const fetchData = async () => {
    try {
      // Silme/güncelleme sonrası tazeleme eski yanıtı almasın (bkz. middleware).
      const [usersRes, unitsRes, sectorsRes, surveysRes] = await Promise.all([
        fetch("/api/admin/users", { cache: "no-store" }),
        fetch("/api/admin/units", { cache: "no-store" }),
        fetch("/api/admin/sectors", { cache: "no-store" }),
        fetch("/api/admin/surveys", { cache: "no-store" }),
      ]);

      if (usersRes.ok) setUsers(await usersRes.json());
      if (unitsRes.ok) setUnits(await unitsRes.json());
      if (sectorsRes.ok) setSectors(await sectorsRes.json());
      if (surveysRes.ok) setSurveys(await surveysRes.json());
    } catch (error) {
      console.error("Veri çekme hatası:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Kullanıcının anket atamalarını getir
  const fetchUserAssignments = async (userId: string) => {
    try {
      const res = await fetch(`/api/admin/survey-assignments?userId=${userId}`);
      if (res.ok) {
        const data = await res.json();
        setUserAssignments(data);
      }
    } catch (error) {
      console.error("Atama getirme hatası:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const method = editingUser ? "PUT" : "POST";
    const body = editingUser
      ? { id: editingUser.id, ...formData }
      : formData;

    // Şifre boşsa gönderme (düzenleme modunda)
    if (editingUser && !formData.password) {
      const { password, ...rest } = body as typeof formData & { id: string };
      Object.assign(body, rest);
    }

    try {
      const res = await fetch("/api/admin/users", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        toast.success(editingUser ? "Kullanıcı güncellendi" : "Kullanıcı oluşturuldu");
        setShowModal(false);
        setEditingUser(null);
        resetForm();
        fetchData();
      } else {
        const data = await res.json();
        toast.error(data.error || "Bir hata oluştu");
      }
    } catch (error) {
      toast.error("Bir hata oluştu");
    }
  };

  /**
   * Devre dışı bırakma ile kalıcı silme ayrıldı.
   *
   * Tek bir "Sil" düğmesi vardı ve arkasındaki uç nokta hesabı yalnızca devre
   * dışı bırakıyordu; liste `isActive`'i ne süzüyor ne gösteriyordu. Sonuç:
   * yönetici onay veriyor, "Kullanıcı silindi" bildirimi alıyor ve satır
   * olduğu gibi kalıyordu.
   */
  const handleDeactivate = async (user: UserType) => {
    const label = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
    if (!confirm(`${label} giriş yapamayacak. Cevapları ve değerlendirmeleri korunur. Devam edilsin mi?`)) return;

    try {
      const res = await fetch(`/api/admin/users?id=${user.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success("Kullanıcı devre dışı bırakıldı");
        fetchData();
      } else {
        toast.error(data.error || "Kullanıcı devre dışı bırakılamadı");
      }
    } catch {
      toast.error("Bir hata oluştu");
    }
  };

  const handleReactivate = async (user: UserType) => {
    try {
      const res = await fetch("/api/admin/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: user.id, name: user.firstName, isActive: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success("Kullanıcı yeniden etkinleştirildi");
        fetchData();
      } else {
        toast.error(data.error || "Kullanıcı etkinleştirilemedi");
      }
    } catch {
      toast.error("Bir hata oluştu");
    }
  };

  const openPermanentDelete = async (user: UserType) => {
    setDeleteTarget({ user, impact: null, loading: true });
    try {
      const res = await fetch(`/api/admin/users?action=delete-impact&id=${user.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Etki bilgisi alınamadı");
      setDeleteTarget({ user, impact: data.impact, loading: false });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Etki bilgisi alınamadı");
      setDeleteTarget(null);
    }
  };

  const confirmPermanentDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/users?id=${deleteTarget.user.id}&permanent=true`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success("Kullanıcı kalıcı olarak silindi");
        setDeleteTarget(null);
        fetchData();
      } else {
        toast.error(data.error || "Kullanıcı silinemedi");
      }
    } catch {
      toast.error("Bir hata oluştu");
    } finally {
      setDeleting(false);
    }
  };

  const openEditModal = (user: UserType) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      password: "",
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      organization: user.organization || "",
      role: user.role,
      emailVerified: user.emailVerified,
      unitId: user.unitId || "",
      sectorId: user.sectorId || "",
      subSectorId: user.subSectorId || "",
    });
    setShowModal(true);
  };

  const openAssignModal = async (user: UserType) => {
    setSelectedUser(user);
    await fetchUserAssignments(user.id);
    setShowAssignModal(true);
  };

  const handleAssignSurvey = async (surveyId: string) => {
    if (!selectedUser) return;
    
    try {
      const res = await fetch("/api/admin/survey-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedUser.id, surveyId }),
      });
      
      if (res.ok) {
        toast.success("Anket atandı");
        await fetchUserAssignments(selectedUser.id);
      } else {
        const data = await res.json();
        toast.error(data.error || "Atama hatası");
      }
    } catch (error) {
      toast.error("Bağlantı hatası");
    }
  };

  const handleRemoveAssignment = async (surveyId: string) => {
    if (!selectedUser) return;
    
    if (!confirm("Bu anket atamasını kaldırmak istediğinizden emin misiniz?")) return;
    
    try {
      const res = await fetch(`/api/admin/survey-assignments?userId=${selectedUser.id}&surveyId=${surveyId}`, {
        method: "DELETE",
      });
      
      if (res.ok) {
        toast.success("Atama kaldırıldı");
        await fetchUserAssignments(selectedUser.id);
      } else {
        toast.error("Kaldırma hatası");
      }
    } catch (error) {
      toast.error("Bağlantı hatası");
    }
  };

  const resetForm = () => {
    setFormData({
      email: "",
      password: "",
      firstName: "",
      lastName: "",
      organization: "",
      role: "USER",
      emailVerified: true,
      unitId: "",
      sectorId: "",
      subSectorId: "",
    });
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
      (user.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
    const matchesRole = !roleFilter || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const selectedSector = sectors.find((s) => s.id === formData.sectorId);
  
  // Kullanıcıya atanmamış anketler
  const unassignedSurveys = surveys.filter(
    s => s.isActive && !userAssignments.some(a => a.surveyId === s.id)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner" role="status" aria-label="Yükleniyor" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Kullanıcılar"
        subtitle="Rol ve birim atamalarını buradan yönetin."
        actions={
          <Button
            onClick={() => {
              setEditingUser(null);
              resetForm();
              setShowModal(true);
            }}
          >
            <Plus size={16} aria-hidden="true" />
            Yeni kullanıcı
          </Button>
        }
      />

      <div className="mb-6 flex flex-wrap items-start gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
            size={16}
            style={{ color: "var(--ink-3)" }}
            aria-hidden="true"
          />
          <label htmlFor="user-search" className="sr-only">
            Kullanıcı ara
          </label>
          <input
            id="user-search"
            type="search"
            placeholder="Ada veya e-postaya göre ara"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="theme-input"
            style={{ paddingLeft: 34 }}
          />
        </div>
        <label htmlFor="role-filter" className="sr-only">
          Rol
        </label>
        <select
          id="role-filter"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="theme-select w-auto"
        >
          <option value="">Tüm roller</option>
          <option value="USER">Kullanıcı</option>
          <option value="UNIT_MANAGER">Birim yöneticisi</option>
          <option value="ADMIN">Yönetici</option>
        </select>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Toplam" value={users.length} />
        <StatCard label="Kullanıcı" value={users.filter((u) => u.role === "USER").length} />
        <StatCard label="Birim yöneticisi" value={users.filter((u) => u.role === "UNIT_MANAGER").length} />
        <StatCard label="Yönetici" value={users.filter((u) => u.role === "ADMIN").length} />
      </div>

      {/* Users Table */}
      <div
        className="overflow-x-auto rounded-[var(--radius-lg)]"
        style={{ background: "var(--surface)", border: "1px solid var(--line)" }}
      >
        <table className="theme-table">
          <thead>
            <tr>
              <th>Kullanıcı</th>
              <th>Rol</th>
              <th>Birim</th>
              <th>Sektör</th>
              <th>Yanıt</th>
              <th className="text-right">İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user) => (
              <tr key={user.id}>
                <td>
                  <div>
                    <p className="font-medium text-[var(--text-main)]">
                      {user.firstName} {user.lastName}
                    </p>
                    <p className="text-sm text-[var(--text-dim)]">{user.email}</p>
                  </div>
                </td>
                <td>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${roleColors[user.role]}`}>
                      {roleLabels[user.role]}
                    </span>
                    {/*
                      Devre dışı bırakılan hesap listede kalır ama farkı
                      görünmeliydi: rozet olmadan yönetici "sildim ama silinmedi"
                      görüyordu.
                    */}
                    {!user.isActive && (
                      <span
                        className="px-2 py-1 rounded-full text-xs font-medium"
                        style={{ background: "var(--surface-3)", color: "var(--ink-3)" }}
                        title="Bu hesap giriş yapamaz. Cevapları ve değerlendirmeleri korunuyor."
                      >
                        Devre dışı
                      </span>
                    )}
                  </div>
                </td>
                <td>
                  {user.unit?.name || "-"}
                </td>
                <td>
                  {user.sector?.name || "-"}
                </td>
                <td>
                  {user._count.surveyResponses}
                </td>
                <td>
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      onClick={() => openAssignModal(user)}
                      title="Anket Ata"
                      variant="ghost"
                      size="icon"
                      className="text-[var(--text-dim)] hover:text-[var(--accent-ink)] hover:bg-[var(--accent-soft)]"
                    >
                      <FileText size={16} />
                    </Button>
                    <Button
                      onClick={() => openEditModal(user)}
                      title="Düzenle"
                      variant="ghost"
                      size="icon"
                      className="text-[var(--text-dim)] hover:text-[var(--accent)]"
                    >
                      <Edit size={16} />
                    </Button>
                    {user.isActive ? (
                      <Button
                        onClick={() => handleDeactivate(user)}
                        title="Devre dışı bırak — hesap giriş yapamaz, verileri korunur"
                        variant="ghost"
                        size="icon"
                        className="text-[var(--text-dim)] hover:text-[var(--warning-ink)] hover:bg-[var(--warning-bg)]"
                      >
                        <UserX size={16} />
                      </Button>
                    ) : (
                      <Button
                        onClick={() => handleReactivate(user)}
                        title="Yeniden etkinleştir"
                        variant="ghost"
                        size="icon"
                        className="text-[var(--text-dim)] hover:text-[var(--success-ink)] hover:bg-[var(--success-bg)]"
                      >
                        <UserCheck size={16} />
                      </Button>
                    )}
                    <Button
                      onClick={() => openPermanentDelete(user)}
                      title="Kalıcı olarak sil"
                      variant="ghost"
                      size="icon"
                      className="text-[var(--text-dim)] hover:text-[var(--error-ink)] hover:bg-[var(--error-bg)]"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredUsers.length === 0 && (
          <div className="text-center py-12 text-[var(--text-dim)]">
            Kullanıcı bulunamadı
          </div>
        )}
      </div>

      {/* User Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="theme-card shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold text-[var(--text-main)]">
                {editingUser ? "Kullanıcı Düzenle" : "Yeni Kullanıcı"}
              </h2>
              <Button
                onClick={() => setShowModal(false)}
                variant="ghost"
                size="icon"
              >
                <X size={20} />
              </Button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Ad</label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Soyad</label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Email *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">
                  Şifre {editingUser ? "(boş bırakırsanız değişmez)" : "*"}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
                  required={!editingUser}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Organizasyon</label>
                <input
                  type="text"
                  value={formData.organization}
                  onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Rol *</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as "USER" | "UNIT_MANAGER" | "ADMIN" })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
                >
                  <option value="USER">Kullanıcı</option>
                  <option value="UNIT_MANAGER">Birim Yöneticisi</option>
                  <option value="ADMIN">Yönetici</option>
                </select>
              </div>

              {/* Doğrulanmamış hesap giriş yapamaz. E-posta sağlayıcısı
                  tanımlı olmayan kurulumda doğrulama postası hiç gitmediği
                  için tek çare yöneticinin buradan işaretlemesi. */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-[var(--text-muted)]">
                  <input
                    type="checkbox"
                    checked={formData.emailVerified}
                    onChange={(e) =>
                      setFormData({ ...formData, emailVerified: e.target.checked })
                    }
                    className="w-4 h-4 accent-[var(--accent)]"
                  />
                  E-posta doğrulanmış (işaretli değilse kullanıcı giriş yapamaz)
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Birim</label>
                <select
                  value={formData.unitId}
                  onChange={(e) => setFormData({ ...formData, unitId: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
                >
                  <option value="">Seçiniz</option>
                  {units.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Sektör (NAICS)</label>
                <select
                  value={formData.sectorId}
                  onChange={(e) => setFormData({ ...formData, sectorId: e.target.value, subSectorId: "" })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
                >
                  <option value="">Sektör Seçiniz</option>
                  {sectors.map((sector) => (
                    <option key={sector.id} value={sector.id}>
                      {sector.name.startsWith('[') || !sector.naicsCode ? sector.name : `[${sector.naicsCode}] ${sector.name}`}
                    </option>
                  ))}
                </select>
              </div>
              
              {formData.sectorId && selectedSector?.subSectors && selectedSector.subSectors.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Alt Sektör</label>
                  <select
                    value={formData.subSectorId}
                    onChange={(e) => setFormData({ ...formData, subSectorId: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
                  >
                    <option value="">Alt Sektör Seçiniz</option>
                    {selectedSector.subSectors.map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        {sub.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  onClick={() => setShowModal(false)}
                  variant="outline"
                >
                  İptal
                </Button>
                <Button
                  type="submit"
                >
                  <Save size={18} />
                  Kaydet
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Survey Assignment Modal */}
      {showAssignModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="theme-card shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-main)]">Anket Atama</h2>
                <p className="text-sm text-[var(--text-dim)]">
                  {selectedUser.firstName} {selectedUser.lastName} ({selectedUser.email})
                </p>
              </div>
              <Button
                onClick={() => {
                  setShowAssignModal(false);
                  setSelectedUser(null);
                  setUserAssignments([]);
                }}
                variant="ghost"
                size="icon"
              >
                <X size={20} />
              </Button>
            </div>
            
            <div className="p-4 space-y-6">
              {/* Atanmış Anketler */}
              <div>
                <h3 className="text-sm font-semibold text-[var(--text-muted)] mb-3 flex items-center gap-2">
                  <Check size={16} className="text-[var(--accent)]" />
                  Atanmış Anketler ({userAssignments.length})
                </h3>
                {userAssignments.length > 0 ? (
                  <div className="space-y-2">
                    {userAssignments.map((assignment) => (
                      <div
                        key={assignment.id}
                        className="flex items-center justify-between p-3 bg-[var(--accent-soft)] border border-[var(--accent)] rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <FileText size={18} className="text-[var(--accent)]" />
                          <div>
                            <p className="font-medium text-[var(--text-main)]">{assignment.survey.name}</p>
                            <p className="text-xs text-[var(--text-dim)]">
                              Atandı: {new Date(assignment.assignedAt).toLocaleDateString('tr-TR')}
                            </p>
                          </div>
                        </div>
                        <Button
                          onClick={() => handleRemoveAssignment(assignment.surveyId)}
                          title="Atamayı Kaldır"
                          variant="ghost"
                          size="icon"
                          className="text-[var(--error-ink)] hover:bg-[var(--error-bg)]"
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-[var(--text-dim)] italic">Henüz anket atanmamış</p>
                )}
              </div>

              {/* Atanabilecek Anketler */}
              <div>
                <h3 className="text-sm font-semibold text-[var(--text-muted)] mb-3 flex items-center gap-2">
                  <Plus size={16} className="text-[var(--blue-main)]" />
                  Atanabilecek Anketler ({unassignedSurveys.length})
                </h3>
                {unassignedSurveys.length > 0 ? (
                  <div className="space-y-2">
                    {unassignedSurveys.map((survey) => (
                      <div
                        key={survey.id}
                        className="flex items-center justify-between p-3 bg-[var(--bg-card-2)] border border-[var(--border-soft)] rounded-lg hover:bg-[var(--bg-card-2)] hover:border-[var(--blue-main)] transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <FileText size={18} className="text-[var(--text-dim)]" />
                          <div>
                            <p className="font-medium text-[var(--text-main)]">{survey.name}</p>
                            {survey.description && (
                              <p className="text-xs text-[var(--text-dim)]">{survey.description}</p>
                            )}
                          </div>
                        </div>
                        <Button
                          onClick={() => handleAssignSurvey(survey.id)}
                          className="text-sm"
                        >
                          <Plus size={14} />
                          Ata
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-[var(--text-dim)] italic">Tüm anketler zaten atanmış</p>
                )}
              </div>
            </div>

            <div className="p-4 border-t bg-[var(--bg-card-2)]">
              <Button
                onClick={() => {
                  setShowAssignModal(false);
                  setSelectedUser(null);
                  setUserAssignments([]);
                }}
                variant="outline"
                className="w-full hover:bg-[var(--bg-card)]"
              >
                Kapat
              </Button>
            </div>
          </div>
        </div>
      )}

      {/*
        Kalıcı silme onayı.
        Şemadaki cascade zinciri kişisel değerlendirmeyi, cevaplarını, puan
        geçmişini ve yol haritasını da götürüyor. Ne gideceği tıklamadan önce
        yazıyor; anket silmede de aynı kalıp var.
      */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4">
          <div className="modal-backdrop absolute inset-0" onClick={() => !deleting && setDeleteTarget(null)} />
          <div
            className="relative w-full max-w-lg rounded-[var(--radius-lg)] p-6"
            style={{ background: "var(--surface)", border: "1px solid var(--line)" }}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle size={20} style={{ color: "var(--error)" }} className="mt-0.5 shrink-0" aria-hidden="true" />
              <div>
                <h2 className="t-subhead" style={{ color: "var(--ink)" }}>
                  Kalıcı olarak silinsin mi?
                </h2>
                <p className="mt-1 t-sm" style={{ color: "var(--ink-2)" }}>
                  {[deleteTarget.user.firstName, deleteTarget.user.lastName].filter(Boolean).join(" ") ||
                    deleteTarget.user.email}{" "}
                  · {deleteTarget.user.email}
                </p>
              </div>
            </div>

            {deleteTarget.loading ? (
              <p className="mt-4 t-sm" style={{ color: "var(--ink-3)" }}>Etki hesaplanıyor…</p>
            ) : deleteTarget.impact ? (
              <div className="mt-4 rounded-[var(--radius-md)] p-4" style={{ background: "var(--surface-2)" }}>
                {deleteTarget.impact.assessments === 0 &&
                deleteTarget.impact.documents === 0 &&
                deleteTarget.impact.authoredElsewhere === 0 ? (
                  <p className="t-sm" style={{ color: "var(--ink-2)" }}>
                    Bu hesaba bağlı değerlendirme, cevap veya dosya yok. Silmek güvenli.
                  </p>
                ) : (
                  <>
                    <p className="t-sm" style={{ color: "var(--ink-2)" }}>Silinecek:</p>
                    <ul className="mt-2 list-disc pl-5 t-sm" style={{ color: "var(--ink-2)" }}>
                      <li>{deleteTarget.impact.assessments} kişisel değerlendirme</li>
                      <li>{deleteTarget.impact.responses} cevap (bu değerlendirmelerin içinde)</li>
                      <li>{deleteTarget.impact.documents} yüklenen dosya kaydı</li>
                    </ul>
                    {deleteTarget.impact.authoredElsewhere > 0 && (
                      <p className="mt-3 t-sm" style={{ color: "var(--ink-3)" }}>
                        Kuruluş değerlendirmelerine girdiği {deleteTarget.impact.authoredElsewhere} cevap
                        silinmez; yalnızca kimin girdiği bilgisi kaybolur.
                      </p>
                    )}
                    <p className="mt-3 t-sm" style={{ color: "var(--error)" }}>
                      Bu işlem geri alınamaz. Erişimi kapatmak yeterliyse "Devre dışı bırak" kullanın.
                    </p>
                  </>
                )}
              </div>
            ) : null}

            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                Vazgeç
              </Button>
              <Button
                onClick={confirmPermanentDelete}
                loading={deleting}
                disabled={deleteTarget.loading}
                className="bg-[var(--error-solid)] hover:bg-[var(--error)]"
              >
                Kalıcı olarak sil
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
