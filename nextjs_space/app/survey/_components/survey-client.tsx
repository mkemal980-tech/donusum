"use client";

import { useEffect, useMemo, useState } from "react";
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
import {
  buildSteps,
  categoryProgress,
  categorySummaries,
  estimateMinutes,
  findResumeStepIndex,
  overallProgress,
  stepProgress,
  unansweredInStep,
} from "@/lib/survey-navigation";

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

export default function SurveyClient() {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [selectedSurveyId, setSelectedSurveyId] = useState<string>("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [responses, setResponses] = useState<Record<string, string>>({});
  // Üç seviyeli ağaç düz bir adım dizisine indirildi (bkz. lib/survey-navigation).
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  /** Eksik soru uyarısı gösterilirken hedeflenen adım. */
  const [pendingStepIndex, setPendingStepIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  /**
   * Atanan anketler alınamadıysa doğru sayılır. Önceden hata da boş liste de
   * "Henüz Anket Atanmadı" gösteriyordu; kullanıcı ankete atanmış olsa bile
   * geçici bir hatada atanmamış sanıyordu.
   */
  const [assignmentError, setAssignmentError] = useState(false);
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
        if (!res.ok) {
          setAssignmentError(true);
          return;
        }
        const data = await res.json();
        setAssignmentError(false);
        setSurveys(data ?? []);
        if (data.length > 0) {
          setSelectedSurveyId((current) => current || data[0].id);
        }
      } catch (error) {
        console.error("Error fetching assigned surveys:", error);
        setAssignmentError(true);
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

        let structure: Category[] = [];
        let responseMap: Record<string, string> = {};

        if (structureRes.ok) {
          const data = await structureRes.json();
          structure = data ?? [];
          setCategories(structure);
        }

        if (responsesRes.ok) {
          const data = await responsesRes.json();
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

        // Kaldığı yerden devam: eksik sorusu olan ilk bölüme dön.
        // Uzun anketler tek oturumda bitmiyor; her dönüşte başa sarmak
        // en can sıkıcı davranış.
        setCurrentStepIndex(findResumeStepIndex(buildSteps(structure), responseMap));
        setPendingStepIndex(null);
      } catch (error) {
        console.error("Error fetching survey data:", error);
      } finally {
        setLoadingStructure(false);
      }
    };

    fetchData();
  }, [selectedSurveyId]);

  // Anket ağacı bir kez düzleştirilir; ekranın tüm göstergeleri buna dayanır.
  const steps = useMemo(() => buildSteps(categories), [categories]);
  const summaries = useMemo(() => categorySummaries(steps), [steps]);

  // Soru nesnelerine kimlikten erişim — adımlar yalnızca kimlik taşır.
  const questionById = useMemo(() => {
    const map = new Map<string, Question>();
    for (const category of categories ?? []) {
      for (const question of category.questions ?? []) map.set(question.id, question);
      for (const subCategory of category.subCategories ?? []) {
        for (const question of subCategory.questions ?? []) map.set(question.id, question);
        for (const subLevel of subCategory.subLevels ?? []) {
          for (const question of subLevel.questions ?? []) map.set(question.id, question);
        }
      }
    }
    return map;
  }, [categories]);

  const currentStep = steps[currentStepIndex];
  const currentQuestions = (currentStep?.questionIds ?? [])
    .map((id) => questionById.get(id))
    .filter((question): question is Question => !!question);

  // İki seviyeli ilerleme: baskın gösterge bölüm içi, genel ikincil.
  // Uzun ankette tek bir genel çubuk soru başına yüzde bir kıpırdar ve
  // "hiç ilerlemiyorum" hissi terk oranını ciddi biçimde artırır.
  const sectionProgress = stepProgress(currentStep, responses);
  const currentCategoryProgress = categoryProgress(steps, currentStep?.categoryId ?? "", responses);
  const overall = overallProgress(steps, responses);

  const totalQuestions = overall.total;
  const answeredQuestions = overall.answered;
  const progressPercentage = overall.percentage;
  const estimatedMinutes = estimateMinutes(totalQuestions);
  const remainingUnanswered = unansweredInStep(currentStep, responses);

  const activeCategoryIndex = summaries.findIndex(
    (summary) => summary.categoryId === currentStep?.categoryId
  );

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

  const canGoNext = currentStepIndex < steps.length - 1;
  const canGoPrev = currentStepIndex > 0;

  /** Uyarıyı atlayarak doğrudan git — onay verildikten sonra çağrılır. */
  const jumpTo = (index: number) => {
    setPendingStepIndex(null);
    setCurrentStepIndex(Math.max(0, Math.min(steps.length - 1, index)));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /**
   * Bölümden ayrılırken eksik soru varsa önce uyarır.
   * Kaydırmalı düzenin bilinen tek zaafı soru atlanması; uyarı bunu kapatır.
   * Geri giderken uyarı yok — kullanıcı zaten düzeltmeye dönüyor olabilir.
   */
  const requestStep = (index: number) => {
    if (index > currentStepIndex && remainingUnanswered > 0) {
      setPendingStepIndex(index);
      return;
    }
    jumpTo(index);
  };

  const goNext = () => requestStep(currentStepIndex + 1);
  const goPrev = () => jumpTo(currentStepIndex - 1);

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
            <h2 className="text-2xl font-bold text-[var(--text-main)] mb-3">
              {assignmentError ? "Anketler Yüklenemedi" : "Henüz Anket Atanmadı"}
            </h2>
            <p className="text-[var(--text-muted)] mb-6">
              {assignmentError
                ? "Anket listesi alınamadı. Bağlantınızı kontrol edip tekrar deneyin; sorun sürerse sistem yöneticinizle iletişime geçin."
                : "Hesabınıza henüz bir anket atanmamış. Lütfen sistem yöneticinizle iletişime geçin."}
            </p>
            <div className="flex items-center justify-center gap-2">
              {assignmentError && (
                <button
                  onClick={() => window.location.reload()}
                  className="px-6 py-3 bg-[var(--accent)] text-white rounded-lg font-medium hover:bg-[var(--accent-dark)] transition-colors"
                >
                  Tekrar Dene
                </button>
              )}
              <button
                onClick={() => router.push("/dashboard")}
                className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                  assignmentError
                    ? "bg-[var(--bg-card-2)] text-[var(--text-muted)]"
                    : "bg-[var(--accent)] text-white hover:bg-[var(--accent-dark)]"
                }`}
              >
                Ana Sayfaya Dön
              </button>
            </div>
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
          {/* Dar ekranda yan yana sığmıyor: mobilde dikey, masaüstünde yatay. */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-4">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-[var(--text-main)]">
                {selectedSurvey?.name || "Olgunluk Değerlendirme Anketi"}
              </h1>
              {selectedSurvey?.description && (
                <p className="text-sm text-[var(--text-dim)] mt-1">{selectedSurvey.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm md:justify-end md:text-right shrink-0">
              {saving && (
                <span className="text-[#a78bfa] flex items-center gap-1">
                  <div className="w-3 h-3 border-2 border-[#a78bfa] border-t-transparent rounded-full animate-spin" />
                  Kaydediliyor...
                </span>
              )}
              <span className="text-[var(--text-dim)]">
                {totalQuestions} sorudan {answeredQuestions} tanesi cevaplandı
                {estimatedMinutes > 0 && answeredQuestions === 0 && (
                  <> · yaklaşık {estimatedMinutes} dk · istediğiniz zaman ara verebilirsiniz</>
                )}
              </span>
            </div>
          </div>

          {/* Genel ilerleme bilinçli olarak ince ve ikincil: uzun ankette
              baskın gösterge bölüm çubuğudur (bkz. aşağıdaki bölüm başlığı). */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-1.5 rounded-full bg-[var(--border-soft)] overflow-hidden">
              <div
                className="h-full bg-[var(--accent)] transition-all duration-500"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
            <span className="text-xs text-[var(--text-dim)] tabular-nums">Genel %{progressPercentage}</span>
          </div>
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
            {/* Kategori haritası — "daha ne kadar var" sorusunu soru sayısıyla
                değil kategori sayısıyla cevaplar; tıklanınca o kategorinin ilk
                bölümüne atlar. */}
            {summaries.length > 1 && (
              <div className="flex items-stretch gap-1.5 mb-4 overflow-x-auto pb-1">
                {summaries.map((summary, index) => {
                  const progress = categoryProgress(steps, summary.categoryId, responses);
                  const isActive = index === activeCategoryIndex;
                  const isDone = progress.percentage === 100;

                  return (
                    <button
                      key={summary.categoryId}
                      onClick={() => requestStep(summary.firstStepIndex)}
                      title={`${summary.categoryName} — ${progress.answered}/${progress.total} soru`}
                      className={`flex-1 min-w-[92px] text-left px-2.5 py-1.5 rounded-lg border transition-colors ${
                        isActive
                          ? "border-[var(--accent)] bg-[rgba(12,193,195,0.12)]"
                          : "border-[var(--border-soft)] bg-[var(--bg-card)] hover:border-[var(--accent)]/50"
                      }`}
                    >
                      <span
                        className={`block text-[11px] truncate ${
                          isActive ? "text-[var(--accent)] font-medium" : "text-[var(--text-dim)]"
                        }`}
                      >
                        {isDone && !isActive ? "✓ " : ""}
                        {summary.categoryName}
                      </span>
                      <span className="mt-1 block h-1 rounded-full bg-[var(--border-soft)] overflow-hidden">
                        <span
                          className="block h-full bg-[var(--accent)] transition-all duration-500"
                          style={{ width: `${progress.percentage}%` }}
                        />
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Bölüm başlığı ve baskın ilerleme çubuğu */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-[var(--bg-card)] rounded-xl shadow-md p-4 mb-6"
            >
              <div className="flex items-center gap-2 text-sm flex-wrap mb-3">
                <span className="flex items-center gap-1 px-2.5 py-1 bg-[var(--accent)] text-white rounded-lg">
                  <FolderOpen size={14} />
                  {currentStep?.categoryName ?? "Kategori"}
                </span>
                <ChevronRight size={16} className="text-[var(--text-dim)]" />
                <span className="flex items-center gap-1 px-2.5 py-1 bg-[#a78bfa] text-white rounded-lg">
                  <Layers size={14} />
                  {currentStep?.subCategoryName ?? "Bölüm"}
                </span>
                {currentStep?.subLevelName && (
                  <>
                    <ChevronRight size={16} className="text-[var(--text-dim)]" />
                    <span className="px-2.5 py-1 bg-[var(--border-soft)] text-[var(--text-muted)] rounded-lg">
                      {currentStep.subLevelName}
                    </span>
                  </>
                )}
                <span className="ml-auto text-xs text-[var(--text-dim)] tabular-nums">
                  Bölüm {currentStepIndex + 1} / {steps.length}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-2.5 rounded-full bg-[var(--border-soft)] overflow-hidden">
                  <div
                    className="h-full bg-[var(--accent)] transition-all duration-500"
                    style={{ width: `${sectionProgress.percentage}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-[var(--text-main)] tabular-nums whitespace-nowrap">
                  {sectionProgress.answered} / {sectionProgress.total} soru
                </span>
              </div>

              <p className="mt-2 text-xs text-[var(--text-dim)]">
                {currentStep?.categoryName}: {currentCategoryProgress.answered} /{" "}
                {currentCategoryProgress.total} soru tamamlandı
              </p>
            </motion.div>

            {/* Questions */}
            <AnimatePresence mode="wait">
              <motion.div
                key={`${selectedSurveyId}-${currentStepIndex}`}
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
            {/* Eksik soru uyarısı — kaydırmalı düzenin bilinen tek zaafı soru
                atlanması; bölümden çıkarken hatırlatılır ama engellenmez. */}
            {pendingStepIndex !== null && (
              <div className="mb-4 p-4 rounded-xl bg-[rgba(245,158,11,0.1)] border border-[var(--warning)]/40">
                <div className="flex items-start gap-3">
                  <AlertTriangle size={20} className="text-[var(--warning)] shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[var(--text-main)]">
                      Bu bölümde {remainingUnanswered} soru cevaplanmadı
                    </p>
                    <p className="text-xs text-[var(--text-dim)] mt-0.5">
                      Cevaplamadan geçebilirsiniz; istediğiniz zaman geri dönüp
                      tamamlayabilirsiniz. Ancak eksik sorular puanınıza dahil edilmez.
                    </p>
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => setPendingStepIndex(null)}
                        className="px-3 py-1.5 rounded-lg text-sm bg-[var(--accent)] text-[var(--bg-deep)] font-medium"
                      >
                        Bu bölümde kal
                      </button>
                      <button
                        onClick={() => jumpTo(pendingStepIndex)}
                        className="px-3 py-1.5 rounded-lg text-sm bg-[var(--bg-card-2)] text-[var(--text-muted)]"
                      >
                        Yine de devam et
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center justify-between"
            >
              <button
                onClick={goPrev}
                disabled={!canGoPrev}
                className="flex items-center gap-2 px-6 py-3 bg-[var(--bg-card)] text-[var(--text-muted)] rounded-lg font-medium hover:bg-[var(--bg-main)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
              >
                <ChevronLeft size={20} />
                Önceki
              </button>

              {/* Kategori noktaları üstteki haritayla mükerrer olduğu için
                  burada yalnızca kalan bölüm sayısı gösterilir. */}
              <span className="text-sm text-[var(--text-dim)] tabular-nums">
                {canGoNext
                  ? `${steps.length - currentStepIndex - 1} bölüm kaldı`
                  : "Son bölüm"}
              </span>

              {canGoNext ? (
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
