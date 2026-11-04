"use client"

import { Children } from "react"
import {
  ArrowUpRightIcon,
  BanknoteIcon,
  CarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClapperboardIcon,
  EllipsisIcon,
  GiftIcon,
  GraduationCapIcon,
  HeartPulseIcon,
  HouseIcon,
  LaptopIcon,
  PencilIcon,
  PiggyBankIcon,
  PlaneIcon,
  RepeatIcon,
  ShieldCheckIcon,
  ShoppingCartIcon,
  SmartphoneIcon,
  TagIcon,
  Trash2Icon,
  UtensilsIcon,
  CircleDollarSignIcon,
  type LucideIcon,
} from "lucide-react"

import { useLabelColors } from "@/components/tasks/label-colors-context"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { SwipeRow } from "@/components/organizzou/SwipeRow"
import type { GoalIconKey } from "@/features/finance/goal-icons"
import { resolveHex, tintStyle } from "@/features/tasks/colors"
import { formatBalance, formatBRL } from "@/lib/money"
import { cn } from "@/lib/utils"

/** Every card of the area: list cards are radius 14, summary cards radius 20 (the Hoje / Tarefas / Agenda sizes). */
export const LIST_CARD = "rounded-[14px] border border-border bg-card"
export const SUMMARY_CARD = "rounded-[20px] border border-border bg-card"

// ------------------------------------------------------------------ money

/**
 * Money, always tabular and never truncated. `tone="in"` is an income ("+ R$ 5.000,00", Lima on dark, Tinta verso on Papel: Lima never
 * becomes text on a light surface), `"out"` an expense ("− R$ 45,00", the default text), `"value"` a balance that can be negative.
 */
export function MoneyText({ cents, tone = "plain", dimDecimals = false, className }: { cents: number; tone?: "plain" | "in" | "out" | "value"; /** The cents at ~50% opacity ("R$ 32.161" + ",80"), for the big numbers of the bento cards. */ dimDecimals?: boolean; className?: string }) {
  const text = tone === "in" ? `+ ${formatBRL(Math.abs(cents))}` : tone === "out" ? `− ${formatBRL(Math.abs(cents))}` : tone === "value" ? formatBalance(cents) : formatBRL(cents)
  const at = text.lastIndexOf(",")
  return (
    <span data-money data-tone={tone} className={cn("tabular whitespace-nowrap", tone === "in" && "text-palette-tinta-verso dark:text-brand", className)}>
      {dimDecimals && at > 0 ? (
        <>
          {text.slice(0, at)}
          <span data-cents className="opacity-50">
            {text.slice(at)}
          </span>
        </>
      ) : (
        text
      )}
    </span>
  )
}

// ------------------------------------------------------------------ icons

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Moradia: HouseIcon,
  Mercado: ShoppingCartIcon,
  Restaurantes: UtensilsIcon,
  Transporte: CarIcon,
  Saúde: HeartPulseIcon,
  Lazer: ClapperboardIcon,
  Assinaturas: RepeatIcon,
  Salário: BanknoteIcon,
  "Renda extra": CircleDollarSignIcon,
}

/** The color the person gave a category (or null). Colors live with the shared label colors (localStorage until the table column exists). */
export function useCategoryColor(id: string | null | undefined) {
  const colors = useLabelColors()
  return id ? resolveHex(colors.colorOf("category", id)) : null
}

/** A circle with the category icon, tinted with its color (16% fill, 30% border) or neutral when it has none. */
export function CategoryCircle({ id, name, size = "md", className }: { id?: string | null; name: string; size?: "sm" | "md"; className?: string }) {
  const hex = useCategoryColor(id)
  const Icon = CATEGORY_ICONS[name] ?? TagIcon
  return (
    <span aria-hidden data-category-circle style={hex ? tintStyle(hex) : undefined} className={cn("flex shrink-0 items-center justify-center rounded-full border", hex ? "" : "border-border bg-muted/50", size === "md" ? "size-10" : "size-8", className)}>
      <Icon strokeWidth={1.75} className={size === "md" ? "size-[18px]" : "size-4"} />
    </span>
  )
}

