"use client"

import { forwardRef, useState } from "react"
import {
  ArrowLeftIcon,
  ArrowUpDownIcon,
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
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
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
import type { ShortcutDef } from "@/features/tasks/shortcuts"
import { PRIORITIES, PRIORITY_LABELS, type ListRow, type Priority, type TagRow } from "@/features/tasks/types"
import { cn } from "@/lib/utils"

import type { GroupBy } from "./list-view"
import { SwatchDot } from "./task-meta"

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
  priority: "Prioridade",
  title: "Título (A–Z)",
  created: "Mais recentes",
}

type BoardToolbarProps = {
  boards: { id: string; name: string }[]
  boardId: string
  onSelectBoard: (id: string) => void
  onNewBoard: () => void
  onRenameBoard: () => void
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

function SortSelect({ sort, onSortChange, className }: { sort: SortKey; onSortChange: (sort: SortKey) => void; className?: string }) {
  return (
    <Select value={sort} onValueChange={(v) => onSortChange(v as SortKey)}>
      <SelectTrigger aria-label="Ordenar" className={cn("w-auto min-w-0 gap-2 rounded-full", className)}>
        <ArrowUpDownIcon aria-hidden strokeWidth={1.75} className="size-4" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
          <SelectItem key={key} value={key}>
            {SORT_LABELS[key]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function FiltersPanel({ props, showSort }: { props: BoardToolbarProps; showSort: boolean }) {
  const { filters, onFiltersChange } = props
  const active = countActiveFilters(filters)
  return (
    <div className="flex flex-col gap-5">
      {showSort ? (
        <div className="flex flex-col gap-2">
          <Label>Ordem</Label>
          <SortSelect sort={props.sort} onSortChange={props.onSortChange} className="h-11 w-full" />
        </div>
      ) : null}
      {props.view === "lista" ? (
        <div className="flex flex-col gap-2">
          <Label>Agrupar por</Label>
          <ToggleGroup type="single" variant="outline" value={props.groupBy} onValueChange={(v) => v && props.onGroupByChange(v as GroupBy)} className="justify-start">
            {(["lista", "prazo", "prioridade"] as GroupBy[]).map((g) => (
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
        <Label>Prioridade</Label>
        <ToggleGroup
          type="multiple"
          variant="outline"
          value={filters.priorities}
          onValueChange={(values) => onFiltersChange({ ...filters, priorities: values as Priority[] })}
          className="flex-wrap justify-start"
        >
          {PRIORITIES.filter((p) => p !== "none").map((p) => (
            <ToggleGroupItem key={p} value={p} aria-label={PRIORITY_LABELS[p]}>
              {PRIORITY_LABELS[p]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

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
              <SwatchDot swatch={tag.swatch} />
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
        <Button variant="ghost" className="h-11 rounded-full" disabled={active === 0} onClick={() => onFiltersChange({ ...EMPTY_FILTERS, query: filters.query })}>
          <XIcon strokeWidth={1.75} /> Limpar filtros
        </Button>
        <Button variant="ghost" className="h-11 rounded-full" disabled={active === 0} onClick={props.onSaveFilterAsShortcut}>
          <PlusIcon strokeWidth={1.75} /> Salvar filtro atual como atalho
        </Button>
      </div>
    </div>
  )
}

/** Pill search, the same treatment as the header's search (radius 999, card background, border, 15px text, icon at 16px). */
export const SearchField = forwardRef<HTMLInputElement, { value: string; onChange: (value: string) => void; className?: string; onFocus?: () => void; onBlur?: () => void; onEscape?: () => void; hint?: boolean }>(function SearchField(
  { value, onChange, className, onFocus, onBlur, onEscape, hint },
  ref
) {
  return (
    <div className={cn("relative min-w-0", className)}>
      <SearchIcon aria-hidden strokeWidth={1.75} className="pointer-events-none absolute top-1/2 left-4 size-[18px] -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={ref}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Buscar tarefas"
        aria-label="Buscar tarefas"
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation()
            onEscape?.()
          }
        }}
        className="h-11 rounded-full border-border bg-card pr-10 pl-11 text-[15px] md:h-10 dark:bg-card"
      />
      {hint && !value ? <kbd aria-hidden className="pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 rounded-md border border-border px-1.5 text-[12px] leading-5 text-muted-foreground md:block">/</kbd> : null}
    </div>
  )
})

export const BoardToolbar = forwardRef<HTMLInputElement, BoardToolbarProps>(function BoardToolbar(props, searchRef) {
  const { filters, onFiltersChange, isMobile } = props
  const active = countActiveFilters(filters)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(Boolean(filters.query))
  const currentBoard = props.boards.find((b) => b.id === props.boardId)

  const boardSwitcher = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Quadro: ${currentBoard?.name ?? ""}`}
          onDoubleClick={props.onRenameBoard}
          className="flex min-h-11 max-w-full min-w-0 items-center gap-1.5 rounded-xl px-2 text-left text-[20px] leading-7 font-semibold outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 max-md:-ml-2 md:min-h-10 md:text-[17px] md:leading-6"
        >
          <span className="truncate">{currentBoard?.name ?? "Tarefas"}</span>
          <ChevronDownIcon aria-hidden strokeWidth={1.75} className="size-5 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-60 rounded-2xl p-2">
        {props.boards.map((board) => (
          <DropdownMenuItem key={board.id} className={cn("min-h-11 gap-3 rounded-xl px-3 text-[15px]", board.id === props.boardId && "bg-foreground/10 font-semibold")} onSelect={() => props.onSelectBoard(board.id)}>
            {board.name}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="min-h-11 gap-3 rounded-xl px-3 text-[15px]" onSelect={props.onNewBoard}>
          <PlusIcon strokeWidth={1.75} /> Novo quadro
        </DropdownMenuItem>
        <DropdownMenuItem className="min-h-11 gap-3 rounded-xl px-3 text-[15px]" onSelect={props.onRenameBoard}>
          <PencilIcon strokeWidth={1.75} /> Renomear quadro
        </DropdownMenuItem>
        <DropdownMenuItem className="min-h-11 gap-3 rounded-xl px-3 text-[15px]" disabled={props.boards.length <= 1} onSelect={props.onArchiveBoard}>
          <Trash2Icon strokeWidth={1.75} /> Arquivar quadro
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  // Neutral segmented control: the ACTIVE view is foreground 14% with weight 600, never Lima.
  const views: { id: ViewMode; label: string; icon: typeof ListIcon }[] = [
    { id: "kanban", label: "Kanban", icon: SquareKanbanIcon },
    { id: "lista", label: "Lista", icon: ListIcon },
    { id: "calendario", label: "Calendário", icon: CalendarDaysIcon },
  ]
  const viewTabs = (
    <div role="tablist" aria-label="Visão" className={cn("grid h-[52px] min-w-0 grid-cols-3 items-center gap-0.5 rounded-full bg-muted p-1 md:flex md:h-10", isMobile && "w-full")}>
      {views.map(({ id, label, icon: Icon }) => {
        const on = props.view === id
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => props.onViewChange(id)}
            className={cn(
              "flex h-full min-w-0 items-center justify-center gap-1.5 rounded-full px-2 text-[14px] whitespace-nowrap outline-none transition-colors duration-[400ms] focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none md:px-3 min-[1536px]:px-4",
              on ? "bg-foreground/14 font-semibold text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon aria-hidden strokeWidth={1.75} className="size-4 max-[400px]:hidden" />
            <span className={cn(!isMobile && "max-[1535px]:sr-only")}>{label}</span>
          </button>
        )
      })}
    </div>
  )

  // Editable shortcut chips with PENDING counts; hidden at 0 unless pinned (or active). Lima = active.
  const chips = (
    <div className="flex min-w-0 items-center gap-1">
      <div role="group" aria-label="Atalhos" className="no-scrollbar flex min-w-0 snap-x gap-2 overflow-x-auto" ref={(el) => el?.querySelector<HTMLElement>("[aria-pressed=true]")?.scrollIntoView({ inline: "center", block: "nearest" })}>
        {props.shortcuts
          .filter((chip) => !chip.hidden && (chip.pinned || (props.counts[chip.id] ?? 0) > 0 || props.activeShortcutId === chip.id))
          .map((chip) => {
            const on = props.activeShortcutId === chip.id
            return (
              <button
                key={chip.id}
                type="button"
                aria-pressed={on}
                onClick={() => props.onShortcut(chip)}
                className={cn(
                  "inline-flex h-11 shrink-0 snap-center items-center gap-2 rounded-full border px-4 text-[14px] whitespace-nowrap outline-none transition-colors duration-[400ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none md:h-9",
                  on ? "border-transparent bg-highlight font-medium text-highlight-foreground" : "border-border hover:bg-accent"
                )}
              >
                {chip.label}
                <span className={cn("tabular text-[13px]", on ? "opacity-70" : "text-muted-foreground")}>{props.counts[chip.id] ?? 0}</span>
              </button>
            )
          })}
      </div>
      <Button type="button" variant="ghost" size="icon" aria-label="Editar atalhos" className="size-11 shrink-0 rounded-full md:size-9" onClick={props.onEditShortcuts}>
        <PencilIcon strokeWidth={1.75} />
      </Button>
    </div>
  )

  const filtersBadge = active > 0 ? <Badge variant="highlight">{active}</Badge> : null

  const sheet = (
    <Drawer open={filtersOpen} onOpenChange={setFiltersOpen}>
      <DrawerContent className="max-h-[88dvh]">
        <DrawerHeader className="text-left">
          <DrawerTitle>Filtrar e ordenar</DrawerTitle>
          <DrawerDescription className="sr-only">Filtre, ordene e agrupe as tarefas do quadro.</DrawerDescription>
        </DrawerHeader>
        <div className="overflow-y-auto px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
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
    // Flat on the page (no card): 16px gutters come from the page, 8px between rows. Row 1: quadro + search + filters. NO "+" here: the
    // app header's Lima "+" is "Nova tarefa" on this screen.
    return (
      <div className="flex flex-col gap-2">
        {searchOpen ? (
          <div className="flex h-11 items-center gap-2">
            <Button variant="ghost" size="icon" className="size-11 shrink-0 rounded-full" aria-label="Fechar a busca" onClick={() => (onFiltersChange({ ...filters, query: "" }), setSearchOpen(false))}>
              <ArrowLeftIcon strokeWidth={1.75} />
            </Button>
            <SearchField ref={searchRef} value={filters.query} onChange={(query) => onFiltersChange({ ...filters, query })} onEscape={() => (onFiltersChange({ ...filters, query: "" }), setSearchOpen(false))} className="flex-1" />
          </div>
        ) : (
          <div className="flex h-11 items-center gap-2">
            <div className="min-w-0 flex-1">{boardSwitcher}</div>
            <Button variant="outline" size="icon" className="size-11 shrink-0 rounded-full" aria-label="Buscar tarefas" onClick={() => setSearchOpen(true)}>
              <SearchIcon strokeWidth={1.75} />
            </Button>
            <Button variant="outline" size="icon" className="relative size-11 shrink-0 rounded-full" aria-label={active > 0 ? `Filtrar e ordenar, ${active} ativos` : "Filtrar e ordenar"} onClick={() => setFiltersOpen(true)}>
              <SlidersHorizontalIcon strokeWidth={1.75} />
              {active > 0 ? <span className="tabular absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-highlight text-[11px] font-semibold text-highlight-foreground">{active}</span> : null}
            </Button>
          </div>
        )}
        {viewTabs}
        {props.view === "kanban" ? props.listTabs : chips}
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
        <div className="flex items-center">
          <Button variant="outline" size="icon" className={cn("size-10 rounded-full", searchOpen && "hidden")} aria-label="Buscar tarefas" onClick={() => setSearchOpen(true)}>
            <SearchIcon strokeWidth={1.75} />
          </Button>
          <div className={cn("relative transition-[width] duration-[400ms] motion-reduce:transition-none", "ease-[cubic-bezier(0.2,0.8,0.2,1)]", searchOpen ? "w-56" : "w-0 overflow-hidden")}>
            <SearchField ref={searchRef} hint value={filters.query} onChange={(query) => onFiltersChange({ ...filters, query })} onFocus={() => setSearchOpen(true)} onBlur={() => !filters.query && setSearchOpen(false)} onEscape={() => (onFiltersChange({ ...filters, query: "" }), setSearchOpen(false))} className="w-56" />
          </div>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="h-10 shrink-0 rounded-full px-4">
              <SlidersHorizontalIcon strokeWidth={1.75} /> Filtros
              {filtersBadge}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="max-h-[min(80dvh,640px)] w-80 max-w-[calc(100vw-2rem)] overflow-y-auto">
            <FiltersPanel props={props} showSort={false} />
          </PopoverContent>
        </Popover>
        <SortSelect sort={props.sort} onSortChange={props.onSortChange} className="h-10 rounded-full max-[1535px]:[&_[data-slot=select-value]]:sr-only" />
      </div>
    </div>
  )
})
