"use client"

import { useState, type ReactNode } from "react"
import {
  CalendarDaysIcon,
  CircleAlertIcon,
  InboxIcon,
  LayoutDashboardIcon,
  SquareKanbanIcon,
  Trash2Icon,
  WalletIcon,
} from "lucide-react"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"
import { toast } from "sonner"

import { AssistantFab } from "@/components/organizzou/AssistantFab"
import { BottomNav, type BottomNavItem } from "@/components/organizzou/BottomNav"
import { EmptyState } from "@/components/organizzou/EmptyState"
import { HabitCheck } from "@/components/organizzou/HabitCheck"
import { ListRow } from "@/components/organizzou/ListRow"
import { Logo } from "@/components/organizzou/Logo"
import { ModuleIcon } from "@/components/organizzou/ModuleIcon"
import { modules, moduleList } from "@/components/organizzou/modules"
import { Stat } from "@/components/organizzou/Stat"
import { ThemeToggle } from "@/components/organizzou/ThemeToggle"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"

const palette = [
  { name: "Lima", hex: "#DBFD00", swatch: "bg-palette-lima", use: "Destaque: ação principal, item ativo, progresso" },
  { name: "Lima verso", hex: "#8FA800", swatch: "bg-palette-lima-verso", use: "Segundo tom do ícone; série secundária" },
  { name: "Tinta", hex: "#0C0E07", swatch: "bg-palette-tinta", use: "Fundo do escuro; texto no claro" },
  { name: "Tinta verso", hex: "#4B5A00", swatch: "bg-palette-tinta-verso", use: "Destaque legível no claro" },
  { name: "Grafite", hex: "#1A1D12", swatch: "bg-palette-grafite", use: "Superfícies no escuro" },
  { name: "Papel", hex: "#F6F7F0", swatch: "bg-palette-papel", use: "Fundo do claro; texto no escuro" },
]

const typeScale = [
  { name: "Display", spec: "36/40 · 600", className: "text-[30px] leading-9 font-semibold tracking-[-0.02em] md:text-4xl md:leading-10", sample: "R$ 4.280,50" },
  { name: "H1", spec: "28/34 · 600", className: "text-[26px] leading-8 font-semibold tracking-[-0.02em] md:text-[28px] md:leading-[34px]", sample: "Tudo certo por hoje" },
  { name: "H2", spec: "20/28 · 600", className: "text-xl leading-7 font-semibold tracking-[-0.01em]", sample: "Próximas tarefas" },
  { name: "H3", spec: "17/24 · 600", className: "text-[17px] leading-6 font-semibold", sample: "Treino de pernas" },
  { name: "Body", spec: "15–16/24 · 400", className: "text-[15px] leading-6", sample: "3 tarefas para hoje." },
  { name: "Small", spec: "13/20 · 400–500", className: "text-[13px] leading-5 font-medium", sample: "Hoje, 18:30" },
  { name: "Overline", spec: "11/16 · 600", className: "text-[11px] leading-4 font-semibold tracking-[0.12em] uppercase", sample: "Próximas" },
]

const weeklySpend = [
  { dia: "Seg", gasto: 120, meta: 150 },
  { dia: "Ter", gasto: 80, meta: 150 },
  { dia: "Qua", gasto: 210, meta: 150 },
  { dia: "Qui", gasto: 95, meta: 150 },
  { dia: "Sex", gasto: 160, meta: 150 },
  { dia: "Sáb", gasto: 240, meta: 150 },
  { dia: "Dom", gasto: 70, meta: 150 },
]

const chartConfig = {
  gasto: { label: "Gasto", color: "var(--chart-1)" },
  meta: { label: "Meta", color: "var(--chart-2)" },
} satisfies ChartConfig

const navItems: [BottomNavItem, BottomNavItem, BottomNavItem, BottomNavItem] = [
  { id: "hoje", label: "Hoje", icon: LayoutDashboardIcon },
  { id: "tarefas", label: "Tarefas", icon: SquareKanbanIcon },
  { id: "agenda", label: "Agenda", icon: CalendarDaysIcon },
  { id: "financas", label: "Finanças", icon: WalletIcon },
]

