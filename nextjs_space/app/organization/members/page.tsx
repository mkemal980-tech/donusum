"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Building2,
  Copy,
  Download,
  FileUp,
  KeyRound,
  Loader2,
  Mail,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import AppShell from "@/components/ui/app-shell";
import PageHeader from "@/components/ui/page-header";
import EmptyState from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

type MemberUser = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: "USER" | "UNIT_MANAGER" | "ADMIN";
  emailVerified: boolean;
  isActive: boolean;
  sectorId: string | null;
  subSectorId: string | null;
  surveyAssignments: { surveyId: string }[];
};

type MemberUnit = {
  id: string;
  name: string;
  description: string | null;
  parentId: string | null;
  users: MemberUser[];
};

type Survey = { id: string; name: string; description: string | null; ownerUnitId: string | null };

type RootUnit = {
  id: string;
  name: string;
  description: string | null;
  members: MemberUnit[];
  surveys: Survey[];
};

type SubSector = { id: string; name: string };
type Sector = { id: string; name: string; naicsCode: string | null; subSectors: SubSector[] };
/**
 * Davet artık anında gönderilmiyor, kuyruğa alınıyor (bkz. lib/email-queue):
 * 500 daveti birden açmak sağlayıcının saniyelik sınırını aşıyordu. Ekran da
 * "gönderildi" yerine "kuyruğa alındı" demeli.
 */
type InvitationSummary = { queued?: number; total?: number };
type JoinCodeRecord = {
  id: string;
  label: string | null;
  codePreview: string;
  expiresAt: string | null;
  maxUses: number | null;
  useCount: number;
  isActive: boolean;
  createdAt: string;
  unavailableReason: string | null;
  unit: { id: string; name: string };
  survey: { id: string; name: string } | null;
};

const EMPTY_MEMBER_FORM = {
  memberName: "",
  description: "",
  firstName: "",
  lastName: "",
  email: "",
  sectorId: "",
  subSectorId: "",
  surveyId: "",
  makeUnitManager: false,
};

const EMPTY_USER_FORM = { memberUnitId: "", firstName: "", lastName: "", email: "", surveyId: "" };
const EMPTY_JOIN_CODE_FORM = {
  memberUnitId: "",
  label: "",
  expiresInDays: "30",
  maxUses: "",
  surveyId: "",
};

type EditInvitationForm = {
  userId: string;
  memberUnitId: string;
  firstName: string;
  lastName: string;
  email: string;
  surveyId: string;
  makeUnitManager: boolean;
};

function invitationMessage(invitation?: InvitationSummary) {
  if (!invitation) return "İşlem tamamlandı.";
  const queued = invitation.queued ?? 0;
  const total = invitation.total ?? queued;
  if (queued === 0) return "Kayıt oluşturuldu; davet zaten kuyrukta.";
  if (queued < total) return `Kayıt oluşturuldu; ${queued}/${total} davet kuyruğa alındı.`;
  return queued === 1
    ? "Davet e-postası kuyruğa alındı."
    : `${queued} davet e-postası kuyruğa alındı.`;
}

