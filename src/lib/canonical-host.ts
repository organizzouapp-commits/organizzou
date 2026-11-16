// One address per site: in production, www.organizzou.com and the old organizzou.vercel.app send people (and links) to https://organizzou.com
// with a permanent 308, keeping the path and the query. Preview deployments, localhost and development are never redirected, and neither are
// the machine-to-machine routes (the scheduled job and push), which must answer on any host.
import { LEGACY_HOSTS, PRODUCTION_SITE_URL } from "./site-url"

export type HostRedirectInput = {
  /** The Host header. */
  host: string | null | undefined
  pathname: string
  /** Including the leading "?", or empty. */
  search: string
  /** VERCEL_ENV: only "production" redirects. */
  vercelEnv: string | undefined
  /** The resolved site URL (getSiteUrl()). */
  siteUrl: string
}

/** Paths that keep answering on every host. */
export const NEVER_REDIRECT_PREFIXES = ["/api/cron/", "/api/push"]

/** The permanent redirect target, or null when the request should be served as it is. */
export function canonicalRedirect({ host, pathname, search, vercelEnv, siteUrl }: HostRedirectInput): string | null {
  if (vercelEnv !== "production") return null
  // Only when the site really is organizzou.com: with another configured URL a redirect could point somewhere wrong or loop.
  if (siteUrl !== PRODUCTION_SITE_URL) return null
  const bare = (host ?? "").toLowerCase().replace(/:\d+$/, "")
  if (!(LEGACY_HOSTS as readonly string[]).includes(bare)) return null
  if (NEVER_REDIRECT_PREFIXES.some((prefix) => pathname === prefix.replace(/\/$/, "") || pathname.startsWith(prefix))) return null
  return `${PRODUCTION_SITE_URL}${pathname}${search}`
}
