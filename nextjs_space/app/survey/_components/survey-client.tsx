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
  Upload
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
}

interface Category {
  id: string;
  name: string;
  description?: string;
  subCategories: SubCategory[];
}

interface Response {
  questionId: string;
  value: string;
}

interface Survey {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
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
          if (data.length > 0 && !selectedSurveyId) {
            setSelectedSurveyId(data[0].id);
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
          (data ?? []).forEach((r: Response) => {
            responseMap[r?.questionId ?? ''] = r?.value ?? '';
          });
          setResponses(responseMap);
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
  const currentSubCategory = currentCategory?.subCategories?.[currentSubCategoryIndex];
  const hasSubLevels = currentSubCategory?.hasSubLevels ?? true;
  const currentSubLevel = hasSubLevels ? currentSubCategory?.subLevels?.[currentSubLevelIndex] : null;
  
  // Mevcut soruları belirle
  const currentQuestions = hasSubLevels 
    ? (currentSubLevel?.questions ?? [])
    : (currentSubCategory?.questions ?? []);

  // Toplam soru sayısı
  const totalQuestions = categories?.reduce((total, cat) => {
    return total + (cat?.subCategories ?? []).reduce((subTotal, sub) => {
      if (sub?.hasSubLevels) {
        return subTotal + (sub?.subLevels ?? []).reduce((levelTotal, level) => {
          return levelTotal + (level?.questions?.length ?? 0);
        }, 0);
      } else {
        return subTotal + (sub?.questions?.length ?? 0);
      }
    }, 0);
  }, 0) ?? 0;

  const answeredQuestions = Object.keys(responses ?? {}).length;
  const progressPercentage = totalQuestions > 0 
    ? Math.round((answeredQuestions / totalQuestions) * 100) 
    : 0;

  const handleAnswer = async (questionId: string, value: string) => {
    setResponses(prev => ({ ...(prev ?? {}), [questionId]: value }));
    setSaving(true);

    try {
      const res = await fetch("/api/survey/responses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, value })
      });
      
      if (res.ok) {
        toast.success("Cevap kaydedildi", {
          duration: 1500,
        });
      }
    } catch (error) {
      console.error("Error saving response:", error);
      toast.error("Cevap kaydedilemedi");
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async (questionId: string, file: File) => {
    setUploading(questionId);
    
    // Dosya boyutu kontrolü (10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error("Dosya boyutu çok büyük", {
        description: "Maksimum dosya boyutu 10MB olmalıdır.",
        duration: 5000,
        icon: <XCircle className="text-red-500" size={20} />
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
          isPublic: false
        })
      });

      if (!presignedRes.ok) {
        toast.error("Dosya yükleme başarısız", {
          description: "Sunucu bağlantısı kurulamadı. Lütfen tekrar deneyin.",
          duration: 5000,
          icon: <XCircle className="text-red-500" size={20} />
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
          icon: <XCircle className="text-red-500" size={20} />
        });
        return;
      }

      await fetch("/api/upload/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cloudStoragePath,
          isPublic: false,
          fileName: file.name,
          fileType: file.type
        })
      });

      // State'i güncelle - dosya başarıyla yüklendi
      setUploadedFiles(prev => ({
        ...prev,
        [questionId]: { fileName: file.name, cloudStoragePath }
      }));
      
      toast.success("Dosya başarıyla yüklendi!", {
        description: file.name,
        duration: 4000,
        icon: <CheckCircle2 className="text-green-500" size={20} />
      });
    } catch (error) {
      console.error("Error uploading file:", error);
      toast.error("Yükleme hatası", {
        description: "Beklenmeyen bir hata oluştu. İnternet bağlantınızı kontrol edin.",
        duration: 5000,
        icon: <XCircle className="text-red-500" size={20} />
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
    const currentSubCat = currentCategory?.subCategories?.[currentSubCategoryIndex];
    
    if (currentSubCat?.hasSubLevels) {
      if ((currentSubLevelIndex ?? 0) < ((currentSubCat?.subLevels?.length ?? 1) - 1)) return true;
    }
    if ((currentSubCategoryIndex ?? 0) < ((currentCategory?.subCategories?.length ?? 1) - 1)) return true;
    if ((currentCategoryIndex ?? 0) < ((categories?.length ?? 1) - 1)) return true;
    return false;
  };

  const canGoPrev = () => {
    return (currentCategoryIndex ?? 0) > 0 || 
           (currentSubCategoryIndex ?? 0) > 0 || 
           (currentSubLevelIndex ?? 0) > 0;
  };

  const goNext = () => {
    const currentSubCat = currentCategory?.subCategories?.[currentSubCategoryIndex];
    
    if (currentSubCat?.hasSubLevels) {
      if ((currentSubLevelIndex ?? 0) < ((currentSubCat?.subLevels?.length ?? 1) - 1)) {
        setCurrentSubLevelIndex(prev => (prev ?? 0) + 1);
        return;
      }
    }
    
    if ((currentSubCategoryIndex ?? 0) < ((currentCategory?.subCategories?.length ?? 1) - 1)) {
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
    const currentSubCat = currentCategory?.subCategories?.[currentSubCategoryIndex];
    
    if (currentSubCat?.hasSubLevels && (currentSubLevelIndex ?? 0) > 0) {
      setCurrentSubLevelIndex(prev => (prev ?? 1) - 1);
      return;
    }
    
    if ((currentSubCategoryIndex ?? 0) > 0) {
      const newSubCatIndex = (currentSubCategoryIndex ?? 1) - 1;
      setCurrentSubCategoryIndex(newSubCatIndex);
      const prevSubCat = currentCategory?.subCategories?.[newSubCatIndex];
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
      const prevSubCats = categories?.[newCatIndex]?.subCategories ?? [];
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
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center h-[calc(100vh-80px)]">
          <div className="w-12 h-12 border-4 border-[#1e3a8a] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  // Hiç anket atanmamışsa
  if (surveys.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-[800px] mx-auto px-6 py-16">
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle size={40} className="text-yellow-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Henüz Anket Atanmadı</h2>
            <p className="text-gray-600 mb-6">
              Hesabınıza henüz bir anket atanmamış. Lütfen sistem yöneticinizle iletişime geçin.
            </p>
            <button
              onClick={() => router.push("/dashboard")}
              className="px-6 py-3 bg-[#1e3a8a] text-white rounded-lg font-medium hover:bg-[#3b5998] transition-colors"
            >
              Ana Sayfaya Dön
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="max-w-[1200px] mx-auto px-6 py-8">
        {/* Anket Seçici (Birden fazla anket varsa) */}
        {surveys.length > 1 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl shadow-md p-4 mb-6"
          >
            <div className="flex items-center gap-4">
              <FileText size={24} className="text-[#1e3a8a]" />
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Anket Seçin</label>
                <select
                  value={selectedSurveyId}
                  onChange={(e) => setSelectedSurveyId(e.target.value)}
                  className="w-full md:w-auto px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#1e3a8a] focus:border-transparent"
                >
                  {surveys.map((survey) => (
                    <option key={survey.id} value={survey.id}>
                      {survey.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </motion.div>
        )}

        {/* Progress Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-md p-6 mb-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {selectedSurvey?.name || "Olgunluk Değerlendirme Anketi"}
              </h1>
              {selectedSurvey?.description && (
                <p className="text-sm text-gray-500 mt-1">{selectedSurvey.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm">
              {saving && (
                <span className="text-[#a78bfa] flex items-center gap-1">
                  <div className="w-3 h-3 border-2 border-[#a78bfa] border-t-transparent rounded-full animate-spin" />
                  Kaydediliyor...
                </span>
              )}
              <span className="text-gray-500">{totalQuestions} sorudan {answeredQuestions} tanesi cevaplandı</span>
            </div>
          </div>
          <ProgressBar value={progressPercentage} label="Genel İlerleme" color="#1e3a8a" />
        </motion.div>

        {loadingStructure ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-12 h-12 border-4 border-[#1e3a8a] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : categories.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-8 text-center">
            <FileQuestion size={64} className="mx-auto text-gray-300 mb-4" />
            <h2 className="text-xl font-semibold text-gray-700 mb-2">Anket Henüz Hazırlanmamış</h2>
            <p className="text-gray-500">Bu ankete henüz soru eklenmemiş. Lütfen daha sonra tekrar kontrol edin.</p>
          </div>
        ) : (
          <>
            {/* Breadcrumb Navigation */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2 text-sm mb-6 flex-wrap"
            >
              <span className="flex items-center gap-1 px-3 py-1 bg-[#1e3a8a] text-white rounded-lg">
                <FolderOpen size={14} />
                {currentCategory?.name ?? 'Category'}
              </span>
              <ChevronRight size={16} className="text-gray-400" />
              <span className="flex items-center gap-1 px-3 py-1 bg-[#a78bfa] text-white rounded-lg">
                <Layers size={14} />
                {currentSubCategory?.name ?? 'Sub-category'}
              </span>
              {hasSubLevels && currentSubLevel && (
                <>
                  <ChevronRight size={16} className="text-gray-400" />
                  <span className="flex items-center gap-1 px-3 py-1 bg-gray-200 text-gray-700 rounded-lg">
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
                  <div className="bg-white rounded-xl shadow-md p-8 text-center">
                    <FileQuestion size={48} className="mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-500">Bu bölümde henüz soru bulunmuyor.</p>
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
                className="flex items-center gap-2 px-6 py-3 bg-white text-gray-700 rounded-lg font-medium hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
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
                        ? "bg-[#1e3a8a]"
                        : index < (currentCategoryIndex ?? 0)
                        ? "bg-[#a78bfa]"
                        : "bg-gray-200"
                    }`}
                  />
                ))}
              </div>

              {canGoNext() ? (
                <button
                  onClick={goNext}
                  className="flex items-center gap-2 px-6 py-3 bg-[#1e3a8a] text-white rounded-lg font-medium hover:bg-[#3b5998] transition-colors shadow-md"
                >
                  Sonraki
                  <ChevronRight size={20} />
                </button>
              ) : (
                <button
                  onClick={handleComplete}
                  className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors shadow-md"
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
