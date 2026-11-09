"use client"

import { useEffect, useId, useRef, useState } from "react"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { ArrowDownIcon, ArrowUpIcon, EllipsisIcon, MinusIcon, PencilIcon, PlusIcon, ScaleIcon, TargetIcon, Trash2Icon } from "lucide-react"

import { BentoCard, BentoStat, SegmentedPills, Sparkline } from "@/components/finance/bento"
import { FinanceDeck } from "@/components/finance/finance-deck"
import { AddPill, HatchedProgress, HeroCard } from "@/components/finance/parts"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  WEIGHT_PERIODS,
  deltasVsPrevious,
  goalProgress,
  kgPlain,
  kgText,
  signedKg,
  sortWeights,
  variation,
  weightsInPeriod,
  yTicks,
  type WeightPeriod,
} from "@/features/diet/weight"
import type { WeightLogRow } from "@/features/diet/types"
import { cn } from "@/lib/utils"

const dim = (text: string) => <span className="text-[16px] leading-6 opacity-60">{text}</span>
const longDate = (day: string) => format(parseISO(day), "d 'de' MMM 'de' yyyy", { locale: ptBR }).replace(".", "")
const shortDate = (day: string) => format(parseISO(day), "d 'de' MMM", { locale: ptBR }).replace(".", "")
const PERIOD_TEXT: Record<WeightPeriod, string> = { 30: "em 30 dias", 90: "em 90 dias", 365: "no último ano" }

/** "30 dias | 90 dias | 1 ano": drives the variation, the sparkline and the chart. */
export function WeightPeriodSwitch({ value, onChange, className }: { value: WeightPeriod; onChange: (period: WeightPeriod) => void; className?: string }) {
  return <SegmentedPills items={WEIGHT_PERIODS.map((p) => ({ id: String(p), label: p === 365 ? "1 ano" : `${p} dias` }))} value={String(value)} onChange={(id) => onChange(Number(id) as WeightPeriod)} ariaLabel="Período" className={className} />
}

// ------------------------------------------------------------------ the three top cards

const pillOnLima = "h-10 w-fit rounded-full bg-highlight-foreground px-4 text-highlight hover:bg-highlight-foreground/90"