export default function OrganizationMembersPage() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession() || {};
  const [roots, setRoots] = useState<RootUnit[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [tenantUnitId, setTenantUnitId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [resendingUserId, setResendingUserId] = useState("");
  const [savingInvitationId, setSavingInvitationId] = useState("");
  const [deletingInvitationId, setDeletingInvitationId] = useState("");
  const [editInvitationForm, setEditInvitationForm] = useState<EditInvitationForm | null>(null);
  const [mode, setMode] = useState<"member" | "user" | "excel" | "codes" | null>(null);
  const [memberForm, setMemberForm] = useState(EMPTY_MEMBER_FORM);
  const [userForm, setUserForm] = useState(EMPTY_USER_FORM);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [excelName, setExcelName] = useState("");
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [joinCodes, setJoinCodes] = useState<JoinCodeRecord[]>([]);
  const [joinCodesLoading, setJoinCodesLoading] = useState(false);
  const [joinCodeForm, setJoinCodeForm] = useState(EMPTY_JOIN_CODE_FORM);
  const [createdJoinCode, setCreatedJoinCode] = useState("");
  const [revokingJoinCodeId, setRevokingJoinCodeId] = useState("");

  useEffect(() => {
    if (sessionStatus === "unauthenticated") router.push("/login");
    const role = (session?.user as { role?: string } | undefined)?.role;
    if (sessionStatus === "authenticated" && role !== "UNIT_MANAGER" && role !== "ADMIN") {
      router.push("/dashboard");
    }
  }, [router, session, sessionStatus]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [membersResponse, sectorsResponse] = await Promise.all([
        fetch("/api/organization/members", { cache: "no-store" }),
        fetch("/api/sectors", { cache: "no-store" }),
      ]);
      const [membersData, sectorsData] = await Promise.all([
        membersResponse.json(),
        sectorsResponse.json(),
      ]);
      if (!membersResponse.ok) throw new Error(membersData.error || "Üyeler yüklenemedi.");
      if (!sectorsResponse.ok) throw new Error(sectorsData.error || "Sektörler yüklenemedi.");
      setRoots(membersData.roots ?? []);
      setSectors(sectorsData ?? []);
      setTenantUnitId((current) => current || membersData.roots?.[0]?.id || "");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Üye bilgileri yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (sessionStatus === "authenticated") loadData();
  }, [loadData, sessionStatus]);

  const selectedRoot = roots.find((root) => root.id === tenantUnitId);
  const members = useMemo(() => selectedRoot?.members ?? [], [selectedRoot]);
  const surveys = useMemo(() => selectedRoot?.surveys ?? [], [selectedRoot]);
  const surveyById = useMemo(() => new Map(surveys.map((survey) => [survey.id, survey])), [surveys]);
  const selectedSector = sectors.find((sector) => sector.id === memberForm.sectorId);
  const sectorById = useMemo(() => new Map(sectors.map((sector) => [sector.id, sector])), [sectors]);
  const subSectorById = useMemo(
    () => new Map(sectors.flatMap((sector) => sector.subSectors.map((subSector) => [subSector.id, subSector] as const))),
    [sectors]
  );

  useEffect(() => {
    setMemberForm((current) => ({
      ...current,
      surveyId: surveys.some((survey) => survey.id === current.surveyId) ? current.surveyId : "",
    }));
    setUserForm((current) => ({
      ...current,
      memberUnitId: members.some((member) => member.id === current.memberUnitId)
        ? current.memberUnitId
        : members[0]?.id ?? "",
      surveyId: surveys.some((survey) => survey.id === current.surveyId) ? current.surveyId : "",
    }));
    setJoinCodeForm((current) => ({
      ...current,
      memberUnitId: members.some((member) => member.id === current.memberUnitId)
        ? current.memberUnitId
        : members[0]?.id ?? "",
      surveyId: surveys.some((survey) => survey.id === current.surveyId) ? current.surveyId : "",
    }));
  }, [members, surveys]);

  useEffect(() => {
    setEditInvitationForm(null);
    setJoinCodes([]);
    setCreatedJoinCode("");
  }, [tenantUnitId]);

  const postAction = async (payload: Record<string, unknown>) => {
    const response = await fetch("/api/organization/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, tenantUnitId }),
    });
    const data = await response.json();
    if (!response.ok) {
      const error = new Error(data.error || "İşlem tamamlanamadı.") as Error & { details?: string[] };
      error.details = data.errors;
      throw error;
    }
    return data;
  };

  const createMember = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const data = await postAction({ action: "create_member", ...memberForm });
      const assignmentMessage = data.assignedSurvey?.name ? ` ${data.assignedSurvey.name} anketi atandı.` : "";
      toast.success(`Üye kuruluş oluşturuldu.${assignmentMessage} ${invitationMessage(data.invitation)}`);
      setMemberForm(EMPTY_MEMBER_FORM);
      setMode(null);
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Üye kuruluş oluşturulamadı.");
    } finally {
      setBusy(false);
    }
  };

  const inviteUser = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const data = await postAction({ action: "invite_user", ...userForm });
      const assignmentMessage = data.assignedSurvey?.name ? ` ${data.assignedSurvey.name} anketi atandı.` : "";
      toast.success(`Kullanıcı eklendi.${assignmentMessage} ${invitationMessage(data.invitation)}`);
      setUserForm((current) => ({ ...EMPTY_USER_FORM, memberUnitId: current.memberUnitId }));
      setMode(null);
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kullanıcı eklenemedi.");
    } finally {
      setBusy(false);
    }
  };

  const importExcel = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!excelFile) return;
    setBusy(true);
    setImportErrors([]);
    try {
      const formData = new FormData();
      formData.append("action", "import_excel");
      formData.append("tenantUnitId", tenantUnitId);
      formData.append("file", excelFile);
      const response = await fetch("/api/organization/members", { method: "POST", body: formData });
      const data = await response.json();
      if (!response.ok) {
        const error = new Error(data.error || "İşlem tamamlanamadı.") as Error & { details?: string[] };
        error.details = data.errors;
        throw error;
      }
      toast.success(`${data.importedUsers} kullanıcı aktarıldı. ${invitationMessage(data.invitation)}`);
      setExcelFile(null);
      setExcelName("");
      setMode(null);
      await loadData();
    } catch (error) {
      const typed = error as Error & { details?: string[] };
      setImportErrors(typed.details ?? []);
      toast.error(typed.message || "Excel aktarılamadı.");
    } finally {
      setBusy(false);
    }
  };

  const chooseExcel = (file?: File) => {
    if (!file) return;
    if (!file.name.toLocaleLowerCase("tr-TR").endsWith(".xlsx")) {
      toast.error("Yalnızca .xlsx Excel dosyası seçebilirsiniz.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Excel dosyası en fazla 2 MB olabilir.");
      return;
    }
    setExcelFile(file);
    setExcelName(file.name);
    setImportErrors([]);
  };

  const resendInvitation = async (userId: string) => {
    setResendingUserId(userId);
    try {
      const data = await postAction({ action: "resend_invitation", userId });
      const message = invitationMessage(data.invitation);
      if ((data.invitation?.queued ?? 0) > 0) toast.success(message);
      else toast.warning(message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Davet yenilenemedi.");
    } finally {
      setResendingUserId("");
    }
  };

  const startEditingInvitation = (user: MemberUser, memberUnitId: string) => {
    setMode(null);
    setEditInvitationForm({
      userId: user.id,
      memberUnitId,
      firstName: user.firstName ?? "",
      lastName: user.lastName ?? "",
      email: user.email,
      surveyId: user.surveyAssignments[0]?.surveyId ?? "",
      makeUnitManager: user.role === "UNIT_MANAGER",
    });
    window.requestAnimationFrame(() => {
      document.getElementById("edit-invitation-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const updateInvitation = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editInvitationForm) return;
    setSavingInvitationId(editInvitationForm.userId);
    try {
      const data = await postAction({ action: "update_invitation", ...editInvitationForm });
      const assignmentMessage = data.assignedSurvey?.name
        ? ` ${data.assignedSurvey.name} anketi atandı.`
        : " Anket ataması kaldırıldı.";
      toast.success(`Davet güncellendi.${assignmentMessage} ${invitationMessage(data.invitation)}`);
      setEditInvitationForm(null);
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Davet güncellenemedi.");
    } finally {
      setSavingInvitationId("");
    }
  };

  const deleteInvitation = async (user: MemberUser) => {
    const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
    if (!window.confirm(`${fullName} için bekleyen davet ve kullanıcı kaydı silinecek. Üye kuruluş korunacak. Devam edilsin mi?`)) return;
    setDeletingInvitationId(user.id);
    try {
      await postAction({ action: "delete_invitation", userId: user.id });
      if (editInvitationForm?.userId === user.id) setEditInvitationForm(null);
      toast.success("Bekleyen davet silindi.");
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Davet silinemedi.");
    } finally {
      setDeletingInvitationId("");
    }
  };

  const loadJoinCodes = async () => {
    if (!tenantUnitId) return;
    setJoinCodesLoading(true);
    try {
      const response = await fetch(`/api/organization/join-codes?tenantUnitId=${encodeURIComponent(tenantUnitId)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Katılım kodları yüklenemedi.");
      setJoinCodes(data.codes ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Katılım kodları yüklenemedi.");
    } finally {
      setJoinCodesLoading(false);
    }
  };

  const openJoinCodes = async () => {
    setEditInvitationForm(null);
    setCreatedJoinCode("");
    if (mode === "codes") {
      setMode(null);
      return;
    }
    setMode("codes");
    await loadJoinCodes();
  };

  const createJoinCode = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setCreatedJoinCode("");
    try {
      const response = await fetch("/api/organization/join-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          tenantUnitId,
          ...joinCodeForm,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Katılım kodu oluşturulamadı.");
      setCreatedJoinCode(data.code);
      setJoinCodeForm((current) => ({ ...EMPTY_JOIN_CODE_FORM, memberUnitId: current.memberUnitId }));
      toast.success("Katılım kodu oluşturuldu. Kodu güvenli şekilde paylaşın.");
      await loadJoinCodes();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Katılım kodu oluşturulamadı.");
    } finally {
      setBusy(false);
    }
  };

  const copyJoinCode = async () => {
    try {
      await navigator.clipboard.writeText(createdJoinCode);
      toast.success("Katılım kodu kopyalandı.");
    } catch {
      toast.error("Kod kopyalanamadı; kodu seçerek kopyalayın.");
    }
  };

  const revokeJoinCode = async (code: JoinCodeRecord) => {
    if (!window.confirm(`${code.codePreview} katılım kodu iptal edilecek. Bu işlem geri alınamaz. Devam edilsin mi?`)) return;
    setRevokingJoinCodeId(code.id);
    try {
      const response = await fetch("/api/organization/join-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "revoke", tenantUnitId, codeId: code.id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Katılım kodu iptal edilemedi.");
      toast.success("Katılım kodu iptal edildi.");
      await loadJoinCodes();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Katılım kodu iptal edilemedi.");
    } finally {
      setRevokingJoinCodeId("");
    }
  };

  if (loading || sessionStatus === "loading") {
    return (
      <>
        <AppShell />
        <main id="icerik" tabIndex={-1}><div className="flex items-center justify-center py-24"><Loader2 className="animate-spin" /></div></main>
      </>
    );
  }

  return (
    <>
      <AppShell />
      <main id="icerik" tabIndex={-1}>
        <PageHeader
          title="Üye yönetimi"
          subtitle="Üye kuruluşları ve kullanıcılarını ekleyin, güvenli hesap davetlerini yönetin."
          actions={
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={openJoinCodes} disabled={!members.length}>
                <KeyRound size={16} /> Katılım kodları
              </Button>
              <Button variant="outline" onClick={() => { setEditInvitationForm(null); setMode(mode === "excel" ? null : "excel"); }} disabled={!selectedRoot}>
                <FileUp size={16} /> Excel ile aktar
              </Button>
              <Button variant="outline" onClick={() => { setEditInvitationForm(null); setMode(mode === "user" ? null : "user"); }} disabled={!members.length}>
                <UserPlus size={16} /> Kullanıcı ekle
              </Button>
              <Button onClick={() => { setEditInvitationForm(null); setMode(mode === "member" ? null : "member"); }} disabled={!selectedRoot}>
                {mode === "member" ? <X size={16} /> : <Plus size={16} />}
                {mode === "member" ? "Kapat" : "Yeni üye kuruluş"}
              </Button>
            </div>
          }
        />

        {roots.length > 1 && (
          <label className="mb-6 block max-w-xl t-sm" style={{ color: "var(--ink-2)" }}>
            Yönetilen oda / STK
            <select value={tenantUnitId} onChange={(event) => setTenantUnitId(event.target.value)} className="theme-select mt-1.5 w-full">
              {roots.map((root) => <option key={root.id} value={root.id}>{root.name}</option>)}
            </select>
          </label>
        )}

        {mode === "codes" && (
          <FormPanel
            title="Birim katılım kodları"
            description="Kodu kullanan yeni hesap seçilen üye kuruluşa standart kullanıcı olarak bağlanır; kuruluş ve sektör profili otomatik devralınır."
          >
            <form onSubmit={createJoinCode} className="grid gap-4 md:grid-cols-2">
              <Field label="Üye kuruluş / birim">
                <select
                  required
                  className="theme-select mt-1.5 w-full"
                  value={joinCodeForm.memberUnitId}
                  onChange={(event) => setJoinCodeForm({ ...joinCodeForm, memberUnitId: event.target.value })}
                >
                  {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
                </select>
              </Field>
              <Field label="Kod açıklaması (isteğe bağlı)">
                <input
                  maxLength={100}
                  className="theme-input mt-1.5 w-full"
                  value={joinCodeForm.label}
                  onChange={(event) => setJoinCodeForm({ ...joinCodeForm, label: event.target.value })}
                  placeholder="Örn. Eylül üye kaydı"
                />
              </Field>
              <Field label="Geçerlilik süresi">
                <select
                  className="theme-select mt-1.5 w-full"
                  value={joinCodeForm.expiresInDays}
                  onChange={(event) => setJoinCodeForm({ ...joinCodeForm, expiresInDays: event.target.value })}
                >
                  <option value="7">7 gün</option>
                  <option value="30">30 gün</option>
                  <option value="90">90 gün</option>
                  <option value="365">1 yıl</option>
                  <option value="">Süresiz</option>
                </select>
              </Field>
              <Field label="Kullanım sınırı (isteğe bağlı)">
                <input
                  type="number"
                  min={1}
                  max={10000}
                  className="theme-input mt-1.5 w-full"
                  value={joinCodeForm.maxUses}
                  onChange={(event) => setJoinCodeForm({ ...joinCodeForm, maxUses: event.target.value })}
                  placeholder="Sınırsız"
                />
              </Field>
              <Field label="Kayıtta atanacak anket (isteğe bağlı)">
                <select
                  className="theme-select mt-1.5 w-full"
                  value={joinCodeForm.surveyId}
                  onChange={(event) => setJoinCodeForm({ ...joinCodeForm, surveyId: event.target.value })}
                >
                  <option value="">Anket atama</option>
                  {surveys.map((survey) => <option key={survey.id} value={survey.id}>{survey.name}</option>)}
                </select>
              </Field>
              <div className="flex items-end justify-end"><Button type="submit" loading={busy}>Katılım kodu oluştur</Button></div>
            </form>

            {createdJoinCode && (
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] p-4" style={{ background: "var(--success-bg)", border: "1px solid var(--success)", color: "var(--success)" }}>
                <div>
                  <p className="font-medium">Yeni kod hazır</p>
                  <code className="mt-1 block text-lg font-semibold tracking-wider">{createdJoinCode}</code>
                  <p className="mt-1 t-caption">Güvenlik nedeniyle tam kod yalnızca şimdi gösterilir.</p>
                </div>
                <Button type="button" variant="outline" onClick={copyJoinCode}><Copy size={15} /> Kopyala</Button>
              </div>
            )}

            <div className="mt-6">
              <h3 className="font-semibold" style={{ color: "var(--ink)" }}>Oluşturulan kodlar</h3>
              {joinCodesLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div>
              ) : joinCodes.length === 0 ? (
                <p className="mt-3 t-sm" style={{ color: "var(--ink-3)" }}>Henüz katılım kodu oluşturulmadı.</p>
              ) : (
                <div className="mt-3 overflow-x-auto">
                  <table className="theme-table">
                    <thead><tr><th>Kod</th><th>Birim</th><th>Anket</th><th>Kullanım</th><th>Son tarih</th><th>Durum</th><th className="text-right">İşlem</th></tr></thead>
                    <tbody>
                      {joinCodes.map((code) => (
                        <tr key={code.id}>
                          <td><span className="font-mono font-medium">{code.codePreview}</span>{code.label && <span className="mt-0.5 block t-caption">{code.label}</span>}</td>
                          <td>{code.unit.name}</td>
                          <td>{code.survey?.name || "—"}</td>
                          <td>{code.useCount}{code.maxUses !== null ? ` / ${code.maxUses}` : " / sınırsız"}</td>
                          <td>{code.expiresAt ? new Date(code.expiresAt).toLocaleDateString("tr-TR") : "Süresiz"}</td>
                          <td><span className={code.unavailableReason ? "badge badge-neutral" : "badge badge-success"}>{code.unavailableReason || "Aktif"}</span></td>
                          <td>
                            <div className="flex justify-end">
                              {code.isActive && (
                                <Button size="sm" variant="ghost" loading={revokingJoinCodeId === code.id} onClick={() => revokeJoinCode(code)} className="text-[var(--error)]">
                                  İptal et
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </FormPanel>
        )}

        {mode === "member" && (
          <FormPanel title="Yeni üye kuruluş" description="Kuruluşu oluşturur, ilk kullanıcıyı bağlar ve 7 günlük şifre belirleme daveti yollar.">
            <form onSubmit={createMember} className="grid gap-4 md:grid-cols-2">
              <Field label="Üye kuruluş adı"><input required maxLength={160} className="theme-input mt-1.5 w-full" value={memberForm.memberName} onChange={(event) => setMemberForm({ ...memberForm, memberName: event.target.value })} /></Field>
              <Field label="Açıklama (isteğe bağlı)"><input maxLength={500} className="theme-input mt-1.5 w-full" value={memberForm.description} onChange={(event) => setMemberForm({ ...memberForm, description: event.target.value })} /></Field>
              <Field label="Yetkili adı"><input required maxLength={80} className="theme-input mt-1.5 w-full" value={memberForm.firstName} onChange={(event) => setMemberForm({ ...memberForm, firstName: event.target.value })} /></Field>
              <Field label="Yetkili soyadı"><input maxLength={80} className="theme-input mt-1.5 w-full" value={memberForm.lastName} onChange={(event) => setMemberForm({ ...memberForm, lastName: event.target.value })} /></Field>
              <Field label="E-posta"><input required type="email" maxLength={254} className="theme-input mt-1.5 w-full" value={memberForm.email} onChange={(event) => setMemberForm({ ...memberForm, email: event.target.value })} /></Field>
              <Field label="Sektör">
                <select required className="theme-select mt-1.5 w-full" value={memberForm.sectorId} onChange={(event) => setMemberForm({ ...memberForm, sectorId: event.target.value, subSectorId: "" })}>
                  <option value="">Sektör seçin</option>
                  {sectors.map((sector) => <option key={sector.id} value={sector.id}>{sector.naicsCode ? `${sector.naicsCode} · ` : ""}{sector.name}</option>)}
                </select>
              </Field>
              <Field label="Alt sektör">
                <select className="theme-select mt-1.5 w-full" value={memberForm.subSectorId} onChange={(event) => setMemberForm({ ...memberForm, subSectorId: event.target.value })} disabled={!selectedSector?.subSectors.length}>
                  <option value="">Alt sektör seçin</option>
                  {selectedSector?.subSectors.map((subSector) => <option key={subSector.id} value={subSector.id}>{subSector.name}</option>)}
                </select>
              </Field>
              <Field label="Atanacak anket (isteğe bağlı)">
                <select className="theme-select mt-1.5 w-full" value={memberForm.surveyId} onChange={(event) => setMemberForm({ ...memberForm, surveyId: event.target.value })}>
                  <option value="">Anket atamadan davet et</option>
                  {surveys.map((survey) => <option key={survey.id} value={survey.id}>{survey.name}</option>)}
                </select>
              </Field>
              <label className="flex cursor-pointer items-start gap-3 rounded-[var(--radius-md)] p-4 md:col-span-2" style={{ background: "var(--surface-2)", border: "1px solid var(--line)" }}>
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4"
                  checked={memberForm.makeUnitManager}
                  onChange={(event) => setMemberForm({ ...memberForm, makeUnitManager: event.target.checked })}
                />
                <span>
                  <span className="block font-medium" style={{ color: "var(--ink)" }}>Bu kullanıcı üye kuruluş yöneticisi olsun</span>
                  <span className="mt-1 block t-caption" style={{ color: "var(--ink-3)" }}>
                    Kullanıcı bu birimi ve alt birimlerini yönetebilir. Seçilmezse yalnızca anketleri dolduran standart kullanıcı olur.
                  </span>
                </span>
              </label>
              <div className="flex items-end justify-end md:col-span-2"><Button type="submit" loading={busy}>Kuruluşu oluştur ve davet et</Button></div>
            </form>
          </FormPanel>
        )}

        {mode === "user" && (
          <FormPanel title="Mevcut üyeye kullanıcı ekle" description="Yeni kullanıcı kuruluşun sektör profilini devralır ve kendi şifresini davet bağlantısıyla belirler.">
            <form onSubmit={inviteUser} className="grid gap-4 md:grid-cols-2">
              <Field label="Üye kuruluş">
                <select required className="theme-select mt-1.5 w-full" value={userForm.memberUnitId} onChange={(event) => setUserForm({ ...userForm, memberUnitId: event.target.value })}>
                  {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
                </select>
              </Field>
              <Field label="E-posta"><input required type="email" maxLength={254} className="theme-input mt-1.5 w-full" value={userForm.email} onChange={(event) => setUserForm({ ...userForm, email: event.target.value })} /></Field>
              <Field label="Ad"><input required maxLength={80} className="theme-input mt-1.5 w-full" value={userForm.firstName} onChange={(event) => setUserForm({ ...userForm, firstName: event.target.value })} /></Field>
              <Field label="Soyad"><input maxLength={80} className="theme-input mt-1.5 w-full" value={userForm.lastName} onChange={(event) => setUserForm({ ...userForm, lastName: event.target.value })} /></Field>
              <Field label="Atanacak anket (isteğe bağlı)">
                <select className="theme-select mt-1.5 w-full" value={userForm.surveyId} onChange={(event) => setUserForm({ ...userForm, surveyId: event.target.value })}>
                  <option value="">Anket atamadan davet et</option>
                  {surveys.map((survey) => <option key={survey.id} value={survey.id}>{survey.name}</option>)}
                </select>
              </Field>
              <div className="flex items-end justify-end md:col-span-2"><Button type="submit" loading={busy}>Kullanıcıyı ekle ve davet et</Button></div>
            </form>
          </FormPanel>
        )}

        {mode === "excel" && (
          <FormPanel title="Excel ile toplu aktarım" description="İki sayfalı şablonun ilk sayfasını doldurun; ikinci sayfadaki rehberde alan açıklamaları ve geçerli sektör kodları bulunur.">
            <form onSubmit={importExcel}>
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-[var(--line-strong)] px-4 py-2 t-sm" style={{ color: "var(--ink)" }}>
                  <FileUp size={16} /> {excelName || "Excel dosyası seç"}
                  <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" onChange={(event) => chooseExcel(event.target.files?.[0])} />
                </label>
                <Button type="button" variant="ghost" onClick={() => window.open("/api/organization/members?template=excel", "_blank")}>
                  <Download size={16} /> Excel şablonunu indir
                </Button>
                <Button type="submit" loading={busy} disabled={!excelFile}>Aktarımı başlat</Button>
              </div>
              {importErrors.length > 0 && (
                <ul className="mt-4 list-disc rounded-[var(--radius-md)] py-3 pl-8 pr-4 t-sm" style={{ background: "var(--error-bg)", color: "var(--error)" }}>
                  {importErrors.map((error) => <li key={error}>{error}</li>)}
                </ul>
              )}
            </form>
          </FormPanel>
        )}

        {editInvitationForm && (
          <div id="edit-invitation-panel">
            <FormPanel
              title="Bekleyen daveti düzenle"
              description="Davet bilgileri güncellenir, eski bağlantı geçersiz olur ve yeni davet seçilen e-posta adresine gönderilir."
            >
            <form onSubmit={updateInvitation} className="grid gap-4 md:grid-cols-2">
              <Field label="Üye kuruluş">
                <select
                  required
                  className="theme-select mt-1.5 w-full"
                  value={editInvitationForm.memberUnitId}
                  onChange={(event) => setEditInvitationForm({ ...editInvitationForm, memberUnitId: event.target.value })}
                >
                  {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
                </select>
              </Field>
              <Field label="E-posta">
                <input
                  required
                  type="email"
                  maxLength={254}
                  className="theme-input mt-1.5 w-full"
                  value={editInvitationForm.email}
                  onChange={(event) => setEditInvitationForm({ ...editInvitationForm, email: event.target.value })}
                />
              </Field>
              <Field label="Ad">
                <input
                  required
                  maxLength={80}
                  className="theme-input mt-1.5 w-full"
                  value={editInvitationForm.firstName}
                  onChange={(event) => setEditInvitationForm({ ...editInvitationForm, firstName: event.target.value })}
                />
              </Field>
              <Field label="Soyad">
                <input
                  maxLength={80}
                  className="theme-input mt-1.5 w-full"
                  value={editInvitationForm.lastName}
                  onChange={(event) => setEditInvitationForm({ ...editInvitationForm, lastName: event.target.value })}
                />
              </Field>
              <Field label="Atanacak anket (isteğe bağlı)">
                <select
                  className="theme-select mt-1.5 w-full"
                  value={editInvitationForm.surveyId}
                  onChange={(event) => setEditInvitationForm({ ...editInvitationForm, surveyId: event.target.value })}
                >
                  <option value="">Anket atamadan davet et</option>
                  {surveys.map((survey) => <option key={survey.id} value={survey.id}>{survey.name}</option>)}
                </select>
              </Field>
              <label className="flex cursor-pointer items-start gap-3 rounded-[var(--radius-md)] p-4" style={{ background: "var(--surface-2)", border: "1px solid var(--line)" }}>
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4"
                  checked={editInvitationForm.makeUnitManager}
                  onChange={(event) => setEditInvitationForm({ ...editInvitationForm, makeUnitManager: event.target.checked })}
                />
                <span>
                  <span className="block font-medium" style={{ color: "var(--ink)" }}>Üye kuruluş yöneticisi olsun</span>
                  <span className="mt-1 block t-caption" style={{ color: "var(--ink-3)" }}>Bu birimi ve alt birimlerini yönetebilir.</span>
                </span>
              </label>
              <div className="flex items-end justify-end gap-2 md:col-span-2">
                <Button type="button" variant="ghost" onClick={() => setEditInvitationForm(null)}>Vazgeç</Button>
                <Button type="submit" loading={savingInvitationId === editInvitationForm.userId}>Değişiklikleri kaydet ve daveti yenile</Button>
              </div>
            </form>
            </FormPanel>
          </div>
        )}

        {!selectedRoot ? (
          <EmptyState title="Yönetilen kuruluş bulunamadı" description="Bu hesabın yönettiği bir oda/STK atanmadığı için üye eklenemez." />
        ) : members.length === 0 ? (
          <EmptyState title="Henüz üye kuruluş yok" description="İlk üye kuruluşu ekleyip yetkili kullanıcıya güvenli davet gönderebilirsiniz." action={<Button onClick={() => setMode("member")}>İlk üyeyi ekle</Button>} />
        ) : (
          <section className="rounded-[var(--radius-lg)] p-6" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="t-subhead" style={{ color: "var(--ink)" }}>Üye kuruluşlar</h2>
                <p className="mt-1 t-sm" style={{ color: "var(--ink-3)" }}>{members.length} kuruluş · {members.reduce((total, member) => total + member.users.length, 0)} kullanıcı</p>
              </div>
              <Building2 size={20} style={{ color: "var(--accent)" }} />
            </div>
            <div className="space-y-4">
              {members.map((member) => (
                <article key={member.id} className="rounded-[var(--radius-md)] p-4" style={{ background: "var(--surface-2)", border: "1px solid var(--line)" }}>
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold" style={{ color: "var(--ink)" }}>{member.name}</h3>
                      <p className="mt-0.5 t-caption" style={{ color: "var(--ink-3)" }}>{member.description || `${member.users.length} kullanıcı`}</p>
                    </div>
                    <span className="badge badge-neutral"><Users size={13} /> {member.users.length}</span>
                  </div>
                  {member.users.length === 0 ? (
                    <p className="t-sm" style={{ color: "var(--ink-3)" }}>Kullanıcı yok. Kampanyaya dahil edilebilmesi için kullanıcı ekleyin.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="theme-table">
                        <thead><tr><th>Kullanıcı</th><th>E-posta</th><th>Sektör</th><th>Anket</th><th>Yetki</th><th>Durum</th><th className="text-right">İşlem</th></tr></thead>
                        <tbody>
                          {member.users.map((user) => {
                            const sector = user.sectorId ? sectorById.get(user.sectorId) : null;
                            const subSector = user.subSectorId ? subSectorById.get(user.subSectorId) : null;
                            const assignedSurvey = user.surveyAssignments[0]
                              ? surveyById.get(user.surveyAssignments[0].surveyId)
                              : null;
                            return (
                              <tr key={user.id}>
                                <td className="font-medium">{[user.firstName, user.lastName].filter(Boolean).join(" ") || "—"}</td>
                                <td>{user.email}</td>
                                <td>{subSector?.name || sector?.name || "—"}</td>
                                <td>{assignedSurvey?.name || "—"}</td>
                                <td>{user.role === "UNIT_MANAGER" ? <span className="badge badge-neutral">Birim yöneticisi</span> : "Kullanıcı"}</td>
                                <td>
                                  <span className={!user.isActive ? "badge badge-neutral" : user.emailVerified ? "badge badge-success" : "badge badge-warning"}>
                                    {!user.isActive ? "Devre dışı" : user.emailVerified ? "Hesap aktif" : "Davet bekliyor"}
                                  </span>
                                </td>
                                <td>
                                  <div className="flex flex-wrap justify-end gap-1">
                                    {user.isActive && !user.emailVerified && (
                                      <>
                                        <Button size="sm" variant="ghost" onClick={() => startEditingInvitation(user, member.id)}>
                                          <Pencil size={14} /> Düzenle
                                        </Button>
                                        <Button size="sm" variant="ghost" loading={resendingUserId === user.id} onClick={() => resendInvitation(user.id)}>
                                          {resendingUserId !== user.id && <RefreshCw size={14} />} Daveti yenile
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          loading={deletingInvitationId === user.id}
                                          onClick={() => deleteInvitation(user)}
                                          className="text-[var(--error)]"
                                        >
                                          {deletingInvitationId !== user.id && <Trash2 size={14} />} Sil
                                        </Button>
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>
        )}

        <section className="mt-6 flex items-start gap-3 rounded-[var(--radius-lg)] p-4 t-sm" style={{ background: "var(--surface-2)", color: "var(--ink-2)" }}>
          <Mail size={18} className="mt-0.5 shrink-0" />
          Kullanıcıya geçici şifre gösterilmez. Tek kullanımlık bağlantı 7 gün geçerlidir; kullanıcı bağlantıdan kendi şifresini belirlediğinde hesabı doğrulanır.
        </section>
      </main>
    </>
  );
}

function FormPanel({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="mb-6 rounded-[var(--radius-lg)] p-6" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
      <h2 className="t-subhead" style={{ color: "var(--ink)" }}>{title}</h2>
      <p className="mb-5 mt-1 t-sm" style={{ color: "var(--ink-2)" }}>{description}</p>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="t-sm" style={{ color: "var(--ink-2)" }}>{label}{children}</label>;
}