export const GOAL_ICONS: Record<GoalIconKey, LucideIcon> = {
  shield: ShieldCheckIcon,
  plane: PlaneIcon,
  laptop: LaptopIcon,
  phone: SmartphoneIcon,
  home: HouseIcon,
  car: CarIcon,
  heart: HeartPulseIcon,
  graduation: GraduationCapIcon,
  gift: GiftIcon,
  piggy: PiggyBankIcon,
}

// ------------------------------------------------------------------ small blocks

/** A circle with "DIA" over the day of the month. */
export function DayBadge({ day, className }: { day: number; className?: string }) {
  return (
    <span aria-hidden data-day-badge className={cn("tabular flex size-11 shrink-0 flex-col items-center justify-center rounded-full border border-border bg-muted/50 leading-none", className)}>
      <span className="text-[9px] font-medium tracking-[0.12em] text-muted-foreground uppercase">dia</span>
      <span className="mt-0.5 text-[16px] font-semibold">{day}</span>
    </span>
  )
}

/** The pill bar: 10px, Lima fill (Tinta in the light theme, where Lima would vanish), or a category color. Capped at 100%. */
export function ProgressBar({ value, label, color, thin = false, className }: { value: number; label: string; color?: string | null; thin?: boolean; className?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)))
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className={cn("w-full overflow-hidden rounded-full bg-muted", thin ? "h-1.5" : "h-2.5", className)}>
      <div className={cn("h-full rounded-full transition-[width] duration-[400ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none", !color && "bg-primary")} style={{ width: `${pct}%`, ...(color ? { backgroundColor: color } : {}) }} />
    </div>
  )
}

/**
 * The bar of budgets and limits: a track with a diagonal hatch and a solid fill (Lima on dark, Tinta on Papel; Tinta on a Lima card).
 * Capped at 100%.
 */
export function HatchedProgress({ value, label, tone = "default", className }: { value: number; label: string; tone?: "default" | "onLima"; className?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)))
  const ink = tone === "onLima" ? "var(--highlight-foreground)" : "var(--foreground)"
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      data-hatched
      className={cn("h-2.5 w-full overflow-hidden rounded-full", className)}
      style={{ backgroundColor: `color-mix(in oklab, ${ink} 10%, transparent)`, backgroundImage: `repeating-linear-gradient(135deg, color-mix(in oklab, ${ink} 22%, transparent) 0 1.5px, transparent 1.5px 6px)` }}
    >
      <div className={cn("h-full rounded-full transition-[width] duration-[400ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none", tone === "onLima" ? "bg-highlight-foreground" : "bg-primary")} style={{ width: `${pct}%` }} />
    </div>
  )
}

/** SVG ring with the percentage in the middle. Lima stroke on dark, Tinta on Papel. */
export function ProgressRing({ value, label, size = 64, tone = "default", className }: { value: number; label: string; size?: number; /** "inverse": Lima on a Tinta surface in both themes. */ tone?: "default" | "inverse"; className?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)))
  const r = 26
  const c = 2 * Math.PI * r
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className={cn("relative shrink-0", className)} style={{ width: size, height: size }}>
      <svg viewBox="0 0 64 64" width={size} height={size} className="-rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" strokeWidth="6" className={tone === "inverse" ? "stroke-palette-papel/15" : "stroke-muted"} />
        <circle cx="32" cy="32" r={r} fill="none" strokeWidth="6" strokeLinecap="round" className={cn(tone === "inverse" ? "stroke-palette-lima" : "stroke-primary", "transition-[stroke-dashoffset] duration-[400ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none")} strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} />
      </svg>
      <span className={cn("tabular absolute inset-0 flex items-center justify-center font-semibold", size >= 110 ? "text-[24px]" : size >= 80 ? "text-[17px]" : "text-[13px]", tone === "inverse" && "text-palette-papel")}>{pct}%</span>
    </div>
  )
}

/** A summary number: small icon + label, value, optional helper. One line each, never wrapping. */
export function StatTile({ icon: Icon, label, children, helper, compact = false, className }: { icon: LucideIcon; label: string; children: React.ReactNode; helper?: string; compact?: boolean; className?: string }) {
  return (
    <section aria-label={label} data-stat-tile className={cn(SUMMARY_CARD, "flex min-w-0 flex-col", compact ? "gap-1 p-2.5" : "gap-2 p-5", className)}>
      <span className={cn("flex items-center text-muted-foreground", compact ? "gap-1 text-[11px] leading-4" : "gap-1.5 text-[13px] leading-5")}>
        <Icon aria-hidden strokeWidth={1.75} className={cn("shrink-0", compact ? "size-3" : "size-3.5")} />
        <span className="truncate">{label}</span>
      </span>
      <span className={cn("tabular font-semibold whitespace-nowrap", compact ? "text-[14px] leading-5" : "text-[22px] leading-8 tracking-[-0.01em]")}>{children}</span>
      {helper ? <span className="text-[12px] leading-4 text-muted-foreground">{helper}</span> : null}
    </section>
  )
}

