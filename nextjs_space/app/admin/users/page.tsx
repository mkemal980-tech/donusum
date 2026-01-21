"use client";

import { useEffect, useState } from "react";
import { Users, Plus, Edit, Trash2, X, Save, Search, Filter, Shield, User, Building2, FileText, Check } from "lucide-react";
import { toast } from "sonner";

interface Unit {
  id: string;
  name: string;
}

interface Sector {
  id: string;
  name: string;
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
  USER: "bg-gray-100 text-gray-700",
  UNIT_MANAGER: "bg-purple-100 text-purple-700",
  ADMIN: "bg-blue-100 text-blue-700",
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
  const [roleFilter, setRoleFilter] = useState("");
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    organization: "",
    role: "USER" as "USER" | "UNIT_MANAGER" | "ADMIN",
    unitId: "",
    sectorId: "",
    subSectorId: "",
  });

  const fetchData = async () => {
    try {
      const [usersRes, unitsRes, sectorsRes, surveysRes] = await Promise.all([
        fetch("/api/admin/users"),
        fetch("/api/admin/units"),
        fetch("/api/admin/sectors"),
        fetch("/api/admin/surveys"),
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

  const handleDelete = async (id: string) => {
    if (!confirm("Bu kullanıcıyı silmek istediğinizden emin misiniz?")) return;

    try {
      const res = await fetch(`/api/admin/users?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Kullanıcı silindi");
        fetchData();
      } else {
        toast.error("Kullanıcı silinemedi");
      }
    } catch (error) {
      toast.error("Bir hata oluştu");
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
        <div className="w-8 h-8 border-4 border-[#1e3a8a] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Users className="text-[#1e3a8a]" size={28} />
          <h1 className="text-2xl font-bold text-gray-900">Kullanıcı Yönetimi</h1>
        </div>
        <button
          onClick={() => {
            setEditingUser(null);
            resetForm();
            setShowModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-[#1e3a8a] text-white rounded-lg hover:bg-[#3b5998] transition-colors"
        >
          <Plus size={20} />
          Yeni Kullanıcı
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-6 flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Kullanıcı ara..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#1e3a8a] focus:border-transparent"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={20} className="text-gray-400" />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#1e3a8a] focus:border-transparent"
          >
            <option value="">Tüm Roller</option>
            <option value="USER">Kullanıcı</option>
            <option value="UNIT_MANAGER">Birim Yöneticisi</option>
            <option value="ADMIN">Yönetici</option>
          </select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users className="text-[#1e3a8a]" size={20} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Toplam</p>
              <p className="text-xl font-bold text-gray-900">{users.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
              <User className="text-gray-600" size={20} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Kullanıcı</p>
              <p className="text-xl font-bold text-gray-900">
                {users.filter((u) => u.role === "USER").length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Building2 className="text-purple-600" size={20} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Birim Yöneticisi</p>
              <p className="text-xl font-bold text-gray-900">
                {users.filter((u) => u.role === "UNIT_MANAGER").length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Shield className="text-[#1e3a8a]" size={20} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Yönetici</p>
              <p className="text-xl font-bold text-gray-900">
                {users.filter((u) => u.role === "ADMIN").length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Kullanıcı</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Rol</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Birim</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Sektör</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Yanıt</th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">İşlemler</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredUsers.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div>
                    <p className="font-medium text-gray-900">
                      {user.firstName} {user.lastName}
                    </p>
                    <p className="text-sm text-gray-500">{user.email}</p>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${roleColors[user.role]}`}>
                    {roleLabels[user.role]}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {user.unit?.name || "-"}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {user.sector?.name || "-"}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {user._count.surveyResponses}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => openAssignModal(user)}
                      className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                      title="Anket Ata"
                    >
                      <FileText size={16} />
                    </button>
                    <button
                      onClick={() => openEditModal(user)}
                      className="p-2 text-gray-400 hover:text-[#1e3a8a] hover:bg-blue-50 rounded-lg transition-colors"
                      title="Düzenle"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(user.id)}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Sil"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredUsers.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            Kullanıcı bulunamadı
          </div>
        )}
      </div>

      {/* User Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingUser ? "Kullanıcı Düzenle" : "Yeni Kullanıcı"}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ad</label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#1e3a8a] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Soyad</label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#1e3a8a] focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#1e3a8a] focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Şifre {editingUser ? "(boş bırakırsanız değişmez)" : "*"}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#1e3a8a] focus:border-transparent"
                  required={!editingUser}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Organizasyon</label>
                <input
                  type="text"
                  value={formData.organization}
                  onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#1e3a8a] focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rol *</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as "USER" | "UNIT_MANAGER" | "ADMIN" })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#1e3a8a] focus:border-transparent"
                >
                  <option value="USER">Kullanıcı</option>
                  <option value="UNIT_MANAGER">Birim Yöneticisi</option>
                  <option value="ADMIN">Yönetici</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Birim</label>
                <select
                  value={formData.unitId}
                  onChange={(e) => setFormData({ ...formData, unitId: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#1e3a8a] focus:border-transparent"
                >
                  <option value="">Seçiniz</option>
                  {units.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sektör</label>
                  <select
                    value={formData.sectorId}
                    onChange={(e) => setFormData({ ...formData, sectorId: e.target.value, subSectorId: "" })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#1e3a8a] focus:border-transparent"
                  >
                    <option value="">Seçiniz</option>
                    {sectors.map((sector) => (
                      <option key={sector.id} value={sector.id}>
                        {sector.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Alt Sektör</label>
                  <select
                    value={formData.subSectorId}
                    onChange={(e) => setFormData({ ...formData, subSectorId: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#1e3a8a] focus:border-transparent"
                    disabled={!formData.sectorId}
                  >
                    <option value="">Seçiniz</option>
                    {selectedSector?.subSectors.map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        {sub.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 px-4 py-2 bg-[#1e3a8a] text-white rounded-lg hover:bg-[#3b5998] transition-colors"
                >
                  <Save size={18} />
                  Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Survey Assignment Modal */}
      {showAssignModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Anket Atama</h2>
                <p className="text-sm text-gray-500">
                  {selectedUser.firstName} {selectedUser.lastName} ({selectedUser.email})
                </p>
              </div>
              <button
                onClick={() => {
                  setShowAssignModal(false);
                  setSelectedUser(null);
                  setUserAssignments([]);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-4 space-y-6">
              {/* Atanmış Anketler */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Check size={16} className="text-green-600" />
                  Atanmış Anketler ({userAssignments.length})
                </h3>
                {userAssignments.length > 0 ? (
                  <div className="space-y-2">
                    {userAssignments.map((assignment) => (
                      <div
                        key={assignment.id}
                        className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <FileText size={18} className="text-green-600" />
                          <div>
                            <p className="font-medium text-gray-900">{assignment.survey.name}</p>
                            <p className="text-xs text-gray-500">
                              Atandı: {new Date(assignment.assignedAt).toLocaleDateString('tr-TR')}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveAssignment(assignment.surveyId)}
                          className="p-2 text-red-500 hover:bg-red-100 rounded-lg transition-colors"
                          title="Atamayı Kaldır"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 italic">Henüz anket atanmamış</p>
                )}
              </div>

              {/* Atanabilecek Anketler */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Plus size={16} className="text-blue-600" />
                  Atanabilecek Anketler ({unassignedSurveys.length})
                </h3>
                {unassignedSurveys.length > 0 ? (
                  <div className="space-y-2">
                    {unassignedSurveys.map((survey) => (
                      <div
                        key={survey.id}
                        className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-200 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <FileText size={18} className="text-gray-400" />
                          <div>
                            <p className="font-medium text-gray-900">{survey.name}</p>
                            {survey.description && (
                              <p className="text-xs text-gray-500">{survey.description}</p>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleAssignSurvey(survey.id)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-[#1e3a8a] text-white text-sm rounded-lg hover:bg-[#3b5998] transition-colors"
                        >
                          <Plus size={14} />
                          Ata
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 italic">Tüm anketler zaten atanmış</p>
                )}
              </div>
            </div>

            <div className="p-4 border-t bg-gray-50">
              <button
                onClick={() => {
                  setShowAssignModal(false);
                  setSelectedUser(null);
                  setUserAssignments([]);
                }}
                className="w-full px-4 py-2 border rounded-lg hover:bg-white transition-colors"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
