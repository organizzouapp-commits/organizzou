"use client"

import {
  AlarmClockIcon,
  CalendarDaysIcon,
  DropletsIcon,
  DumbbellIcon,
  FileTextIcon,
  FlagIcon,
  GraduationCapIcon,
  InboxIcon,
  MoonIcon,
  RepeatIcon,
  ScaleIcon,
  SmileIcon,
  SquareCheckIcon,
  TargetIcon,
  TrendingDownIcon,
  TrendingUpIcon,
  type LucideIcon,
} from "lucide-react"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatBRL } from "@/lib/money"
import { type CaptureItem, type CaptureType, CAPTURE_TYPES, isConfident, TYPE_LABELS, whenLabel } from "@/server/assistant/parse"

export const TYPE_ICONS: Record<CaptureType, LucideIcon> = {
  tarefa: SquareCheckIcon,
  gasto: TrendingDownIcon,
  receita: TrendingUpIcon,
  nota: FileTextIcon,
  habito: RepeatIcon,
  evento: CalendarDaysIcon,
  lembrete: AlarmClockIcon,
  meta: TargetIcon,
  humor: SmileIcon,
  agua: DropletsIcon,
  peso: ScaleIcon,
  sono: MoonIcon,
  treino: DumbbellIcon,
  estudo: GraduationCapIcon,
}

const PRIORITY: Record<NonNullable<CaptureItem["priority"]>, string> = { low: "Prioridade baixa", medium: "Prioridade média", high: "Prioridade alta" }

/** The parsed fields of one item, as small facts under its title. Only what was actually read is shown. */
function facts(item: CaptureItem, now: Date): { icon?: LucideIcon; text: string }[] {
  const out: { icon?: LucideIcon; text: string }[] = []
  const when = whenLabel(item, now)
  if (when) out.push({ icon: CalendarDaysIcon, text: when })
  if (item.cents) out.push({ text: formatBRL(item.cents) })
  if (item.category) out.push({ text: item.category })
  if (item.priority) out.push({ icon: FlagIcon, text: PRIORITY[item.priority] })
  if (item.type === "agua" && item.amount) out.push({ text: `${item.amount} ml` })
  if ((item.type === "estudo" || item.type === "treino") && item.amount) out.push({ text: `${item.amount} min` })
  if ((item.type === "estudo" || item.type === "treino") && item.target) out.push({ text: item.target })
  return out
}

type PreviewProps = {
  items: CaptureItem[]
  now: Date
  /** The type the person chose with the selector, per source text. */
  onChangeType: (source: string, type: CaptureType) => void
  /** Sources whose chosen type could not be read from the text (for example "Gasto" without an amount). */
  cannotRead: Set<string>
}

/** "Vou criar:" a compact card per item with the detected type, the parsed fields and "Mudar tipo". */
export function CapturePreview({ items, now, onChangeType, cannotRead }: PreviewProps) {
  if (items.length === 0) return <p className="text-[15px] leading-6 text-muted-foreground">Comece a escrever para ver o que vou criar.</p>
  return (
    <section aria-label="Prévia" aria-live="polite" className="@container flex flex-col gap-2">
      <p className="text-[11px] leading-4 font-semibold tracking-[0.12em] text-muted-foreground uppercase">Vou criar:</p>
      <ul className="flex flex-col gap-2">
        {items.map((item) => {
          const unsure = !isConfident(item)
          const Icon = unsure ? InboxIcon : TYPE_ICONS[item.type]
          const list = facts(item, now)
          return (
            <li key={item.source} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-3 @min-[420px]:flex-row @min-[420px]:items-center" data-capture-type={unsure ? "inbox" : item.type}>
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <span aria-hidden className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-highlight text-highlight-foreground">
                  <Icon strokeWidth={1.75} className="size-[18px]" />
                </span>
                <div className="flex min-w-0 flex-col gap-1">
                  <p className="truncate text-[15px] leading-5 font-semibold">{unsure ? "Nota no Inbox" : item.title}</p>
                  {unsure ? (
                    <p className="text-[13px] leading-5 text-muted-foreground">Não tenho certeza do que é. Guardo o texto como nota no Inbox e você muda depois.</p>
                  ) : (
                    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] leading-5 text-muted-foreground">
                      <span className="font-medium text-foreground">{TYPE_LABELS[item.type]}</span>
                      {list.map((f) => (
                        <span key={f.text} className="inline-flex items-center gap-1">
                          {f.icon ? <f.icon aria-hidden strokeWidth={1.75} className="size-3.5" /> : null}
                          {f.text}
                        </span>
                      ))}
                    </p>
                  )}
                  {cannotRead.has(item.source) ? <p className="text-[13px] leading-5 text-destructive">Não deu para ler como esse tipo. Mantive o anterior.</p> : null}
                </div>
              </div>
              <Select value={unsure ? "" : item.type} onValueChange={(value) => onChangeType(item.source, value as CaptureType)}>
                <SelectTrigger aria-label={`Mudar tipo: ${item.title}`} className="h-11 w-full shrink-0 rounded-xl @min-[420px]:w-40">
                  <SelectValue placeholder="Mudar tipo" />
                </SelectTrigger>
                <SelectContent>
                  {CAPTURE_TYPES.map((type) => (
                    <SelectItem key={type} value={type} className="min-h-11">
                      {TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