/**
 * The Lima card for the key number of a screen (Lima surface, Tinta text, in both themes): an uppercase label with a translucent arrow
 * circle, the value (cents dimmed by the caller), a helper line, the hatched bar (Tinta on Lima) with two small captions, a line under
 * the bar, and optional action pills at the bottom.
 */
export function HeroCard({
  label,
  value,
  size = "md",
  support,
  children,
  actions,
  progress,
  captions,
  footer,
  onArrow,
  arrowLabel,
  className,
}: {
  label: string
  value: React.ReactNode
  /** "md" 36px, "lg" 44px (the balance). */
  size?: "md" | "lg"
  /** The helper line right under the value. */
  support?: string
  children?: React.ReactNode
  actions?: React.ReactNode
  progress?: { value: number; label: string }
  /** Two small labels under the bar, left and right. */
  captions?: [string, string]
  /** The line under the bar (goals, bills). */
  footer?: string
  onArrow?: () => void
  arrowLabel?: string
  className?: string
}) {
  return (
    <section aria-label={label} data-hero-card className={cn("flex min-w-0 flex-col gap-3 rounded-[20px] bg-highlight p-5 text-highlight-foreground", className)}>
      <div className="flex items-center justify-between gap-3">
        <span className="truncate text-[11px] leading-4 font-semibold tracking-[0.1em] uppercase">{label}</span>
        {onArrow ? (
          <button type="button" data-hero-arrow aria-label={arrowLabel ?? `Abrir ${label}`} onClick={onArrow} className="relative flex size-9 shrink-0 items-center justify-center rounded-full bg-highlight-foreground/10 outline-none transition-colors duration-[400ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] after:absolute after:-inset-1 hover:bg-highlight-foreground/20 focus-visible:ring-3 focus-visible:ring-highlight-foreground/40 motion-reduce:transition-none">
            <ArrowUpRightIcon aria-hidden strokeWidth={1.75} className="size-[18px]" />
          </button>
        ) : null}
      </div>
      <div className="flex flex-col gap-1">
        <span className={cn("tabular text-[36px] leading-[44px] font-semibold tracking-[-0.02em] whitespace-nowrap", size === "lg" && "md:text-[44px] md:leading-[52px]")}>{value}</span>
        {support ? <span className="text-[13px] leading-5 text-highlight-foreground/75">{support}</span> : null}
      </div>
      {progress ? (
        <div className="flex flex-col gap-1.5">
          <HatchedProgress value={progress.value} label={progress.label} tone="onLima" className="h-3" />
          {captions ? (
            <div className="tabular flex justify-between text-[11px] leading-4 text-highlight-foreground/70">
              <span>{captions[0]}</span>
              <span>{captions[1]}</span>
            </div>
          ) : null}
        </div>
      ) : null}
      {children}
      {footer ? <span className="text-[13px] leading-5 text-highlight-foreground/75">{footer}</span> : null}
      {actions ? <div className="mt-auto flex flex-wrap gap-2 pt-1">{actions}</div> : null}
    </section>
  )
}

/** The pills of a hero with actions: primary = Tinta with Lima text, secondary = outline. */
export function HeroPill({ primary = false, className, ...props }: React.ComponentProps<"button"> & { primary?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "inline-flex h-11 items-center justify-center gap-1.5 rounded-full px-4 text-[14px] leading-5 font-semibold outline-none transition-colors duration-[400ms] focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none md:h-10",
        primary ? "bg-palette-tinta text-palette-lima hover:bg-palette-tinta/90" : "border border-highlight-foreground/40 text-highlight-foreground hover:bg-highlight-foreground/10",
        className
      )}
    />
  )
}

