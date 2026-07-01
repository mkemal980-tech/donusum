"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Header from "@/components/ui/header";
import SurveyQuestion from "@/components/survey/survey-question";
import ProgressBar from "@/components/ui/progress-bar";
import { 
  ChevronLeft, 
  ChevronRight, 
  Check, 
  FolderOpen,
  Layers,
  FileQuestion,
  FileText,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Upload,
  Clock,
  AlertTriangle,
  Lock
} from "lucide-react";

interface Question {
  id: string;
  text: string;
  type: string;
  options?: any[] | null;
  requiresEvidence: boolean;
  order: number;
}

interface SubLevel {
  id: string;
  name: string;
  questions: Question[];
}

interface SubCategory {
  id: string;
  name: string;
  hasSubLevels: boolean;
  subLevels: SubLevel[];
  questions: Question[]; // Doğrudan sorular (hasSubLevels = false olduğunda)
  isCategoryDirect?: boolean;
}

interface Category {
  id: string;
  name: string;
  description?: string;
  subCategories: SubCategory[];
  questions: Question[];  // Doğrudan kategoriye bağlı sorular
}

interface Response {
  questionId: string;
  value: string;
  documents?: Array<{
    fileName: string;
    cloudStoragePath: string;
  }>;
}

interface Survey {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  hasDeadline?: boolean;
  deadline?: string | null;
  isExpired?: boolean;
}

function getDisplaySubCategories(category?: Category): SubCategory[] {
  if (!category) return [];

  const directQuestions = category.questions ?? [];
  const directSection: SubCategory[] = directQuestions.length > 0
    ? [{
        id: `${category.id}__direct`,
        name: "Kategori Soruları",
        hasSubLevels: false,
        subLevels: [],
        questions: directQuestions,
        isCategoryDirect: true
      }]
    : [];

  return [...directSection, ...(category.subCategories ?? [])];
}

