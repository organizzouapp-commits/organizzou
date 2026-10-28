"use client"

import { forwardRef, useState } from "react"
import {
  ArrowUpDownIcon,
  CalendarDaysIcon,
  EllipsisIcon,
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  countActiveFilters,
  EMPTY_FILTERS,
  type DueFilter,
  type SortKey,
  type TaskFilters,
} from "@/features/tasks/filters"
import { PRIORITIES, PRIORITY_LABELS, type ListRow, type Priority, type TagRow } from "@/features/tasks/types"
import { cn } from "@/lib/utils"

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

/** Quick filters next to the toolbar: one tap each, tap again to clear. */
const SMART_CHIPS: { due: DueFilter; label: string }[] = [
  { due: "today", label: "Hoje" },
  { due: "week", label: "Esta semana" },
  { due: "overdue", label: "Atrasadas" },
  { due: "none", label: "Sem data" },
]

type BoardToolbarProps = {
  boards: { id: string; name: string }[]
  boardId: string
  onSelectBoard: (id: string) => void
  onNewBoard: () => void
  onRenameBoard: () => void
  onArchiveBoard: () => void
  onNewTask: () => void
  view: ViewMode
  onViewChange: (view: ViewMode) => void
  filters: TaskFilters
  onFiltersChange: (filters: TaskFilters) => void
  sort: SortKey
  onSortChange: (sort: SortKey) => void
  lists: ListRow[]
  tags: TagRow[]
  visibleCount: number
  isMobile: boolean
}

function toggle<T>(values: T[], value: T) {
  return values.includes(value) ? values.filter((v) => v !== value) : [...values, value]
}

function SortSelect({ sort, onSortChange, className }: { sort: SortKey; onSortChange: (sort: SortKey) => void; className?: string }) {
  return (
    <Select value={sort} onValueChange={(v) => onSortChange(v as SortKey)}>
      <SelectTrigger aria-label="Ordenar" className={cn("w-auto min-w-0 gap-2", className)}>
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
          <SortSelect sort={props.sort} onSortChange={props.onSortChange} className="w-full" />
        </div>
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

      <Button variant="ghost" disabled={active === 0} onClick={() => onFiltersChange({ ...EMPTY_FILTERS, query: filters.query })}>
        <XIcon strokeWidth={1.75} /> Limpar filtros
      </Button>
    </div>
  )
}

export const SearchField = forwardRef<HTMLInputElement, { value: string; onChange: (value: string) => void; className?: string }>(function SearchField(
  { value, onChange, className },
  ref
) {
  return (
    <div className={cn("relative min-w-0", className)}>
      <SearchIcon aria-hidden strokeWidth={1.75} className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={ref}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Buscar tarefas  ( / )"
        aria-label="Buscar tarefas"
        className="pl-9"
      />
    </div>
  )
})

export const BoardToolbar = forwardRef<HTMLInputElement, BoardToolbarProps>(function BoardToolbar(props, searchRef) {
  const { filters, onFiltersChange, isMobile } = props
  const active = countActiveFilters(filters)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const filtersButton = (
    <Button variant="outline" className="shrink-0" onClick={isMobile ? () => setFiltersOpen(true) : undefined}>
      <SlidersHorizontalIcon strokeWidth={1.75} /> Filtros
      {active > 0 ? <Badge variant="highlight">{active}</Badge> : null}
    </Button>
  )

  const boardSelect = (
    <>
      <Select value={props.boardId} onValueChange={props.onSelectBoard}>
        <SelectTrigger aria-label="Quadro" className="min-w-0 max-w-64 flex-1 text-[15px] font-semibold md:flex-none">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {props.boards.map((board) => (
            <SelectItem key={board.id} value={board.id}>
              {board.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Opções do quadro">
            <EllipsisIcon strokeWidth={1.75} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={props.onNewBoard}>
            <PlusIcon strokeWidth={1.75} /> Novo quadro
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={props.onRenameBoard}>
            <PencilIcon strokeWidth={1.75} /> Renomear quadro
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" disabled={props.boards.length <= 1} onSelect={props.onArchiveBoard}>
            <Trash2Icon strokeWidth={1.75} /> Arquivar quadro
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )

  const viewTabs = (
    <Tabs className="min-w-0" value={props.view} onValueChange={(v) => props.onViewChange(v as ViewMode)}>
      {/* On very narrow phones the icons go, so "Calendário" is never cut off (the list also scrolls if it still does not fit). */}
      <TabsList aria-label="Visão" className="max-[420px]:[&_svg]:hidden">
        <TabsTrigger value="kanban">
          <SquareKanbanIcon strokeWidth={1.75} /> Kanban
        </TabsTrigger>
        <TabsTrigger value="lista">
          <ListIcon strokeWidth={1.75} /> Lista
        </TabsTrigger>
        <TabsTrigger value="calendario">
          <CalendarDaysIcon strokeWidth={1.75} /> Calendário
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )

  const chips = (
    <div role="group" aria-label="Filtros rápidos" className="no-scrollbar flex gap-2 overflow-x-auto">
      {SMART_CHIPS.map((chip) => {
        const on = filters.due === chip.due
        return (
          <button
            key={chip.due}
            type="button"
            aria-pressed={on}
            onClick={() => onFiltersChange({ ...filters, due: on ? "all" : chip.due })}
            className={cn(
              "inline-flex h-9 shrink-0 items-center rounded-full border px-4 text-[14px] outline-none transition-colors duration-[400ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none",
              on ? "border-transparent bg-highlight font-medium text-highlight-foreground" : "border-border hover:bg-accent"
            )}
          >
            {chip.label}
          </button>
        )
      })}
    </div>
  )

  if (isMobile) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          {boardSelect}
          <Button onClick={props.onNewTask} className="ml-auto">
            <PlusIcon strokeWidth={1.75} /> Nova
          </Button>
        </div>
        {viewTabs}
        <div className="flex items-center gap-2">
          <SearchField ref={searchRef} value={filters.query} onChange={(query) => onFiltersChange({ ...filters, query })} className="flex-1" />
          {filtersButton}
        </div>
        {chips}
        <Drawer open={filtersOpen} onOpenChange={setFiltersOpen}>
          <DrawerContent className="max-h-[88dvh]">
            <DrawerHeader className="text-left">
              <DrawerTitle>Filtros</DrawerTitle>
              <DrawerDescription className="sr-only">Filtre e ordene as tarefas do quadro.</DrawerDescription>
            </DrawerHeader>
            <div className="overflow-y-auto px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
              <FiltersPanel props={props} showSort />
            </div>
          </DrawerContent>
        </Drawer>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex min-w-0 items-center gap-1">{boardSelect}</div>
        {viewTabs}
        <SearchField ref={searchRef} value={filters.query} onChange={(query) => onFiltersChange({ ...filters, query })} className="min-w-44 max-w-72 flex-1" />
        <Popover>
          <PopoverTrigger asChild>{filtersButton}</PopoverTrigger>
          <PopoverContent align="start" className="w-80 max-w-[calc(100vw-2rem)]">
            <FiltersPanel props={props} showSort={false} />
          </PopoverContent>
        </Popover>
        <SortSelect sort={props.sort} onSortChange={props.onSortChange} />
        <span className="tabular ml-auto text-[13px] leading-5 text-muted-foreground">
          {props.visibleCount} {props.visibleCount === 1 ? "tarefa" : "tarefas"}
        </span>
      </div>
      {chips}
    </div>
  )
})
