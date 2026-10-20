import { redirect } from "next/navigation";

/** Yol haritası tek panonun sekmesidir; eski bağlantılar oraya gider. */
export default function RoadmapPage() {
  redirect("/dashboard?tab=roadmap");
}
