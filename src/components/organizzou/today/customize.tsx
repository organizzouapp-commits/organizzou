"use client"

import { useMemo, useState } from "react"
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core"
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { ArrowDownIcon, ArrowUpIcon, GripVerticalIcon, RotateCcwIcon } from "lucide-react"

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import { modules } from "@/components/organizzou/modules"
import { STAT_WIDGETS, panelMeta, statMeta, type StatId } from "@/features/today/catalog"
import { DEFAULT_PREFS, type TodayPrefs } from "@/features/today/prefs"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"

const overline = "text-[11px] leading-4 font-semibold tracking-[0.12em] uppercase text-muted-foreground"
const iconButton = "size-11 shrink-0 rounded-full"

function SortableRow({ id, label, children }: { id: string; label: string; children: (handle: React.ReactNode) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id })
  const handle = (
    <button
      type="button"
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      aria-label={`Arrastar ${label}. Com o teclado: espaço para pegar, setas para mover, espaço para soltar.`}
      className="flex size-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing"
    >
      <GripVerticalIcon aria-hidden strokeWidth={1.75} className="size-5" />
    </button>
  )
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("flex min-h-14 items-center gap-1 border-b border-border bg-popover py-1 last:border-b-0", isDragging && "relative z-10 rounded-2xl border border-border")}
    >
      {children(handle)}
    </li>
  )
}

function MoveButtons({ label, index, count, onMove }: { label: string; index: number; count: number; onMove: (to: number) => void }) {
  return (
    <>
      <Button type="button" variant="ghost" size="icon" className={iconButton} aria-label={`Mover ${label} para cima`} disabled={index === 0} onClick={() => onMove(index - 1)}>
        <ArrowUpIcon strokeWidth={1.75} />
      </Button>
      <Button type="button" variant="ghost" size="icon" className={iconButton} aria-label={`Mover ${label} para baixo`} disabled={index === count - 1} onClick={() => onMove(index + 1)}>
        <ArrowDownIcon strokeWidth={1.75} />
      </Button>
    </>
  )
}

function useSortSensors() {
  return useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))
}

// ---------------------------------------------------------------------------------------------------------------------

