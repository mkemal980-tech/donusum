import { redirect } from "next/navigation";

/** Öneriler tek panonun sekmesidir; eski bağlantılar oraya gider. */
export default function RecommendationsPage() {
  redirect("/dashboard?tab=recommendations");
}
