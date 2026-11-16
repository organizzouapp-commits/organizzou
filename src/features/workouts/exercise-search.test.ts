import { describe, expect, it } from "vitest"

import { exactExercise, exerciseOptions, foldName } from "./exercise-search"

const catalog = [
  { id: "1", name: "Supino reto com barra" },
  { id: "2", name: "Supino inclinado" },
  { id: "3", name: "Remada curvada" },
  { id: "4", name: "Elevação lateral" },
  { id: "5", name: "Agachamento livre" },
]

describe("exerciseOptions", () => {
  it("lists prefix matches before contains matches, ignoring accents and case", () => {
    const options = exerciseOptions(catalog, "lat")
    expect(options.map((o) => o.name)).toEqual(['lat', "Elevação lateral"])
    expect(exerciseOptions(catalog, "ELEVACAO")[1]).toEqual({ kind: "existing", id: "4", name: "Elevação lateral" })
    const sup = exerciseOptions(catalog, "supi")
    expect(sup[0].kind).toBe("create")
    expect(sup.filter((o) => o.kind === "existing").map((o) => o.name)).toEqual(["Supino reto com barra", "Supino inclinado"])
    const reto = exerciseOptions(catalog, "reto")
    expect(reto.map((o) => o.name)).toEqual(["reto", "Supino reto com barra"])
  })
  it("puts prefix before contains", () => {
    const options = exerciseOptions([...catalog, { id: "6", name: "Remada alta" }], "re").filter((o) => o.kind === "existing").map((o) => o.name)
    expect(options.slice(0, 2)).toEqual(["Remada curvada", "Remada alta"])
  })
  it("offers Criar only when there is no exact match", () => {
    expect(exerciseOptions(catalog, "supino inclinado").some((o) => o.kind === "create")).toBe(false)
    expect(exerciseOptions(catalog, "Supino Declinado")[0]).toEqual({ kind: "create", name: "Supino Declinado" })
  })
  it("shows the first exercises for an empty field and trims the typed name", () => {
    expect(exerciseOptions(catalog, "").map((o) => o.kind)).toEqual(Array(5).fill("existing"))
    expect(exerciseOptions(catalog, "  rosca   direta  ")[0]).toEqual({ kind: "create", name: "rosca direta" })
  })
  it("finds the exact exercise", () => {
    expect(exactExercise(catalog, "agachamento LIVRE")?.id).toBe("5")
    expect(exactExercise(catalog, "agachamento")).toBeNull()
    expect(foldName("  Ação  ")).toBe("acao")
  })
})
