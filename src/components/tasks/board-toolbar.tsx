"use client"

import { forwardRef, useRef, useState } from "react"
import {
  ArrowLeftIcon,
  CalendarDaysIcon,
  ChevronDownIcon,
  ListIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  SlidersHorizontalIcon,
  SquareKanbanIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  countActiveFilters,
  EMPTY_FILTERS,
  type DueFilter,
  type SortKey,
  type TaskFilters,
} from "@/features/tasks/filters"
import { visibleShortcuts, type ShortcutDef } from "@/features/tasks/shortcuts"
import type { ListRow, TagRow } from "@/features/tasks/types"
import { cn } from "@/lib/utils"

import type { CalendarViewId } from "@/components/calendar/agenda-screen"
import { resolveMode, useCalendarPrefs } from "./calendar-store"
import { InlineInput } from "./inline-input"
import { ExpandingSearch, SearchField } from "./toolbar-controls"
import { ViewTabs, type ViewTab } from "./view-tabs"
import { dashedPillClass, PillTabs } from "./pill-tabs"
import type { GroupBy } from "./list-view"
import { useLabelColors } from "./label-colors-context"
import { ColorDot } from "./task-meta"

export type ViewMode = "kanban" | "lista" | "calendario"

const DUE_LABELS: Record<DueFilter, string> = {
  all: "Qualquer data",
  overdue: "Atrasadas",
  today: "Hoje",
  week: "Próximos 7 dias",
  none: "Sem data",
}

const SORT_LABELS: Record<SortKey, string> = {
  manual: "Ordem manual",
  due: "Data de entrega",
  title: "Título (A–Z)",
  created: "Mais recentes",
}

type BoardToolbarProps = {
  boards: { id: string; name: string }[]
  boardId: string
  onSelectBoard: (id: string) => void
  onNewBoard: () => void
  /** The quadro name is an inline field: `editingName` switches it on, `onCommitBoardName` saves. */
  editingName: boolean
  onEditingNameChange: (editing: boolean) => void
  onCommitBoardName: (name: string) => Promise<void>
  onArchiveBoard: () => void
  view: ViewMode
  onViewChange: (view: ViewMode) => void
  filters: TaskFilters
  onFiltersChange: (filters: TaskFilters) => void
  sort: SortKey
  onSortChange: (sort: SortKey) => void
  lists: ListRow[]
  tags: TagRow[]
  /** The shortcut chips (editable), their PENDING counts and which one the filters equal right now. */
  shortcuts: ShortcutDef[]
  counts: Record<string, number>
  activeShortcutId: string | null
  onShortcut: (shortcut: ShortcutDef) => void
  onEditShortcuts: () => void
  onSaveFilterAsShortcut: () => void
  groupBy: GroupBy
  onGroupByChange: (groupBy: GroupBy) => void
  onManageLists: () => void
  /** Phones, Kanban: the list tabs, rendered as the third row of the header block. */
  listTabs?: React.ReactNode
  isMobile: boolean
}

function toggle<T>(values: T[], value: T) {
  return values.includes(value) ? values.filter((v) => v !== value) : [...values, value]
}


