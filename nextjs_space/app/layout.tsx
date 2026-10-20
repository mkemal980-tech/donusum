import type { Metadata } from "next";
import {
  Barlow,
  Barlow_Condensed,
  IBM_Plex_Mono,
  IBM_Plex_Sans,
  Inter,
  Space_Grotesk,
} from "next/font/google";
import "./globals.css";
import Providers from "@/components/providers";

/**
 * Tipografi tek yerden.
 *
 * Uygulama (giriş, kayıt ve giriş sonrası tüm ekranlar) iso2app'in üç
 * ailesini kullanır: gövde IBM Plex Sans, başlık ve KPI değerleri Space
 * Grotesk, etiket/kod/tablo sayıları IBM Plex Mono (bkz. DESIGN.md >
 * Typography). next/font dosyaları derlemede indirip kendi sunucumuzdan
 * verir; tarayıcı Google'a gitmez.
 *
 * Tanıtım sayfası kendi kapsamlı sistemine (app/landing.css, .esg-landing)
 * sahip olduğu için Inter ve Barlow ikilisi orada kalır.
 *
 * `latin-ext` şart: ğ, ş ve ı yalnızca o alt kümede var; latin ile Türkçe
 * metin yedek fonta düşüyordu.
 *
 * Fontlar değişken olarak veriliyor — sınıf olarak verilince body'ye yazılan
 * font-family, globals.css'teki kuralı seçici gücüyle eziyordu.
 */
const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ibm-plex-sans",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600", "700"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
  variable: "--font-ibm-plex-mono",
  display: "swap",
});

/** Tanıtım sayfasının ailesi (bkz. app/landing.css). */
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

const fontVariables = [ibmPlexSans, spaceGrotesk, ibmPlexMono, inter, barlow, barlowCondensed]
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
    // Açık tema varsayılandır; data-theme'i next-themes kullanıcı tercihine
    // göre yazar ve seçimi cihazda saklar.
    // Font değişkenleri <html> üzerinde: tema token'ları :root'ta tanımlı ve
    // orada --font-ibm-plex-sans'ı okuyabilmeleri gerekiyor. body'ye konulduğunda
    // :root'taki --font-body geçersize düşüp yazı Times'a iniyordu.
    <html lang="tr" className={fontVariables} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