export default function SurveyClient() {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [selectedSurveyId, setSelectedSurveyId] = useState<string>("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [currentCategoryIndex, setCurrentCategoryIndex] = useState(0);
  const [currentSubCategoryIndex, setCurrentSubCategoryIndex] = useState(0);
  const [currentSubLevelIndex, setCurrentSubLevelIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingStructure, setLoadingStructure] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, { fileName: string; cloudStoragePath: string }>>({});
  const [uploading, setUploading] = useState<string | null>(null);
  const router = useRouter();

  // Atanan anketleri getir
  useEffect(() => {
    const fetchAssignedSurveys = async () => {
      try {
        const res = await fetch("/api/survey/assigned");
        if (res.ok) {
          const data = await res.json();
          setSurveys(data ?? []);
          if (data.length > 0) {
            setSelectedSurveyId((current) => current || data[0].id);
          }
        }
      } catch (error) {
        console.error("Error fetching assigned surveys:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchAssignedSurveys();
  }, []);

  // Seçilen ankete göre yapıyı getir
  useEffect(() => {
    if (!selectedSurveyId) return;
    
    const fetchData = async () => {
      setLoadingStructure(true);
      try {
        const surveyParam = `?surveyId=${selectedSurveyId}`;
        const [structureRes, responsesRes] = await Promise.all([
          fetch(`/api/survey/structure${surveyParam}`),
          fetch(`/api/survey/responses${surveyParam}`)
        ]);

        if (structureRes.ok) {
          const data = await structureRes.json();
          setCategories(data ?? []);
        }

        if (responsesRes.ok) {
          const data = await responsesRes.json();
          const responseMap: Record<string, string> = {};
          const fileMap: Record<string, { fileName: string; cloudStoragePath: string }> = {};
          (data ?? []).forEach((r: Response) => {
            if (!r?.questionId) return;
            responseMap[r.questionId] = r?.value ?? '';
            const latestDocument = r.documents?.[0];
            if (latestDocument) {
              fileMap[r.questionId] = {
                fileName: latestDocument.fileName,
                cloudStoragePath: latestDocument.cloudStoragePath
              };
            }
          });
          setResponses(responseMap);
          setUploadedFiles(fileMap);
        }

        // Reset navigation
        setCurrentCategoryIndex(0);
        setCurrentSubCategoryIndex(0);
        setCurrentSubLevelIndex(0);
      } catch (error) {
        console.error("Error fetching survey data:", error);
      } finally {
        setLoadingStructure(false);
      }
    };

    fetchData();
  }, [selectedSurveyId]);

  const currentCategory = categories?.[currentCategoryIndex];
  const currentSubCategories = getDisplaySubCategories(currentCategory);
  const currentSubCategory = currentSubCategories?.[currentSubCategoryIndex];
  const hasSubLevels = currentSubCategory?.hasSubLevels ?? true;
  const currentSubLevel = hasSubLevels ? currentSubCategory?.subLevels?.[currentSubLevelIndex] : null;
  
  // Mevcut soruları belirle
  const currentQuestions = hasSubLevels 
    ? (currentSubLevel?.questions ?? [])
    : (currentSubCategory?.questions ?? []);

  // Toplam soru sayısı (kategori soruları dahil)
  const totalQuestions = categories?.reduce((total, cat) => {
    // Doğrudan kategoriye bağlı sorular
    const categoryQuestionCount = cat?.questions?.length ?? 0;
    
    // Alt kategori soruları
    const subCategoryQuestionCount = (cat?.subCategories ?? []).reduce((subTotal, sub) => {
      if (sub?.hasSubLevels) {
        return subTotal + (sub?.subLevels ?? []).reduce((levelTotal, level) => {
          return levelTotal + (level?.questions?.length ?? 0);
        }, 0);
      } else {
        return subTotal + (sub?.questions?.length ?? 0);
      }
    }, 0);
    
    return total + categoryQuestionCount + subCategoryQuestionCount;
  }, 0) ?? 0;

  const answeredQuestions = Object.keys(responses ?? {}).length;
  const progressPercentage = totalQuestions > 0 
    ? Math.round((answeredQuestions / totalQuestions) * 100) 
    : 0;

  const handleAnswer = async (questionId: string, value: string) => {
    const previousValue = responses[questionId];
    setResponses(prev => ({ ...(prev ?? {}), [questionId]: value }));
    setSaving(true);

    try {
      const res = await fetch("/api/survey/responses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, value })
      });
      
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setResponses(prev => {
          const next = { ...(prev ?? {}) };
          if (previousValue === undefined) {
            delete next[questionId];
          } else {
            next[questionId] = previousValue;
          }
          return next;
        });
        toast.error(data?.error || "Cevap kaydedilemedi");
        return;
      }

      toast.success("Cevap kaydedildi", {
        duration: 1500,
      });
    } catch (error) {
      console.error("Error saving response:", error);
      toast.error("Cevap kaydedilemedi");
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async (questionId: string, file: File) => {
    if (!responses[questionId]) {
      toast.error("Önce soruyu cevaplayın", {
        description: "Kanıt dosyasını cevabınızla ilişkilendirmek için önce bu soruya cevap vermelisiniz.",
        duration: 5000,
        icon: <AlertTriangle className="text-[var(--warning)]" size={20} />
      });
      return;
    }

    setUploading(questionId);
    
    // Dosya boyutu kontrolü (10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error("Dosya boyutu çok büyük", {
        description: "Maksimum dosya boyutu 10MB olmalıdır.",
        duration: 5000,
        icon: <XCircle className="text-[var(--error)]" size={20} />
      });
      setUploading(null);
      return;
    }

    try {
      const presignedRes = await fetch("/api/upload/presigned", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type,
          isPublic: true,
          fileSize: file.size
        })
      });

      if (!presignedRes.ok) {
        toast.error("Dosya yükleme başarısız", {
          description: "Sunucu bağlantısı kurulamadı. Lütfen tekrar deneyin.",
          duration: 5000,
          icon: <XCircle className="text-[var(--error)]" size={20} />
        });
        return;
      }

      const { uploadUrl, cloudStoragePath } = await presignedRes.json();

      const uploadHeaders: Record<string, string> = {
        "Content-Type": file.type
      };
      
      if (uploadUrl.includes("content-disposition")) {
        uploadHeaders["Content-Disposition"] = "attachment";
      }

      const uploadResult = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: uploadHeaders
      });

      if (!uploadResult.ok) {
        toast.error("Dosya yüklenemedi", {
          description: "Depolama alanına erişilemiyor. Lütfen tekrar deneyin.",
          duration: 5000,
          icon: <XCircle className="text-[var(--error)]" size={20} />
        });
        return;
      }

      const completeRes = await fetch("/api/upload/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cloudStoragePath,
          isPublic: true,
          fileName: file.name,
          fileType: file.type,
          questionId
        })
      });

      if (!completeRes.ok) {
        const data = await completeRes.json().catch(() => ({}));
        toast.error("Dosya kaydı tamamlanamadı", {
          description: data?.error || "Dosya yüklendi ancak cevapla ilişkilendirilemedi.",
          duration: 5000,
          icon: <XCircle className="text-[var(--error)]" size={20} />
        });
        return;
      }

      // State'i güncelle - dosya başarıyla yüklendi
      setUploadedFiles(prev => ({
        ...prev,
        [questionId]: { fileName: file.name, cloudStoragePath }
      }));
      
      toast.success("Dosya başarıyla yüklendi!", {
        description: file.name,
        duration: 4000,
        icon: <CheckCircle2 className="text-[var(--accent)]" size={20} />
      });
    } catch (error) {
      console.error("Error uploading file:", error);
      toast.error("Yükleme hatası", {
        description: "Beklenmeyen bir hata oluştu. İnternet bağlantınızı kontrol edin.",
        duration: 5000,
        icon: <XCircle className="text-[var(--error)]" size={20} />
      });
    } finally {
      setUploading(null);
    }
  };

  const handleRemoveFile = (questionId: string) => {
    const fileName = uploadedFiles[questionId]?.fileName;
    setUploadedFiles(prev => {
      const newFiles = { ...prev };
      delete newFiles[questionId];
      return newFiles;
    });
    toast.info("Dosya kaldırıldı", {
      description: fileName || "Dosya başarıyla kaldırıldı",
      duration: 3000
    });
  };

  const canGoNext = () => {
    const currentSubCat = currentSubCategories?.[currentSubCategoryIndex];
    
    if (currentSubCat?.hasSubLevels) {
      if ((currentSubLevelIndex ?? 0) < ((currentSubCat?.subLevels?.length ?? 1) - 1)) return true;
    }
    if ((currentSubCategoryIndex ?? 0) < ((currentSubCategories?.length ?? 1) - 1)) return true;
    if ((currentCategoryIndex ?? 0) < ((categories?.length ?? 1) - 1)) return true;
    return false;
  };

  const canGoPrev = () => {
    return (currentCategoryIndex ?? 0) > 0 || 
           (currentSubCategoryIndex ?? 0) > 0 || 
           (currentSubLevelIndex ?? 0) > 0;
  };

  const goNext = () => {
    const currentSubCat = currentSubCategories?.[currentSubCategoryIndex];
    
    if (currentSubCat?.hasSubLevels) {
      if ((currentSubLevelIndex ?? 0) < ((currentSubCat?.subLevels?.length ?? 1) - 1)) {
        setCurrentSubLevelIndex(prev => (prev ?? 0) + 1);
        return;
      }
    }
    
    if ((currentSubCategoryIndex ?? 0) < ((currentSubCategories?.length ?? 1) - 1)) {
      setCurrentSubCategoryIndex(prev => (prev ?? 0) + 1);
      setCurrentSubLevelIndex(0);
      return;
    }
    
    if ((currentCategoryIndex ?? 0) < ((categories?.length ?? 1) - 1)) {
      setCurrentCategoryIndex(prev => (prev ?? 0) + 1);
      setCurrentSubCategoryIndex(0);
      setCurrentSubLevelIndex(0);
    }
  };

  const goPrev = () => {
    const currentSubCat = currentSubCategories?.[currentSubCategoryIndex];
    
    if (currentSubCat?.hasSubLevels && (currentSubLevelIndex ?? 0) > 0) {
      setCurrentSubLevelIndex(prev => (prev ?? 1) - 1);
      return;
    }
    
    if ((currentSubCategoryIndex ?? 0) > 0) {
      const newSubCatIndex = (currentSubCategoryIndex ?? 1) - 1;
      setCurrentSubCategoryIndex(newSubCatIndex);
      const prevSubCat = currentSubCategories?.[newSubCatIndex];
      if (prevSubCat?.hasSubLevels) {
        const prevSubLevels = prevSubCat?.subLevels ?? [];
        setCurrentSubLevelIndex(Math.max(0, prevSubLevels.length - 1));
      } else {
        setCurrentSubLevelIndex(0);
      }
      return;
    }
    
    if ((currentCategoryIndex ?? 0) > 0) {
      const newCatIndex = (currentCategoryIndex ?? 1) - 1;
      setCurrentCategoryIndex(newCatIndex);
      const prevSubCats = getDisplaySubCategories(categories?.[newCatIndex]);
      const lastSubCatIndex = Math.max(0, prevSubCats.length - 1);
      setCurrentSubCategoryIndex(lastSubCatIndex);
      const lastSubCat = prevSubCats?.[lastSubCatIndex];
      if (lastSubCat?.hasSubLevels) {
        const prevSubLevels = lastSubCat?.subLevels ?? [];
        setCurrentSubLevelIndex(Math.max(0, prevSubLevels.length - 1));
      } else {
        setCurrentSubLevelIndex(0);
      }
    }
  };

  const handleComplete = () => {
    toast.success("🎉 Anket tamamlandı!", {
      description: "Sonuçlarınız hesaplanıyor...",
      duration: 2000,
    });
    setTimeout(() => {
      router.push("/dashboard");
    }, 1000);
  };

  const selectedSurvey = surveys.find(s => s.id === selectedSurveyId);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-main)]">
        <Header />
        <div className="flex items-center justify-center h-[calc(100vh-80px)]">
          <div className="w-12 h-12 border-4 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  // Hiç anket atanmamışsa
  if (surveys.length === 0) {
    return (
      <div className="min-h-screen bg-[var(--bg-main)]">
        <Header />
        <div className="max-w-[800px] mx-auto px-6 py-16">
          <div className="bg-[var(--bg-card)] rounded-2xl shadow-lg p-8 text-center">
            <div className="w-20 h-20 bg-[var(--warning-bg)] rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle size={40} className="text-[var(--warning)]" />
            </div>
            <h2 className="text-2xl font-bold text-[var(--text-main)] mb-3">Henüz Anket Atanmadı</h2>
            <p className="text-[var(--text-muted)] mb-6">
              Hesabınıza henüz bir anket atanmamış. Lütfen sistem yöneticinizle iletişime geçin.
            </p>
            <button
              onClick={() => router.push("/dashboard")}
              className="px-6 py-3 bg-[var(--accent)] text-white rounded-lg font-medium hover:bg-[var(--accent-dark)] transition-colors"
            >
              Ana Sayfaya Dön
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  // Seçili anket süresi dolmuşsa
  if (selectedSurvey?.isExpired) {
    return (
      <div className="min-h-screen bg-[var(--bg-main)]">
        <Header />
        <div className="max-w-[800px] mx-auto px-6 py-16">
          <div className="bg-[var(--bg-card)] rounded-2xl shadow-lg p-8 text-center border border-[var(--error)]/30">
            <div className="w-20 h-20 bg-[rgba(239,68,68,0.1)] rounded-full flex items-center justify-center mx-auto mb-6">
              <Lock size={40} className="text-[var(--error)]" />
            </div>
            <h2 className="text-2xl font-bold text-[var(--text-main)] mb-3">Anket Süresi Doldu</h2>
            <p className="text-[var(--text-muted)] mb-4">
              <strong>{selectedSurvey.name}</strong> anketi için belirlenen süre dolmuştur.
            </p>
            {selectedSurvey.deadline && (
              <p className="text-sm text-[var(--error)] mb-6 flex items-center justify-center gap-2">
                <Clock size={16} />
                Bitiş Tarihi: {new Date(selectedSurvey.deadline).toLocaleDateString("tr-TR")}
              </p>
            )}
            <p className="text-[var(--text-dim)] mb-6 text-sm">
              Süre uzatma talebi için lütfen sistem yöneticinizle iletişime geçin.
            </p>
            
            {/* Diğer anketler varsa seçim imkanı */}
            {surveys.filter(s => !s.isExpired).length > 0 && (
              <div className="mb-6 p-4 bg-[var(--bg-card-2)] rounded-lg">
                <p className="text-sm text-[var(--text-muted)] mb-2">Diğer anketlere devam edebilirsiniz:</p>
                <select
                  value=""
                  onChange={(e) => setSelectedSurveyId(e.target.value)}
                  className="w-full px-4 py-2 border border-[var(--border-soft)] rounded-lg bg-[var(--bg-card)] text-[var(--text-main)]"
                >
                  <option value="">Anket seçin...</option>
                  {surveys.filter(s => !s.isExpired).map((survey) => (
                    <option key={survey.id} value={survey.id}>
                      {survey.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            
            <button
              onClick={() => router.push("/dashboard")}
              className="px-6 py-3 bg-[var(--accent)] text-white rounded-lg font-medium hover:bg-[var(--accent-dark)] transition-colors"
            >
              Ana Sayfaya Dön
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-main)]">
      <Header />
      
      <main className="max-w-[1200px] mx-auto px-6 py-8">
        {/* Anket Seçici (Birden fazla anket varsa) */}
        {surveys.length > 1 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[var(--bg-card)] rounded-xl shadow-md p-4 mb-6"
          >
            <div className="flex items-center gap-4">
              <FileText size={24} className="text-[var(--accent)]" />
              <div className="flex-1">
                <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Anket Seçin</label>
                <select
                  value={selectedSurveyId}
                  onChange={(e) => setSelectedSurveyId(e.target.value)}
                  className="w-full md:w-auto px-4 py-2 border border-[var(--border-soft)] rounded-lg focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent bg-[var(--bg-card)] text-[var(--text-main)]"
                >
                  {surveys.map((survey) => (
                    <option key={survey.id} value={survey.id} disabled={survey.isExpired}>
                      {survey.name} {survey.isExpired ? '(Süresi doldu)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </motion.div>
        )}
        
        {/* Süre Uyarısı */}
        {selectedSurvey?.hasDeadline && selectedSurvey?.deadline && !selectedSurvey?.isExpired && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-xl shadow-md p-4 mb-6 flex items-center gap-3 ${
              new Date(selectedSurvey.deadline).getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000
                ? 'bg-[rgba(239,68,68,0.1)] border border-[var(--error)]/30'
                : 'bg-[rgba(245,158,11,0.1)] border border-[var(--warning)]/30'
            }`}
          >
            <Clock size={20} className={
              new Date(selectedSurvey.deadline).getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000
                ? 'text-[var(--error)]'
                : 'text-[var(--warning)]'
            } />
            <div>
              <p className={`font-medium ${
                new Date(selectedSurvey.deadline).getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000
                  ? 'text-[var(--error)]'
                  : 'text-[var(--warning)]'
              }`}>
                Anket Bitiş Tarihi: {new Date(selectedSurvey.deadline).toLocaleDateString("tr-TR")}
              </p>
              <p className="text-sm text-[var(--text-dim)]">
                {Math.ceil((new Date(selectedSurvey.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} gün kaldı
              </p>
            </div>
          </motion.div>
        )}

        {/* Progress Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[var(--bg-card)] rounded-xl shadow-md p-6 mb-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-[var(--text-main)]">
                {selectedSurvey?.name || "Olgunluk Değerlendirme Anketi"}
              </h1>
              {selectedSurvey?.description && (
                <p className="text-sm text-[var(--text-dim)] mt-1">{selectedSurvey.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm">
              {saving && (
                <span className="text-[#a78bfa] flex items-center gap-1">
                  <div className="w-3 h-3 border-2 border-[#a78bfa] border-t-transparent rounded-full animate-spin" />
                  Kaydediliyor...
                </span>
              )}
              <span className="text-[var(--text-dim)]">{totalQuestions} sorudan {answeredQuestions} tanesi cevaplandı</span>
            </div>
          </div>
          <ProgressBar value={progressPercentage} label="Genel İlerleme" color="var(--accent)" />
        </motion.div>

        {loadingStructure ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-12 h-12 border-4 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : categories.length === 0 ? (
          <div className="bg-[var(--bg-card)] rounded-xl shadow-md p-8 text-center">
            <FileQuestion size={64} className="mx-auto text-[var(--ui-passive)] mb-4" />
            <h2 className="text-xl font-semibold text-[var(--text-muted)] mb-2">Anket Henüz Hazırlanmamış</h2>
            <p className="text-[var(--text-dim)]">Bu ankete henüz soru eklenmemiş. Lütfen daha sonra tekrar kontrol edin.</p>
          </div>
        ) : (
          <>
            {/* Breadcrumb Navigation */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2 text-sm mb-6 flex-wrap"
            >
              <span className="flex items-center gap-1 px-3 py-1 bg-[var(--accent)] text-white rounded-lg">
                <FolderOpen size={14} />
                {currentCategory?.name ?? 'Category'}
              </span>
              <ChevronRight size={16} className="text-[var(--text-dim)]" />
              <span className="flex items-center gap-1 px-3 py-1 bg-[#a78bfa] text-white rounded-lg">
                <Layers size={14} />
                {currentSubCategory?.name ?? 'Sub-category'}
              </span>
              {hasSubLevels && currentSubLevel && (
                <>
                  <ChevronRight size={16} className="text-[var(--text-dim)]" />
                  <span className="flex items-center gap-1 px-3 py-1 bg-[var(--border-soft)] text-[var(--text-muted)] rounded-lg">
                    {currentSubLevel?.name ?? 'Level'}
                  </span>
                </>
              )}
            </motion.div>

            {/* Questions */}
            <AnimatePresence mode="wait">
              <motion.div
                key={`${selectedSurveyId}-${currentCategoryIndex}-${currentSubCategoryIndex}-${currentSubLevelIndex}`}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6 mb-8"
              >
                {currentQuestions?.length === 0 ? (
                  <div className="bg-[var(--bg-card)] rounded-xl shadow-md p-8 text-center">
                    <FileQuestion size={48} className="mx-auto text-[var(--ui-passive)] mb-4" />
                    <p className="text-[var(--text-dim)]">Bu bölümde henüz soru bulunmuyor.</p>
                  </div>
                ) : (
                  currentQuestions?.map((question) => (
                    <SurveyQuestion
                      key={question?.id}
                      question={question}
                      value={responses?.[question?.id ?? '']}
                      onAnswer={handleAnswer}
                      onUpload={handleUpload}
                      onRemoveFile={handleRemoveFile}
                      uploadedFile={uploadedFiles[question?.id ?? '']?.fileName || null}
                      isUploading={uploading === question?.id}
                    />
                  ))
                )}
              </motion.div>
            </AnimatePresence>

            {/* Navigation */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center justify-between"
            >
              <button
                onClick={goPrev}
                disabled={!canGoPrev()}
                className="flex items-center gap-2 px-6 py-3 bg-[var(--bg-card)] text-[var(--text-muted)] rounded-lg font-medium hover:bg-[var(--bg-main)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
              >
                <ChevronLeft size={20} />
                Önceki
              </button>

              <div className="flex items-center gap-2">
                {categories?.map((_, index) => (
                  <div
                    key={index}
                    className={`w-3 h-3 rounded-full transition-colors ${
                      index === currentCategoryIndex
                        ? "bg-[var(--accent)]"
                        : index < (currentCategoryIndex ?? 0)
                        ? "bg-[#a78bfa]"
                        : "bg-[var(--border-soft)]"
                    }`}
                  />
                ))}
              </div>

              {canGoNext() ? (
                <button
                  onClick={goNext}
                  className="flex items-center gap-2 px-6 py-3 bg-[var(--accent)] text-white rounded-lg font-medium hover:bg-[var(--accent-dark)] transition-colors shadow-md"
                >
                  Sonraki
                  <ChevronRight size={20} />
                </button>
              ) : (
                <button
                  onClick={handleComplete}
                  className="flex items-center gap-2 px-6 py-3 bg-[var(--accent-dark)] text-white rounded-lg font-medium hover:bg-[var(--accent-dark)] transition-colors shadow-md"
                >
                  Anketi Tamamla
                  <Check size={20} />
                </button>
              )}
            </motion.div>
          </>
        )}
      </main>
    </div>
  );
}
