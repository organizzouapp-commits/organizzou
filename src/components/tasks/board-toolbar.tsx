"use client"

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
}

function toggle<T>(values: T[], value: T) {
  return values.includes(value) ? values.filter((v) => v !== value) : [...values, value]
}

export function BoardToolbar(props: BoardToolbarProps) {
  const { filters, onFiltersChange } = props
  const active = countActiveFilters(filters)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Select value={props.boardId} onValueChange={props.onSelectBoard}>
          <SelectTrigger aria-label="Quadro" className="min-w-0 flex-1 text-[17px] font-semibold md:max-w-72 md:flex-none">
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
        <Button onClick={props.onNewTask} className="ml-auto md:hidden">
          <PlusIcon strokeWidth={1.75} /> <span className="hidden sm:inline">Nova tarefa</span>
          <span className="sm:hidden">Nova</span>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 basis-48 md:max-w-80">
          <SearchIcon aria-hidden strokeWidth={1.75} className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={filters.query}
            onChange={(e) => onFiltersChange({ ...filters, query: e.target.value })}
            placeholder="Buscar tarefas"
            aria-label="Buscar tarefas"
            className="pl-9"
          />
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline">
              <SlidersHorizontalIcon strokeWidth={1.75} /> Filtros
              {active > 0 ? <Badge variant="highlight">{active}</Badge> : null}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-5">
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
                <Label>Tags</Label>
                {props.tags.map((tag) => (
                  <label key={tag.id} className="flex min-h-11 items-center gap-3 text-[15px] md:min-h-9">
                    <Checkbox
                      checked={filters.tagIds.includes(tag.id)}
                      onCheckedChange={() => onFiltersChange({ ...filters, tagIds: toggle(filters.tagIds, tag.id) })}
                    />
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
                  <Checkbox
                    checked={filters.listIds.includes(list.id)}
                    onCheckedChange={() => onFiltersChange({ ...filters, listIds: toggle(filters.listIds, list.id) })}
                  />
                  {list.name}
                </label>
              ))}
            </div>

            <label className="flex min-h-11 items-center justify-between gap-3 text-[15px]">
              Mostrar concluídas
              <Switch
                checked={filters.showCompleted}
                onCheckedChange={(checked) => onFiltersChange({ ...filters, showCompleted: checked })}
              />
            </label>

            <Button
              variant="ghost"
              disabled={active === 0}
              onClick={() => onFiltersChange({ ...EMPTY_FILTERS, query: filters.query })}
            >
              <XIcon strokeWidth={1.75} /> Limpar filtros
            </Button>
          </PopoverContent>
        </Popover>

        <Select value={props.sort} onValueChange={(v) => props.onSortChange(v as SortKey)}>
          <SelectTrigger aria-label="Ordenar" className="w-auto min-w-0 gap-2">
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
      </div>

      <div className="flex items-center justify-between gap-3">
        <Tabs className="min-w-0" value={props.view} onValueChange={(v) => props.onViewChange(v as ViewMode)}>
          {/* On very narrow phones the icons go, so "Calendário" is never cut off (the list also scrolls if it still does not fit). */}
          <TabsList className="max-[420px]:[&_svg]:hidden">
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
        <span className="tabular hidden text-[13px] leading-5 text-muted-foreground sm:inline">
          {props.visibleCount} {props.visibleCount === 1 ? "tarefa" : "tarefas"}
        </span>
      </div>
    </div>
  )
}
