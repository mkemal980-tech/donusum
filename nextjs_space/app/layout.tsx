import type { Metadata } from "next";
import { Poppins, Roboto } from "next/font/google";
import "./globals.css";
import Providers from "@/components/providers";

/**
 * Tipografi tek yerden: gövde ve başlık Poppins, sayısal göstergeler Roboto.
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
    <html lang="tr" suppressHydrationWarning>
      <body className={`${poppins.variable} ${roboto.variable}`} suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
