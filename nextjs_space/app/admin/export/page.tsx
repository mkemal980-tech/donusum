'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  Download,
  Database,
  FileJson,
  FileSpreadsheet,
  Loader2,
  Check,
  AlertCircle
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/ui/page-header";

interface TableOption {
  id: string;
  name: string;
  description: string;
  selected: boolean;
}

export default function ExportPage(): JSX.Element {
  const [loading, setLoading] = useState<boolean>(false);
  const [format, setFormat] = useState<'json' | 'csv'>('json');
  const [selectedTable, setSelectedTable] = useState<string>('users');
  const [includePasswords, setIncludePasswords] = useState<boolean>(false);
  const [tables, setTables] = useState<TableOption[]>([
    { id: 'users', name: 'Kullanıcılar', description: 'Tüm kullanıcı verileri', selected: true },
    { id: 'sectors', name: 'Sektörler', description: 'Sektör ve alt sektörler', selected: true },
    { id: 'surveys', name: 'Anketler', description: 'Anket yapıları', selected: true },
    { id: 'categories', name: 'Kategoriler', description: 'Kategori hiyerarşisi', selected: true },
    { id: 'subCategories', name: 'Alt Kategoriler', description: 'Alt kategori verileri', selected: true },
    { id: 'subLevels', name: 'Alt Seviyeler', description: 'Alt seviye verileri', selected: true },
    { id: 'questions', name: 'Sorular', description: 'Tüm anket soruları', selected: true },
    { id: 'recommendations', name: 'Öneriler', description: 'Öneri verileri', selected: true },
    { id: 'benchmarks', name: 'Benchmarklar', description: 'Karşılaştırma verileri', selected: true },
    { id: 'ironmanBenchmarks', name: 'Ironman Benchmarklar', description: 'Velocity/Endurance verileri', selected: true },
    { id: 'surveyResponses', name: 'Anket Yanıtları', description: 'Kullanıcı yanıtları', selected: true },
    { id: 'roadmapItems', name: 'Yol Haritası', description: 'Roadmap öğeleri', selected: true },
    { id: 'scoreHistory', name: 'Puan Geçmişi', description: 'Puan değişimleri', selected: true },
    { id: 'documents', name: 'Belgeler', description: 'Yüklenen dosyalar (metadata)', selected: true },
    { id: 'units', name: 'Birimler', description: 'Organizasyon birimleri', selected: true },
    { id: 'userSurveyAssignments', name: 'Anket Atamaları', description: 'Kullanıcı-anket ilişkileri', selected: true }
  ]);

  const toggleTable = (id: string): void => {
    setTables(prev =>
      prev.map(t => (t.id === id ? { ...t, selected: !t.selected } : t))
    );
  };

  const selectAll = (): void => {
    setTables(prev => prev.map(t => ({ ...t, selected: true })));
  };

  const selectNone = (): void => {
    setTables(prev => prev.map(t => ({ ...t, selected: false })));
  };

  const handleExport = async (): Promise<void> => {
    const selectedTables = tables.filter(t => t.selected).map(t => t.id);

    if (selectedTables.length === 0) {
      toast.error('En az bir tablo seçmelisiniz');
      return;
    }

    setLoading(true);

    try {
      const params = new URLSearchParams();
      params.set('format', format);
      
      if (format === 'csv') {
        params.set('table', selectedTable);
      } else {
        if (selectedTables.length === tables.length) {
          params.set('tables', 'all');
        } else {
          params.set('tables', selectedTables.join(','));
        }
      }

      if (includePasswords) {
        params.set('includePasswords', 'true');
      }

      const response = await fetch(`/api/admin/export?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Export başarısız');
      }

      // Dosyayı indir
      const blob = await response.blob();
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `export_${new Date().toISOString().split('T')[0]}.${format}`;
      
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/);
        if (match) {
          filename = match[1];
        }
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Veriler başarıyla dışa aktarıldı');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Dışa aktarma sırasında hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Dışa aktarma"
        subtitle="Veritabanı tablolarını JSON ya da CSV olarak indirin."
      />

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Sol Panel - Format Seçimi */}
        <div className="lg:col-span-1 space-y-4">
          <motion.div
            className="p-5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-soft)]"
          >
            <h2 className="text-lg font-semibold text-[var(--text-main)] mb-4">Format Seçimi</h2>
            
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setFormat('json')}
                className={`w-full p-4 rounded-lg border-2 transition-all flex items-center gap-3 ${
                  format === 'json'
                    ? 'border-[var(--accent)] bg-[var(--surface-2)]'
                    : 'border-[var(--line)] bg-[var(--surface-2)] hover:border-[var(--line-strong)]'
                }`}
              >
                <FileJson className={`h-6 w-6 ${format === 'json' ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}`} />
                <div className="text-left">
                  <div className="font-medium" style={{ color: "var(--ink)" }}>JSON</div>
                  <div className="text-sm text-[var(--text-muted)]">Tüm veriler, ilişkiler dahil</div>
                </div>
                {format === 'json' && <Check className="h-5 w-5 text-[var(--accent)] ml-auto" />}
              </button>

              <button
                type="button"
                onClick={() => setFormat('csv')}
                className={`w-full p-4 rounded-lg border-2 transition-all flex items-center gap-3 ${
                  format === 'csv'
                    ? 'border-[var(--accent)] bg-[var(--surface-2)]'
                    : 'border-[var(--line)] bg-[var(--surface-2)] hover:border-[var(--line-strong)]'
                }`}
              >
                <FileSpreadsheet className={`h-6 w-6 ${format === 'csv' ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}`} />
                <div className="text-left">
                  <div className="font-medium" style={{ color: "var(--ink)" }}>CSV</div>
                  <div className="text-sm text-[var(--text-muted)]">Tek tablo, Excel uyumlu</div>
                </div>
                {format === 'csv' && <Check className="h-5 w-5 text-[var(--accent)] ml-auto" />}
              </button>
            </div>

            {format === 'csv' && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">
                  Dışa Aktarılacak Tablo
                </label>
                <select
                  value={selectedTable}
                  onChange={(e) => setSelectedTable(e.target.value)}
                  className="w-full p-3 rounded-lg bg-[var(--bg-card-2)] border border-[var(--border-soft)] text-[var(--text-main)]"
                >
                  {tables.map(table => (
                    <option key={table.id} value={table.id}>
                      {table.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Güvenlik Seçeneği */}
            <div className="mt-4 p-4 rounded-lg bg-[var(--bg-card-2)] border border-[var(--border-soft)]">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includePasswords}
                  onChange={(e) => setIncludePasswords(e.target.checked)}
                  className="w-4 h-4 rounded border-[var(--border-soft)] text-[var(--accent)] focus:ring-[var(--accent)]"
                />
                <div>
                  <div className="font-medium text-[var(--text-main)]">Şifreleri Dahil Et</div>
                  <div className="text-xs text-[var(--text-muted)]">
                    Hash&apos;lenmiş şifreler dahil edilir (migrasyon için)
                  </div>
                </div>
              </label>
            </div>

            {/* Uyarı */}
            <div className="mt-4 p-4 rounded-lg bg-[var(--warning-bg)] border border-[var(--warning)]/30">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-[var(--warning)] mt-0.5 flex-shrink-0" />
                <div className="text-sm text-[var(--warning)]">
                  <strong>Dikkat:</strong> Dışa aktarılan veriler hassas bilgiler içerebilir. Güvenli bir şekilde saklayın.
                </div>
              </div>
            </div>

            {/* Export Butonu */}
            <Button
              type="button"
              onClick={handleExport}
              disabled={loading}
              className="w-full mt-4 text-[var(--bg-deep)] font-medium"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Dışa Aktarılıyor...
                </>
              ) : (
                <>
                  <Download className="h-5 w-5" />
                  Dışa Aktar
                </>
              )}
            </Button>
          </motion.div>
        </div>

        {/* Sağ Panel - Tablo Seçimi (Sadece JSON için) */}
        {format === 'json' && (
          <motion.div
            className="lg:col-span-2 p-5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-soft)]"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-[var(--text-main)]">Tablolar</h2>
              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={selectAll}
                  variant="secondary"
                  className="text-sm text-[var(--text-muted)]"
                >
                  Tümünü Seç
                </Button>
                <Button
                  type="button"
                  onClick={selectNone}
                  variant="secondary"
                  className="text-sm text-[var(--text-muted)]"
                >
                  Hiçbirini Seçme
                </Button>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              {tables.map(table => (
                <button
                  key={table.id}
                  type="button"
                  onClick={() => toggleTable(table.id)}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    table.selected
                      ? 'border-[var(--accent)] bg-[var(--surface-2)]'
                      : 'border-[var(--line)] bg-[var(--surface-2)] hover:border-[var(--line-strong)]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium" style={{ color: "var(--ink)" }}>
                        {table.name}
                      </div>
                      <div className="text-sm text-[var(--text-muted)]">{table.description}</div>
                    </div>
                    {table.selected && <Check className="h-5 w-5 text-[var(--accent)]" />}
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-4 p-4 rounded-lg bg-[var(--bg-card-2)] border border-[var(--border-soft)]">
              <div className="text-sm text-[var(--text-muted)]">
                <strong className="text-[var(--text-main)]">
                  {tables.filter(t => t.selected).length}
                </strong> tablo seçildi
              </div>
            </div>
          </motion.div>
        )}

        {/* CSV için bilgi paneli */}
        {format === 'csv' && (
          <motion.div
            className="lg:col-span-2 p-5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-soft)]"
          >
            <h2 className="text-lg font-semibold text-[var(--text-main)] mb-4">CSV Formatı Hakkında</h2>
            
            <div className="space-y-4 text-[var(--text-muted)]">
              <p>
                CSV formatı tek bir tabloyu düz metin olarak dışa aktarır. Excel, Google Sheets
                ve diğer tablo programlarıyla uyumludur.
              </p>
              
              <div className="p-4 rounded-lg bg-[var(--bg-card-2)] border border-[var(--border-soft)]">
                <h3 className="font-medium text-[var(--text-main)] mb-2">Özellikler:</h3>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>UTF-8 karakter kodlaması</li>
                  <li>Virgül ayraçlı format</li>
                  <li>İlk satır başlık içerir</li>
                  <li>JSON alanları noktalı virgül ile ayrılmış</li>
                </ul>
              </div>

              <div className="p-4 rounded-lg bg-[var(--info-bg)]/10 border border-[var(--blue-main)]/30">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-[var(--blue-main)] mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-[var(--blue-light)]">
                    <strong>İpucu:</strong> Tüm verileri ilişkileriyle birlikte almak için JSON formatını tercih edin.
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
