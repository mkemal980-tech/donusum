import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "./auth-options";
import { prisma } from "./db";

/**
 * Birime bağlı kullanıcının önerileri ve yol haritası tek panonun
 * sekmeleridir; eski sayfa panodaki sekmeye gider. Birim bilgisi oturumdan
 * değil veritabanından okunur: oturum giriş anında donar.
 */
export async function redirectUnitMemberToDashboard(tab: "recommendations" | "roadmap") {
  const session = await getServerSession(authOptions);
  const id = (session?.user as { id?: string } | undefined)?.id;
  if (!id) return;
  const user = await prisma.user.findUnique({ where: { id }, select: { role: true, unitId: true } });
  if (user?.unitId && user.role !== "ADMIN") redirect("/dashboard?tab=" + tab);
}