function Highlights({ prefs, onChange }: { prefs: TodayPrefs; onChange: (next: TodayPrefs) => void }) {
  const sensors = useSortSensors()
  /** The stat the person just tapped while 4 were already chosen: waiting for "which one should it replace?". */
  const [incoming, setIncoming] = useState<StatId | null>(null)
  const selected = prefs.highlights

  const groups = useMemo(() => {
    const map = new Map<string, typeof STAT_WIDGETS[number][]>()
    for (const w of STAT_WIDGETS) map.set(w.module, [...(map.get(w.module) ?? []), w])
    return [...map.entries()]
  }, [])

  const move = (from: number, to: number) => onChange({ ...prefs, highlights: arrayMove(selected, from, to) })
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    move(selected.indexOf(active.id as StatId), selected.indexOf(over.id as StatId))
  }

  return (
    <section aria-label="Destaques" className="flex flex-col gap-4">
      <div>
        <h3 className="text-[17px] leading-6 font-semibold">Destaques</h3>
        <p className="text-[15px] leading-6 text-muted-foreground">Escolha 4 números para o topo da página e arraste para mudar a ordem.</p>
      </div>

      <div data-vaul-no-drag>
        <p className={cn(overline, "pb-1")}>Seus 4 destaques, em ordem</p>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={selected} strategy={verticalListSortingStrategy}>
            <ol aria-label="Destaques escolhidos">
              {selected.map((id, index) => {
                const meta = statMeta(id)!
                return (
                  <SortableRow key={id} id={id} label={meta.title}>
                    {(handle) => (
                      <>
                        {handle}
                        <span aria-hidden className="tabular flex size-7 shrink-0 items-center justify-center rounded-full bg-highlight text-[13px] font-semibold text-highlight-foreground">
                          {index + 1}
                        </span>
                        <meta.icon aria-hidden strokeWidth={1.75} className="size-5 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 px-1 text-[15px] leading-6">{meta.title}</span>
                        <MoveButtons label={meta.title} index={index} count={selected.length} onMove={(to) => move(index, to)} />
                      </>
                    )}
                  </SortableRow>
                )
              })}
            </ol>
          </SortableContext>
        </DndContext>
      </div>

      {incoming ? (
        <div role="group" aria-label="Qual destaque substituir?" className="flex flex-col gap-2 rounded-2xl border border-border p-3">
          <p className="text-[15px] leading-6">
            Você já tem 4 destaques. Qual deles <strong className="font-semibold">“{statMeta(incoming)?.title}”</strong> deve substituir?
          </p>
          <div className="flex flex-col">
            {selected.map((id, index) => (
              <Button
                key={id}
                type="button"
                variant="ghost"
                className="h-auto min-h-11 justify-start gap-3 rounded-xl px-3 py-2 text-left text-[15px] whitespace-normal"
                onClick={() => {
                  onChange({ ...prefs, highlights: selected.map((s) => (s === id ? incoming : s)) })
                  setIncoming(null)
                }}
              >
                <span aria-hidden className="tabular flex size-6 shrink-0 items-center justify-center rounded-full border border-border text-[12px]">
                  {index + 1}
                </span>
                {statMeta(id)?.title}
              </Button>
            ))}
          </div>
          <Button type="button" variant="outline" className="h-11 self-start rounded-full px-5" onClick={() => setIncoming(null)}>
            Cancelar
          </Button>
        </div>
      ) : null}

      <div className="flex flex-col gap-4">
        {groups.map(([module, widgets]) => (
          <div key={module}>
            <p className={cn(overline, "pb-1")}>{modules[module as keyof typeof modules].name}</p>
            {widgets.map((w) => {
              const order = selected.indexOf(w.id)
              const chosen = order !== -1
              return (
                <button
                  key={w.id}
                  type="button"
                  aria-pressed={chosen}
                  aria-label={chosen ? `${w.title}: destaque ${order + 1}` : `Adicionar ${w.title} aos destaques`}
                  onClick={() => {
                    if (chosen) return
                    setIncoming(w.id)
                    if (selected.length < 4) {
                      onChange({ ...prefs, highlights: [...selected, w.id] })
                      setIncoming(null)
                    }
                  }}
                  className="flex min-h-11 w-full items-center gap-3 rounded-xl px-1 text-left text-[15px] outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <w.icon aria-hidden strokeWidth={1.75} className="size-5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 py-1 leading-6">{w.title}</span>
                  {chosen ? (
                    <span aria-hidden className="tabular flex size-7 shrink-0 items-center justify-center rounded-full bg-highlight text-[13px] font-semibold text-highlight-foreground">
                      {order + 1}
                    </span>
                  ) : (
                    <span aria-hidden className="size-7 shrink-0 rounded-full border border-border" />
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </section>
  )
}

function Panels({ prefs, onChange }: { prefs: TodayPrefs; onChange: (next: TodayPrefs) => void }) {
  const sensors = useSortSensors()
  const ids = prefs.panels.map((p) => p.id)
  const move = (from: number, to: number) => onChange({ ...prefs, panels: arrayMove(prefs.panels, from, to) })
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    move(ids.indexOf(active.id as never), ids.indexOf(over.id as never))
  }

  return (
    <section aria-label="Painéis" className="flex flex-col gap-3">
      <div>
        <h3 className="text-[17px] leading-6 font-semibold">Painéis</h3>
        <p className="text-[15px] leading-6 text-muted-foreground">Mostre, esconda e reordene. “Seu dia” pode ser escondido, mas não apagado.</p>
      </div>
      <div data-vaul-no-drag>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <ul aria-label="Painéis da página">
              {prefs.panels.map((panel, index) => {
                const meta = panelMeta(panel.id)!
                return (
                  <SortableRow key={panel.id} id={panel.id} label={meta.title}>
                    {(handle) => (
                      <>
                        {handle}
                        <meta.icon aria-hidden strokeWidth={1.75} className={cn("size-5 shrink-0", panel.visible ? "text-foreground" : "text-muted-foreground")} />
                        <span className={cn("min-w-0 flex-1 px-1 text-[15px] leading-6", !panel.visible && "text-muted-foreground")}>{meta.title}</span>
                        <MoveButtons label={meta.title} index={index} count={prefs.panels.length} onMove={(to) => move(index, to)} />
                        <span className="flex size-11 shrink-0 items-center justify-center">
                          <Switch
                            checked={panel.visible}
                            aria-label={panel.visible ? `Esconder ${meta.title}` : `Mostrar ${meta.title}`}
                            onCheckedChange={(visible) => onChange({ ...prefs, panels: prefs.panels.map((p) => (p.id === panel.id ? { ...p, visible } : p)) })}
                          />
                        </span>
                      </>
                    )}
                  </SortableRow>
                )
              })}
            </ul>
          </SortableContext>
        </DndContext>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------------------------------------------------

type CustomizeProps = { open: boolean; onOpenChange: (open: boolean) => void; prefs: TodayPrefs; onChange: (next: TodayPrefs) => void }

function ResetButton({ onChange }: { onChange: (next: TodayPrefs) => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="outline" className="h-11 rounded-full px-5">
          <RotateCcwIcon strokeWidth={1.75} /> Restaurar padrão
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Restaurar o padrão?</AlertDialogTitle>
          <AlertDialogDescription>Os 4 destaques e os painéis voltam à ordem e à visibilidade originais. Você pode personalizar de novo quando quiser.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={() => onChange(DEFAULT_PREFS)}>Restaurar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

const DESCRIPTION = "Escolha os destaques e os painéis da página Hoje. As mudanças aparecem na hora."

/** Bottom drawer on phones, right sheet from 768 px. Changes apply live behind it; "Pronto" only closes. */
export function CustomizeDialog({ open, onOpenChange, prefs, onChange }: CustomizeProps) {
  const isMobile = useIsMobile()
  const body = (
    <div className="flex flex-col gap-8">
      <Highlights prefs={prefs} onChange={onChange} />
      <Panels prefs={prefs} onChange={onChange} />
    </div>
  )
  const footer = (
    <>
      <ResetButton onChange={onChange} />
      <Button type="button" className="h-11 rounded-full px-6" onClick={() => onOpenChange(false)}>
        Pronto
      </Button>
    </>
  )

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="rounded-t-[24px] data-[vaul-drawer-direction=bottom]:max-h-[90dvh]">
          <DrawerHeader className="pb-2 text-left">
            <DrawerTitle>Personalizar</DrawerTitle>
            <DrawerDescription>{DESCRIPTION}</DrawerDescription>
          </DrawerHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4">{body}</div>
          <DrawerFooter className="flex-row justify-between gap-3 border-t border-border pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</DrawerFooter>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 sm:max-w-[480px]!">
        <SheetHeader className="border-b border-border p-6 pr-14">
          <SheetTitle>Personalizar</SheetTitle>
          <SheetDescription>{DESCRIPTION}</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-6">{body}</div>
        <SheetFooter className="flex-row justify-between gap-3 border-t border-border p-4">{footer}</SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