function TopCards({ sorted, inPeriod, period, target, isMobile, onRegister, onGoal }: { sorted: WeightLogRow[]; inPeriod: WeightLogRow[]; period: WeightPeriod; target: number | null; isMobile: boolean; onRegister: () => void; onGoal: () => void }) {
  const last = sorted[sorted.length - 1]
  const change = variation(inPeriod)
  const progress = goalProgress(sorted, target)

  const hero = (
    <HeroCard
      key="hero"
      className="h-[216px]"
      label="Peso atual"
      value={
        last ? (
          <>
            {kgPlain(last.weight_kg)} {dim("kg")}
          </>
        ) : (
          "—"
        )
      }
      support={last ? `último registro: ${shortDate(last.log_date)}` : "Nenhum registro ainda"}
      actions={
        <Button type="button" data-testid="register-weight-hero" onClick={onRegister} className={cn(pillOnLima, "mt-auto")}>
          <PlusIcon strokeWidth={1.75} /> Registrar peso
        </Button>
      }
    />
  )

  const ChangeIcon = change === null || change === 0 ? MinusIcon : change < 0 ? ArrowDownIcon : ArrowUpIcon
  const variationCard = (
    <BentoStat
      key="variation"
      label="Variação"
      icon={ChangeIcon}
      className="h-[216px]"
      chip={change === null ? "Poucos registros no período" : PERIOD_TEXT[period]}
      footer={inPeriod.length >= 2 ? <Sparkline points={inPeriod.map((w) => w.weight_kg)} label={`Peso ${PERIOD_TEXT[period]}`} tone="default" /> : null}
    >
      {change === null ? (
        "—"
      ) : (
        <>
          {signedKg(change)} {dim("kg")}
        </>
      )}
    </BentoStat>
  )

  const goalCard =
    target === null ? (
      <BentoStat key="goal" label="Meta" icon={TargetIcon} className="h-[216px]" chip="Sem meta definida" footer={<AddPill label="Definir meta" onClick={onGoal} />}>
        —
      </BentoStat>
    ) : (
      <BentoStat
        key="goal"
        label="Meta"
        icon={TargetIcon}
        className="h-[216px]"
        chip={progress === null ? "Sem registros ainda" : progress.reached ? "Meta atingida" : `faltam ${kgPlain(progress.remaining)} kg`}
        footer={
          <div className="flex items-center gap-3">
            {progress ? <HatchedProgress value={progress.pct} label={`Meta de peso: ${progress.pct}%`} className="flex-1" /> : <span className="flex-1" />}
            <Button type="button" variant="outline" className="h-9 rounded-full px-4" onClick={onGoal}>
              Editar
            </Button>
          </div>
        }
      >
        {kgPlain(target)} {dim("kg")}
      </BentoStat>
    )

  if (isMobile) {
    return (
      <FinanceDeck
        title={null}
        label="Resumo do peso"
        noun="resumo"
        initialHeight={216}
        slides={[
          { id: "hero", hero: true, node: hero },
          { id: "variation", node: variationCard },
          { id: "goal", node: goalCard },
        ]}
      />
    )
  }
  return (
    <div data-testid="weight-top" className="grid grid-cols-1 gap-4 @min-[720px]:grid-cols-3">
      {[hero, variationCard, goalCard].map((card, i) => (
        <div key={i} className="flex min-w-0 flex-col [&>*]:flex-1">
          {card}
        </div>
      ))}
    </div>
  )
}

// ------------------------------------------------------------------ evolution chart

const MIN_HEIGHT = 260
const PAD = { left: 56, right: 18, top: 18, bottom: 30 }

function useWidth() {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => setSize({ width: el.clientWidth, height: el.clientHeight })
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return [ref, size.width, Math.max(MIN_HEIGHT, size.height)] as const
}