/** A card's title row: the title (and optional helper) on the left, pill actions on the right. */
export function CardHeader({ title, helper, actions }: { title: string; helper?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex min-h-9 items-center justify-between gap-3">
      <div className="min-w-0">
        <h3 className="truncate text-[17px] leading-6 font-semibold">{title}</h3>
        {helper ? <p className="truncate text-[13px] leading-5 text-muted-foreground">{helper}</p> : null}
      </div>
      {actions}
    </div>
  )
}

/** The month toolbar: "novembro de 2026" (tap = this month) on the left, ‹ › circles on the right. */
export function MonthToolbar({ title, onToday, onShift, className }: { title: string; onToday: () => void; onShift: (direction: -1 | 1) => void; className?: string }) {
  return (
    <div data-testid="month-toolbar" className={cn("flex h-10 items-center gap-2", className)}>
      <button type="button" data-testid="month-title" aria-label="Ir para o mês atual" title="Ir para o mês atual" onClick={onToday} className="min-w-0 flex-1 cursor-pointer truncate rounded-full text-left text-[15px] leading-6 font-semibold outline-none md:first-letter:capitalize focus-visible:ring-3 focus-visible:ring-ring/50 md:text-xl md:leading-7 md:tracking-[-0.01em]">
        {title}
      </button>
      <Button variant="ghost" size="icon" aria-label="Mês anterior" className="shrink-0" onClick={() => onShift(-1)}>
        <ChevronLeftIcon strokeWidth={1.75} />
      </Button>
      <Button variant="ghost" size="icon" aria-label="Próximo mês" className="shrink-0" onClick={() => onShift(1)}>
        <ChevronRightIcon strokeWidth={1.75} />
      </Button>
    </div>
  )
}

/** The dashed add pill (same look as "Adicionar tarefa…"), used as a button that opens a dialog. */
export function AddPill({ label, onClick, className }: { label: string; onClick: () => void; className?: string }) {
  return (
    <button type="button" data-add-task-pill onClick={onClick} className={cn("flex h-11 w-full items-center gap-2 rounded-full border border-dashed border-border px-4 text-left text-[14px] text-muted-foreground outline-none transition-colors duration-[400ms] hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none md:h-10", className)}>
      <PlusGlyph />
      {label}
    </button>
  )
}

function PlusGlyph() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" className="size-4 shrink-0">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

/** Neutral, outlined status chip: icon + text, never a red or green fill. */
export function StatusChip({ icon: Icon, children, className }: { icon: LucideIcon; children: React.ReactNode; className?: string }) {
  return (
    <span data-status-chip className={cn("inline-flex h-6 shrink-0 items-center gap-1 rounded-full border border-foreground/30 px-2 text-[12px] leading-4 font-medium whitespace-nowrap", className)}>
      <Icon aria-hidden strokeWidth={1.75} className="size-3.5" />
      {children}
    </span>
  )
}

/** An empty list: a neutral icon, one line, and a pill action. */
export function EmptyBlock({ icon: Icon, title, description, action }: { icon: LucideIcon; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div data-empty className="flex flex-col items-center gap-3 rounded-[14px] border border-dashed border-border px-6 py-10 text-center">
      <Icon aria-hidden strokeWidth={1.75} className="size-7 text-muted-foreground" />
      <p className="text-[15px] leading-6 font-medium">{title}</p>
      {description ? <p className="-mt-2 text-[13px] leading-5 text-muted-foreground">{description}</p> : null}
      {action}
    </div>
  )
}

// ------------------------------------------------------------------ list item

