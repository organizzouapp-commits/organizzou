import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import vm from "node:vm"

import { describe, expect, it } from "vitest"

// public/sw.js is the file the browser really runs, so the test runs that very file with a mock worker scope and mock events.
const source = readFileSync(join(process.cwd(), "public", "sw.js"), "utf8")

type Shown = { title: string; options: Record<string, unknown> }

function load() {
  const handlers: Record<string, (event: unknown) => void> = {}
  const shown: Shown[] = []
  const posted: Record<string, unknown>[] = []
  const opened: string[] = []
  let failFirstShow = false
  const windows = [{ url: "https://organizzou.com/dashboard", focus: async () => "focused", navigate: async (...args: string[]): Promise<unknown> => void args, postMessage: (m: Record<string, unknown>) => posted.push(m) }]
  const scope = {
    location: { origin: "https://organizzou.com" },
    clients: { claim: async () => undefined, matchAll: async () => windows, openWindow: async (url: string) => void opened.push(url) },
    registration: {
      showNotification: async (title: string, options: Record<string, unknown>) => {
        if (failFirstShow && shown.length === 0) {
          shown.push({ title: "(refused)", options })
          throw Object.assign(new Error("bad option"), { name: "TypeError" })
        }
        shown.push({ title, options })
      },
    },
    skipWaiting: () => undefined,
    addEventListener: (name: string, handler: (event: unknown) => void) => void (handlers[name] = handler),
  }
  vm.runInNewContext(source, { self: scope, URL, Promise, console })
  const push = async (payload: unknown, raw?: string) => {
    let pending: Promise<unknown> = Promise.resolve()
    const data = raw !== undefined ? { json: () => JSON.parse(raw), text: () => raw } : { json: () => payload, text: () => JSON.stringify(payload) }
    handlers.push({ data, waitUntil: (p: Promise<unknown>) => void (pending = p) })
    await pending
  }
  return { handlers, shown, posted, opened, push, windows, failFirstShow: () => void (failFirstShow = true) }
}

describe("the push handler", () => {
  it("shows a noticeable notification: never silent, vibrates, stable tag with renotify, icon and badge", async () => {
    const sw = load()
    await sw.push({ title: "Lembrete", body: "Pagar a conta", url: "/dashboard/agenda", tag: "reminders:abc" })
    expect(sw.shown).toHaveLength(1)
    const { title, options } = sw.shown[0]
    expect(title).toBe("Lembrete")
    expect(options).toMatchObject({ body: "Pagar a conta", icon: "/brand/pwa-192.png", badge: "/brand/pwa-badge-96.png", vibrate: [100, 50, 100], tag: "reminders:abc", renotify: true, requireInteraction: false, lang: "pt-BR", data: { url: "/dashboard/agenda" } })
    expect(options).not.toHaveProperty("silent")
  })

  it("the banner stays until clicked only when the push says sticky (the test, reminders with a due time)", async () => {
    const sw = load()
    await sw.push({ title: "Organizzou", body: "Teste", url: "/dashboard", tag: "test", sticky: true })
    await sw.push({ title: "Hábitos", body: "Resumo", url: "/dashboard/rotina", tag: "habits" })
    expect(sw.shown[0].options.requireInteraction).toBe(true)
    expect(sw.shown[1].options.requireInteraction).toBe(false)
  })

  it("without a tag it still uses a stable one (made from the destination) with renotify, which is what keeps showNotification from throwing", async () => {
    const sw = load()
    await sw.push({ title: "A", body: "b", url: "/dashboard/financas" })
    await sw.push({ title: "A", body: "b", url: "/dashboard/financas" })
    expect(sw.shown[0].options.tag).toBe("org:/dashboard/financas")
    expect(sw.shown[1].options.tag).toBe(sw.shown[0].options.tag)
    expect(sw.shown[0].options.renotify).toBe(true)
  })

  it("only same-site paths are used as the destination, and an unreadable payload still shows something", async () => {
    const sw = load()
    await sw.push({ title: "x", body: "y", url: "https://evil.example/phish" })
    expect((sw.shown[0].options.data as { url: string }).url).toBe("/dashboard")
    await sw.push(undefined, "texto simples, não é JSON {")
    expect(sw.shown[1].title).toBe("Organizzou")
    expect(sw.shown[1].options.body).toContain("texto simples")
  })

  it("tells the open pages what happened (for the debug panel) and falls back to a plain notification when an option is refused", async () => {
    const sw = load()
    await sw.push({ title: "ok", body: "b", url: "/dashboard" })
    expect(sw.posted.map((m) => m.stage)).toEqual(["received", "shown"])
    const refused = load()
    refused.failFirstShow()
    await refused.push({ title: "ok", body: "b", url: "/dashboard" })
    expect(refused.posted.map((m) => m.stage)).toEqual(["received", "error"])
    expect(refused.posted[1]).toMatchObject({ detail: "TypeError" })
    expect(refused.shown.at(-1)).toMatchObject({ title: "ok", options: { body: "b", data: { url: "/dashboard" } } })
  })

  it("the icons it points to exist in public/", () => {
    for (const path of ["brand/pwa-192.png", "brand/pwa-badge-96.png"]) expect(existsSync(join(process.cwd(), "public", path)), path).toBe(true)
  })
})

describe("the notification click (unchanged)", () => {
  it("closes the notification, focuses an open Organizzou window and navigates it", async () => {
    const sw = load()
    let closed = false
    let pending: Promise<unknown> = Promise.resolve()
    const navigated: string[] = []
    sw.windows[0].navigate = async (...args: string[]) => void navigated.push(args[0])
    sw.handlers.notificationclick({ notification: { close: () => void (closed = true), data: { url: "/dashboard/agenda" } }, waitUntil: (p: Promise<unknown>) => void (pending = p) })
    await expect(pending).resolves.toBe("focused")
    expect(closed).toBe(true)
    expect(navigated).toEqual(["https://organizzou.com/dashboard/agenda"])
  })
  it("opens a new window when none is open", async () => {
    const sw = load()
    sw.windows.length = 0
    let pending: Promise<unknown> = Promise.resolve()
    sw.handlers.notificationclick({ notification: { close: () => undefined, data: { url: "/dashboard" } }, waitUntil: (p: Promise<unknown>) => void (pending = p) })
    await pending
    expect(sw.opened).toEqual(["https://organizzou.com/dashboard"])
  })
})
