"use client"

import { useEffect, useRef, useState } from "react"
import { CheckIcon, PlusIcon, Trash2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { BUILT_IN_COLORS, colorLabel, HEX_RE, MAX_CUSTOM_COLORS, normalizeHex, resolveHex, type ColorValue } from "@/features/tasks/colors"
import { cn } from "@/lib/utils"

type ColorPickerProps = {
  value: ColorValue
  onChange: (value: ColorValue) => void
  /** Custom colors the person saved (at most 5); they follow the built-in swatches in the same row. */
  custom: string[]
  /** Returns false when the color could not be saved (already there, or the 5 slots are taken). */
  onSaveCustom: (hex: string) => boolean
  onRemoveCustom: (hex: string) => void
  label?: string
  className?: string
}

const SWATCH = "relative flex size-7 shrink-0 items-center justify-center rounded-full outline-none after:absolute after:-inset-2 focus-visible:ring-3 focus-visible:ring-ring/50"

/** A check that stays readable on any fill: dark ink on light colors, light ink on dark ones. */
function checkTone(hex: string) {
  const n = parseInt(hex.slice(1), 16)
  const lin = (v: number) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  const luminance = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255)
  return luminance > 0.4 ? "text-palette-tinta" : "text-palette-papel"
}

function Swatch({ hex, label, selected, ring, onSelect }: { hex: string | null; label: string; selected: boolean; ring?: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={label}
      title={label}
      data-swatch={label}
      onClick={onSelect}
      className={cn(SWATCH, selected && "outline-2 outline-offset-2 outline-foreground")}
    >
      <span aria-hidden className={cn("size-7 rounded-full", ring ? "border-2 border-foreground/50" : "ring-1 ring-foreground/25")} style={hex ? { backgroundColor: hex } : undefined} />
      {selected ? <CheckIcon aria-hidden strokeWidth={2} className={cn("absolute size-4", hex ? checkTone(hex) : "text-foreground")} /> : null}
    </button>
  )
}

/** A saved color: long press (or right click) offers to remove it. */
function CustomSwatch({ hex, selected, onSelect, onRemove }: { hex: string; selected: boolean; onSelect: () => void; onRemove: () => void }) {
  const [menu, setMenu] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  const fired = useRef(false)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  return (
    <Popover open={menu} onOpenChange={setMenu}>
      <PopoverAnchor asChild>
        <span
          className="shrink-0"
          onPointerDown={() => {
            fired.current = false
            window.clearTimeout(timer.current)
            timer.current = window.setTimeout(() => ((fired.current = true), setMenu(true)), 550)
          }}
          onPointerUp={() => window.clearTimeout(timer.current)}
          onPointerLeave={() => window.clearTimeout(timer.current)}
          onContextMenu={(e) => (e.preventDefault(), setMenu(true))}
        >
          <Swatch hex={hex} label={`Cor ${hex}`} selected={selected} onSelect={() => !fired.current && onSelect()} />
        </span>
      </PopoverAnchor>
      <PopoverContent className="w-auto rounded-2xl p-2" align="start">
        <Button type="button" variant="ghost" className="h-11 gap-2 px-4" onClick={() => (setMenu(false), onRemove())}>
          <Trash2Icon strokeWidth={1.75} /> Remover cor {hex}
        </Button>
      </PopoverContent>
    </Popover>
  )
}

function CustomPanel({ full, onSave }: { full: boolean; onSave: (hex: string) => boolean }) {
  const [open, setOpen] = useState(false)
  const [hex, setHex] = useState("#DBFD00")
  const valid = HEX_RE.test(hex)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" aria-label="Adicionar cor personalizada" title="Cor personalizada" data-swatch="Adicionar" className={SWATCH}>
          <span aria-hidden className="flex size-7 items-center justify-center rounded-full border-2 border-dashed border-foreground/50 text-foreground">
            <PlusIcon strokeWidth={2} className="size-3.5" />
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" collisionPadding={16} className="flex w-64 flex-col gap-3 rounded-2xl p-3" data-testid="custom-color-panel">
        <div className="flex items-center gap-3">
          <input
            type="color"
            aria-label="Escolher a cor"
            value={valid ? hex.toLowerCase() : "#000000"}
            onChange={(e) => setHex(normalizeHex(e.target.value))}
            className="size-11 shrink-0 cursor-pointer rounded-full border border-border bg-transparent p-0.5"
          />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <Input
              value={hex}
              maxLength={7}
              inputMode="text"
              aria-label="Código da cor (#RRGGBB)"
              aria-invalid={!valid}
              aria-describedby="hex-hint"
              onChange={(e) => setHex(`#${e.target.value.replace(/[^0-9a-fA-F]/g, "").slice(0, 6)}`.toUpperCase())}
              className="h-11 font-mono tabular-nums"
            />
          </div>
        </div>
        <p id="hex-hint" className={cn("text-[13px] leading-5", valid ? "text-muted-foreground" : "font-medium text-foreground")}>
          {full ? `Você já salvou ${MAX_CUSTOM_COLORS} cores. Remova uma (segure) para salvar outra.` : valid ? "Formato #RRGGBB." : "Use o formato #RRGGBB."}
        </p>
        <Button
          type="button"
          disabled={!valid || full}
          className="h-11"
          onClick={() => {
            if (onSave(hex)) setOpen(false)
          }}
        >
          Salvar cor
        </Button>
      </PopoverContent>
    </Popover>
  )
}

/**
 * The one color picker of Tarefas: a single horizontal row that never wraps (it scrolls sideways when the container is narrow):
 * "Sem cor" ring, the built-in swatches, the person's saved colors and a "+" that opens the custom-color panel.
 */
export function ColorPicker({ value, onChange, custom, onSaveCustom, onRemoveCustom, label = "Cor", className }: ColorPickerProps) {
  const current = value ? (resolveHex(value) ?? null) : null
  return (
    <div role="radiogroup" aria-label={label} data-color-row className={cn("no-scrollbar flex min-h-11 flex-nowrap items-center gap-2 overflow-x-auto px-1.5 py-2", className)}>
      <Swatch hex={null} ring label="Sem cor" selected={!value} onSelect={() => onChange(null)} />
      {BUILT_IN_COLORS.map((color) => (
        <Swatch key={color.id} hex={color.hex} label={colorLabel(color.id)} selected={value === color.id} onSelect={() => onChange(color.id)} />
      ))}
      {custom.map((hex) => (
        <CustomSwatch
          key={hex}
          hex={hex}
          selected={Boolean(current) && current === hex && value !== null && !BUILT_IN_COLORS.some((c) => c.id === value)}
          onSelect={() => onChange(hex)}
          onRemove={() => onRemoveCustom(hex)}
        />
      ))}
      <CustomPanel
        full={custom.length >= MAX_CUSTOM_COLORS}
        onSave={(hex) => {
          const saved = onSaveCustom(hex)
          if (saved) onChange(normalizeHex(hex))
          return saved
        }}
      />
    </div>
  )
}
