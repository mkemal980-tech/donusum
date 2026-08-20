"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import AppShell from "@/components/ui/app-shell";
import PageHeader from "@/components/ui/page-header";
import EmptyState from "@/components/ui/empty-state";
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
import { getWithRetry } from "@/lib/retrying-fetch";
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
import { Button } from "@/components/ui/button";

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
  /**
   * Görev dağılımı durumu. Anket yapısı zaten süzülmüş geliyor; bu bilgi
   * yalnızca ekranın doğru şeyi söylemesi için: bölüm atanmamış bir katkıcıya
   * "anket hazırlanmamış" demek yanlış olurdu.
   */
  const [sectionInfo, setSectionInfo] = useState<{
    distributed: boolean;
    isCoordinator: boolean;
    mySectionCount: number;
    /** Gönderilmiş değerlendirmede anket salt okunur. */
    locked: boolean;
    submittedAt: string | null;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  /**
   * Cevaplar her tıklamada kaydediliyor ama bunu yalnızca bir saniyelik
   * bildirim söylüyordu. Kullanıcı "kaydet" düğmesi aramaya devam ediyordu;
   * durumu ekranda kalıcı olarak göstermek o soruyu ortadan kaldırıyor.
   */
  const [savedOnce, setSavedOnce] = useState(false);
  /** Kaldığı yerden devam ettirildiyse hangi bölümden — bir kez söylenir. */
  const [resumedSection, setResumedSection] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, { fileName: string; cloudStoragePath: string }>>({});
  const [uploading, setUploading] = useState<string | null>(null);
  const router = useRouter();

  // Atanan anketleri getir
  useEffect(() => {
    const fetchAssignedSurveys = async () => {
      try {
        const res = await getWithRetry("/api/survey/assigned");
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
        const [structureRes, responsesRes, sectionsRes] = await Promise.all([
          getWithRetry(`/api/survey/structure${surveyParam}`),
          getWithRetry(`/api/survey/responses${surveyParam}`),
          getWithRetry(`/api/assessment/sections${surveyParam}`)
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

        if (sectionsRes.ok) {
          const data = await sectionsRes.json();
          setSectionInfo({
            distributed: Boolean(data?.distributed),
            isCoordinator: Boolean(data?.isCoordinator),
            mySectionCount: (data?.mySectionIds ?? []).length,
            locked: Boolean(data?.locked),
            submittedAt: data?.submittedAt ?? null,
          });
        } else {
          // Dağıtım bilgisi alınamadıysa ekran susar; anket yine çalışır.
          setSectionInfo(null);
        }

        // Kaldığı yerden devam: eksik sorusu olan ilk bölüme dön.
        // Uzun anketler tek oturumda bitmiyor; her dönüşte başa sarmak
        // en can sıkıcı davranış.
        const resumeSteps = buildSteps(structure);
        const resumeIndex = findResumeStepIndex(resumeSteps, responseMap);
        setCurrentStepIndex(resumeIndex);
        setPendingStepIndex(null);

        // Sessizce ortadan başlatmak "neredeyim" hissi veriyor; atlandıysa söyle.
        const resumeStep = resumeSteps[resumeIndex];
        setResumedSection(
          resumeIndex > 0 && resumeStep
            ? resumeStep.subLevelName
              ? `${resumeStep.subCategoryName} — ${resumeStep.subLevelName}`
              : resumeStep.subCategoryName
            : null
        );
        setSavedOnce(Object.keys(responseMap).length > 0);
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
    // Kilitli değerlendirmede sunucu zaten 403 döner; kullanıcıyı boşuna
    // beklettikten sonra hata göstermek yerine burada söyle.
    if (sectionInfo?.locked) {
      toast.error("Bu değerlendirme gönderildi ve kilitlendi.");
      return;
    }

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

      setSavedOnce(true);
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
    toast.success("Anket tamamlandı.", {
      description: "Puanınız hesaplanıyor, panoya dönülüyor.",
      duration: 2000,
    });
    setTimeout(() => {
      router.push("/dashboard");
    }, 1000);
  };

  const selectedSurvey = surveys.find(s => s.id === selectedSurveyId);

  if (loading) {
    return (
      <>
        <AppShell />
        <main>
          <div className="skeleton mb-6 h-8 w-56" />
          <div className="skeleton mb-6 h-24" />
          <div className="flex flex-col gap-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton h-32" />
            ))}
          </div>
        </main>
      </>
    );
  }

  // Hiç anket atanmamışsa
  if (surveys.length === 0) {
    return (
      <>
        <AppShell />
        <main>
          <PageHeader title="Anket" />
          <EmptyState
            title={assignmentError ? "Anket listesi alınamadı" : "Size henüz anket atanmadı"}
            description={
              assignmentError
                ? "Bağlantınızı kontrol edip tekrar deneyin. Sorun sürerse platform yöneticinizle görüşün."
                : "Değerlendirme ataması yapıldığında anket burada açılır. Atama için platform yöneticinizle görüşün."
            }
            action={
              <div className="flex flex-wrap gap-2">
                {assignmentError && (
                  <Button onClick={() => window.location.reload()}>Tekrar dene</Button>
                )}
                <Button
                  variant={assignmentError ? "outline" : "default"}
                  onClick={() => router.push("/dashboard")}
                >
                  Panoya dön
                </Button>
              </div>
            }
          />
        </main>
      </>
    );
  }
  
  // Seçili anket süresi dolmuşsa
  if (selectedSurvey?.isExpired) {
    const openSurveys = surveys.filter((s) => !s.isExpired);

    return (
      <>
        <AppShell />
        <main>
          <PageHeader title="Anket" subtitle={selectedSurvey.name} />
          <EmptyState
            title="Bu anketin süresi doldu"
            description={
              <>
                Cevaplar kapatıldı
                {selectedSurvey.deadline
                  ? `; son tarih ${new Date(selectedSurvey.deadline).toLocaleDateString("tr-TR")}.`
                  : "."}{" "}
                Süre uzatımı için platform yöneticinizle görüşün.
              </>
            }
            action={
              <div className="flex flex-wrap items-center gap-2">
                {openSurveys.length > 0 && (
                  <>
                    <label htmlFor="open-survey" className="sr-only">
                      Açık anketler
                    </label>
                    <select
                      id="open-survey"
                      value=""
                      onChange={(e) => setSelectedSurveyId(e.target.value)}
                      className="theme-select w-auto"
                    >
                      <option value="">Açık bir ankete geç</option>
                      {openSurveys.map((survey) => (
                        <option key={survey.id} value={survey.id}>
                          {survey.name}
                        </option>
                      ))}
                    </select>
                  </>
                )}
                <Button variant="outline" onClick={() => router.push("/dashboard")}>
                  Panoya dön
                </Button>
              </div>
            }
          />
        </main>
      </>
    );
  }

  const deadlineSoon =
    !!selectedSurvey?.deadline &&
    new Date(selectedSurvey.deadline).getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000;

  return (
    <>
      <AppShell />

      <main>
        <PageHeader
          title={selectedSurvey?.name || "Olgunluk değerlendirme anketi"}
          subtitle={selectedSurvey?.description || undefined}
          actions={
            surveys.length > 1 ? (
              <>
                <label htmlFor="survey-picker" className="sr-only">
                  Anket seçin
                </label>
                <select
                  id="survey-picker"
                  value={selectedSurveyId}
                  onChange={(e) => setSelectedSurveyId(e.target.value)}
                  className="theme-select w-auto"
                >
                  {surveys.map((survey) => (
                    <option key={survey.id} value={survey.id} disabled={survey.isExpired}>
                      {survey.name} {survey.isExpired ? "(süresi doldu)" : ""}
                    </option>
                  ))}
                </select>
              </>
            ) : undefined
          }
        />

        {/* Son tarih: yaklaşınca hata, uzaksa uyarı rengiyle. */}
        {selectedSurvey?.hasDeadline && selectedSurvey?.deadline && !selectedSurvey?.isExpired && (
          <p
            className="mb-5 flex items-center gap-2.5 rounded-[var(--radius-xs)] p-3 t-sm"
            style={{
              background: deadlineSoon ? "var(--error-bg)" : "var(--warning-bg)",
              color: deadlineSoon ? "var(--error)" : "var(--warning)",
            }}
          >
            <Clock size={16} className="shrink-0" aria-hidden="true" />
            Son tarih {new Date(selectedSurvey.deadline).toLocaleDateString("tr-TR")} —{" "}
            {Math.ceil(
              (new Date(selectedSurvey.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
            )}{" "}
            gün kaldı.
          </p>
        )}

        {/* Genel ilerleme bilinçli olarak ince ve ikincil: uzun ankette
            baskın gösterge bölüm çubuğudur (bkz. aşağıdaki bölüm başlığı). */}
        <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="progress-bar min-w-[180px] flex-1">
            <div className="progress-bar-fill" style={{ width: `${progressPercentage}%` }} />
          </div>
          <span className="t-sm tabular" style={{ color: "var(--ink-2)" }}>
            {answeredQuestions}/{totalQuestions} soru · %{progressPercentage}
            {estimatedMinutes > 0 && answeredQuestions === 0 && (
              <> · yaklaşık {estimatedMinutes} dk</>
            )}
          </span>
          {saving ? (
            <span className="flex items-center gap-1.5 t-sm" style={{ color: "var(--ink-3)" }}>
              <span className="spinner" style={{ width: 12, height: 12, borderWidth: 1.5 }} />
              Kaydediliyor
            </span>
          ) : savedOnce ? (
            <span
              className="flex items-center gap-1.5 t-sm"
              style={{ color: "var(--success)" }}
              title="Her cevap anında kaydedilir; ayrıca kaydetmeniz gerekmez."
            >
              <CheckCircle2 size={14} aria-hidden="true" />
              Otomatik kaydedildi
            </span>
          ) : null}
        </div>

        {loadingStructure ? (
          <div className="flex flex-col gap-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton h-32" />
            ))}
          </div>
        ) : categories.length === 0 ? (
          /* Ekipte görev dağıtılmış ama bu kişiye bölüm düşmemişse anketin
             boş görünmesi hazırlıksızlıktan değil; doğrusunu söyle. */
          sectionInfo?.distributed && !sectionInfo.isCoordinator ? (
            <EmptyState
              title="Size bölüm atanmadı"
              description="Bu ankette bölümler ekip üyelerine dağıtıldı ve size henüz bir bölüm düşmedi. Koordinatörünüzle görüşün."
            />
          ) : (
            <EmptyState
              title="Anket henüz hazırlanmadı"
              description="Bu ankete soru eklenmemiş. Sorular tanımlandığında burada açılır."
            />
          )
        ) : (
          <>
            {/* Kilit önce söylenir: kullanıcı cevabı değiştirmeyi denemeden
                önce neden değiştiremeyeceğini bilsin. */}
            {sectionInfo?.locked && (
              <div
                className="mb-4 flex items-start gap-2.5 rounded-[var(--radius-xs)] p-3"
                style={{ background: "var(--accent-quiet)" }}
              >
                <Lock size={16} className="mt-0.5 shrink-0" style={{ color: "var(--accent)" }} aria-hidden="true" />
                <div className="t-sm">
                  <p className="font-medium" style={{ color: "var(--ink)" }}>
                    Bu değerlendirme gönderildi
                    {sectionInfo.submittedAt
                      ? ` · ${new Date(sectionInfo.submittedAt).toLocaleDateString("tr-TR")}`
                      : ""}
                  </p>
                  <p style={{ color: "var(--ink-2)" }}>
                    Cevaplar salt okunur. Düzeltme gerekiyorsa koordinatörünüzden gönderimi geri
                    almasını isteyin.
                  </p>
                </div>
              </div>
            )}

            {/* Ortadan başlamak "neredeyim" hissi veriyor; nedenini söyle. */}
            {resumedSection && !sectionInfo?.locked && (
              <div
                className="mb-4 flex items-start justify-between gap-3 rounded-[var(--radius-xs)] p-3"
                style={{ background: "var(--surface-2)" }}
              >
                <p className="flex items-start gap-2 t-sm" style={{ color: "var(--ink-2)" }}>
                  <Clock size={15} className="mt-0.5 shrink-0" style={{ color: "var(--ink-3)" }} aria-hidden="true" />
                  <span>
                    Kaldığınız yerden devam ediyorsunuz:{" "}
                    <strong className="font-medium" style={{ color: "var(--ink)" }}>{resumedSection}</strong>.
                    Önceki cevaplarınız kayıtlı.
                  </span>
                </p>
                <button
                  type="button"
                  onClick={() => setResumedSection(null)}
                  className="shrink-0 t-sm hover:underline"
                  style={{ color: "var(--ink-3)" }}
                >
                  Tamam
                </button>
              </div>
            )}

            {/* Katkıcı yalnızca kendi bölümlerini görüyor; ilerleme çubuğunun
                neden anketin tamamını göstermediği açık olsun. */}
            {sectionInfo?.distributed && !sectionInfo.isCoordinator && (
              <p className="mb-4 t-sm" style={{ color: "var(--ink-3)" }}>
                Size atanan {sectionInfo.mySectionCount} bölüm gösteriliyor.
              </p>
            )}
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
                      type="button"
                      aria-current={isActive ? "step" : undefined}
                      className="min-w-[104px] flex-1 rounded-[var(--radius-md)] px-3 py-2 text-left transition-colors duration-fast ease-out-quart"
                      style={{
                        background: isActive ? "var(--accent-quiet)" : "var(--surface)",
                        border: `1px solid ${isActive ? "var(--accent)" : "var(--line)"}`,
                      }}
                    >
                      <span
                        className="block truncate t-sm"
                        style={{
                          color: isActive ? "var(--ink)" : "var(--ink-2)",
                          fontWeight: isActive ? 500 : 400,
                        }}
                      >
                        {summary.categoryName}
                      </span>
                      <span className="progress-bar mt-1.5" style={{ height: 3 }}>
                        <span
                          className="progress-bar-fill block"
                          style={{
                            width: `${progress.percentage}%`,
                            background: isDone ? "var(--series-2)" : "var(--accent)",
                          }}
                        />
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Bölüm başlığı ve baskın ilerleme çubuğu */}
            {/* Bölüm başlığı: kırıntı yolu + baskın ilerleme çubuğu. */}
            <div
              className="mb-6 rounded-[var(--radius-lg)] p-5"
              style={{ background: "var(--surface)", border: "1px solid var(--line)" }}
            >
              <nav className="breadcrumb flex-wrap" aria-label="Bölüm konumu">
                <span className="breadcrumb-item active">{currentStep?.categoryName ?? "Kategori"}</span>
                <ChevronRight size={14} className="breadcrumb-separator" aria-hidden="true" />
                <span className="breadcrumb-item active">{currentStep?.subCategoryName ?? "Bölüm"}</span>
                {currentStep?.subLevelName && (
                  <>
                    <ChevronRight size={14} className="breadcrumb-separator" aria-hidden="true" />
                    <span className="breadcrumb-item">{currentStep.subLevelName}</span>
                  </>
                )}
                <span className="ml-auto tabular" style={{ color: "var(--ink-3)" }}>
                  Bölüm {currentStepIndex + 1} / {steps.length}
                </span>
              </nav>

              <div className="mt-4 flex items-center gap-3">
                <div className="progress-bar flex-1" style={{ height: 8 }}>
                  <div
                    className="progress-bar-fill"
                    style={{ width: `${sectionProgress.percentage}%` }}
                  />
                </div>
                <span className="whitespace-nowrap t-sm tabular font-medium" style={{ color: "var(--ink)" }}>
                  {sectionProgress.answered} / {sectionProgress.total} soru
                </span>
              </div>

              <p className="mt-2 t-sm" style={{ color: "var(--ink-3)" }}>
                {currentStep?.categoryName}: {currentCategoryProgress.answered} /{" "}
                {currentCategoryProgress.total} soru tamamlandı
              </p>
            </div>

            {/* Questions */}
            <AnimatePresence mode="wait">
              {/* Bölüm değişimi bir durum değişikliği; yatay kaydırma yerine
                  kısa bir çapraz geçiş yeterli. */}
              <motion.div
                key={`${selectedSurveyId}-${currentStepIndex}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.17, ease: [0.25, 1, 0.5, 1] }}
                className="mb-8 flex flex-col gap-5"
              >
                {currentQuestions?.length === 0 ? (
                  <EmptyState title="Bu bölümde soru yok" description="Sonraki bölüme geçebilirsiniz." />
                ) : (
                  /* Kilitliyken fieldset bütün girdileri tarayıcı düzeyinde
                     kapatır — klavyeyle dolaşan kullanıcı da dışarıda kalır. */
                  <fieldset
                    disabled={sectionInfo?.locked ?? false}
                    className={`m-0 flex flex-col gap-5 border-0 p-0 ${
                      sectionInfo?.locked ? "opacity-75" : ""
                    }`}
                  >
                    {currentQuestions?.map((question) => (
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
                    ))}
                  </fieldset>
                )}
              </motion.div>
            </AnimatePresence>

            {/* Navigation */}
            {/* Eksik soru uyarısı — kaydırmalı düzenin bilinen tek zaafı soru
                atlanması; bölümden çıkarken hatırlatılır ama engellenmez. */}
            {pendingStepIndex !== null && (
              <div
                className="mb-4 flex items-start gap-2.5 rounded-[var(--radius-xs)] p-3"
                style={{ background: "var(--warning-bg)" }}
                role="alert"
              >
                <AlertTriangle size={16} className="mt-0.5 shrink-0" style={{ color: "var(--warning)" }} aria-hidden="true" />
                <div>
                  <p className="t-sm font-medium" style={{ color: "var(--warning)" }}>
                    Bu bölümde {remainingUnanswered} soru cevaplanmadı
                  </p>
                  <p className="mt-0.5 t-sm" style={{ color: "var(--ink-2)" }}>
                    Cevaplamadan geçebilir, sonra dönüp tamamlayabilirsiniz. Eksik sorular
                    puana dahil edilmez.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => setPendingStepIndex(null)}>
                      Bu bölümde kal
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => jumpTo(pendingStepIndex)}>
                      Yine de devam et
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-4">
              <Button variant="outline" onClick={goPrev} disabled={!canGoPrev}>
                <ChevronLeft size={16} aria-hidden="true" />
                Önceki
              </Button>

              {/* Kategori noktaları üstteki haritayla mükerrer olduğu için
                  burada yalnızca kalan bölüm sayısı ve çıkış yolu gösterilir. */}
              <div className="flex flex-col items-center gap-1">
                <span className="t-sm tabular" style={{ color: "var(--ink-3)" }}>
                  {canGoNext
                    ? `${steps.length - currentStepIndex - 1} bölüm kaldı`
                    : "Son bölüm"}
                </span>
                {/* Teknik olarak gereksiz — cevaplar zaten kayıtlı — ama
                    kullanıcı bir çıkış düğmesi arıyor ve bulamayınca anketi
                    bitirmek zorunda olduğunu sanıyor. */}
                {!sectionInfo?.locked && (
                  <button
                    onClick={() => {
                      toast.success("Cevaplarınız kayıtlı. Kaldığınız yerden devam edebilirsiniz.");
                      router.push("/dashboard");
                    }}
                    disabled={saving}
                    className="t-sm underline underline-offset-4 disabled:opacity-50"
                    style={{ color: "var(--ink-3)" }}
                  >
                    {saving ? "Kaydediliyor" : "Kaydet ve çık"}
                  </button>
                )}
              </div>

              {canGoNext ? (
                <Button onClick={goNext}>
                  Sonraki
                  <ChevronRight size={16} aria-hidden="true" />
                </Button>
              ) : (
                <Button onClick={handleComplete}>
                  Anketi tamamla
                  <Check size={16} aria-hidden="true" />
                </Button>
              )}
            </div>
          </>
        )}
      </main>
    </>
  );
}
