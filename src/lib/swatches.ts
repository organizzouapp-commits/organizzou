import { z } from "zod"

// The only user-selectable "colors": fixed swatches built from the 6 brand colors
// (CLAUDE.md rule 3). Never a free color picker, never a hex in the database.
export const SWATCH_IDS = ["neutro", "lima", "lima-verso", "tinta-verso", "grafite", "papel"] as const
export const swatchSchema = z.enum(SWATCH_IDS)
export type SwatchId = z.infer<typeof swatchSchema>

type SwatchDefinition = {
  id: SwatchId
  label: string
  /** Fill for dots and stripes. */
  fill: string
  /** Fill + readable text color, for chips that carry text. */
  chip: string
}

export const swatches: Record<SwatchId, SwatchDefinition> = {
  neutro: { id: "neutro", label: "Neutro", fill: "bg-foreground/30", chip: "bg-foreground/10 text-foreground" },
  lima: { id: "lima", label: "Lima", fill: "bg-palette-lima", chip: "bg-palette-lima text-palette-tinta" },
  "lima-verso": {
    id: "lima-verso",
    label: "Lima verso",
    fill: "bg-palette-lima-verso",
    chip: "bg-palette-lima-verso text-palette-tinta",
  },
  "tinta-verso": {
    id: "tinta-verso",
    label: "Tinta verso",
    fill: "bg-palette-tinta-verso",
    chip: "bg-palette-tinta-verso text-palette-papel",
  },
  grafite: {
    id: "grafite",
    label: "Grafite",
    fill: "bg-palette-grafite ring-1 ring-foreground/20",
    chip: "bg-palette-grafite text-palette-papel ring-1 ring-foreground/20",
  },
  papel: {
    id: "papel",
    label: "Papel",
    fill: "bg-palette-papel ring-1 ring-foreground/30",
    chip: "bg-palette-papel text-palette-tinta ring-1 ring-foreground/30",
  },
}

export function isSwatchId(value: string): value is SwatchId {
  return (SWATCH_IDS as readonly string[]).includes(value)
}

export function getSwatch(value: string): SwatchDefinition {
  return isSwatchId(value) ? swatches[value] : swatches.neutro
}
