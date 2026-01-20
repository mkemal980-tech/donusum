"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { 
  Download, 
  FileSpreadsheet, 
  Users, 
  Lightbulb, 
  FolderTree, 
  Factory,
  FileText,
  CheckCircle,
  Loader2
} from "lucide-react";

interface Survey {
  id: string;
  name: string;
}

interface Sector {
  id: string;
  name: string;
}

type ExportType = 'survey-responses' | 'user-scores' | 'recommendations' | 'categories' | 'sectors';

const exportOptions: { type: ExportType; label: string; description: string; icon: any; color: string }[] = [
  { 
    type: 'survey-responses', 
    label: 'Anket Cevapları', 
    description: 'Tüm kullanıcı cevaplarını detaylı olarak dışa aktar',
    icon: FileSpreadsheet,
    color: 'bg-blue-500'
  },
  { 
    type: 'user-scores', 
    label: 'Kullanıcı Puanları', 
    description: 'Kullanıcıların olgunluk puanlarını ve seviyelerini dışa aktar',
    icon: Users,
    color: 'bg-green-500'
  },
  { 
    type: 'recommendations', 
    label: 'Öneriler', 
    description: 'Tüm önerileri ve detaylarını dışa aktar',
    icon: Lightbulb,
    color: 'bg-purple-500'
  },
  { 
    type: 'categories', 
    label: 'Kategoriler & Sorular', 
    description: 'Anket yapısını, kategorileri ve soruları dışa aktar',
    icon: FolderTree,
    color: 'bg-orange-500'
  },
  { 
    type: 'sectors', 
    label: 'Sektörler', 
    description: 'Sektör ve alt sektör listesini dışa aktar',
    icon: Factory,
    color: 'bg-slate-500'
  }
];

export default function ExportPage() {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [selectedSurvey, setSelectedSurvey] = useState<string>('');
  const [selectedSector, setSelectedSector] = useState<string>('');
  const [exporting, setExporting] = useState<ExportType | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [surveysRes, sectorsRes] = await Promise.all([
          fetch('/api/admin/surveys'),
          fetch('/api/admin/sectors')
        ]);

        if (surveysRes.ok) {
          const data = await surveysRes.json();
          setSurveys(data ?? []);
        }

        if (sectorsRes.ok) {
          const data = await sectorsRes.json();
          setSectors(data ?? []);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchData();
  }, []);

  const handleExport = async (type: ExportType) => {
    setExporting(type);

    try {
      let url = `/api/admin/export?type=${type}`;
      
      // Filtreler
      if (selectedSurvey && (type === 'survey-responses' || type === 'recommendations' || type === 'categories')) {
        url += `&surveyId=${selectedSurvey}`;
      }
      if (selectedSector && type === 'user-scores') {
        url += `&sectorId=${selectedSector}`;
      }

      const res = await fetch(url);

      if (!res.ok) {
        throw new Error('Export failed');
      }

      // Dosyayı indir
      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      
      // Dosya adını header'dan al
      const contentDisposition = res.headers.get('Content-Disposition');
      const filename = contentDisposition?.split('filename="')[1]?.replace('"', '') || `${type}.csv`;
      a.download = filename;
      
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);

      toast.success('Veri başarıyla dışa aktarıldı', {
        description: filename
      });
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Dışa aktarma başarısız oldu');
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-[#1e3a8a] rounded-xl flex items-center justify-center">
          <Download className="text-white" size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Veri Dışa Aktarma</h1>
          <p className="text-gray-500">Platform verilerini CSV formatında dışa aktarın</p>
        </div>
      </div>

      {/* Filtreler */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <FileText size={20} className="text-[#1e3a8a]" />
          Filtreler (Opsiyonel)
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Anket Seçin
            </label>
            <select
              value={selectedSurvey}
              onChange={(e) => setSelectedSurvey(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#1e3a8a] outline-none bg-white"
            >
              <option value="">Tüm Anketler</option>
              {surveys.map(survey => (
                <option key={survey.id} value={survey.id}>{survey.name}</option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">Anket cevapları, öneriler ve kategoriler için geçerli</p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sektör Seçin
            </label>
            <select
              value={selectedSector}
              onChange={(e) => setSelectedSector(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#1e3a8a] outline-none bg-white"
            >
              <option value="">Tüm Sektörler</option>
              {sectors.map(sector => (
                <option key={sector.id} value={sector.id}>{sector.name}</option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">Kullanıcı puanları için geçerli</p>
          </div>
        </div>
      </div>

      {/* Export Kartları */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {exportOptions.map((option) => {
          const Icon = option.icon;
          const isExporting = exporting === option.type;
          
          return (
            <div
              key={option.type}
              className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow"
            >
              <div className={`${option.color} px-6 py-4`}>
                <Icon className="text-white" size={32} />
              </div>
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">{option.label}</h3>
                <p className="text-gray-500 text-sm mb-4">{option.description}</p>
                
                <button
                  onClick={() => handleExport(option.type)}
                  disabled={isExporting}
                  className="w-full flex items-center justify-center gap-2 bg-[#1e3a8a] text-white px-4 py-2.5 rounded-lg hover:bg-[#1e3a8a]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isExporting ? (
                    <>
                      <Loader2 className="animate-spin" size={18} />
                      Dışa Aktarılıyor...
                    </>
                  ) : (
                    <>
                      <Download size={18} />
                      CSV Olarak İndir
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bilgi Kutusu */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <div className="flex items-start gap-3">
          <CheckCircle className="text-blue-600 mt-0.5" size={20} />
          <div>
            <h3 className="font-semibold text-blue-800 mb-1">CSV Formatı Hakkında</h3>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Dosyalar UTF-8 BOM ile kodlanır, Excel&apos;de Türkçe karakterler doğru görünür</li>
              <li>• CSV dosyaları Microsoft Excel, Google Sheets ve diğer tablo programlarında açılabilir</li>
              <li>• Filtreleri kullanarak belirli anket veya sektöre ait verileri dışa aktarabilirsiniz</li>
              <li>• Büyük veri setleri için dışa aktarma birkaç saniye sürebilir</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
