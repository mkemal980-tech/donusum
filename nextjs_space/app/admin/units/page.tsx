"use client";

import { useEffect, useState } from "react";
import { Building2, Plus, Edit, Trash2, X, Save, Users, UserCircle, ChevronDown, ChevronRight, Shield, Crown } from "lucide-react";
import { toast } from "sonner";

interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  unitId: string | null;
}

interface UnitAdmin {
  id: string;
  userId: string;
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
}

interface Unit {
  id: string;
  name: string;
  description: string | null;
  organization: string | null;
  parentId: string | null;
  parent?: { id: string; name: string } | null;
  subUnits: Unit[];
  admins: UnitAdmin[];
  users: User[];
  _count: {
    users: number;
    subUnits: number;
  };
}

export default function UnitsPage() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [showUsersModal, setShowUsersModal] = useState<Unit | null>(null);
  const [expandedUnits, setExpandedUnits] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    organization: "",
    parentId: "",
    adminIds: [] as string[],
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

  const toggleExpand = (unitId: string) => {
    setExpandedUnits(prev => {
      const next = new Set(prev);
      if (next.has(unitId)) {
        next.delete(unitId);
      } else {
        next.add(unitId);
      }
      return next;
    });
  };

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
    if (!confirm("Bu birimi silmek istediğinizden emin misiniz?")) return;

    try {
      const res = await fetch(`/api/admin/units?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      
      if (res.ok) {
        toast.success("Birim silindi");
        fetchData();
      } else {
        toast.error(data.error || "Birim silinemedi");
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

  const openCreateModal = (parentId?: string) => {
    setEditingUnit(null);
    setFormData({
      name: "",
      description: "",
      organization: "",
      parentId: parentId || "",
      adminIds: [],
    });
    setShowModal(true);
  };

  const openEditModal = (unit: Unit) => {
    setEditingUnit(unit);
    setFormData({
      name: unit.name,
      description: unit.description || "",
      organization: unit.organization || "",
      parentId: unit.parentId || "",
      adminIds: unit.admins.map(a => a.userId),
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      organization: "",
      parentId: "",
      adminIds: [],
    });
  };

  const toggleAdmin = (userId: string) => {
    setFormData(prev => ({
      ...prev,
      adminIds: prev.adminIds.includes(userId)
        ? prev.adminIds.filter(id => id !== userId)
        : [...prev.adminIds, userId],
    }));
  };

  // Flatten units for parent selection (excluding current unit and its children)
  const getFlatUnitsForParent = (excludeId?: string): { id: string; name: string; level: number }[] => {
    const result: { id: string; name: string; level: number }[] = [];
    
    const addUnit = (unit: Unit, level: number) => {
      if (unit.id !== excludeId) {
        result.push({ id: unit.id, name: unit.name, level });
        unit.subUnits?.forEach(sub => addUnit(sub, level + 1));
      }
    };
    
    units.forEach(u => addUnit(u, 0));
    return result;
  };

  // Get parent unit's admins for inherited display
  const getParentAdmins = (unit: Unit): UnitAdmin[] => {
    if (!unit.parentId) return [];
    
    const findUnit = (units: Unit[], id: string): Unit | null => {
      for (const u of units) {
        if (u.id === id) return u;
        const found = findUnit(u.subUnits || [], id);
        if (found) return found;
      }
      return null;
    };
    
    const parent = findUnit(units, unit.parentId);
    return parent?.admins || [];
  };

  const unassignedUsers = allUsers.filter(
    (u) => !u.unitId && u.role !== "ADMIN"
  );

  const renderUnit = (unit: Unit, level: number = 0) => {
    const isExpanded = expandedUnits.has(unit.id);
    const hasSubUnits = unit.subUnits && unit.subUnits.length > 0;
    const parentAdmins = getParentAdmins(unit);

    return (
      <div key={unit.id} className={`${level > 0 ? 'ml-8 border-l-2 border-gray-200 pl-4' : ''}`}>
        <div className="bg-white rounded-xl shadow-sm p-5 mb-4 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              {hasSubUnits && (
                <button
                  onClick={() => toggleExpand(unit.id)}
                  className="mt-1 p-1 hover:bg-gray-100 rounded"
                >
                  {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                </button>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-gray-900">{unit.name}</h3>
                  {level > 0 && (
                    <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">Alt Birim</span>
                  )}
                </div>
                {unit.description && (
                  <p className="text-sm text-gray-500 mt-1">{unit.description}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => openCreateModal(unit.id)}
                className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                title="Alt Birim Ekle"
              >
                <Plus size={16} />
              </button>
              <button
                onClick={() => openEditModal(unit)}
                className="p-2 text-gray-400 hover:text-[#1e3a8a] hover:bg-blue-50 rounded-lg transition-colors"
                title="Düzenle"
              >
                <Edit size={16} />
              </button>
              <button
                onClick={() => handleDelete(unit.id)}
                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                title="Sil"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>

          {/* Admins */}
          <div className="mt-4 p-3 bg-purple-50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="text-purple-600" size={18} />
              <span className="text-sm font-medium text-purple-700">Birim Adminleri</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {unit.admins.map(admin => (
                <span key={admin.id} className="inline-flex items-center gap-1 px-2 py-1 bg-purple-200 text-purple-800 text-xs rounded-full">
                  <Crown size={12} />
                  {admin.user.firstName} {admin.user.lastName}
                </span>
              ))}
              {parentAdmins.length > 0 && parentAdmins.map(admin => (
                <span key={`inherited-${admin.id}`} className="inline-flex items-center gap-1 px-2 py-1 bg-gray-200 text-gray-600 text-xs rounded-full" title="Üst birimden miras">
                  <Shield size={12} />
                  {admin.user.firstName} {admin.user.lastName}
                  <span className="text-gray-400">(miras)</span>
                </span>
              ))}
              {unit.admins.length === 0 && parentAdmins.length === 0 && (
                <span className="text-xs text-purple-500">Admin atanmamış</span>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-1">
                <Users size={16} />
                <span>{unit._count.users} Kullanıcı</span>
              </div>
              {hasSubUnits && (
                <div className="flex items-center gap-1">
                  <Building2 size={16} />
                  <span>{unit._count.subUnits} Alt Birim</span>
                </div>
              )}
            </div>
            <button
              onClick={() => setShowUsersModal(unit)}
              className="text-sm text-[#1e3a8a] hover:underline"
            >
              Kullanıcıları Yönet
            </button>
          </div>
        </div>

        {/* Sub Units */}
        {isExpanded && hasSubUnits && (
          <div className="mt-2">
            {unit.subUnits.map(sub => renderUnit(sub, level + 1))}
          </div>
        )}
      </div>
    );
  };

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
          onClick={() => openCreateModal()}
          className="flex items-center gap-2 px-4 py-2 bg-[#1e3a8a] text-white rounded-lg hover:bg-[#3b5998] transition-colors"
        >
          <Plus size={20} />
          Yeni Birim
        </button>
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
        <h4 className="font-semibold text-blue-800 mb-2">Birim ve Alt Birim Yönetimi</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• <strong>Birim</strong> oluşturup içine <strong>Alt Birimler</strong> ekleyebilirsiniz.</li>
          <li>• Her birime <strong>birden fazla Admin</strong> atayabilirsiniz.</li>
          <li>• <strong>Üst birim adminleri</strong>, otomatik olarak tüm alt birimlerin de admini olur (miras).</li>
          <li>• Alt birimlerde ayrıca admin ataması gerektirmez.</li>
        </ul>
      </div>

      {/* Units Tree */}
      <div className="space-y-4">
        {units.map(unit => renderUnit(unit, 0))}
      </div>

      {units.length === 0 && (
        <div className="text-center py-12 text-gray-500 bg-white rounded-xl">
          Henüz birim oluşturulmamış
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingUnit ? "Birim Düzenle" : formData.parentId ? "Alt Birim Ekle" : "Yeni Birim"}
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Üst Birim (Opsiyonel)</label>
                <select
                  value={formData.parentId}
                  onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#1e3a8a] focus:border-transparent"
                >
                  <option value="">Yok (Üst Birim)</option>
                  {getFlatUnitsForParent(editingUnit?.id).map((u) => (
                    <option key={u.id} value={u.id}>
                      {"\u00A0\u00A0".repeat(u.level)}{u.level > 0 ? '└ ' : ''}{u.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Seçilirse bu birim, üst birimin alt birimi olur.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <div className="flex items-center gap-2">
                    <Shield size={16} className="text-purple-600" />
                    Birim Adminleri (Birden fazla seçebilirsiniz)
                  </div>
                </label>
                <div className="border rounded-lg max-h-48 overflow-y-auto">
                  {allUsers
                    .filter((u) => u.role !== "ADMIN")
                    .map((user) => (
                      <label
                        key={user.id}
                        className={`flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0 ${
                          formData.adminIds.includes(user.id) ? 'bg-purple-50' : ''
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={formData.adminIds.includes(user.id)}
                          onChange={() => toggleAdmin(user.id)}
                          className="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
                        />
                        <div>
                          <p className="font-medium text-gray-900 text-sm">
                            {user.firstName} {user.lastName}
                          </p>
                          <p className="text-xs text-gray-500">{user.email}</p>
                        </div>
                      </label>
                    ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Seçilen kullanıcıların rolü otomatik olarak "Birim Yöneticisi" olarak güncellenecektir.
                  Adminler, bu birimin ve tüm alt birimlerinin yöneticisi olacaktır.
                </p>
              </div>

              {formData.adminIds.length > 0 && (
                <div className="p-3 bg-purple-50 rounded-lg">
                  <p className="text-sm text-purple-700 font-medium mb-2">Seçilen Adminler ({formData.adminIds.length}):</p>
                  <div className="flex flex-wrap gap-2">
                    {formData.adminIds.map(id => {
                      const user = allUsers.find(u => u.id === id);
                      return user ? (
                        <span key={id} className="inline-flex items-center gap-1 px-2 py-1 bg-purple-200 text-purple-800 text-xs rounded-full">
                          <Crown size={12} />
                          {user.firstName} {user.lastName}
                          <button
                            type="button"
                            onClick={() => toggleAdmin(id)}
                            className="ml-1 hover:text-red-600"
                          >
                            <X size={12} />
                          </button>
                        </span>
                      ) : null;
                    })}
                  </div>
                </div>
              )}

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
