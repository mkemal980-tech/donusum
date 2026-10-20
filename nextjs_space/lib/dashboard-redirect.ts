import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "./auth-options";

/**
 * Öneriler ve yol haritası tek panonun sekmeleridir; eski sayfa oturum
 * açmış kullanıcıyı panodaki sekmeye gönderir.
 */
export async function redirectToDashboardTab(tab: "recommendations" | "roadmap") {
  const session = await getServerSession(authOptions);
  if (session?.user) redirect("/dashboard?tab=" + tab);
}
