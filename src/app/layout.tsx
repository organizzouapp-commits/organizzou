import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import { CookieConsent } from "@/components/organizzou/cookie-consent";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

// Surgena (the logo typeface) is the UI font. Single SemiBold file registered as 600; every weight maps to it.
// Personal-use license: a commercial web-font license is required before launch (DESIGN-SYSTEM §4).
const surgena = localFont({
  src: "../fonts/Surgena-SemiBold.woff2",
  weight: "600",
  style: "normal",
  variable: "--font-surgena",
  display: "swap",
  fallback: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Organizzou",
  description: "Sua vida organizada em um só lugar.",
  icons: { icon: "/brand/organizzou-icone.svg" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${surgena.variable} ${geistMono.variable} h-full antialiased`}
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
        </ThemeProvider>
      </body>
    </html>
  );
}