function WeightChart({ points, target, isMobile }: { points: WeightLogRow[]; target: number | null; isMobile: boolean }) {
  const [ref, width, HEIGHT] = useWidth()
  const gradient = useId()
  const [hover, setHover] = useState<number | null>(null)
  const n = points.length
  const active = hover !== null && hover < n ? hover : n - 1

  if (n < 2) {
    return (
      <p data-testid="weight-chart-empty" className="py-10 text-center text-[13px] leading-5 text-muted-foreground">
        Poucos registros neste período. Registre seu peso para ver a evolução.
      </p>
    )
  }

  const { ticks, min, max } = yTicks([...points.map((p) => p.weight_kg), ...(target === null ? [] : [target])])
  const plotW = Math.max(0, width - PAD.left - PAD.right)
  const plotH = HEIGHT - PAD.top - PAD.bottom
  const x = (i: number) => PAD.left + (i / (n - 1)) * plotW
  const y = (kg: number) => PAD.top + (1 - (kg - min) / (max - min)) * plotH
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.weight_kg).toFixed(1)}`).join(" ")
  const area = `${line} L${x(n - 1).toFixed(1)},${(PAD.top + plotH).toFixed(1)} L${x(0).toFixed(1)},${(PAD.top + plotH).toFixed(1)} Z`
  const step = Math.max(isMobile ? 3 : 1, Math.ceil(n / Math.max(1, Math.floor(plotW / 48))))
  const tipW = 112
  const tipLeft = Math.min(Math.max(x(active) - tipW / 2, 0), Math.max(0, width - tipW))
  const summary = `Peso nos últimos registros: ${points.slice(-5).map((p) => `${shortDate(p.log_date)} ${kgText(p.weight_kg)}`).join(", ")}.`

  return (
    <div ref={ref} data-testid="weight-chart" className="relative min-h-[260px] w-full flex-1">
      {width > 0 ? (
        <>
          <svg role="img" aria-label={summary} width={width} height={HEIGHT} className="block overflow-visible" onPointerLeave={() => setHover(null)} onPointerMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            setHover(Math.min(n - 1, Math.max(0, Math.round(((e.clientX - rect.left - PAD.left) / plotW) * (n - 1)))))
          }}>
            <defs>
              <linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.28" />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {ticks.map((t) => (
              <g key={t} data-tick={t}>
                <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--foreground)" strokeOpacity={t === min ? 0.35 : 0.2} strokeDasharray={t === min ? undefined : "3 4"} />
                <text x={PAD.left - 10} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--muted-foreground)" className="tabular">
                  {t} kg
                </text>
              </g>
            ))}
            {target !== null && target >= min && target <= max ? (
              <g data-testid="weight-goal-line">
                <line x1={PAD.left} x2={width - PAD.right} y1={y(target)} y2={y(target)} stroke="var(--primary)" strokeWidth="1.5" strokeDasharray="6 5" />
                <text x={width - PAD.right - 4} y={y(target) - 6} textAnchor="end" fontSize="11" fontWeight="600" fill="var(--foreground)">
                  meta
                </text>
              </g>
            ) : null}
            <path d={area} fill={`url(#${gradient})`} />
            <path d={line} fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
            {points.map((p, i) => {
              const last = i === n - 1
              if (!last && n > 45) return null
              return <circle key={p.id} data-point={last ? "last" : "past"} cx={x(i)} cy={y(p.weight_kg)} r={last ? 5 : 4} fill={last ? "var(--primary)" : "var(--card)"} stroke="var(--primary)" strokeWidth="2" />
            })}
            {hover !== null && hover !== n - 1 ? <circle cx={x(hover)} cy={y(points[hover].weight_kg)} r={5} fill="var(--primary)" stroke="var(--card)" strokeWidth="2" /> : null}
            {points.map((p, i) =>
              (n - 1 - i) % step === 0 ? (
                <text key={p.id} aria-hidden x={x(i)} y={HEIGHT - 8} textAnchor={i === n - 1 ? "end" : i === 0 ? "start" : "middle"} fontSize={isMobile ? 10 : 12} fill="var(--muted-foreground)" className="tabular" fontWeight={i === n - 1 ? 700 : 400}>
                  {format(parseISO(p.log_date), "dd/MM")}
                </text>
              ) : null
            )}
          </svg>
          <div data-testid="weight-tooltip" className="tabular pointer-events-none absolute z-10 flex flex-col rounded-[12px] border border-border bg-popover px-3 py-1.5 text-popover-foreground" style={{ left: tipLeft, top: Math.max(0, y(points[active].weight_kg) - 62), width: tipW }}>
            <span className="text-[11px] leading-4 text-muted-foreground">{shortDate(points[active].log_date)}</span>
            <span className="text-[15px] leading-5 font-semibold">{kgText(points[active].weight_kg)}</span>
          </div>
        </>
      ) : null}
    </div>
  )
}

// ------------------------------------------------------------------ records

function DeltaChip({ delta }: { delta: number | null }) {
  const Icon = delta === null || delta === 0 ? MinusIcon : delta < 0 ? ArrowDownIcon : ArrowUpIcon
  return (
    <span data-delta className="tabular inline-flex h-6 shrink-0 items-center gap-1 rounded-full border border-foreground/25 px-2 text-[12px] leading-4 whitespace-nowrap text-muted-foreground">
      <Icon aria-hidden strokeWidth={1.75} className="size-3" />
      {delta === null ? "primeiro" : delta === 0 ? "igual" : `${signedKg(delta)} kg`}
    </span>
  )
}

