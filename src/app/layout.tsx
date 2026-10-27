import { Suspense } from "react";
import type { Metadata } from "next";
import { Geist_Mono, Outfit } from "next/font/google";
import { LoadingHandoff } from "@/components/organizzou/loading-handoff";
import { CookieConsent } from "@/components/organizzou/cookie-consent";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getSiteUrl } from "@/lib/supabase/env";
import "./globals.css";

// Outfit (Google Fonts, OFL) is the UI font. Surgena lives only inside the logo artwork.
const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const TITLE = { default: "Organizzou - Sua vida organizada", template: "Organizzou - %s" };
const DESCRIPTION = "Sua vida organizada em um só lugar.";

export const metadata: Metadata = {
  // Every absolute URL (canonical, Open Graph, sitemap) comes from NEXT_PUBLIC_SITE_URL.
  metadataBase: new URL(getSiteUrl()),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: "Organizzou",
  icons: {
    icon: [{ url: "/brand/organizzou-icone.svg", type: "image/svg+xml" }],
    apple: [{ url: "/brand/organizzou-icone-1024.png", sizes: "1024x1024", type: "image/png" }],
  },
  openGraph: { type: "website", siteName: "Organizzou", locale: "pt_BR", title: TITLE, description: DESCRIPTION },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${outfit.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster />
          <CookieConsent />
          <Suspense fallback={null}>
            <LoadingHandoff />
          </Suspense>
        </ThemeProvider>
      </body>
    </html>
  );
}
