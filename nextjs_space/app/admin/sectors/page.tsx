"use client";

import { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, Factory, Layers, ChevronDown, ChevronRight, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SubSector {
  id: string;
  name: string;
  order: number;
}

interface Sector {
  id: string;
  name: string;
  naicsCode: string | null;
  order: number;
  subSectors: SubSector[];
  _count?: { users: number };
}

export default function SectorsPage() {
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSector, setExpandedSector] = useState<string | null>(null);
  
  // New sector form
  const [showNewSector, setShowNewSector] = useState(false);
  const [newSectorName, setNewSectorName] = useState("");
  const [newSectorNaicsCode, setNewSectorNaicsCode] = useState("");
  
  // Edit sector
  const [editingSector, setEditingSector] = useState<string | null>(null);
  const [editSectorName, setEditSectorName] = useState("");
  const [editSectorNaicsCode, setEditSectorNaicsCode] = useState("");
  
  // New subsector form
  const [showNewSubSector, setShowNewSubSector] = useState<string | null>(null);
  const [newSubSectorName, setNewSubSectorName] = useState("");
  
  // Edit subsector
  const [editingSubSector, setEditingSubSector] = useState<string | null>(null);
  const [editSubSectorName, setEditSubSectorName] = useState("");

  const fetchSectors = async () => {
    try {
      const res = await fetch("/api/admin/sectors");
      const data = await res.json();
      setSectors(data || []);
    } catch (error) {
      console.error("Error fetching sectors:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSectors();
  }, []);

  const handleCreateSector = async () => {
    if (!newSectorName.trim()) return;
    try {
      const res = await fetch("/api/admin/sectors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          name: newSectorName, 
          naicsCode: newSectorNaicsCode || null,
          order: sectors.length 
        })
      });
      if (res.ok) {
        setNewSectorName("");
        setNewSectorNaicsCode("");
        setShowNewSector(false);
        fetchSectors();
      }
    } catch (error) {
      console.error("Error creating sector:", error);
    }
  };

  const handleUpdateSector = async (id: string) => {
    if (!editSectorName.trim()) return;
    try {
      const res = await fetch("/api/admin/sectors", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name: editSectorName, naicsCode: editSectorNaicsCode || null })
      });
      if (res.ok) {
        setEditingSector(null);
        setEditSectorNaicsCode("");
        fetchSectors();
      }
    } catch (error) {
      console.error("Error updating sector:", error);
    }
  };

  const handleDeleteSector = async (id: string) => {
    if (!confirm("Bu sektörü ve tüm alt sektörlerini silmek istediğinizden emin misiniz?")) return;
    try {
      const res = await fetch(`/api/admin/sectors?id=${id}`, { method: "DELETE" });
      if (res.ok) fetchSectors();
    } catch (error) {
      console.error("Error deleting sector:", error);
    }
  };

  const handleCreateSubSector = async (sectorId: string) => {
    if (!newSubSectorName.trim()) return;
    const sector = sectors.find(s => s.id === sectorId);
    try {
      const res = await fetch("/api/admin/subsectors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          name: newSubSectorName, 
          sectorId,
          order: sector?.subSectors?.length || 0
        })
      });
      if (res.ok) {
        setNewSubSectorName("");
        setShowNewSubSector(null);
        fetchSectors();
      }
    } catch (error) {
      console.error("Error creating subsector:", error);
    }
  };

  const handleUpdateSubSector = async (id: string) => {
    if (!editSubSectorName.trim()) return;
    try {
      const res = await fetch("/api/admin/subsectors", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name: editSubSectorName })
      });
      if (res.ok) {
        setEditingSubSector(null);
        fetchSectors();
      }
    } catch (error) {
      console.error("Error updating subsector:", error);
    }
  };

  const handleDeleteSubSector = async (id: string) => {
    if (!confirm("Bu alt sektörü silmek istediğinizden emin misiniz?")) return;
    try {
      const res = await fetch(`/api/admin/subsectors?id=${id}`, { method: "DELETE" });
      if (res.ok) fetchSectors();
    } catch (error) {
      console.error("Error deleting subsector:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner" role="status" aria-label="Yükleniyor" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="t-display" style={{ color: "var(--ink)" }}>Sektörler</h1>
          <p className="mt-1 t-sm" style={{ color: "var(--ink-2)" }}>Sektör ve alt sektörleri tanımlayın</p>
        </div>
        <Button
          onClick={() => setShowNewSector(true)}
        >
          <Plus size={20} />
          Yeni Sektör
        </Button>
      </div>

      {showNewSector && (
        <div className="theme-card p-4 mb-4">
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={newSectorNaicsCode}
              onChange={(e) => setNewSectorNaicsCode(e.target.value)}
              placeholder="NAICS Kodu (örn: 11)"
              className="w-28 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--accent)] outline-none text-center font-mono"
            />
            <input
              type="text"
              value={newSectorName}
              onChange={(e) => setNewSectorName(e.target.value)}
              placeholder="Sektör adı..."
              className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--accent)] outline-none"
              autoFocus
            />
            <Button
              onClick={handleCreateSector}
              size="icon"
            >
              <Save size={20} />
            </Button>
            <Button
              onClick={() => { setShowNewSector(false); setNewSectorName(""); setNewSectorNaicsCode(""); }}
              variant="secondary"
              size="icon"
              className="text-[var(--text-muted)] hover:bg-[var(--ui-passive)]"
            >
              <X size={20} />
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {sectors.map((sector) => (
          <div key={sector.id} className="theme-card overflow-hidden">
            <div
              className="flex items-center justify-between p-4 cursor-pointer hover:bg-[var(--bg-card-2)]"
              onClick={() => setExpandedSector(expandedSector === sector.id ? null : sector.id)}
            >
              <div className="flex items-center gap-3">
                {expandedSector === sector.id ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                <Factory size={20} className="text-[var(--blue-main)]" />
                {editingSector === sector.id ? (
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="text"
                      value={editSectorNaicsCode}
                      onChange={(e) => setEditSectorNaicsCode(e.target.value)}
                      placeholder="NAICS"
                      className="w-20 px-2 py-1 border rounded focus:ring-2 focus:ring-[var(--accent)] outline-none text-center font-mono text-sm"
                    />
                    <input
                      type="text"
                      value={editSectorName}
                      onChange={(e) => setEditSectorName(e.target.value)}
                      className="px-2 py-1 border rounded focus:ring-2 focus:ring-[var(--accent)] outline-none"
                      autoFocus
                    />
                    <button onClick={() => handleUpdateSector(sector.id)} className="p-1 text-[var(--accent-ink)] hover:bg-[var(--accent-soft)] rounded">
                      <Save size={18} />
                    </button>
                    <button onClick={() => { setEditingSector(null); setEditSectorNaicsCode(""); }} className="p-1 text-[var(--text-muted)] hover:bg-[var(--bg-card-2)] rounded">
                      <X size={18} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    {sector.naicsCode && (
                      <span className="px-2 py-0.5 bg-[var(--bg-card-2)] text-[var(--accent)] text-xs font-mono rounded">
                        {sector.naicsCode}
                      </span>
                    )}
                    <span className="font-medium text-[var(--text-main)]">{sector.name}</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <span className="text-sm text-[var(--text-dim)] mr-2">
                  {sector.subSectors.length} alt sektör | {sector._count?.users || 0} kullanıcı
                </span>
                <Button
                  onClick={() => { setEditingSector(sector.id); setEditSectorName(sector.name); setEditSectorNaicsCode(sector.naicsCode || ""); }}
                  variant="ghost"
                  size="icon"
                  className="text-[var(--blue-main)]"
                >
                  <Edit2 size={18} />
                </Button>
                <Button
                  onClick={() => handleDeleteSector(sector.id)}
                  variant="ghost"
                  size="icon"
                  className="text-[var(--error-ink)] hover:bg-[var(--error-bg)]"
                >
                  <Trash2 size={18} />
                </Button>
              </div>
            </div>

            {expandedSector === sector.id && (
              <div className="px-4 pb-4 pt-2 bg-[var(--bg-card-2)] border-t">
                <div className="ml-8 space-y-2">
                  {sector.subSectors.map((sub) => (
                    <div key={sub.id} className="flex items-center justify-between py-2 px-3 bg-[var(--bg-card)] rounded-lg">
                      <div className="flex items-center gap-2">
                        <Layers size={16} className="text-[var(--accent)]" />
                        {editingSubSector === sub.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={editSubSectorName}
                              onChange={(e) => setEditSubSectorName(e.target.value)}
                              className="px-2 py-1 border rounded focus:ring-2 focus:ring-[var(--accent)] outline-none text-sm"
                              autoFocus
                            />
                            <button onClick={() => handleUpdateSubSector(sub.id)} className="p-1 text-[var(--accent-ink)] hover:bg-[var(--accent-soft)] rounded">
                              <Save size={16} />
                            </button>
                            <button onClick={() => setEditingSubSector(null)} className="p-1 text-[var(--text-muted)] hover:bg-[var(--bg-card-2)] rounded">
                              <X size={16} />
                            </button>
                          </div>
                        ) : (
                          <span className="text-[var(--text-muted)]">{sub.name}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => { setEditingSubSector(sub.id); setEditSubSectorName(sub.name); }}
                          className="p-1 text-[var(--blue-main)] hover:bg-[var(--bg-card-2)] rounded"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteSubSector(sub.id)}
                          className="p-1 text-[var(--error-ink)] hover:bg-[var(--error-bg)] rounded"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}

                  {showNewSubSector === sector.id ? (
                    <div className="flex items-center gap-2 py-2 px-3 bg-[var(--bg-card)] rounded-lg">
                      <Layers size={16} className="text-[var(--accent)]" />
                      <input
                        type="text"
                        value={newSubSectorName}
                        onChange={(e) => setNewSubSectorName(e.target.value)}
                        placeholder="Alt sektör adı..."
                        className="flex-1 px-2 py-1 border rounded focus:ring-2 focus:ring-[var(--accent)] outline-none text-sm"
                        autoFocus
                      />
                      <button onClick={() => handleCreateSubSector(sector.id)} className="p-1 text-[var(--accent-ink)] hover:bg-[var(--accent-soft)] rounded">
                        <Save size={16} />
                      </button>
                      <button onClick={() => { setShowNewSubSector(null); setNewSubSectorName(""); }} className="p-1 text-[var(--text-muted)] hover:bg-[var(--bg-card-2)] rounded">
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowNewSubSector(sector.id)}
                      className="flex items-center gap-2 py-2 px-3 text-[var(--accent-ink)] hover:bg-[var(--accent-quiet)] rounded-lg w-full"
                    >
                      <Plus size={16} />
                      Alt Sektör Ekle
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

        {sectors.length === 0 && (
          <div className="text-center py-12 theme-card">
            <Factory size={48} className="mx-auto text-[var(--ui-passive)] mb-4" />
            <p className="text-[var(--text-dim)]">Henüz sektör tanımlanmamış</p>
            <p className="text-sm text-[var(--text-dim)] mt-1">Yukarıdaki butonu kullanarak sektör ekleyin</p>
          </div>
        )}
      </div>
    </div>
  );
}
