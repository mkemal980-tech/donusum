export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateSurveyAccess, withAuth } from "@/lib/api-utils";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { getScopeResolver } from "@/lib/scoring";
import {
  getAssessmentContext,
  getContributorCandidates,
  getSectionAssignments,
} from "@/lib/assessment";
import { pendingByAssignee, sectionOfQuestion } from "@/lib/section-assignment";

/**
 * Katkıcılara hatırlatma.
 *
 * Her atamada tek tek posta atmak spam olurdu: koordinatör on iki bölümü tek
 * tek dağıtırken aynı kişiye on iki posta giderdi ve bildirimler okunmaz hâle
 * gelirdi. Bunun yerine gönderme anını koordinatör seçiyor ve kişi başına tek
 * özet gidiyor.
 *
 * Aynı düğme hem ilk duyuru hem sonraki hatırlatmalar için: alıcı listesi
 * "eksiği kalanlar" olduğu için ikinci basışta işini bitirenler rahatsız
 * edilmez.
 */
export async function POST(request: NextRequest) {
  const auth = await withAuth(request, { rateLimit: "auth" });
  if (!auth.success) return auth.response;

  try {
    const { surveyId } = (await request.json()) ?? {};
    if (!surveyId) {
      return NextResponse.json({ error: "surveyId gerekli" }, { status: 400 });
    }

    const accessError = await validateSurveyAccess(auth.userId, auth.user.role, surveyId);
    if (accessError) return accessError;

    const context = await getAssessmentContext(auth.userId, surveyId);
    if (!context.isCoordinator) {
      return NextResponse.json({ error: "Hatırlatma gönderme yetkiniz yok." }, { status: 403 });
    }

    if (!context.assessmentId) {
      return NextResponse.json({ error: "Henüz dağıtılmış bölüm yok." }, { status: 400 });
    }

    // Sağlayıcı yoksa sessizce başarı dönmek en kötüsü olurdu: koordinatör
    // gönderdiğini sanır, kimse haberdar olmaz.
    if (!isEmailConfigured()) {
      return NextResponse.json(
        { error: "E-posta sağlayıcısı tanımlı değil; hatırlatma gönderilemiyor." },
        { status: 503 }
      );
    }

    const [survey, assignments, members, scopeOf] = await Promise.all([
      prisma.survey.findUnique({ where: { id: surveyId }, select: { name: true } }),
      getSectionAssignments(context.assessmentId),
      getContributorCandidates({ unitId: context.unitId, ownerUserId: auth.userId }),
      getScopeResolver(auth.userId, surveyId),
    ]);

    if (assignments.length === 0) {
      return NextResponse.json({ error: "Henüz dağıtılmış bölüm yok." }, { status: 400 });
    }

    const subCategories = await prisma.subCategory.findMany({
      where: { id: { in: assignments.map((assignment) => assignment.subCategoryId) } },
      select: {
        id: true,
        name: true,
        _count: { select: { questions: { where: { archivedAt: null } } } },
        subLevels: {
          where: { archivedAt: null },
          select: { _count: { select: { questions: { where: { archivedAt: null } } } } },
        },
      },
    });

    const responses = await prisma.surveyResponse.findMany({
      where: { assessmentId: context.assessmentId, question: { archivedAt: null } },
      select: {
        value: true,
        question: {
          select: { subCategoryId: true, subLevel: { select: { subCategoryId: true } } },
        },
      },
    });

    const answeredBySection = new Map<string, number>();
    for (const response of responses) {
      if (!response.value) continue;
      const sectionId = sectionOfQuestion(response.question);
      if (!sectionId) continue;
      answeredBySection.set(sectionId, (answeredBySection.get(sectionId) ?? 0) + 1);
    }

    const assigneeOfSection = new Map(
      assignments.map((assignment) => [assignment.subCategoryId, assignment.assigneeId])
    );

    const pending = pendingByAssignee(
      subCategories
        .filter((subCategory) => scopeOf(subCategory.id).applicable)
        .map((subCategory) => ({
          id: subCategory.id,
          name: subCategory.name,
          assigneeId: assigneeOfSection.get(subCategory.id) ?? null,
          questionCount:
            subCategory._count.questions +
            subCategory.subLevels.reduce((sum, level) => sum + level._count.questions, 0),
          answeredCount: answeredBySection.get(subCategory.id) ?? 0,
        }))
    );

    if (pending.length === 0) {
      return NextResponse.json({
        success: true,
        sent: 0,
        message: "Herkes kendi bölümlerini tamamlamış; gönderilecek hatırlatma yok.",
      });
    }

    const memberById = new Map(members.map((member) => [member.id, member]));
    const appUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const surveyName = survey?.name ?? "Anket";

    let sent = 0;
    const failed: string[] = [];

    for (const row of pending) {
      const member = memberById.get(row.assigneeId);
      if (!member) continue; // birimden ayrılmış olabilir

      const name = [member.firstName, member.lastName].filter(Boolean).join(" ") || "Merhaba";
      const rows = row.sections
        .map(
          (section) =>
            `<tr><td style="padding:6px 12px 6px 0;color:#c9d1d9;">${section.name}</td>` +
            `<td style="padding:6px 0;color:#8b949e;">${section.answeredCount}/${section.questionCount} soru</td></tr>`
        )
        .join("");

      const result = await sendEmail({
        to: member.email,
        subject: `${surveyName} — size atanan bölümler`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#0d1117;padding:24px;border-radius:8px;">
            <p style="color:#c9d1d9;font-size:15px;">${name},</p>
            <p style="color:#c9d1d9;font-size:15px;">
              <strong>${surveyName}</strong> değerlendirmesinde aşağıdaki bölümler size atandı.
              Ankette yalnızca kendi bölümlerinizi görürsünüz.
            </p>
            <table style="margin:16px 0;border-collapse:collapse;">${rows}</table>
            <p style="margin:24px 0;">
              <a href="${appUrl}/survey" style="background:#0cc1c3;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">
                Bölümlerimi doldur
              </a>
            </p>
            <p style="color:#484f58;font-size:12px;">
              Bu hatırlatmayı değerlendirme koordinatörünüz gönderdi.
            </p>
          </div>
        `,
        text:
          `${name}, ${surveyName} değerlendirmesinde size atanan bölümlerde ` +
          `${row.missingQuestions} soru boş: ${row.sections.map((s) => s.name).join(", ")}. ` +
          `${appUrl}/survey`,
      });

      if (result.success) {
        sent++;
      } else {
        failed.push(member.email);
        console.error("Hatırlatma gönderilemedi:", member.email, result.error);
      }
    }

    return NextResponse.json({
      success: true,
      sent,
      failed: failed.length,
      message:
        failed.length > 0
          ? `${sent} kişiye gönderildi, ${failed.length} kişiye gönderilemedi.`
          : `${sent} kişiye hatırlatma gönderildi.`,
    });
  } catch (error) {
    console.error("Error sending assignment reminders:", error);
    return NextResponse.json({ error: "Hatırlatma gönderilemedi" }, { status: 500 });
  }
}
