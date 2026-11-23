import { describe, expect, it } from "vitest"

import { MODULE_BENEFITS, moduleForPath } from "./plan-routes"
import { canUse, PRO_FEATURES } from "./plans"

describe("which pages the plan locks", () => {
  it("the nine life modules are Pro, with their sub-routes", () => {
    for (const [path, name] of [
      ["/dashboard/agenda", "Agenda"],
      ["/dashboard/rotina", "Rotina"],
      ["/dashboard/treinos", "Treinos"],
      ["/dashboard/dieta", "Dieta"],
      ["/dashboard/estudos", "Estudos"],
      ["/dashboard/notas", "Notas e lembretes"],
      ["/dashboard/metas", "Metas"],
      ["/dashboard/diario", "Diário"],
      ["/dashboard/cofre", "Cofre"],
    ] as const) {
      expect(moduleForPath(path)?.name).toBe(name)
      expect(moduleForPath(`${path}/algo`)?.name).toBe(name)
    }
  })
  it("Hoje, Tarefas, Finanças, Configurações and Ajuda stay open", () => {
    for (const path of ["/dashboard", "/dashboard/tarefas", "/dashboard/tarefas/abc", "/dashboard/financas", "/dashboard/configuracoes", "/dashboard/ajuda", "/dashboard/agendamento-falso"]) expect(moduleForPath(path)).toBeNull()
  })
  it("every locked module is a Pro feature with three benefits", () => {
    for (const path of ["agenda", "rotina", "treinos", "dieta", "estudos", "notas", "metas", "diario", "cofre"]) {
      const found = moduleForPath(`/dashboard/${path}`)!
      expect(PRO_FEATURES).toContain(found.feature)
      expect(canUse("free", found.feature)).toBe(false)
      expect(canUse("pro", found.feature)).toBe(true)
      expect(MODULE_BENEFITS[found.feature]).toHaveLength(3)
    }
  })
})