function Records({ sorted, count, notes, onEdit, onRemove, className }: { sorted: WeightLogRow[]; count: number; notes: Record<string, string>; onEdit: (row: WeightLogRow) => void; onRemove: (row: WeightLogRow) => void; className?: string }) {
  const deltas = deltasVsPrevious(sorted)
  const recent = [...sorted].reverse().slice(0, count)
  return (
    <BentoCard title="Registros" data-testid="weight-records" className={className}>
      {recent.length === 0 ? <p className="text-[13px] leading-5 text-muted-foreground">Nenhum peso registrado ainda.</p> : null}
      <ul className="flex flex-col divide-y divide-border">
        {recent.map((row) => (
          <li key={row.id} data-weight-row={row.log_date} className="flex min-h-[60px] items-center gap-3 py-2">
            <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border">
              <ScaleIcon strokeWidth={1.75} className="size-4" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="tabular text-[15px] leading-6 font-semibold">{kgText(row.weight_kg)}</span>
              <span className="truncate text-[12px] leading-4 text-muted-foreground" title={notes[row.log_date] || undefined}>
                {longDate(row.log_date)}
              </span>
            </span>
            <DeltaChip delta={deltas.get(row.id) ?? null} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="icon" aria-label={`Opções do registro de ${longDate(row.log_date)}`} className="relative size-9 shrink-0 rounded-full after:absolute after:-inset-y-1 after:inset-x-0">
                  <EllipsisIcon strokeWidth={1.75} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => onEdit(row)}>
                  <PencilIcon strokeWidth={1.75} /> Editar
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onRemove(row)}>
                  <Trash2Icon strokeWidth={1.75} /> Remover
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </li>
        ))}
      </ul>
    </BentoCard>
  )
}

// ------------------------------------------------------------------ the tab

export function PesoTab({ weights, target, today, period, onPeriod, isMobile, notes, onRegister, onEdit, onRemove, onGoal }: { weights: WeightLogRow[]; target: number | null; today: string; period: WeightPeriod; onPeriod: (period: WeightPeriod) => void; isMobile: boolean; notes: Record<string, string>; onRegister: () => void; onEdit: (row: WeightLogRow) => void; onRemove: (row: WeightLogRow) => void; onGoal: () => void }) {
  const sorted = sortWeights(weights)
  const inPeriod = weightsInPeriod(sorted, today, period)
  const change = variation(inPeriod)
  const [removing, setRemoving] = useState<WeightLogRow | null>(null)

  return (
    <div data-testid="dieta-peso" data-period={period} className="@container flex min-w-0 flex-col gap-4">
      <TopCards sorted={sorted} inPeriod={inPeriod} period={period} target={target} isMobile={isMobile} onRegister={onRegister} onGoal={onGoal} />
      <div className="grid grid-cols-1 gap-4 @min-[880px]:grid-cols-12">
        <BentoCard title="Evolução do peso" subtitle={change === null ? "Poucos registros no período" : `${signedKg(change)} kg ${PERIOD_TEXT[period]}`} data-testid="weight-evolution" className="@min-[880px]:col-span-8" actions={isMobile ? undefined : <WeightPeriodSwitch value={period} onChange={onPeriod} />}>
          {isMobile ? <WeightPeriodSwitch value={period} onChange={onPeriod} className="w-full [&>button]:flex-1" /> : null}
          <WeightChart points={inPeriod} target={target} isMobile={isMobile} />
        </BentoCard>
        <Records sorted={sorted} count={isMobile ? 6 : 7} notes={notes} onEdit={onEdit} onRemove={setRemoving} className="@min-[880px]:col-span-4" />
      </div>
      <AlertDialog open={Boolean(removing)} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover este registro?</AlertDialogTitle>
            <AlertDialogDescription>{removing ? `O peso de ${kgText(removing.weight_kg)} de ${longDate(removing.log_date)} será removido.` : ""}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (removing) onRemove(removing)
                setRemoving(null)
              }}
            >
              <Trash2Icon strokeWidth={1.75} /> Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

