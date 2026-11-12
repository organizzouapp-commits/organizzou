// Web push, the parts that need no browser and no server: a readable name for a device, the VAPID key conversion, and what a subscription
// looks like when it reaches the server. Pure, so it is tested.
import { z } from "zod"

/** "Chrome no Android", "Safari no iPhone"... from the user agent. Only a label for the list of devices: nothing else is read from it. */
export function deviceLabel(userAgent: string): string {
  const ua = userAgent || ""
  const os = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS X|Macintosh/.test(ua) ? "Mac" : /Linux|X11/.test(ua) ? "Linux" : null
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\/|Opera/.test(ua) ? "Opera" : /Firefox|FxiOS/.test(ua) ? "Firefox" : /Chrome|CriOS/.test(ua) ? "Chrome" : /Safari/.test(ua) ? "Safari" : null
  if (browser && os) return `${browser} no ${os}`
  return browser ?? os ?? "Este aparelho"
}

/** A VAPID public key (base64url) as the bytes PushManager.subscribe wants. */
export function urlBase64ToUint8Array(value: string): Uint8Array<ArrayBuffer> {
  const padded = value + "=".repeat((4 - (value.length % 4)) % 4)
  const raw = atob(padded.replace(/-/g, "+").replace(/_/g, "/"))
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

export type PushSupport = "supported" | "denied" | "unsupported" | "ios-needs-install"

/** What this browser can do, from plain facts (so it is testable): does it have the APIs, is it an iPhone/iPad outside the installed app. */
export function pushSupport(facts: { hasApis: boolean; permission: "default" | "granted" | "denied"; userAgent: string; standalone: boolean }): PushSupport {
  const ios = /iPhone|iPad|iPod/.test(facts.userAgent)
  if (!facts.hasApis) return ios && !facts.standalone ? "ios-needs-install" : "unsupported"
  if (facts.permission === "denied") return "denied"
  return "supported"
}

/** What the browser hands over after subscribing; validated again on the server before it is stored. */
export const subscriptionSchema = z.object({
  endpoint: z.url().max(1000).refine((value) => value.startsWith("https://"), "O endereço do aparelho precisa ser https."),
  keys: z.object({ p256dh: z.string().min(20).max(200), auth: z.string().min(8).max(100) }),
  userAgent: z.string().max(300).optional(),
})
export type PushSubscriptionInput = z.infer<typeof subscriptionSchema>
