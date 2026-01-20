"use client";

import { useEffect, useState } from "react";
import { Building2, Plus, Edit, Trash2, X, Save, Users, UserCircle } from "lucide-react";
import { toast } from "sonner";

interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  unitId: string | null;
}

interface Unit {
  id: string;
  name: string;
  description: string | null;
  organization: string | null;
  managerId: string | null;
  manager: User | null;
  users: User[];
  _count: {
    users: number;
  };
}

export default function UnitsPage() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [showUsersModal, setShowUsersModal] = useState<Unit | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    organization: "",
    managerId: "",
  });

  const fetchData = async () => {
    try {
      const [unitsRes, usersRes] = await Promise.all([
        fetch("/api/admin/units"),
        fetch("/api/admin/users"),
      ]);

      if (unitsRes.ok) setUnits(await unitsRes.json());
      if (usersRes.ok) setAllUsers(await usersRes.json());
    } catch (error) {
      console.error("Veri çekme hatası:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const method = editingUnit ? "PUT" : "POST";
    const body = editingUnit
      ? { id: editingUnit.id, ...formData }
      : formData;

    try {
      const res = await fetch("/api/admin/units", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        toast.success(editingUnit ? "Birim güncellendi" : "Birim oluşturuldu");
        setShowModal(false);
        setEditingUnit(null);
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
    if (!confirm("Bu birimi silmek istediğinizden emin misiniz? Birimdeki kullanıcılar birimden çıkarılacaktır.")) return;

    try {
      const res = await fetch(`/api/admin/units?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Birim silindi");
        fetchData();
      } else {
        toast.error("Birim silinemedi");
      }
    } catch (error) {
      toast.error("Bir hata oluştu");
    }
  };

  const handleAssignUser = async (userId: string, unitId: string) => {
    try {
      const res = await fetch("/api/admin/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: userId, unitId }),
      });

      if (res.ok) {
        toast.success("Kullanıcı birime atandı");
        fetchData();
      } else {
        toast.error("Kullanıcı atanamadı");
      }
    } catch (error) {
      toast.error("Bir hata oluştu");
    }
  };

  const handleRemoveUserFromUnit = async (userId: string) => {
    try {
      const res = await fetch("/api/admin/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: userId, unitId: null }),
      });

      if (res.ok) {
        toast.success("Kullanıcı birimden çıkarıldı");
        fetchData();
      } else {
        toast.error("Kullanıcı çıkarılamadı");
      }
    } catch (error) {
      toast.error("Bir hata oluştu");
    }
  };

  const openEditModal = (unit: Unit) => {
    setEditingUnit(unit);
    setFormData({
      name: unit.name,
      description: unit.description || "",
      organization: unit.organization || "",
      managerId: unit.managerId || "",
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      organization: "",
      managerId: "",
    });
  };

  const unassignedUsers = allUsers.filter(
    (u) => !u.unitId && u.role !== "ADMIN"
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
          <Building2 className="text-[#1e3a8a]" size={28} />
          <h1 className="text-2xl font-bold text-gray-900">Birim Yönetimi</h1>
        </div>
        <button
          onClick={() => {
            setEditingUnit(null);
            resetForm();
            setShowModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-[#1e3a8a] text-white rounded-lg hover:bg-[#3b5998] transition-colors"
        >
          <Plus size={20} />
          Yeni Birim
        </button>
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
        <p className="text-sm text-blue-700">
          <strong>Birim</strong>, bir şirketin lokasyonu veya departmanıdır. Her birime bir <strong>Birim Yöneticisi</strong> atayabilir
          ve kullanıcıları bu birimlere dağıtabilirsiniz. Birim Yöneticisi sadece kendi birimindeki kullanıcıları
          görebilir ve yönetebilir.
        </p>
      </div>

      {/* Units Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {units.map((unit) => (
          <div key={unit.id} className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{unit.name}</h3>
                {unit.description && (
                  <p className="text-sm text-gray-500 mt-1">{unit.description}</p>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => openEditModal(unit)}
                  className="p-2 text-gray-400 hover:text-[#1e3a8a] hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <Edit size={16} />
                </button>
                <button
                  onClick={() => handleDelete(unit.id)}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            {/* Manager */}
            <div className="flex items-center gap-2 mb-4 p-3 bg-purple-50 rounded-lg">
              <UserCircle className="text-purple-600" size={20} />
              <div>
                <p className="text-xs text-purple-600 font-medium">Birim Yöneticisi</p>
                <p className="text-sm text-gray-900">
                  {unit.manager
                    ? `${unit.manager.firstName || ""} ${unit.manager.lastName || ""} (${unit.manager.email})`
                    : "Atanmamış"}
                </p>
              </div>
            </div>

            {/* User Count */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-gray-600">
                <Users size={18} />
                <span className="text-sm">{unit._count.users} Kullanıcı</span>
              </div>
              <button
                onClick={() => setShowUsersModal(unit)}
                className="text-sm text-[#1e3a8a] hover:underline"
              >
                Kullanıcıları Yönet
              </button>
            </div>
          </div>
        ))}
      </div>

      {units.length === 0 && (
        <div className="text-center py-12 text-gray-500 bg-white rounded-xl">
          Henüz birim oluşturulmamış
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingUnit ? "Birim Düzenle" : "Yeni Birim"}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Birim Adı *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#1e3a8a] focus:border-transparent"
                  required
                  placeholder="Örn: İstanbul Merkez"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Açıklama</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#1e3a8a] focus:border-transparent"
                  rows={2}
                  placeholder="Birim hakkında kısa açıklama"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Organizasyon</label>
                <input
                  type="text"
                  value={formData.organization}
                  onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#1e3a8a] focus:border-transparent"
                  placeholder="Örn: ABC Şirketi"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Birim Yöneticisi</label>
                <select
                  value={formData.managerId}
                  onChange={(e) => setFormData({ ...formData, managerId: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#1e3a8a] focus:border-transparent"
                >
                  <option value="">Seçiniz</option>
                  {allUsers
                    .filter((u) => u.role !== "ADMIN")
                    .map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.firstName} {user.lastName} ({user.email})
                      </option>
                    ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Seçilen kullanıcının rolü otomatik olarak "Birim Yöneticisi" olarak güncellenecektir.
                </p>
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

      {/* Users Modal */}
      {showUsersModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">
                {showUsersModal.name} - Kullanıcılar
              </h2>
              <button
                onClick={() => setShowUsersModal(null)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4 flex-1 overflow-y-auto">
              {/* Current Users */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Birimdeki Kullanıcılar</h3>
                {showUsersModal.users.length > 0 ? (
                  <div className="space-y-2">
                    {showUsersModal.users.map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div>
                          <p className="font-medium text-gray-900">
                            {user.firstName} {user.lastName}
                          </p>
                          <p className="text-sm text-gray-500">{user.email}</p>
                        </div>
                        <button
                          onClick={() => handleRemoveUserFromUnit(user.id)}
                          className="text-sm text-red-600 hover:underline"
                        >
                          Çıkar
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Bu birimde henüz kullanıcı yok</p>
                )}
              </div>

              {/* Add User */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Kullanıcı Ekle</h3>
                {unassignedUsers.length > 0 ? (
                  <div className="space-y-2">
                    {unassignedUsers.map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div>
                          <p className="font-medium text-gray-900">
                            {user.firstName} {user.lastName}
                          </p>
                          <p className="text-sm text-gray-500">{user.email}</p>
                        </div>
                        <button
                          onClick={() => handleAssignUser(user.id, showUsersModal.id)}
                          className="text-sm text-[#1e3a8a] hover:underline"
                        >
                          Ekle
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Atanmamış kullanıcı yok</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
