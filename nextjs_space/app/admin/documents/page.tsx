"use client";

import { useCallback, useEffect, useState } from "react";
import { FileText, Download, Trash2, User, Building2, Search, Filter, Eye } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface Document {
  id: string;
  fileName: string;
  fileType: string;
  cloudStoragePath: string;
  isPublic: boolean;
  createdAt: string;
  downloadUrl: string | null;
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    unit?: {
      id: string;
      name: string;
    } | null;
  };
  response?: {
        question: {
          text: string;
          category?: { name: string } | null;
          subLevel?: {
        name: string;
        subCategory: {
          name: string;
          category: { name: string };
        };
      } | null;
      subCategory?: {
        name: string;
        category: { name: string };
      } | null;
    };
  } | null;
}

interface Unit {
  id: string;
  name: string;
}

interface UserOption {
  id: string;
  name: string;
  email: string;
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUnit, setSelectedUnit] = useState("");
  const [selectedUser, setSelectedUser] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const fetchUnits = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/units");
      if (res.ok) {
        const data = await res.json();
        setUnits(data);
      }
    } catch (error) {
      console.error("Error fetching units:", error);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/users");
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  }, []);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedUnit) params.append("unitId", selectedUnit);
      if (selectedUser) params.append("userId", selectedUser);

      const res = await fetch(`/api/admin/documents?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
      }
    } catch (error) {
      console.error("Error fetching documents:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedUnit, selectedUser]);

  useEffect(() => {
    fetchUnits();
    fetchUsers();
  }, [fetchUnits, fetchUsers]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleDelete = async (id: string) => {
    if (!confirm("Bu dosyayı silmek istediğinizden emin misiniz?")) return;

    try {
      const res = await fetch(`/api/admin/documents?id=${id}`, {
        method: "DELETE"
      });

      if (res.ok) {
        toast.success("Dosya silindi");
        fetchDocuments();
      } else {
        toast.error("Dosya silinemedi");
      }
    } catch (error) {
      toast.error("Bir hata oluştu");
    }
  };

  const handleDownload = (doc: Document) => {
    if (doc.downloadUrl) {
      const link = document.createElement("a");
      link.href = doc.downloadUrl;
      link.download = doc.fileName;
      link.click();
    } else {
      toast.error("Dosya indirilemedi");
    }
  };

  const getQuestionContext = (doc: Document) => {
    if (!doc.response?.question) return "Bağlantısız dosya";
    
    const q = doc.response.question;
    if (q.subLevel) {
      return `${q.subLevel.subCategory.category.name} > ${q.subLevel.subCategory.name} > ${q.subLevel.name}`;
    } else if (q.subCategory) {
      return `${q.subCategory.category.name} > ${q.subCategory.name}`;
    } else if (q.category) {
      return q.category.name;
    }
    return "";
  };

  const getUserName = (doc: Document) => {
    return [doc.user.firstName, doc.user.lastName].filter(Boolean).join(" ") || doc.user.email;
  };

  const filteredDocuments = documents.filter(doc =>
    doc.fileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    getUserName(doc).toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getFileIcon = (fileType: string) => {
    if (fileType.includes("pdf")) return "📄";
    if (fileType.includes("image")) return "🖼️";
    if (fileType.includes("word") || fileType.includes("document")) return "📝";
    if (fileType.includes("excel") || fileType.includes("sheet")) return "📊";
    return "📎";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="t-display" style={{ color: "var(--ink)" }}>Yüklenen Dosyalar</h1>
          <p className="text-[var(--text-dim)]  mt-1">Kullanıcıların yüklediği kanıt dosyaları</p>
        </div>
        <div className="flex items-center gap-2 bg-[var(--accent-soft)]  px-4 py-2 rounded-lg">
          <FileText className="text-[var(--accent-cyan)] " size={20} />
          <span className="font-semibold text-[var(--accent)] ">{documents.length} dosya</span>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-[var(--bg-card)]  rounded-xl shadow-sm p-4 border border-[var(--border-soft)] ">
        <div className="flex items-center gap-2 mb-4">
          <Filter size={18} className="text-[var(--text-dim)] " />
          <span className="font-medium text-[var(--text-muted)] ">Filtreler</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" size={18} />
            <input
              type="text"
              placeholder="Dosya adı veya kullanıcı ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-[var(--border-soft)]  rounded-lg bg-[var(--bg-card)]  text-[var(--text-main)]  focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
            />
          </div>

          {/* Unit Filter */}
          <select
            value={selectedUnit}
            onChange={(e) => setSelectedUnit(e.target.value)}
            className="px-4 py-2 border border-[var(--border-soft)]  rounded-lg bg-[var(--bg-card)]  text-[var(--text-main)]  focus:ring-2 focus:ring-[var(--accent)]"
          >
            <option value="">Tüm Birimler</option>
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>{unit.name}</option>
            ))}
          </select>

          {/* User Filter */}
          <select
            value={selectedUser}
            onChange={(e) => setSelectedUser(e.target.value)}
            className="px-4 py-2 border border-[var(--border-soft)]  rounded-lg bg-[var(--bg-card)]  text-[var(--text-main)]  focus:ring-2 focus:ring-[var(--accent)]"
          >
            <option value="">Tüm Kullanıcılar</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>{user.name} ({user.email})</option>
            ))}
          </select>
        </div>
      </div>

      {/* Documents List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-[var(--accent-cyan)] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredDocuments.length === 0 ? (
        <div className="bg-[var(--bg-card)]  rounded-xl p-12 text-center border border-[var(--border-soft)] ">
          <FileText className="mx-auto text-[var(--ui-passive)]  mb-4" size={48} />
          <p className="text-[var(--text-dim)] ">Henüz yüklenmiş dosya bulunmuyor</p>
        </div>
      ) : (
        <div className="bg-[var(--bg-card)]  rounded-xl shadow-sm border border-[var(--border-soft)]  overflow-hidden">
          <table className="theme-table">
            <thead>
              <tr>
                <th>Dosya</th>
                <th>Kullanıcı</th>
                <th>Birim</th>
                <th>Soru Bağlamı</th>
                <th>Tarih</th>
                <th className="text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {filteredDocuments.map((doc) => (
                <tr key={doc.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{getFileIcon(doc.fileType)}</span>
                      <div>
                        <p className="font-medium text-[var(--text-main)] ">{doc.fileName}</p>
                        <p className="text-xs text-[var(--text-dim)] ">{doc.fileType}</p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <User size={16} className="text-[var(--text-dim)]" />
                      <div>
                        <p className="text-[var(--text-main)] ">{getUserName(doc)}</p>
                        <p className="text-xs text-[var(--text-dim)] ">{doc.user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td>
                    {doc.user.unit ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-[var(--bg-card-2)]  text-[var(--accent)]  rounded text-sm">
                        <Building2 size={14} />
                        {doc.user.unit.name}
                      </span>
                    ) : (
                      <span className="text-[var(--text-dim)] ">-</span>
                    )}
                  </td>
                  <td>
                    <p className="text-sm text-[var(--text-muted)]  max-w-xs truncate" title={getQuestionContext(doc)}>
                      {getQuestionContext(doc)}
                    </p>
                  </td>
                  <td>
                    <p className="text-sm text-[var(--text-dim)] ">
                      {new Date(doc.createdAt).toLocaleDateString("tr-TR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </p>
                  </td>
                  <td>
                    <div className="flex items-center justify-end gap-2">
                      {doc.downloadUrl && (
                        <Button
                          onClick={() => handleDownload(doc)}
                          title="İndir"
                          variant="ghost"
                          size="icon"
                          className="text-[var(--accent-cyan)] hover:bg-[var(--accent-soft)]"
                        >
                          <Download size={18} />
                        </Button>
                      )}
                      <Button
                        onClick={() => handleDelete(doc.id)}
                        title="Sil"
                        variant="ghost"
                        size="icon"
                        className="text-[var(--error)] hover:bg-[var(--error-bg)]"
                      >
                        <Trash2 size={18} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
