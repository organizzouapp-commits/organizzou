import type { Metadata } from "next"
import { preconnect } from "react-dom"

export const metadata: Metadata = { title: "Entrar", alternates: { canonical: "/login" } }

// The form is drawn by AuthShell in the (auth) layout.
export default function Page() {
  // The login page only: open the connections the Google button is about to need (Google's own host; the Supabase host that redirects to it).
  preconnect("https://accounts.google.com")
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) preconnect(process.env.NEXT_PUBLIC_SUPABASE_URL.trim())
  return null
}
