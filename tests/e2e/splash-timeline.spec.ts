/**
 * Prints the timeline of the e-mail hand-off from the ?splashDebug=1 log: when the client navigation was asked for, when the route committed,
 * when the dashboard shell mounted, when the first data painted, and when the overlay left (and why). Not an assertion: a measuring tool.
 *   PROTOTYPE_BYPASS_AUTH=1 NEXT_DIST_DIR=.next-preview npx next dev -p 3100 ; npx playwright test splash-timeline
 */
import { test } from "@playwright/test"

const CONSENT = encodeURIComponent(JSON.stringify({ version: 1, necessary: true, analytics: false, marketing: false, decidedAt: new Date().toISOString() }))

test("timeline of the hand-off", async ({ page, context, baseURL }) => {
  test.setTimeout(120000)
  await context.addCookies([{ name: "organizzou_consent", value: CONSENT, url: baseURL! }])
  await page.goto("/login?splashDebug=1")
  await page.waitForFunction(() => Boolean((window as unknown as { __startLoadingHandoff?: unknown }).__startLoadingHandoff))
  await page.evaluate(() => sessionStorage.removeItem("splashLog"))
  await page.evaluate(() => (window as unknown as { __startLoadingHandoff: (href: string) => void }).__startLoadingHandoff("/dashboard"))
  await page.waitForFunction(() => JSON.parse(sessionStorage.getItem("splashLog") ?? "[]").some((e: { ev: string }) => e.ev === "handoff-removed"), undefined, { timeout: 90000 })
  const log = (await page.evaluate(() => JSON.parse(sessionStorage.getItem("splashLog") ?? "[]"))) as { ev: string; date: number; path: string; x: unknown }[]
  const t0 = log.find((e) => e.ev === "handoff-start")?.date ?? log[0].date
  console.log("TIMELINE\n" + log.filter((e) => e.ev !== "due").map((e) => `${String(e.date - t0).padStart(6)}ms  ${e.path.padEnd(11)} ${e.ev} ${e.x ? JSON.stringify(e.x) : ""}`).join("\n"))
})
