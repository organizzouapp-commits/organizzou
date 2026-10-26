"use client"

import { useState } from "react"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { CheckIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/organizzou/ConfirmDialog"
import { ModuleIcon } from "@/components/organizzou/ModuleIcon"
import { modules, type ModuleId } from "@/components/organizzou/modules"
import { Bento, BentoCard, KpiCard } from "@/components/organizzou/Bento"
import { PageHeader } from "@/components/organizzou/PageHeader"
import { usePrimaryAction } from "@/components/shell/primary-action"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { goalProgress, linkRatio } from "@/features/goals/progress"
import type { GoalLinkRow, GoalWithDetails } from "@/features/goals/types"
import { daysUntil } from "@/features/studies/spaced-repetition"
import { buildMockGoals } from "@/mocks/goals"
import { dayOf, mockId } from "@/mocks/time"

const LINKABLE: ModuleId[] = ["tarefas", "rotina", "financas", "treinos", "dieta", "estudos"]
const DEFAULT_LINKS: Record<string, { label: string; total: number; unit: string }> = {
  tarefas: { label: "Tarefas concluídas", total: 10, unit: "tarefas" },
  rotina: { label: "Dias com o hábito em dia", total: 30, unit: "dias" },
  financas: { label: "Valor guardado", total: 1000, unit: "R$" },
  treinos: { label: "Treinos feitos", total: 20, unit: "treinos" },
  dieta: { label: "Dias dentro da meta", total: 30, unit: "dias" },
  estudos: { label: "Horas de estudo", total: 50, unit: "h" },
}

function formatValue(value: number, unit: string) {
  const text = value.toLocaleString("pt-BR")
  return unit === "R$" ? `R$ ${text}` : `${text} ${unit}`
}

export function MetasScreen({ nowIso }: { nowIso: string }) {
  const today = dayOf(nowIso)
  const [goals, setGoals] = useState<GoalWithDetails[]>(() => buildMockGoals(nowIso))
  const [creating, setCreating] = useState(false)
  const [toDelete, setToDelete] = useState<GoalWithDetails | null>(null)

  function toggleMilestone(goalId: string, milestoneId: string) {
    setGoals((current) =>
      current.map((g) => (g.id === goalId ? { ...g, milestones: g.milestones.map((m) => (m.id === milestoneId ? { ...m, done: !m.done } : m)) } : g))
    )
  }

  function setStatus(goal: GoalWithDetails, status: "active" | "done") {
    setGoals((current) => current.map((g) => (g.id === goal.id ? { ...g, status } : g)))
    toast.success(status === "done" ? "Meta concluída. Parabéns!" : "Meta reaberta.")
  }

  const active = goals.filter((g) => g.status === "active")
  const done = goals.filter((g) => g.status === "done")

  function renderGoals(list: GoalWithDetails[]) {
    if (list.length === 0) return <p className="py-6 text-[15px] leading-6 text-muted-foreground">Nada por aqui ainda.</p>
    return (
      <Accordion type="single" collapsible className="w-full">
        {list.map((goal) => {
          const progress = goalProgress(goal.links, goal.milestones)
          const left = goal.deadline ? daysUntil(goal.deadline, today) : null
          return (
            <AccordionItem key={goal.id} value={goal.id}>
              <AccordionTrigger className="items-start gap-4 text-left">
                <span className="flex min-w-0 flex-1 flex-col gap-2">
                  <span className="text-[17px] leading-6 font-semibold">{goal.title}</span>
                  <span className="flex items-center gap-3">
                    <Progress value={progress} className="max-w-48" aria-label={`Progresso de ${goal.title}`} />
                    <span className="tabular text-[13px] leading-5 text-muted-foreground">{progress}%</span>
                    {left !== null && goal.status === "active" ? (
                      <span className="tabular text-[13px] leading-5 text-muted-foreground">
                        · {left < 0 ? "prazo vencido" : left === 0 ? "vence hoje" : `faltam ${left} dias`}
                      </span>
                    ) : null}
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="flex flex-col gap-6">
                {goal.description ? <p className="text-[15px] leading-6 text-muted-foreground">{goal.description}</p> : null}
                {goal.deadline ? (
                  <p className="text-[13px] leading-5 text-muted-foreground">
                    Prazo: {format(parseISO(goal.deadline), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </p>
                ) : null}

                <section className="flex flex-col">
                  <h3 className="mb-1 text-[11px] leading-4 font-semibold tracking-[0.12em] text-muted-foreground uppercase">Ligada a</h3>
                  {goal.links.map((link: GoalLinkRow) => (
                    <div key={link.id} className="flex min-h-14 items-center gap-4 border-b border-border py-3 last:border-b-0">
                      <ModuleIcon module={link.module} />
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="truncate text-[15px] leading-6">{link.label}</span>
                          <span className="tabular shrink-0 text-[13px] leading-5 text-muted-foreground">
                            {formatValue(link.done, link.unit)} de {formatValue(link.total, link.unit)}
                          </span>
                        </div>
                        <Progress value={linkRatio(link) * 100} aria-label={link.label} />
                        <span className="text-[13px] leading-5 text-muted-foreground">{modules[link.module].name}</span>
                      </div>
                    </div>
                  ))}
                </section>

                {goal.milestones.length > 0 ? (
                  <section className="flex flex-col">
                    <h3 className="mb-1 text-[11px] leading-4 font-semibold tracking-[0.12em] text-muted-foreground uppercase">Marcos</h3>
                    {goal.milestones.map((m) => (
                      <label key={m.id} className="flex min-h-11 items-center gap-3 text-[15px] leading-6">
                        <Checkbox checked={m.done} onCheckedChange={() => toggleMilestone(goal.id, m.id)} />
                        <span className={m.done ? "text-muted-foreground line-through" : ""}>{m.title}</span>
                      </label>
                    ))}
                  </section>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  {goal.status === "active" ? (
                    <Button variant="outline" onClick={() => setStatus(goal, "done")}>
                      <CheckIcon strokeWidth={1.75} /> Marcar como concluída
                    </Button>
                  ) : (
                    <Button variant="outline" onClick={() => setStatus(goal, "active")}>
                      Reabrir meta
                    </Button>
                  )}
                  <Button variant="ghost" onClick={() => setToDelete(goal)}>
                    <Trash2Icon strokeWidth={1.75} /> Excluir
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>
          )
        })}
      </Accordion>
    )
  }

  usePrimaryAction("Nova meta", () => setCreating(true))
  const averageProgress =
    active.length === 0 ? 0 : Math.round(active.reduce((sum, g) => sum + goalProgress(g.links, g.milestones), 0) / active.length)
  const nextDeadline = [...active].filter((g) => g.deadline).sort((a, b) => (a.deadline ?? "").localeCompare(b.deadline ?? ""))[0]

  return (
    <div className="flex flex-col gap-5">
      <PageHeader />
      <Bento>
        <KpiCard tone="highlight" label="Em andamento" value={`${active.length}`} support={`${averageProgress}% de progresso médio`} className="col-span-12 sm:col-span-4" />
        <KpiCard label="Concluídas" value={`${done.length}`} support="metas fechadas" className="col-span-6 sm:col-span-4" />
        <KpiCard
          label="Próximo prazo"
          value={nextDeadline?.deadline ? `${daysUntil(nextDeadline.deadline, today)} dias` : "—"}
          support={nextDeadline?.title ?? "Sem prazos"}
          className="col-span-6 sm:col-span-4"
        />
        <BentoCard className="col-span-12">
      <Tabs defaultValue="ativas">
        <TabsList>
          <TabsTrigger value="ativas">
            Em andamento <Badge variant="secondary" className="tabular">{active.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="concluidas">
            Concluídas <Badge variant="secondary" className="tabular">{done.length}</Badge>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="ativas" className="pt-4">
          {renderGoals(active)}
        </TabsContent>
        <TabsContent value="concluidas" className="pt-4">
          {renderGoals(done)}
        </TabsContent>
      </Tabs>
        </BentoCard>
      </Bento>

      <GoalDialog
        open={creating}
        onOpenChange={setCreating}
        nowIso={nowIso}
        onCreate={(goal) => {
          setGoals((current) => [goal, ...current])
          toast.success("Meta criada.")
        }}
      />
      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Excluir esta meta?"
        description={toDelete ? `“${toDelete.title}” será apagada. Tarefas, hábitos e registros ligados a ela continuam existindo.` : ""}
        onConfirm={() => {
          const goal = toDelete
          setToDelete(null)
          if (!goal) return
          setGoals((current) => current.filter((g) => g.id !== goal.id))
          toast("Meta excluída.")
        }}
      />
    </div>
  )
}

function GoalDialog({
  open,
  onOpenChange,
  nowIso,
  onCreate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  nowIso: string
  onCreate: (goal: GoalWithDetails) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>{open ? <GoalForm nowIso={nowIso} onCreate={onCreate} onClose={() => onOpenChange(false)} /> : null}</DialogContent>
    </Dialog>
  )
}

function GoalForm({ nowIso, onCreate, onClose }: { nowIso: string; onCreate: (goal: GoalWithDetails) => void; onClose: () => void }) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [deadline, setDeadline] = useState("")
  const [linked, setLinked] = useState<string[]>(["tarefas"])

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault()
        if (!title.trim()) return
        const goalId = mockId("goal")
        onCreate({
          id: goalId,
          user_id: "00000000-0000-4000-8000-000000000001",
          title: title.trim(),
          description: description.trim() || null,
          deadline: deadline || null,
          status: "active",
          created_at: nowIso,
          updated_at: nowIso,
          links: linked.map((module) => ({ id: mockId("lk"), goal_id: goalId, module: module as ModuleId, done: 0, ...DEFAULT_LINKS[module] })),
          milestones: [],
        })
        onClose()
      }}
    >
      <DialogHeader>
        <DialogTitle>Nova meta</DialogTitle>
        <DialogDescription className="sr-only">Defina uma meta e ligue aos módulos que alimentam o progresso.</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-2">
        <Label htmlFor="goal-title">Meta</Label>
        <Input id="goal-title" autoFocus value={title} maxLength={100} placeholder="Ex.: Aprender a tocar violão" onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="goal-desc">Descrição</Label>
        <Textarea id="goal-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="goal-deadline">Prazo (opcional)</Label>
        <Input id="goal-deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
      </div>
      <div className="flex flex-col gap-2">
        <Label>Alimentada por</Label>
        <ToggleGroup type="multiple" variant="outline" value={linked} onValueChange={setLinked} className="flex-wrap justify-start">
          {LINKABLE.map((module) => {
            const Icon = modules[module].icon
            return (
              <ToggleGroupItem key={module} value={module}>
                <Icon strokeWidth={1.75} /> {modules[module].name}
              </ToggleGroupItem>
            )
          })}
        </ToggleGroup>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!title.trim()}>
          Criar meta
        </Button>
      </DialogFooter>
    </form>
  )
}
