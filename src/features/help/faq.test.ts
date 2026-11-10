import { describe, expect, it } from "vitest"

import { FAQ, answerText, filterFaq, normalize } from "./faq"
import { SETTINGS_TABS } from "@/lib/settings-tabs"

describe("filterFaq", () => {
  it("shows everything for an empty or blank search", () => {
    expect(filterFaq(FAQ, "")).toHaveLength(FAQ.length)
    expect(filterFaq(FAQ, "   ")).toHaveLength(FAQ.length)
  })

  it("ignores case and accents", () => {
    expect(filterFaq(FAQ, "CONFIGURACOES").length).toBeGreaterThan(0)
    expect(filterFaq(FAQ, "aparência").map((i) => i.id)).toContain("tema")
  })

  it("looks at the answers, not only the questions", () => {
    expect(filterFaq(FAQ, "lista de espera").map((i) => i.id)).toContain("plano")
  })

  it("needs every word to match", () => {
    expect(filterFaq(FAQ, "tema claro").map((i) => i.id)).toEqual(["tema"])
    expect(filterFaq(FAQ, "tema zzzz")).toEqual([])
  })

  it("is empty for something that is not there", () => {
    expect(filterFaq(FAQ, "xyzxyz")).toEqual([])
  })
})

describe("the FAQ content", () => {
  it("has unique ids and non-empty answers", () => {
    expect(new Set(FAQ.map((i) => i.id)).size).toBe(FAQ.length)
    for (const item of FAQ) expect(answerText(item.a).length).toBeGreaterThan(20)
  })

  it("only links to existing tabs of Configurações or to the privacy policy", () => {
    const tabs = SETTINGS_TABS.map((t) => t.id as string)
    for (const part of FAQ.flatMap((i) => i.a)) {
      if (typeof part === "string") continue
      if (part.href.startsWith("/dashboard/configuracoes")) expect(tabs).toContain(new URL(part.href, "https://x.test").searchParams.get("aba"))
      else expect(part.href).toBe("/politicas#privacidade")
    }
  })

  it("no longer talks about connected banks or removed pages", () => {
    const all = normalize(FAQ.map((i) => `${i.q} ${answerText(i.a)}`).join(" "))
    expect(all).not.toContain("bancos conectados")
    expect(all).not.toContain("pagina plano pro")
  })
})
