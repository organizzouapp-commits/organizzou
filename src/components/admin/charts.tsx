"use client"

import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, XAxis, YAxis } from "recharts"

import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { fmtDayMonth, fmtInt } from "@/lib/admin/format"

const axis = { tickLine: false, axisLine: false, tickMargin: 8 } as const

/** Thins the labels so a 365-day axis stays readable. */
function every(length: number) {
  return Math.max(0, Math.ceil(length / 7) - 1)
}

function ChartEmpty({ label }: { label: string }) {
  return <p className="flex h-full min-h-40 items-center justify-center text-center text-[15px] text-muted-foreground">{label}</p>
}

// ---------------------------------------------------------------------------------------------------------------------

const signupsConfig = { signups: { label: "Cadastros", color: "var(--chart-1)" } } satisfies ChartConfig

export function SignupsChart({ data }: { data: { day: string; signups: number }[] }) {
  if (data.length === 0) return <ChartEmpty label="Sem cadastros no período." />
  return (
    <ChartContainer config={signupsConfig} className="aspect-auto h-64 w-full" role="img" aria-label="Cadastros por dia">
      <BarChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="day" {...axis} interval={every(data.length)} tickFormatter={fmtDayMonth} />
        <YAxis {...axis} width={32} allowDecimals={false} tickFormatter={(v: number) => fmtInt(v)} />
        <ChartTooltip content={<ChartTooltipContent labelFormatter={(_, items) => fmtDayMonth(String(items?.[0]?.payload?.day ?? ""))} />} />
        <Bar dataKey="signups" fill="var(--color-signups)" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ChartContainer>
  )
}

// ---------------------------------------------------------------------------------------------------------------------

const activeConfig = {
  dau: { label: "Diário (DAU)", color: "var(--chart-1)" },
  wau: { label: "Semanal (WAU)", color: "var(--chart-2)" },
  mau: { label: "Mensal (MAU)", color: "var(--chart-3)" },
} satisfies ChartConfig

/** Solid, dashed and dotted lines: the three series are told apart by shape too, not only by color. */
export function ActiveUsersChart({ data }: { data: { day: string; dau: number; wau: number; mau: number }[] }) {
  if (data.length === 0) return <ChartEmpty label="Sem atividade registrada no período." />
  return (
    <ChartContainer config={activeConfig} className="aspect-auto h-72 w-full" role="img" aria-label="Pessoas ativas por dia: diário, semanal e mensal">
      <LineChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="day" {...axis} interval={every(data.length)} tickFormatter={fmtDayMonth} />
        <YAxis {...axis} width={32} allowDecimals={false} tickFormatter={(v: number) => fmtInt(v)} />
        <ChartTooltip content={<ChartTooltipContent labelFormatter={(_, items) => fmtDayMonth(String(items?.[0]?.payload?.day ?? ""))} />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Line dataKey="dau" type="monotone" stroke="var(--color-dau)" strokeWidth={2.5} dot={false} />
        <Line dataKey="wau" type="monotone" stroke="var(--color-wau)" strokeWidth={2.5} strokeDasharray="8 5" dot={false} />
        <Line dataKey="mau" type="monotone" stroke="var(--color-mau)" strokeWidth={2.5} strokeDasharray="2 5" strokeLinecap="round" dot={false} />
      </LineChart>
    </ChartContainer>
  )
}

// ---------------------------------------------------------------------------------------------------------------------

export type PlanSliceDatum = { key: string; label: string; users: number }

const SLICE_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-5)", "var(--chart-4)"]
const SLICE_SWATCH = ["bg-chart-1", "bg-chart-2", "bg-chart-5", "bg-chart-4"]

export function PlanChart({ data }: { data: PlanSliceDatum[] }) {
  const total = data.reduce((sum, slice) => sum + slice.users, 0)
  if (total === 0) return <ChartEmpty label="Sem usuários ainda." />
  const config = Object.fromEntries(data.map((slice, i) => [slice.key, { label: slice.label, color: SLICE_COLORS[i % SLICE_COLORS.length] }])) satisfies ChartConfig
  return (
    <div className="flex flex-col items-center gap-4 @min-[420px]:flex-row">
      <ChartContainer config={config} className="aspect-square h-44 shrink-0" role="img" aria-label="Distribuição de planos">
        <PieChart>
          <ChartTooltip content={<ChartTooltipContent nameKey="key" hideLabel />} />
          <Pie data={data} dataKey="users" nameKey="key" innerRadius={48} outerRadius={80} strokeWidth={2} paddingAngle={2}>
            {data.map((slice, i) => (
              <Cell key={slice.key} fill={SLICE_COLORS[i % SLICE_COLORS.length]} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
      {/* The legend carries the numbers, so the chart never depends on color alone. */}
      <ul className="flex w-full flex-col gap-2 text-[15px]">
        {data.map((slice, i) => (
          <li key={slice.key} className="flex items-center gap-3">
            <span aria-hidden className={`size-3 shrink-0 rounded-sm ${SLICE_SWATCH[i % SLICE_SWATCH.length]}`} />
            <span className="min-w-0 flex-1 truncate">{slice.label}</span>
            <span className="tabular font-medium">{fmtInt(slice.users)}</span>
            <span className="tabular w-12 text-right text-[13px] text-muted-foreground">{Math.round((slice.users / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ---------------------------------------------------------------------------------------------------------------------

export type ModuleWeekDatum = { week: string; [feature: string]: string | number }

const FEATURE_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-5)", "var(--chart-4)"]

export function ModuleWeeksChart({ data, features }: { data: ModuleWeekDatum[]; features: { key: string; label: string }[] }) {
  if (data.length === 0) return <ChartEmpty label="Nenhum registro criado no período." />
  const config = Object.fromEntries(features.map((f, i) => [f.key, { label: f.label, color: FEATURE_COLORS[i % FEATURE_COLORS.length] }])) satisfies ChartConfig
  return (
    <ChartContainer config={config} className="aspect-auto h-72 w-full" role="img" aria-label="Registros criados por semana, por recurso">
      <BarChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="week" {...axis} tickFormatter={(v: string) => fmtDayMonth(v)} />
        <YAxis {...axis} width={36} allowDecimals={false} tickFormatter={(v: number) => fmtInt(v)} />
        <ChartTooltip content={<ChartTooltipContent labelFormatter={(_, items) => `Semana de ${fmtDayMonth(String(items?.[0]?.payload?.week ?? ""))}`} />} />
        <ChartLegend content={<ChartLegendContent />} />
        {features.map((f) => (
          <Bar key={f.key} dataKey={f.key} stackId="records" fill={`var(--color-${f.key})`} />
        ))}
      </BarChart>
    </ChartContainer>
  )
}

export function DailyBarsChart({ data, label, empty }: { data: { day: string; value: number }[]; label: string; empty: string }) {
  if (data.length === 0) return <ChartEmpty label={empty} />
  const config = { value: { label, color: "var(--chart-1)" } } satisfies ChartConfig
  return (
    <ChartContainer config={config} className="aspect-auto h-64 w-full" role="img" aria-label={label}>
      <BarChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="day" {...axis} interval={every(data.length)} tickFormatter={fmtDayMonth} />
        <YAxis {...axis} width={32} allowDecimals={false} tickFormatter={(v: number) => fmtInt(v)} />
        <ChartTooltip content={<ChartTooltipContent labelFormatter={(_, items) => fmtDayMonth(String(items?.[0]?.payload?.day ?? ""))} />} />
        <Bar dataKey="value" fill="var(--color-value)" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ChartContainer>
  )
}
