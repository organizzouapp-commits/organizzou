"use client"

import { useEffect, useRef, useState } from "react"
import { CheckIcon, PlusIcon, Trash2Icon } from "lucide-react"

import { ScrollRow } from "@/components/organizzou/scroll-row"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { BUILT_IN_COLORS, colorLabel, HEX_RE, inkFor, MAX_CUSTOM_COLORS, normalizeHex, resolveHex, type ColorValue } from "@/features/tasks/colors"
import { cn } from "@/lib/utils"

type ColorPickerProps = {
  value: ColorValue
  onChange: (value: ColorValue) => void
  /** Custom colors the person saved (at most 8); they follow the built-in swatches in the same row. */
  custom: string[]
  /** Returns false when the color could not be saved (already there, or the 5 slots are taken). */
  onSaveCustom: (hex: string) => boolean
  onRemoveCustom: (hex: string) => void
  label?: string
  className?: string
}

const SWATCH = "relative flex size-7 shrink-0 items-center justify-center rounded-full outline-none after:absolute after:-inset-2 focus-visible:ring-3 focus-visible:ring-ring/50"

function Swatch({ hex, ink, label, selected, ring, onSelect }: { hex: string | null; ink?: "light" | "dark"; label: string; selected: boolean; ring?: boolean; onSelect: () => void }) {
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
      {selected ? <CheckIcon aria-hidden strokeWidth={2} className={cn("absolute size-4", hex ? (ink === "light" ? "text-palette-papel" : "text-palette-tinta") : "text-foreground")} /> : null}
    </button>
  )
}

/** A saved color: long press (or right click) offers to remove it. */
function CustomSwatch({ id, selected, onSelect, onRemove }: { id: string; selected: boolean; onSelect: () => void; onRemove?: () => void }) {
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
            if (onRemove) timer.current = window.setTimeout(() => ((fired.current = true), setMenu(true)), 550)
          }}
          onPointerUp={() => window.clearTimeout(timer.current)}
          onPointerLeave={() => window.clearTimeout(timer.current)}
          onContextMenu={(e) => onRemove && (e.preventDefault(), setMenu(true))}
        >
          <Swatch hex={resolveHex(id)} ink={inkFor(id)} label={colorLabel(id)} selected={selected} onSelect={() => !fired.current && onSelect()} />
        </span>
      </PopoverAnchor>
      <PopoverContent className="w-auto rounded-2xl p-2" align="start">
        <Button type="button" variant="ghost" className="h-11 gap-2 px-4" onClick={() => (setMenu(false), onRemove?.())}>
          <Trash2Icon strokeWidth={1.75} /> Remover cor {colorLabel(id)}
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
          {full ? `Você já salvou ${MAX_CUSTOM_COLORS} cores. Remova uma (segure ou clique com o botão direito) para salvar outra.` : valid ? "Formato #RRGGBB." : "Use o formato #RRGGBB."}
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
 * The one color picker of Tarefas (tasks, tags, categories, priorities): a single row that never wraps (it scrolls sideways, by touch, drag, wheel or arrow keys,
 * when the container is narrower than the row): "Sem cor" ring, the five default colors, the person's saved colors (and a stored
 * legacy color in use, so it still shows) and a "+" that opens the custom-color panel. 28 px circles, 8 px gap, 44 px hit area.
 */
export function ColorPicker({ value, onChange, custom, onSaveCustom, onRemoveCustom, label = "Cor", className }: ColorPickerProps) {
  const isDefault = BUILT_IN_COLORS.some((c) => c.id === value)
  const current = value ? (resolveHex(value) ?? null) : null
  // A stored value that is neither a default nor saved (an old swatch, a hex from before) is listed after the saved colors.
  const stray = value && !isDefault && current && !custom.includes(value) ? value : null
  return (
    <ScrollRow role="radiogroup" aria-label={label} data-color-row className={cn("flex min-h-11 w-full max-w-full min-w-0 flex-nowrap items-center gap-2 px-1.5 py-2", className)}>
      <Swatch hex={null} ring label="Sem cor" selected={!value} onSelect={() => onChange(null)} />
      {BUILT_IN_COLORS.map((color) => (
        <Swatch key={color.id} hex={color.hex} ink={color.ink} label={color.label} selected={value === color.id} onSelect={() => onChange(color.id)} />
      ))}
      {custom.map((hex) => (
        <CustomSwatch key={hex} id={hex} selected={value !== null && current === normalizeHex(hex) && !isDefault} onSelect={() => onChange(hex)} onRemove={() => onRemoveCustom(hex)} />
      ))}
      {stray ? <CustomSwatch key={stray} id={stray} selected onSelect={() => onChange(stray)} /> : null}
      <CustomPanel
        full={custom.length >= MAX_CUSTOM_COLORS}
        onSave={(hex) => {
          const value = normalizeHex(hex)
          const saved = onSaveCustom(value)
          if (saved || custom.includes(value)) onChange(value)
          return saved || custom.includes(value)
        }}
      />
    </ScrollRow>
  )
}
