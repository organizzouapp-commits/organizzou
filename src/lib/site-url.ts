// THE source of truth for the public address of the site. Every absolute link comes from here: OAuth and e-mail redirects, metadataBase,
// canonical and Open Graph, the sitemap and robots, the passkey defaults and the host redirect. Nothing else builds an origin by hand.
//
// NEXT_PUBLIC_SITE_URL wins (no trailing slash). Without it: a Vercel preview deployment uses its own address, production defaults to
// https://organizzou.com, and development to http://localhost:3000.

export const PRODUCTION_SITE_URL = "https://organizzou.com"
export const DEVELOPMENT_SITE_URL = "http://localhost:3000"

/** Hosts that only exist to send people to the canonical one (permanent redirect in production, see canonical-host.ts). */
export const LEGACY_HOSTS = ["www.organizzou.com", "organizzou.vercel.app"] as const

export type SiteEnv = { NEXT_PUBLIC_SITE_URL?: string; NODE_ENV?: string; VERCEL_ENV?: string; VERCEL_URL?: string }

const clean = (url: string) => url.trim().replace(/\/+$/, "")

export function resolveSiteUrl(env: SiteEnv): string {
  const explicit = env.NEXT_PUBLIC_SITE_URL ? clean(env.NEXT_PUBLIC_SITE_URL) : ""
  if (explicit) return explicit
  if (env.VERCEL_ENV === "preview" && env.VERCEL_URL) return `https://${clean(env.VERCEL_URL)}`
  return env.NODE_ENV === "production" ? PRODUCTION_SITE_URL : DEVELOPMENT_SITE_URL
}

/** The public site URL for this server (NEXT_PUBLIC_* variables are referenced literally so Next.js can inline them in the browser bundle). */
export function getSiteUrl(): string {
  return resolveSiteUrl({
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NODE_ENV: process.env.NODE_ENV,
    VERCEL_ENV: process.env.VERCEL_ENV,
    VERCEL_URL: process.env.VERCEL_URL,
  })
}

/** The host of a URL ("organizzou.com"), used as the default WebAuthn relying party id. */
export const hostOf = (url: string): string => new URL(url).hostname
