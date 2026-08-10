import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Poppins, Roboto, Space_Grotesk } from "next/font/google";
import "./globals.css";
import Providers from "@/components/providers";

/**
 * Tipografi tek yerden — iki tema, iki yazı ailesi.
 *
 * Koyu tema (varsayılan) Poppins + Roboto kullanır; açık "ESG LAB" teması
 * marka kılavuzundaki Space Grotesk + IBM Plex Sans/Mono ile gelir. Hangisinin
 * kullanılacağını globals.css'teki --font-head/--font-body/--font-mono
 * seçer, bileşenler bu üç değişkenden başkasını bilmez.
 *
 * Fontlar Google'dan `@import` ile değil `next/font` ile alınır; dosyalar
 * derlemede uygulamayla birlikte sunulur, dış istek yok. `latin-ext` şart:
 * ğ, ş ve ı yalnızca o alt kümede var, latin ile Türkçe metin yedek fonta
 * düşüyordu.
 *
 * Değişken olarak veriliyorlar — sınıf olarak verilince body'ye yazılan
 * font-family, globals.css'teki kuralı seçici gücüyle eziyordu: sayfa
 * Poppins diyor, tarayıcı başka bir font çiziyordu.
 */
const poppins = Poppins({
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

const roboto = Roboto({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "700"],
  variable: "--font-roboto",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const plexSans = IBM_Plex_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-sans",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});

const fontVariables = [poppins, roboto, spaceGrotesk, plexSans, plexMono]
  .map((font) => font.variable)
  .join(" ");

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Transformation Platform - Strategic Maturity Assessment",
    description: "Comprehensive ESG and Digital Transformation maturity assessment platform for corporate executives and sustainability leaders.",
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg"
    },
    metadataBase: new URL(process.env.NEXTAUTH_URL ?? "http://localhost:3000"),
    openGraph: {
      title: "Transformation Platform",
      description: "Strategic transformation and maturity management platform",
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
    // data-accent marka vurgusunu seçer; data-theme'i next-themes yazar.
    // Font değişkenleri <html> üzerinde: tema token'ları :root'ta tanımlı ve
    // orada --font-poppins gibi bir değişkeni okuyabilmeleri gerekiyor. body'ye
    // konulduğunda :root'taki --font-head geçersize düşüp yazı Times'a iniyordu.
    <html lang="tr" data-accent="orange" className={fontVariables} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
