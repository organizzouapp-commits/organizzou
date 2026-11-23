import { CheckIcon, MinusIcon } from "lucide-react"

import { SoonBadge } from "@/components/organizzou/SoonBadge"
import { cn } from "@/lib/utils"

type Cell = true | false | string | "soon"
type Row = { label: string; free: Cell; pro: Cell }
type Group = { title: string; rows: Row[] }

/** Free versus Pro, grouped like the design. The assistant is Pro only (no quick-capture tier); voice is part of it; the message service is a badge only. */
export const COMPARISON: Group[] = [
  {
    title: "Tarefas",
    rows: [
      { label: "Quadros", free: "1", pro: "Ilimitados" },
      { label: "Listas", free: "Até 3", pro: "Ilimitadas" },
      { label: "Lembretes de tarefas no celular", free: true, pro: true },
    ],
  },
  {
    title: "Finanças",
    rows: [
      { label: "Lançamentos manuais", free: true, pro: true },
      { label: "Contas fixas e parceladas", free: false, pro: true },
      { label: "Metas e orçamento", free: false, pro: true },
      { label: "Gráficos e histórico", free: false, pro: true },
    ],
  },
  { title: "Assistente", rows: [{ label: "Assistente virtual", free: "—", pro: "Conversa, ações e voz · 200 por dia" }] },
  { title: "Módulos de vida", rows: [{ label: "Agenda, Rotina, Treinos, Dieta, Estudos, Notas, Metas, Diário e Cofre", free: false, pro: true }] },
  {
    title: "Segurança e avisos",
    rows: [
      { label: "Verificação em duas etapas, passkeys e sessões", free: true, pro: true },
      { label: "Todos os avisos (agenda, contas, hábitos e mais)", free: false, pro: true },
      { label: "WhatsApp", free: false, pro: "soon" },
    ],
  },
]

function CellView({ value, label }: { value: Cell; label: string }) {
  if (value === true) return <CheckIcon aria-label={`${label}: incluído`} strokeWidth={1.75} className="size-[18px]" />
  if (value === false) return <MinusIcon aria-label={`${label}: não incluído`} strokeWidth={1.75} className="size-[18px] text-muted-foreground" />
  if (value === "soon") return <SoonBadge />
  return <span className="tabular text-[14px] leading-5">{value}</span>
}

/** The comparison table: one grid, a header per group, 44px+ rows, readable at 390px. */
export function PlanComparison({ className }: { className?: string }) {
  return (
    <div role="table" aria-label="Comparativo de planos" className={cn("grid grid-cols-[minmax(0,1.5fr)_minmax(0,0.7fr)_minmax(0,1fr)] text-[15px] leading-6", className)}>
      <div role="row" className="col-span-3 grid grid-cols-subgrid pb-2">
        {["Recurso", "Gratuito", "Pro"].map((title) => (
          <span key={title} role="columnheader" className="text-[11px] leading-4 font-semibold tracking-[0.12em] text-muted-foreground uppercase">
            {title}
          </span>
        ))}
      </div>
      {COMPARISON.map((group) => (
        <div key={group.title} role="rowgroup" className="col-span-3 grid grid-cols-subgrid">
          <h4 className="col-span-3 border-t border-border pt-4 pb-1 text-[13px] leading-5 font-semibold">{group.title}</h4>
          {group.rows.map((row) => (
            <div key={row.label} role="row" className="col-span-3 grid min-h-11 grid-cols-subgrid items-center gap-x-3 py-2">
              <span role="cell">{row.label}</span>
              <span role="cell" className="flex items-center">
                <CellView value={row.free} label={`${row.label} no Gratuito`} />
              </span>
              <span role="cell" className="flex items-center">
                <CellView value={row.pro} label={`${row.label} no Pro`} />
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