/** The ⋯ menu of a finance card: Editar and Excluir, plus optional extra entries before them (Destacar). `icon="arrow"` makes the trigger the circle arrow of the featured card. */
export function RowMenu({ title, onEdit, onDelete, extra, icon = "dots", className }: { title: string; onEdit?: () => void; onDelete?: () => void; extra?: { label: string; icon: LucideIcon; onSelect: () => void }[]; icon?: "dots" | "arrow"; className?: string }) {
  if (!onEdit && !onDelete && !extra?.length) return null
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Ações de ${title}`} className={cn("relative z-10 size-9 shrink-0 after:absolute after:-inset-1", icon === "arrow" && "border border-current/25", className)}>
          {icon === "arrow" ? <ArrowUpRightIcon strokeWidth={1.75} /> : <EllipsisIcon strokeWidth={1.75} />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {extra?.map(({ label, icon: Icon, onSelect }) => (
          <DropdownMenuItem key={label} className="min-h-11 gap-3 rounded-xl px-3 text-[15px]" onSelect={onSelect}>
            <Icon strokeWidth={1.75} /> {label}
          </DropdownMenuItem>
        ))}
        {onEdit ? (
          <DropdownMenuItem className="min-h-11 gap-3 rounded-xl px-3 text-[15px]" onSelect={onEdit}>
            <PencilIcon strokeWidth={1.75} /> Editar
          </DropdownMenuItem>
        ) : null}
        {onDelete ? (
          <DropdownMenuItem className="min-h-11 gap-3 rounded-xl px-3 text-[15px]" onSelect={onDelete}>
            <Trash2Icon strokeWidth={1.75} /> Excluir
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

type FinanceListItemProps = {
  leading: React.ReactNode
  title: string
  subtitle?: string
  amount: React.ReactNode
  /** The pill at the end ("Pagar", "✓ Pago"). */
  action?: React.ReactNode
  /** Extra chips in the title row (desktop "Atrasada"). */
  chip?: React.ReactNode
  /** The ⋯ menu entries; Editar / Excluir only. */
  onEdit?: () => void
  onDelete?: () => void
  /** Tapping the card (not a button inside it). */
  onOpen?: () => void
  /** Phone layout of the bills: row 1 = leading + text + ⋯, row 2 = amount left and the pill right. */
  stacked?: boolean
  /** Touch swipes (phones). */
  swipe?: { onRight?: () => void; rightLabel?: string; onLeft?: () => void }
  className?: string
  [key: `data-${string}`]: string | undefined
}

/**
 * The bordered card of every finance list: leading circle, one-line title, one-line subtitle, amount, optional pill, ⋯ (Editar, Excluir).
 * Titles ellipsize; amounts never do. The whole card opens `onOpen` through the title button's stretched hit area, while the pill and
 * the menu stay on top of it.
 */
export function FinanceListItem({ leading, title, subtitle, amount, action, chip, onEdit, onDelete, onOpen, stacked = false, swipe, className, ...data }: FinanceListItemProps) {
  const menu = <RowMenu title={title} onEdit={onEdit} onDelete={onDelete} />
  const titleButton = (
    <button type="button" data-item-title onClick={onOpen} disabled={!onOpen} className="flex min-w-0 flex-col text-left outline-none after:absolute after:inset-0 after:rounded-[14px] focus-visible:after:ring-3 focus-visible:after:ring-ring/50">
      <span className="flex min-w-0 items-center gap-2">
        <span className="truncate text-[15px] leading-6 font-medium">{title}</span>
        {chip}
      </span>
      {subtitle ? <span data-item-subtitle className="truncate text-[13px] leading-5 text-muted-foreground">{subtitle}</span> : null}
    </button>
  )
  const card = stacked ? (
    <div className={cn(LIST_CARD, "relative flex flex-col gap-2 p-3", className)} {...data}>
      <div className="flex items-center gap-3">
        {leading}
        <div className="flex min-w-0 flex-1 flex-col">{titleButton}</div>
        {menu}
      </div>
      <div className="flex items-center justify-between gap-3 pl-[56px]">
        <span className="text-[15px] font-semibold">{amount}</span>
        <span className="relative z-10">{action}</span>
      </div>
    </div>
  ) : (
    <div className={cn(LIST_CARD, "relative flex min-h-[64px] items-center gap-3 px-3 py-2.5", className)} {...data}>
      {leading}
      <div className="flex min-w-0 flex-1 flex-col">{titleButton}</div>
      <span className="shrink-0 text-[15px] font-semibold">{amount}</span>
      {action ? <span className="relative z-10 shrink-0">{action}</span> : null}
      {menu}
    </div>
  )
  if (!swipe) return card
  return (
    <SwipeRow className="rounded-[14px]" surfaceClassName="bg-transparent" rightLabel={swipe.rightLabel} onSwipeRight={swipe.onRight} onSwipeLeft={swipe.onLeft}>
      {card}
    </SwipeRow>
  )
}

/** The rows of a group: separate cards 8px apart on the page. */
export function CardStack({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div data-group-rows className={cn("flex flex-col gap-2 pb-2", className)}>
      {Children.toArray(children)}
    </div>
  )
}
