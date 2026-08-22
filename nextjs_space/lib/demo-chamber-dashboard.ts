/**
 * Süper yöneticiye gösterilen kurgu ticaret odası demosu.
 *
 * Bu veri hiçbir müşteri, kullanıcı veya değerlendirme kaydından okunmaz. Demo
 * ekranı gerçek sisteme veri yazmadan ürünün 2.000 yanıtlık bir kampanyada
 * nasıl görüneceğini anlatabilsin diye sayılar burada sabit tutulur.
 */
export const demoChamberDashboard = {
  organization: {
    name: "Marmara Ticaret Odası",
    type: "Ticaret odası",
    memberCount: 2480,
  },
  campaign: {
    name: "2026 Üye Sürdürülebilirlik Olgunluk Araştırması",
    status: "Aktif",
    privacyMode: "Anonim sonuçlar",
    launchedAt: "03 Ağustos 2026",
    deadline: "31 Ağustos 2026",
    lastUpdatedAt: "22 Ağustos 2026, 14:30",
    questionCount: 72,
  },
  participation: {
    invited: 2480,
    submitted: 2000,
    inProgress: 260,
    notStarted: 220,
    completionRate: 80.6,
  },
  results: {
    overallScore: 63.8,
    medianScore: 65,
    leadingMaturity: "Gelişen",
    benchmarkDifference: 4.6,
  },
  responseTrend: [
    { label: "03 Ağu", cumulative: 118 },
    { label: "06 Ağu", cumulative: 354 },
    { label: "09 Ağu", cumulative: 620 },
    { label: "12 Ağu", cumulative: 940 },
    { label: "15 Ağu", cumulative: 1225 },
    { label: "17 Ağu", cumulative: 1470 },
    { label: "19 Ağu", cumulative: 1650 },
    { label: "20 Ağu", cumulative: 1805 },
    { label: "21 Ağu", cumulative: 1902 },
    { label: "22 Ağu", cumulative: 2000 },
  ],
  categories: [
    { name: "İklim ve enerji", score: 71, benchmark: 66, change: 7.2 },
    { name: "Çalışanlar ve sosyal etki", score: 69, benchmark: 64, change: 5.6 },
    { name: "Yönetişim ve raporlama", score: 64, benchmark: 61, change: 4.1 },
    { name: "Döngüsellik ve kaynaklar", score: 62, benchmark: 60, change: 3.8 },
    { name: "Sürdürülebilir tedarik", score: 59, benchmark: 58, change: 2.7 },
    { name: "Su yönetimi", score: 56, benchmark: 57, change: 1.9 },
  ],
  maturityDistribution: [
    { label: "Başlangıç", count: 162, percentage: 8.1, color: "var(--series-5)" },
    { label: "Farkındalık", count: 410, percentage: 20.5, color: "var(--series-3)" },
    { label: "Gelişen", count: 704, percentage: 35.2, color: "var(--series-1)" },
    { label: "Olgun", count: 548, percentage: 27.4, color: "var(--series-2)" },
    { label: "Lider", count: 176, percentage: 8.8, color: "var(--series-4)" },
  ],
  sectors: [
    { name: "İmalat", responses: 476, score: 65.8, participation: 84 },
    { name: "Toptan ve perakende", responses: 404, score: 60.4, participation: 78 },
    { name: "Hizmetler", responses: 346, score: 64.9, participation: 82 },
    { name: "İnşaat", responses: 258, score: 58.7, participation: 75 },
    { name: "Gıda", responses: 232, score: 66.2, participation: 86 },
    { name: "Lojistik", responses: 174, score: 61.1, participation: 79 },
    { name: "Bilgi teknolojileri", responses: 110, score: 73.6, participation: 91 },
  ],
  companySizes: [
    { label: "Mikro (1–9)", count: 620, score: 56.8 },
    { label: "Küçük (10–49)", count: 600, score: 61.7 },
    { label: "Orta (50–249)", count: 510, score: 68.5 },
    { label: "Büyük (250+)", count: 270, score: 75.2 },
  ],
  insights: [
    {
      title: "Enerji çalışmaları öne çıkıyor",
      description: "İklim ve enerji 71 puanla en güçlü alan. Üyelerin %62'si tüketimini düzenli izlediğini belirtiyor.",
      tone: "success",
    },
    {
      title: "Emisyon envanteri yaygın değil",
      description: "Yalnızca 680 üye (%34) kurumsal sera gazı envanteri hazırlamış durumda.",
      tone: "warning",
    },
    {
      title: "Tedarik zincirinde gelişim alanı var",
      description: "920 üye (%46) tedarikçi seçiminde sürdürülebilirlik ölçütü kullandığını bildiriyor.",
      tone: "accent",
    },
    {
      title: "Su yönetimi önceliklendirilmeli",
      description: "580 üyenin (%29) belgelenmiş su azaltım hedefi bulunuyor; en düşük kategori puanı 56.",
      tone: "danger",
    },
  ],
} as const;

export type DemoChamberDashboard = typeof demoChamberDashboard;
