import type { Metadata } from "next";
import { Barlow, Barlow_Condensed, Inter } from "next/font/google";
import "./globals.css";
import Providers from "@/components/providers";

/**
 * Tipografi tek yerden — tek aile.
 *
 * Uygulama (giriş sonrası tüm ekranlar) Inter kullanır: başlık, gövde, etiket
 * ve sayı aynı aileden gelir; hiyerarşi ağırlık ve ölçekle kurulur, ikinci bir
 * yazı ailesiyle değil (bkz. DESIGN.md > Typography).
 *
 * Tanıtım sayfası kendi kapsamlı sistemine (app/landing.css, .esg-landing)
 * sahip olduğu için Barlow ikilisi orada kalır.
 *
 * `latin-ext` şart: ğ, ş ve ı yalnızca o alt kümede var; latin ile Türkçe
 * metin yedek fonta düşüyordu.
 *
 * Fontlar değişken olarak veriliyor — sınıf olarak verilince body'ye yazılan
 * font-family, globals.css'teki kuralı seçici gücüyle eziyordu.
 */
const inter = Inter({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

/** Tanıtım sayfasının kendi ailesi (bkz. app/landing.css). */
const barlow = Barlow({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "700"],
  variable: "--font-barlow",
  display: "swap",
});

const barlowCondensed = Barlow_Condensed({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "600"],
  variable: "--font-barlow-condensed",
  display: "swap",
});

const fontVariables = [inter, barlow, barlowCondensed]
  .map((font) => font.variable)
  .join(" ");

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Dönüşüm Platformu — Stratejik Olgunluk Değerlendirmesi",
    description:
      "Kurumsal ESG ve dijital dönüşüm olgunluğunu ölçen, kıyaslayan ve yol haritasına çeviren değerlendirme platformu.",
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg"
    },
    metadataBase: new URL(process.env.NEXTAUTH_URL ?? "http://localhost:3000"),
    openGraph: {
      title: "Dönüşüm Platformu",
      description: "Stratejik dönüşüm ve olgunluk yönetimi platformu",
      images: ["/og-image.png"]
    }
  };
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // Tek tema: koyu. data-theme'i next-themes yazar, forcedTheme ile sabit.
    // Font değişkenleri <html> üzerinde: tema token'ları :root'ta tanımlı ve
    // orada --font-inter'ı okuyabilmeleri gerekiyor. body'ye konulduğunda
    // :root'taki --font-body geçersize düşüp yazı Times'a iniyordu.
    <html lang="tr" className={fontVariables} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
