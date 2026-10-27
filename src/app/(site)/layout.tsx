import type { Metadata } from "next"

import { getSiteUrl } from "@/lib/supabase/env"

const TITLE = "Organizzou — Em breve"
const DESCRIPTION = "O app que organiza sua vida: tarefas, finanças, treinos, estudos e um assistente no WhatsApp, num só lugar."

// Public marketing pages: no app shell, only the root providers (theme, toaster, cookie consent).
export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: TITLE,
  description: DESCRIPTION,
  icons: {
    icon: [{ url: "/brand/organizzou-icone.svg", type: "image/svg+xml" }],
    apple: [{ url: "/brand/organizzou-icone-1024.png", sizes: "1024x1024", type: "image/png" }],
  },
  openGraph: { type: "website", locale: "pt_BR", siteName: "Organizzou", title: TITLE, description: DESCRIPTION },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
}

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return children
}