function FiltersPanel({ props, showSort }: { props: BoardToolbarProps; showSort: boolean }) {
  const { filters, onFiltersChange } = props
  const labelColors = useLabelColors()
  const active = countActiveFilters(filters) + (props.sort !== "manual" ? 1 : 0)
  return (
    <div className="flex min-w-0 flex-col gap-5">
      <fieldset className="flex flex-col gap-1">
        <Label asChild>
          <legend>Ordenar por</legend>
        </Label>
        <RadioGroup value={props.sort} onValueChange={(value) => props.onSortChange(value as SortKey)} aria-label="Ordenar por" className="gap-0">
          {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
            <label key={key} className="flex min-h-11 items-center gap-3 text-[15px] md:min-h-9">
              <RadioGroupItem value={key} data-sort={key} />
              {SORT_LABELS[key]}
            </label>
          ))}
        </RadioGroup>
      </fieldset>
      {props.view === "lista" ? (
        <div className="flex flex-col gap-2">
          <Label>Agrupar por</Label>
          <ToggleGroup type="single" variant="outline" value={props.groupBy} onValueChange={(v) => v && props.onGroupByChange(v as GroupBy)} className="justify-start">
            {(["lista", "prazo"] as GroupBy[]).map((g) => (
              <ToggleGroupItem key={g} value={g} aria-label={`Agrupar por ${g}`} className="h-11 px-4 capitalize md:h-9">
                {g}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      ) : null}
      {showSort && props.view !== "calendario" ? (
        <Button type="button" variant="outline" className="h-11 justify-start rounded-full" onClick={props.onManageLists}>
          <ListIcon strokeWidth={1.75} /> Gerenciar listas
        </Button>
      ) : null}
      <div className="flex flex-col gap-2">
        <Label htmlFor="filter-due">Data de entrega</Label>
        <Select value={filters.due} onValueChange={(v) => onFiltersChange({ ...filters, due: v as DueFilter })}>
          <SelectTrigger id="filter-due" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(DUE_LABELS) as DueFilter[]).map((key) => (
              <SelectItem key={key} value={key}>
                {DUE_LABELS[key]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {props.tags.length > 0 ? (
        <div className="flex flex-col gap-1">
          <Label>Etiquetas</Label>
          {props.tags.map((tag) => (
            <label key={tag.id} className="flex min-h-11 items-center gap-3 text-[15px] md:min-h-9">
              <Checkbox checked={filters.tagIds.includes(tag.id)} onCheckedChange={() => onFiltersChange({ ...filters, tagIds: toggle(filters.tagIds, tag.id) })} />
              <ColorDot color={labelColors.colorOf("tag", tag.id)} />
              {tag.name}
            </label>
          ))}
        </div>
      ) : null}

      <div className="flex flex-col gap-1">
        <Label>Listas</Label>
        {props.lists.map((list) => (
          <label key={list.id} className="flex min-h-11 items-center gap-3 text-[15px] md:min-h-9">
            <Checkbox checked={filters.listIds.includes(list.id)} onCheckedChange={() => onFiltersChange({ ...filters, listIds: toggle(filters.listIds, list.id) })} />
            {list.name}
          </label>
        ))}
      </div>

      <label className="flex min-h-11 items-center justify-between gap-3 text-[15px]">
        Mostrar concluídas
        <Switch checked={filters.showCompleted} onCheckedChange={(checked) => onFiltersChange({ ...filters, showCompleted: checked })} />
      </label>

      <div className="flex flex-wrap gap-2">
        <Button variant="ghost" className="h-11 rounded-full" disabled={active === 0} onClick={() => (onFiltersChange({ ...EMPTY_FILTERS, query: filters.query }), props.onSortChange("manual"))}>
          <XIcon strokeWidth={1.75} /> Limpar filtros
        </Button>
        <Button variant="ghost" className="h-11 rounded-full" disabled={active === 0} onClick={props.onSaveFilterAsShortcut}>
          <PlusIcon strokeWidth={1.75} /> Salvar filtro atual como atalho
        </Button>
      </div>
    </div>
  )
}

const MODE_LABELS = [
  { id: "mes", label: "Mês" },
  { id: "semana", label: "Semana" },
  { id: "dia", label: "Dia" },
  { id: "agenda", label: "Agenda" },
] as const

/** Phones, Agenda: row 3 of the header card is the mode switcher (the shared PillTabs, equal widths). */
function CalendarModes() {
  const { prefs, update } = useCalendarPrefs()
  const mode = resolveMode(prefs, true)
  return (
    <PillTabs
      equal
      ariaLabel="Modo do calendário"
      value={mode}
      items={MODE_LABELS.map((m) => ({ id: m.id, label: m.label }))}
      onSelect={(item) => update((p) => ({ ...p, view: item.id as CalendarViewId }))}
      itemProps={(item) => ({ "data-calendar-mode": item.id })}
    />
  )
}

export const BoardToolbar = forwardRef<HTMLInputElement, BoardToolbarProps>(function BoardToolbar(props, searchRef) {
  const { filters, onFiltersChange, isMobile } = props
  const active = countActiveFilters(filters) + (props.sort !== "manual" ? 1 : 0)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(Boolean(filters.query))
  const currentBoard = props.boards.find((b) => b.id === props.boardId)

  // Two controls: the NAME (click edits it in place, auto-commit) and a separate chevron circle that opens the quadro menu.
  // "Renomear" in the menu starts the inline field; the menu must not hand focus back to the chevron afterwards.
  const focusName = useRef(false)
  const boardSwitcher = (
    <div className="flex min-w-0 items-center gap-1">
      {props.editingName ? (
        <InlineInput
          initialValue={currentBoard?.name ?? ""}
          maxLength={60}
          ariaLabel="Nome do quadro"
          className="min-w-0 flex-1"
          inputClassName="h-10 rounded-full text-[18px] leading-6 font-semibold md:h-10 md:text-[17px]"
          onCommit={(name) => props.onCommitBoardName(name)}
          onClose={() => props.onEditingNameChange(false)}
        />
      ) : (
        <button
          type="button"
          data-board-name
          aria-label={`Quadro: ${currentBoard?.name ?? ""}`}
          title="Clique para renomear"
          onClick={() => props.onEditingNameChange(true)}
          className="relative min-h-10 max-w-full min-w-0 truncate rounded-full px-3 text-left text-[18px] leading-6 font-semibold outline-none after:absolute after:inset-x-0 after:-inset-y-0.5 hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 max-md:-ml-2 max-md:min-h-9 max-md:px-2 md:text-[17px]"
        >
          {currentBoard?.name ?? "Tarefas"}
        </button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="icon" aria-label="Trocar de quadro" className="relative size-8 shrink-0 rounded-full after:absolute after:-inset-1.5 md:size-10 md:after:hidden">
            <ChevronDownIcon strokeWidth={1.75} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="min-w-60 rounded-2xl p-2"
          onCloseAutoFocus={(event) => {
            if (!focusName.current) return
            focusName.current = false
            event.preventDefault()
            props.onEditingNameChange(true)
          }}
        >
          {props.boards.map((board) => (
            <DropdownMenuItem key={board.id} className={cn("min-h-11 gap-3 rounded-xl px-3 text-[15px]", board.id === props.boardId && "bg-foreground/10 font-semibold")} onSelect={() => props.onSelectBoard(board.id)}>
              {board.name}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem className="min-h-11 gap-3 rounded-xl px-3 text-[15px]" onSelect={props.onNewBoard}>
            <PlusIcon strokeWidth={1.75} /> Novo quadro
          </DropdownMenuItem>
          <DropdownMenuItem className="min-h-11 gap-3 rounded-xl px-3 text-[15px]" onSelect={() => (focusName.current = true)}>
            <PencilIcon strokeWidth={1.75} /> Renomear
          </DropdownMenuItem>
          <DropdownMenuItem className="min-h-11 gap-3 rounded-xl px-3 text-[15px]" disabled={props.boards.length <= 1} onSelect={props.onArchiveBoard}>
            <Trash2Icon strokeWidth={1.75} /> Arquivar quadro
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )

  // Neutral segmented control (shared with Finanças): the ACTIVE view is foreground 14% with weight 600, never Lima.
  const views: ViewTab<ViewMode>[] = [
    { id: "kanban", label: "Kanban", icon: SquareKanbanIcon },
    { id: "lista", label: "Lista", icon: ListIcon },
    { id: "calendario", label: "Agenda", icon: CalendarDaysIcon },
  ]
  const viewTabs = <ViewTabs tabs={views} value={props.view} onChange={props.onViewChange} ariaLabel="Visão" isMobile={isMobile} />

  // Editable shortcut chips with PENDING counts: exactly the ones switched on in "Editar atalhos", in that order. Lima = active.
  const chips = (
    <PillTabs
      kind="toggles"
      ariaLabel="Atalhos"
      onSelect={(item) => {
        const chip = props.shortcuts.find((x) => x.id === item.id)
        if (chip) props.onShortcut(chip)
      }}
      isOn={(item) => props.activeShortcutId === item.id}
      items={visibleShortcuts(props.shortcuts)
        .map((chip) => ({ id: chip.id, label: chip.label, count: props.counts[chip.id] ?? 0 }))}
      trailing={
        <button type="button" aria-label="Editar atalhos" onClick={props.onEditShortcuts} className={dashedPillClass}>
          <PencilIcon aria-hidden strokeWidth={1.75} className="size-4" /> Editar
        </button>
      }
      className="min-w-0"
    />
  )

  const filtersBadge = active > 0 ? <Badge variant="highlight">{active}</Badge> : null

  const sheet = (
    <Drawer open={filtersOpen} onOpenChange={setFiltersOpen}>
      <DrawerContent className="max-h-[88dvh]">
        <DrawerHeader className="text-left">
          <DrawerTitle>Filtrar e ordenar</DrawerTitle>
          <DrawerDescription className="sr-only">Filtre, ordene e agrupe as tarefas do quadro.</DrawerDescription>
        </DrawerHeader>
        <div className="scroll-soft overflow-y-auto px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <FiltersPanel
            props={{
              ...props,
              onManageLists: () => {
                setFiltersOpen(false)
                props.onManageLists()
              },
            }}
            showSort
          />
        </div>
      </DrawerContent>
    </Drawer>
  )

  if (isMobile) {
    // The card itself (solid, border, radius 20, 12px padding, 12px above it) is drawn by the page and scrolls away with it. 8px between rows.
    // Row 1: quadro + search + filters. NO "+" here: the app header's Lima "+" is "Nova tarefa" on this screen.
    // Row 2: icon-only view switch. Row 3: list tabs / shortcut chips (hidden in Calendário, which has its own toolbar).
    return (
      <div className="flex flex-col gap-2">
        {searchOpen ? (
          <div className="flex h-9 items-center gap-2">
            <Button variant="ghost" size="icon" className="relative size-9 shrink-0 rounded-full after:absolute after:-inset-1" aria-label="Fechar a busca" onClick={() => (onFiltersChange({ ...filters, query: "" }), setSearchOpen(false))}>
              <ArrowLeftIcon strokeWidth={1.75} />
            </Button>
            <SearchField ref={searchRef} value={filters.query} onChange={(query) => onFiltersChange({ ...filters, query })} onEscape={() => (onFiltersChange({ ...filters, query: "" }), setSearchOpen(false))} className="flex-1" />
          </div>
        ) : (
          <div className="flex h-9 items-center gap-2">
            <div className="min-w-0 flex-1">{boardSwitcher}</div>
            <Button variant="outline" size="icon" className="relative size-9 shrink-0 rounded-full after:absolute after:-inset-1" aria-label="Buscar tarefas" onClick={() => setSearchOpen(true)}>
              <SearchIcon strokeWidth={1.75} />
            </Button>
            <Button variant="outline" size="icon" className="relative size-9 shrink-0 rounded-full after:absolute after:-inset-1" aria-label={active > 0 ? `Filtrar e ordenar, ${active} ativos` : "Filtrar e ordenar"} onClick={() => setFiltersOpen(true)}>
              <SlidersHorizontalIcon strokeWidth={1.75} />
              {active > 0 ? <span className="tabular absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-highlight text-[11px] font-semibold text-highlight-foreground">{active}</span> : null}
            </Button>
          </div>
        )}
        {viewTabs}
        {props.view === "kanban" ? props.listTabs : props.view === "lista" ? chips : <CalendarModes />}
        {sheet}
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 min-[1280px]:flex-nowrap">
      <div className="flex min-w-0 shrink-0 items-center">{boardSwitcher}</div>
      {viewTabs}
      <div className="order-last w-full min-[1280px]:order-none min-[1280px]:w-auto min-[1280px]:min-w-0 min-[1280px]:flex-1">{chips}</div>
      <div className="ml-auto flex shrink-0 items-center gap-2">
        {/* Local filter only; the header search stays global. The icon expands into the pill ("/" focuses it). */}
        <ExpandingSearch ref={searchRef} hint label="Buscar tarefas" value={filters.query} onChange={(query) => onFiltersChange({ ...filters, query })} />
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="h-10 shrink-0 rounded-full px-4">
              <SlidersHorizontalIcon strokeWidth={1.75} /> Filtros
              {filtersBadge}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="max-h-[min(80dvh,640px)] w-80 max-w-[calc(100vw-2rem)] scroll-soft overflow-x-hidden overflow-y-auto">
            <FiltersPanel props={props} showSort={false} />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
})
