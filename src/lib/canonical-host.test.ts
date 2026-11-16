import { describe, expect, it } from "vitest"

import { canonicalRedirect } from "./canonical-host"
import { PRODUCTION_SITE_URL, resolveSiteUrl } from "./site-url"

const base = { pathname: "/dashboard/tarefas", search: "?filtro=hoje", vercelEnv: "production", siteUrl: PRODUCTION_SITE_URL }

describe("canonicalRedirect", () => {
  it("sends the old vercel.app host and www to https://organizzou.com, keeping path and query", () => {
    expect(canonicalRedirect({ ...base, host: "organizzou.vercel.app" })).toBe("https://organizzou.com/dashboard/tarefas?filtro=hoje")
    expect(canonicalRedirect({ ...base, host: "www.organizzou.com" })).toBe("https://organizzou.com/dashboard/tarefas?filtro=hoje")
    expect(canonicalRedirect({ ...base, host: "WWW.Organizzou.com:443", pathname: "/", search: "" })).toBe("https://organizzou.com/")
  })

  it("leaves the canonical host, previews, localhost and other hosts alone", () => {
    expect(canonicalRedirect({ ...base, host: "organizzou.com" })).toBeNull()
    expect(canonicalRedirect({ ...base, host: "organizzou-git-feature-x.vercel.app" })).toBeNull()
    expect(canonicalRedirect({ ...base, host: "localhost:3000" })).toBeNull()
    expect(canonicalRedirect({ ...base, host: undefined })).toBeNull()
  })

  it("never redirects a preview deployment or development, even on a legacy host name", () => {
    expect(canonicalRedirect({ ...base, host: "organizzou.vercel.app", vercelEnv: "preview" })).toBeNull()
    expect(canonicalRedirect({ ...base, host: "organizzou.vercel.app", vercelEnv: "development" })).toBeNull()
    expect(canonicalRedirect({ ...base, host: "organizzou.vercel.app", vercelEnv: undefined })).toBeNull()
  })

  it("keeps the cron and push routes working on any host", () => {
    expect(canonicalRedirect({ ...base, host: "organizzou.vercel.app", pathname: "/api/cron/notifications", search: "" })).toBeNull()
    expect(canonicalRedirect({ ...base, host: "www.organizzou.com", pathname: "/api/push/subscribe", search: "" })).toBeNull()
    expect(canonicalRedirect({ ...base, host: "organizzou.vercel.app", pathname: "/api/passkey/login-options", search: "" })).not.toBeNull()
  })

  it("does nothing when the configured site is not organizzou.com (no loops, no wrong targets)", () => {
    expect(canonicalRedirect({ ...base, host: "organizzou.vercel.app", siteUrl: "https://organizzou.vercel.app" })).toBeNull()
  })
})

describe("resolveSiteUrl", () => {
  it("NEXT_PUBLIC_SITE_URL wins and loses its trailing slash", () => {
    expect(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: "https://organizzou.com/", NODE_ENV: "production" })).toBe("https://organizzou.com")
  })
  it("defaults to https://organizzou.com in production and localhost in development", () => {
    expect(resolveSiteUrl({ NODE_ENV: "production", VERCEL_ENV: "production", VERCEL_URL: "organizzou-abc.vercel.app" })).toBe("https://organizzou.com")
    expect(resolveSiteUrl({ NODE_ENV: "development" })).toBe("http://localhost:3000")
    expect(resolveSiteUrl({})).toBe("http://localhost:3000")
  })
  it("a preview deployment uses its own address when nothing is configured", () => {
    expect(resolveSiteUrl({ NODE_ENV: "production", VERCEL_ENV: "preview", VERCEL_URL: "organizzou-git-x.vercel.app" })).toBe("https://organizzou-git-x.vercel.app")
  })
})
