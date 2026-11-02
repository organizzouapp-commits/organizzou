"use client"

import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core"
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { ArrowDownIcon, ArrowUpIcon, GripVerticalIcon, RotateCcwIcon } from "lucide-react"

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import { panelMeta, statMeta, type StatId } from "@/features/today/catalog"
import { DEFAULT_PREFS, type TodayPrefs } from "@/features/today/prefs"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"

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
  const list = prefs.highlights
  const ids = list.map((h) => h.id)
  const enabledCount = list.filter((h) => h.enabled).length

  const move = (from: number, to: number) => onChange({ ...prefs, highlights: arrayMove(list, from, to) })
  const setEnabled = (id: StatId, enabled: boolean) => onChange({ ...prefs, highlights: list.map((h) => (h.id === id ? { ...h, enabled } : h)) })
  const setAll = (enabled: boolean) => onChange({ ...prefs, highlights: list.map((h) => ({ ...h, enabled })) })
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    move(ids.indexOf(active.id as StatId), ids.indexOf(over.id as StatId))
  }

  return (
    <section aria-label="Destaques" className="flex flex-col gap-4">
      <div>
        <h3 className="text-[17px] leading-6 font-semibold">Destaques</h3>
        <p className="text-[15px] leading-6 text-muted-foreground">Ligue os números que quer ver no topo e arraste para mudar a ordem. Pode ser quantos quiser.</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="tabular text-[13px] leading-5 text-muted-foreground" role="status">
          {enabledCount} de {list.length} ligados
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" className="h-11 rounded-full px-4" disabled={enabledCount === list.length} onClick={() => setAll(true)}>
            Ativar todos
          </Button>
          <Button type="button" variant="outline" className="h-11 rounded-full px-4" disabled={enabledCount === 0} onClick={() => setAll(false)}>
            Desativar todos
          </Button>
        </div>
      </div>
      {enabledCount === 0 ? (
        <p className="rounded-2xl border border-border p-3 text-[15px] leading-6 text-muted-foreground">Nenhum destaque ligado: a faixa de destaques fica escondida na página. Ligue um para ela voltar.</p>
      ) : null}

      <div data-vaul-no-drag>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <ul aria-label="Destaques da página">
              {list.map((h, index) => {
                const meta = statMeta(h.id)!
                return (
                  <SortableRow key={h.id} id={h.id} label={meta.title}>
                    {(handle) => (
                      <>
                        {handle}
                        <meta.icon aria-hidden strokeWidth={1.75} className={cn("size-5 shrink-0", h.enabled ? "text-foreground" : "text-muted-foreground")} />
                        <span className={cn("min-w-0 flex-1 px-1 text-[15px] leading-6", !h.enabled && "text-muted-foreground")}>{meta.title}</span>
                        <MoveButtons label={meta.title} index={index} count={list.length} onMove={(to) => move(index, to)} />
                        <span className="flex size-11 shrink-0 items-center justify-center">
                          <Switch checked={h.enabled} aria-label={h.enabled ? `Desligar ${meta.title}` : `Ligar ${meta.title}`} onCheckedChange={(enabled) => setEnabled(h.id, enabled)} />
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
