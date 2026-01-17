"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import Header from "@/components/ui/header";
import SurveyQuestion from "@/components/survey/survey-question";
import ProgressBar from "@/components/ui/progress-bar";
import { 
  ChevronLeft, 
  ChevronRight, 
  Check, 
  FolderOpen,
  Layers,
  FileQuestion
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
  subLevels: SubLevel[];
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

export default function SurveyClient() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [currentCategoryIndex, setCurrentCategoryIndex] = useState(0);
  const [currentSubCategoryIndex, setCurrentSubCategoryIndex] = useState(0);
  const [currentSubLevelIndex, setCurrentSubLevelIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [structureRes, responsesRes] = await Promise.all([
          fetch("/api/survey/structure"),
          fetch("/api/survey/responses")
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
      } catch (error) {
        console.error("Error fetching survey data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const currentCategory = categories?.[currentCategoryIndex];
  const currentSubCategory = currentCategory?.subCategories?.[currentSubCategoryIndex];
  const currentSubLevel = currentSubCategory?.subLevels?.[currentSubLevelIndex];
  const currentQuestions = currentSubLevel?.questions ?? [];

  const totalQuestions = categories?.reduce((total, cat) => {
    return total + (cat?.subCategories ?? []).reduce((subTotal, sub) => {
      return subTotal + (sub?.subLevels ?? []).reduce((levelTotal, level) => {
        return levelTotal + (level?.questions?.length ?? 0);
      }, 0);
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
      await fetch("/api/survey/responses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, value })
      });
    } catch (error) {
      console.error("Error saving response:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async (questionId: string, file: File) => {
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

      if (!presignedRes.ok) return;

      const { uploadUrl, cloudStoragePath } = await presignedRes.json();

      const uploadHeaders: Record<string, string> = {
        "Content-Type": file.type
      };
      
      if (uploadUrl.includes("content-disposition")) {
        uploadHeaders["Content-Disposition"] = "attachment";
      }

      await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: uploadHeaders
      });

      const responseId = responses?.[questionId] ? undefined : undefined;

      await fetch("/api/upload/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cloudStoragePath,
          isPublic: false,
          fileName: file.name,
          fileType: file.type,
          responseId
        })
      });
    } catch (error) {
      console.error("Error uploading file:", error);
    }
  };

  const canGoNext = () => {
    if ((currentSubLevelIndex ?? 0) < ((currentSubCategory?.subLevels?.length ?? 1) - 1)) return true;
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
    if ((currentSubLevelIndex ?? 0) < ((currentSubCategory?.subLevels?.length ?? 1) - 1)) {
      setCurrentSubLevelIndex(prev => (prev ?? 0) + 1);
    } else if ((currentSubCategoryIndex ?? 0) < ((currentCategory?.subCategories?.length ?? 1) - 1)) {
      setCurrentSubCategoryIndex(prev => (prev ?? 0) + 1);
      setCurrentSubLevelIndex(0);
    } else if ((currentCategoryIndex ?? 0) < ((categories?.length ?? 1) - 1)) {
      setCurrentCategoryIndex(prev => (prev ?? 0) + 1);
      setCurrentSubCategoryIndex(0);
      setCurrentSubLevelIndex(0);
    }
  };

  const goPrev = () => {
    if ((currentSubLevelIndex ?? 0) > 0) {
      setCurrentSubLevelIndex(prev => (prev ?? 1) - 1);
    } else if ((currentSubCategoryIndex ?? 0) > 0) {
      const newSubCatIndex = (currentSubCategoryIndex ?? 1) - 1;
      setCurrentSubCategoryIndex(newSubCatIndex);
      const prevSubLevels = currentCategory?.subCategories?.[newSubCatIndex]?.subLevels ?? [];
      setCurrentSubLevelIndex(Math.max(0, prevSubLevels.length - 1));
    } else if ((currentCategoryIndex ?? 0) > 0) {
      const newCatIndex = (currentCategoryIndex ?? 1) - 1;
      setCurrentCategoryIndex(newCatIndex);
      const prevSubCats = categories?.[newCatIndex]?.subCategories ?? [];
      const lastSubCatIndex = Math.max(0, prevSubCats.length - 1);
      setCurrentSubCategoryIndex(lastSubCatIndex);
      const prevSubLevels = prevSubCats?.[lastSubCatIndex]?.subLevels ?? [];
      setCurrentSubLevelIndex(Math.max(0, prevSubLevels.length - 1));
    }
  };

  const handleComplete = () => {
    router.push("/dashboard");
  };

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

  if ((categories?.length ?? 0) === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-[1200px] mx-auto px-6 py-8">
          <div className="text-center py-16">
            <FileQuestion size={64} className="mx-auto text-gray-300 mb-4" />
            <h2 className="text-2xl font-semibold text-gray-700 mb-2">Anket Mevcut Değil</h2>
            <p className="text-gray-500">Anket hazırlanıyor. Lütfen daha sonra tekrar kontrol edin.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="max-w-[1200px] mx-auto px-6 py-8">
        {/* Progress Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-md p-6 mb-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-900">Olgunluk Değerlendirme Anketi</h1>
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
          <ChevronRight size={16} className="text-gray-400" />
          <span className="flex items-center gap-1 px-3 py-1 bg-gray-200 text-gray-700 rounded-lg">
            {currentSubLevel?.name ?? 'Level'}
          </span>
        </motion.div>

        {/* Questions */}
        <AnimatePresence mode="wait">
          <motion.div
            key={`${currentCategoryIndex}-${currentSubCategoryIndex}-${currentSubLevelIndex}`}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6 mb-8"
          >
            {currentQuestions?.map((question, index) => (
              <SurveyQuestion
                key={question?.id}
                question={question}
                value={responses?.[question?.id ?? '']}
                onAnswer={handleAnswer}
                onUpload={handleUpload}
              />
            ))}
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
      </main>
    </div>
  );
}