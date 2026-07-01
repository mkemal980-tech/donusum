import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "@/components/providers";

const inter = Inter({ subsets: ["latin"] });

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
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