function Section({ title, overline, children }: { title: string; overline?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-6 py-8 md:py-10">
      <div className="flex flex-col gap-1">
        {overline ? (
          <span className="text-[11px] leading-4 font-semibold tracking-[0.12em] text-muted-foreground uppercase">
            {overline}
          </span>
        ) : null}
        <h2 className="text-xl leading-7 font-semibold tracking-[-0.01em]">{title}</h2>
      </div>
      {children}
    </section>
  )
}

export default function DesignSystemPage() {
  const [habits, setHabits] = useState({ agua: true, leitura: false, treino: false })
  const [navActive, setNavActive] = useState("hoje")
  const [notify, setNotify] = useState(true)
  const [plan, setPlan] = useState("mensal")

  return (
    <div className="mx-auto w-full max-w-[1120px] flex-1 px-4 pb-32 md:px-6 lg:px-10">
      <header className="flex items-center justify-between py-6">
        <Logo />
        <ThemeToggle />
      </header>

      <div className="flex flex-col gap-2 py-4">
        <h1 className="text-[26px] leading-8 font-semibold tracking-[-0.02em] md:text-[28px] md:leading-[34px]">
          Design system
        </h1>
        <p className="max-w-xl text-base leading-6 text-muted-foreground">
          Vitrine do Organizzou v2 (clean). Seis cores, muito espaço e linhas finas.
        </p>
      </div>

      <Separator />

      <Section overline="Marca" title="Logotipo e ícone">
        <div className="flex flex-wrap items-center gap-8">
          <Logo />
          <Logo iconOnly />
          <Logo iconOnly className="size-4" />
        </div>
      </Section>

      <Separator />

      <Section overline="Cores" title="As seis cores do sistema">
        <div className="grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-3 lg:grid-cols-6">
          {palette.map((color) => (
            <div key={color.name} className="flex flex-col gap-3">
              <div className={`${color.swatch} h-20 rounded-xl border border-border`} />
              <div className="flex flex-col">
                <span className="text-[15px] leading-6 font-semibold">{color.name}</span>
                <span className="tabular font-mono text-[13px] leading-5 text-muted-foreground">
                  {color.hex}
                </span>
                <span className="mt-1 text-[13px] leading-5 text-muted-foreground">{color.use}</span>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Separator />

      <Section overline="Tipografia" title="Escala tipográfica (Outfit)">
        <div className="flex flex-col">
          {typeScale.map((t) => (
            <div
              key={t.name}
              className="flex flex-col gap-1 border-b border-border py-4 last:border-b-0 md:flex-row md:items-baseline md:gap-8"
            >
              <div className="flex w-40 shrink-0 flex-col">
                <span className="text-[13px] leading-5 font-medium">{t.name}</span>
                <span className="tabular text-[13px] leading-5 text-muted-foreground">{t.spec}</span>
              </div>
              <span className={t.className}>{t.sample}</span>
            </div>
          ))}
        </div>
      </Section>

      <Separator />

      <Section overline="Ações" title="Botões">
        <div className="flex flex-col gap-6">
          {(
            [
              ["default", "Primário"],
              ["secondary", "Secundário"],
              ["outline", "Contorno"],
              ["ghost", "Fantasma"],
              ["link", "Link"],
              ["destructive", "Destrutivo"],
            ] as const
          ).map(([variant, label]) => (
            <div key={variant} className="flex flex-wrap items-center gap-3">
              <span className="w-24 text-[13px] leading-5 text-muted-foreground">{label}</span>
              <Button variant={variant}>Normal</Button>
              <Button variant={variant} className="bg-accent text-accent-foreground">
                Hover
              </Button>
              <Button variant={variant} className="ring-3 ring-ring/50">
                Foco
              </Button>
              <Button variant={variant} disabled>
                Desativado
              </Button>
            </div>
          ))}
        </div>
      </Section>

      <Separator />

      <Section overline="Formulários" title="Campos e controles">
        <div className="grid gap-8 md:grid-cols-2">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="titulo">Título da tarefa</Label>
              <Input id="titulo" placeholder="Ex.: Pagar a conta de luz" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="categoria">Módulo</Label>
              <Select defaultValue="tarefas">
                <SelectTrigger id="categoria" className="w-full">
                  <SelectValue placeholder="Escolha um módulo" />
                </SelectTrigger>
                <SelectContent>
                  {moduleList.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="nota">Nota</Label>
              <Textarea id="nota" placeholder="Escreva o que quiser lembrar." />
            </div>
          </div>
          <div className="flex flex-col gap-6">
            <label className="flex min-h-11 items-center gap-3 text-[15px]">
              <Checkbox defaultChecked /> Repetir toda semana
            </label>
            <label className="flex min-h-11 items-center justify-between gap-3 text-[15px]">
              Receber lembretes
              <Switch checked={notify} onCheckedChange={setNotify} />
            </label>
            <RadioGroup value={plan} onValueChange={setPlan} className="gap-1">
              {[
                ["mensal", "Cobrança mensal"],
                ["anual", "Cobrança anual"],
              ].map(([value, label]) => (
                <label key={value} className="flex min-h-11 items-center gap-3 text-[15px]">
                  <RadioGroupItem value={value} /> {label}
                </label>
              ))}
            </RadioGroup>
          </div>
        </div>
      </Section>

      <Separator />

      <Section overline="Números" title="Stats">
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4">
          <Stat label="Saldo do mês" value="R$ 4.280,50" support="+ R$ 320,00 esta semana" trend="up" />
          <Stat label="Gastos" value="R$ 1.916,20" support="− R$ 84,00 vs. semana passada" trend="down" />
          <Stat label="Tarefas hoje" value="3" support="1 concluída" />
          <Stat label="Calorias" value="1.840" support="de 2.200 kcal" />
        </div>
      </Section>

      <Separator />

      <Section overline="Listas" title="Listas antes de cards">
        <div className="max-w-xl">
          <ListRow icon={modules.tarefas.icon} title="Enviar relatório" description="Hoje, 17:00" trailing={<Badge variant="highlight">Hoje</Badge>} />
          <ListRow icon={modules.agenda.icon} title="Consulta de rotina" description="Amanhã, 09:30" trailing="09:30" />
          <ListRow icon={modules.financas.icon} title="Mercado" description="Débito · Alimentação" trailing="− R$ 182,40" />
          <ListRow icon={modules.treinos.icon} title="Treino de pernas" description="45 min" trailing={<Badge variant="secondary">Novo</Badge>} />
        </div>
        <div className="flex flex-wrap gap-6">
          {moduleList.map((m) => (
            <ModuleIcon key={m.id} module={m.id} showName />
          ))}
        </div>
      </Section>

      <Separator />

      <Section overline="Rotina" title="Hábitos e progresso">
        <div className="grid gap-8 md:grid-cols-2">
          <div className="flex max-w-md flex-col">
            <HabitCheck label="Beber 2 litros de água" support="Sequência de 12 dias" checked={habits.agua} onCheckedChange={(v) => setHabits((h) => ({ ...h, agua: v }))} />
            <HabitCheck label="Ler 20 páginas" support="Sequência de 4 dias" checked={habits.leitura} onCheckedChange={(v) => setHabits((h) => ({ ...h, leitura: v }))} />
            <HabitCheck label="Treinar" support="Sequência de 2 dias" checked={habits.treino} onCheckedChange={(v) => setHabits((h) => ({ ...h, treino: v }))} />
          </div>
          <div className="flex max-w-md flex-col gap-6">
            <div className="flex flex-col gap-2">
              <div className="tabular flex justify-between text-[13px] leading-5">
                <span>Meta de leitura</span>
                <span className="text-muted-foreground">65%</span>
              </div>
              <Progress value={65} />
            </div>
            <div className="flex flex-col gap-2">
              <div className="tabular flex justify-between text-[13px] leading-5">
                <span>Orçamento do mês</span>
                <span className="text-muted-foreground">30%</span>
              </div>
              <Progress value={30} />
            </div>
          </div>
        </div>
      </Section>

      <Separator />

      <Section overline="Navegação" title="Tabs e badges">
        <Tabs defaultValue="hoje">
          <TabsList>
            <TabsTrigger value="hoje">Hoje</TabsTrigger>
            <TabsTrigger value="semana">Semana</TabsTrigger>
            <TabsTrigger value="mes">Mês</TabsTrigger>
          </TabsList>
          <TabsContent value="hoje" className="pt-4 text-muted-foreground">3 tarefas para hoje.</TabsContent>
          <TabsContent value="semana" className="pt-4 text-muted-foreground">12 tarefas nesta semana.</TabsContent>
          <TabsContent value="mes" className="pt-4 text-muted-foreground">41 tarefas neste mês.</TabsContent>
        </Tabs>
        <div className="flex flex-wrap items-center gap-3">
          <Badge>Padrão</Badge>
          <Badge variant="secondary">Secundário</Badge>
          <Badge variant="highlight">Hoje</Badge>
          <Badge variant="outline">Contorno</Badge>
          <Badge variant="destructive">
            <CircleAlertIcon /> Atrasada
          </Badge>
        </div>
      </Section>

      <Separator />

      <Section overline="Dados" title="Gráfico">
        <ChartContainer config={chartConfig} className="aspect-[16/7] w-full max-w-2xl">
          <AreaChart data={weeklySpend} margin={{ left: 4, right: 4 }}>
            <CartesianGrid vertical={false} strokeOpacity={0.5} />
            <XAxis dataKey="dia" tickLine={false} axisLine={false} tickMargin={8} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Area dataKey="meta" type="monotone" stroke="var(--color-meta)" strokeWidth={1.5} strokeDasharray="4 4" fill="none" />
            <Area dataKey="gasto" type="monotone" stroke="var(--color-gasto)" strokeWidth={1.75} fill="var(--color-gasto)" fillOpacity={0.12} />
          </AreaChart>
        </ChartContainer>
      </Section>

      <Separator />

      <Section overline="Feedback" title="Toast, diálogo e gaveta">
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => toast.success("Gasto registrado.")}>
            Mostrar toast
          </Button>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="destructive">
                <Trash2Icon /> Excluir (diálogo)
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Excluir esta tarefa?</DialogTitle>
                <DialogDescription>Essa ação não pode ser desfeita.</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancelar</Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button variant="destructive" onClick={() => toast("Tarefa excluída.")}>
                    <Trash2Icon /> Excluir
                  </Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Drawer>
            <DrawerTrigger asChild>
              <Button variant="destructive">
                <Trash2Icon /> Excluir (gaveta)
              </Button>
            </DrawerTrigger>
            <DrawerContent>
              <DrawerHeader>
                <DrawerTitle>Excluir esta tarefa?</DrawerTitle>
                <DrawerDescription>Essa ação não pode ser desfeita.</DrawerDescription>
              </DrawerHeader>
              <DrawerFooter>
                <DrawerClose asChild>
                  <Button variant="destructive" onClick={() => toast("Tarefa excluída.")}>
                    <Trash2Icon /> Excluir
                  </Button>
                </DrawerClose>
                <DrawerClose asChild>
                  <Button variant="outline">Cancelar</Button>
                </DrawerClose>
              </DrawerFooter>
            </DrawerContent>
          </Drawer>
        </div>
        <EmptyState
          icon={InboxIcon}
          title="Nada por aqui ainda"
          description="Quando você criar uma tarefa, ela aparece aqui."
          action={<Button>Criar tarefa</Button>}
        />
      </Section>

      <Separator />

      <Section overline="Mobile" title="BottomNav flutuante e assistente">
        <div className="relative max-w-sm overflow-hidden rounded-2xl border border-border">
          <div className="flex h-40 items-start p-4 text-[13px] leading-5 text-muted-foreground">
            Conteúdo da tela
          </div>
          <AssistantFab className="absolute top-4 right-4" />
          <div className="flex justify-center px-4 pt-2 pb-6">
            <BottomNav items={navItems} activeId={navActive} onSelect={setNavActive} onAdd={() => toast("Novo item")} />
          </div>
        </div>
      </Section>
    </div>
  )
}
