// NEXT_PUBLIC_* variables must be referenced literally so Next.js can inline them in the browser bundle.
export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!url || !anonKey) {
    throw new Error(
      "Supabase não configurado: defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY (ou NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) em .env.local e reinicie o servidor."
    )
  }

  return { url, anonKey }
}

/**
 * Base URL for every absolute link (OAuth redirect, e-mail links, Open Graph, canonical, sitemap). NEXT_PUBLIC_SITE_URL wins.
 * On Vercel, when it is missing, the production domain / deployment URL that Vercel provides is used instead of localhost, so a
 * forgotten variable never bakes http://localhost:3000 into e-mails and metadata.
 */
export function getSiteUrl() {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL
  if (explicit) return explicit
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL
  return vercel ? `https://${vercel}` : "http://localhost:3000"
}
