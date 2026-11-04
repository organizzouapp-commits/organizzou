"use client"

import { useState } from "react"
import { CircleAlertIcon, PlusIcon } from "lucide-react"

import { ManageablePicker } from "@/components/tasks/manageable-picker"
import { PillTabs, dashedPillClass, pillClass } from "@/components/tasks/pill-tabs"
import { ResponsiveSheet } from "@/components/tasks/responsive-sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { GOAL_ICON_KEYS, GOAL_ICON_LABELS, type GoalIconKey } from "@/features/finance/goal-icons"
import type { AccountRow, FinancialGoalRow, RecurringBillRow, TransactionKind, TransactionRow } from "@/features/finance/types"
import { formatBRL, parseBRL } from "@/lib/money"
import { newId } from "@/lib/sp-time"
import { cn } from "@/lib/utils"

import { useFinance } from "./context"
import { GOAL_ICONS } from "./parts"
import { projection } from "./goals"

const USER = "00000000-0000-4000-8000-000000000001"
const INPUT = "h-11 rounded-[12px]"
const INCOME_CATEGORIES = ["Salário", "Renda extra"]

/** A validation message under its field: icon + text, neutral and outlined, never a red fill. */
function FieldError({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <p id={id} role="alert" className="inline-flex w-fit items-center gap-1.5 rounded-full border border-foreground/30 px-2.5 py-0.5 text-[13px] leading-5">
      <CircleAlertIcon aria-hidden strokeWidth={1.75} className="size-3.5 shrink-0" />
      {children}
    </p>
  )
}

function Field({ label, htmlFor, error, helper, children }: { label: string; htmlFor?: string; error?: string | null; helper?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Label htmlFor={htmlFor} className="text-[13px] leading-5 font-medium">
        {label}
      </Label>
      {children}
      {helper && !error ? <p className="text-[13px] leading-5 text-muted-foreground">{helper}</p> : null}
      {error ? <FieldError id={`${htmlFor}-error`}>{error}</FieldError> : null}
    </div>
  )
}

/** Cancelar (outline pill) + the primary pill. Sticky at the bottom of the sheet on phones, so it never scrolls away. */
function Footer({ onCancel, submit }: { onCancel: () => void; submit: string }) {
  return (
    <div className="sticky bottom-0 -mx-4 mt-1 flex gap-2 border-t border-border bg-popover px-4 pt-3 pb-1 md:static md:mx-0 md:justify-end md:border-0 md:px-0 md:pt-1 md:pb-0">
      <Button type="button" variant="outline" className="h-11 flex-1 md:h-10 md:flex-none" onClick={onCancel}>
        Cancelar
      </Button>
      <Button type="submit" className="h-11 flex-1 md:h-10 md:flex-none">
        {submit}
      </Button>
    </div>
  )
}

/** The category chips (Lima when picked) with a dashed "+ Categoria" that opens the shared manager inline. */
function CategoryChips({ value, onChange, only }: { value: string; onChange: (id: string) => void; only?: (name: string) => boolean }) {
  const f = useFinance()
  const [managing, setManaging] = useState(false)
  const list = f.categories.filter((c) => c.id === value || !only || only(c.name))
  return (
    <div className="flex flex-col gap-2">
      <div role="radiogroup" aria-label="Categoria" className="flex flex-wrap gap-2">
        {list.map((c) => (
          <button key={c.id} type="button" role="radio" aria-checked={c.id === value} onClick={() => onChange(c.id)} className={pillClass(c.id === value)}>
            {c.name}
          </button>
        ))}
        <button type="button" aria-expanded={managing} onClick={() => setManaging((v) => !v)} className={dashedPillClass}>
          <PlusIcon aria-hidden strokeWidth={1.75} className="size-3.5" /> Categoria
        </button>
      </div>
      {managing ? (
        <div className="rounded-[14px] border border-border p-2">
          <ManageablePicker
            noun="categoria"
            kind="category"
            unit={["lançamento", "lançamentos"]}
            deleteNote="Eles ficam sem categoria."
            items={f.categories.map((c) => ({ id: c.id, label: c.name }))}
            selected={value ? [value] : []}
            onSelect={(id) => {
              onChange(id)
              setManaging(false)
            }}
            onCreate={(name) => {
              const id = f.createCategory(name)
              onChange(id)
              return id
            }}
            onRename={(id, name) => f.renameCategory(id, name)}
            onDelete={f.deleteCategory}
            usage={f.categoryUsage}
          />
        </div>
      ) : null}
    </div>
  )
}

// ----------------------------------------------------------- Novo lançamento

export function TransactionDialog({ open, onOpenChange, row }: { open: boolean; onOpenChange: (open: boolean) => void; row: TransactionRow | null }) {
  return (
    <ResponsiveSheet open={open} onOpenChange={onOpenChange} title={row ? "Editar lançamento" : "Novo lançamento"} description="Registre uma saída ou uma entrada.">
      {open ? <TransactionForm key={row?.id ?? "new"} row={row} onClose={() => onOpenChange(false)} /> : null}
    </ResponsiveSheet>
  )
}

function TransactionForm({ row, onClose }: { row: TransactionRow | null; onClose: () => void }) {
  const f = useFinance()
  const [kind, setKind] = useState<TransactionKind>(row?.kind ?? "out")
  const [amount, setAmount] = useState(row ? (row.amount_cents / 100).toFixed(2).replace(".", ",") : "")
  const [description, setDescription] = useState(row?.description ?? "")
  const [category, setCategory] = useState(row?.category_id ?? (f.categories.find((c) => !INCOME_CATEGORIES.includes(c.name)) ?? f.categories[0])?.id ?? "")
  const [account, setAccount] = useState(row?.account_id ?? f.accounts[0]?.id ?? "")
  const [date, setDate] = useState(row?.occurred_on ?? f.today)
  const [tried, setTried] = useState(false)
  const cents = parseBRL(amount)
  const errors = {
    description: description.trim() ? null : "Escreva uma descrição.",
    amount: cents && cents > 0 ? null : "Informe um valor maior que zero.",
    account: account ? null : "Crie uma conta antes de registrar lançamentos.",
  }
  const incomeOnly = (name: string) => (kind === "in" ? INCOME_CATEGORIES.includes(name) : !INCOME_CATEGORIES.includes(name))

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        setTried(true)
        if (errors.description || errors.amount || errors.account || !cents) return
        const now = new Date().toISOString()
        f.saveTransaction({
          ...(row ?? {}),
          id: row?.id ?? newId(),
          user_id: USER,
          account_id: account,
          category_id: category || null,
          kind,
          amount_cents: cents,
          occurred_on: date,
          method: row?.method ?? null,
          description: description.trim(),
          source: "manual",
          created_at: row?.created_at ?? now,
          updated_at: now,
        })
        onClose()
      }}
    >
      <PillTabs
        kind="toggles"
        ariaLabel="Tipo do lançamento"
        items={[
          { id: "out", label: "Saída" },
          { id: "in", label: "Entrada" },
        ]}
        isOn={(i) => i.id === kind}
        onSelect={(i) => {
          const next = i.id as TransactionKind
          setKind(next)
          const first = f.categories.find((c) => (next === "in" ? INCOME_CATEGORIES.includes(c.name) : !INCOME_CATEGORIES.includes(c.name)))
          if (first) setCategory(first.id)
        }}
        itemProps={(i) => ({ "data-kind": i.id })}
      />
      <Field label="Descrição" htmlFor="tx-desc" error={tried ? errors.description : null}>
        <Input id="tx-desc" autoFocus value={description} maxLength={80} placeholder="Ex.: Mercado do bairro" aria-invalid={tried && Boolean(errors.description)} onChange={(e) => setDescription(e.target.value)} className={INPUT} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Valor" htmlFor="tx-amount" error={tried ? errors.amount : null}>
          <Input id="tx-amount" inputMode="decimal" placeholder="R$ 0,00" value={amount} aria-invalid={tried && Boolean(errors.amount)} onChange={(e) => setAmount(e.target.value)} className={INPUT} />
        </Field>
        <Field label="Data" htmlFor="tx-date">
          <Input id="tx-date" type="date" value={date} max={f.today} onChange={(e) => setDate(e.target.value)} className={INPUT} />
        </Field>
      </div>
      <Field label="Categoria">
        <CategoryChips value={category} onChange={setCategory} only={incomeOnly} />
      </Field>
      <Field label="Conta" htmlFor="tx-account" error={tried ? errors.account : null}>
        <Select value={account} onValueChange={setAccount}>
          <SelectTrigger id="tx-account" className={cn(INPUT, "w-full")}>
            <SelectValue placeholder="Escolha a conta" />
          </SelectTrigger>
          <SelectContent>
            {f.accounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Footer onCancel={onClose} submit="Salvar" />
    </form>
  )
}

// ----------------------------------------------------------- Nova conta fixa

export function BillDialog({ open, onOpenChange, row }: { open: boolean; onOpenChange: (open: boolean) => void; row: RecurringBillRow | null }) {
  return (
    <ResponsiveSheet open={open} onOpenChange={onOpenChange} title={row ? "Editar conta fixa" : "Nova conta fixa"} description="Vence todo mês e entra em “A pagar”.">
      {open ? <BillForm key={row?.id ?? "new"} row={row} onClose={() => onOpenChange(false)} /> : null}
    </ResponsiveSheet>
  )
}

function BillForm({ row, onClose }: { row: RecurringBillRow | null; onClose: () => void }) {
  const f = useFinance()
  const [name, setName] = useState(row?.name ?? "")
  const [amount, setAmount] = useState(row ? (row.amount_cents / 100).toFixed(2).replace(".", ",") : "")
  const [day, setDay] = useState(String(row?.due_day ?? 10))
  const [category, setCategory] = useState(row?.category_id ?? (f.categories.find((c) => c.name === "Assinaturas") ?? f.categories[0])?.id ?? "")
  const [tried, setTried] = useState(false)
  const cents = parseBRL(amount)
  const dueDay = Number(day)
  const errors = {
    name: name.trim() ? null : "Dê um nome para a conta.",
    amount: cents && cents > 0 ? null : "Informe um valor maior que zero.",
    day: Number.isInteger(dueDay) && dueDay >= 1 && dueDay <= 28 ? null : "Use um dia de 1 a 28.",
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        setTried(true)
        if (errors.name || errors.amount || errors.day || !cents) return
        const now = new Date().toISOString()
        f.saveBill({
          ...(row ?? {}),
          id: row?.id ?? newId(),
          user_id: USER,
          name: name.trim(),
          amount_cents: cents,
          due_day: dueDay,
          category_id: category || null,
          active: row?.active ?? true,
          last_paid_month: row?.last_paid_month ?? null,
          created_at: row?.created_at ?? now,
          updated_at: now,
        })
        onClose()
      }}
    >
      <Field label="Nome" htmlFor="bill-name" error={tried ? errors.name : null}>
        <Input id="bill-name" autoFocus value={name} maxLength={60} placeholder="Ex.: Disney+" aria-invalid={tried && Boolean(errors.name)} onChange={(e) => setName(e.target.value)} className={INPUT} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Valor" htmlFor="bill-amount" error={tried ? errors.amount : null}>
          <Input id="bill-amount" inputMode="decimal" placeholder="R$ 0,00" value={amount} aria-invalid={tried && Boolean(errors.amount)} onChange={(e) => setAmount(e.target.value)} className={INPUT} />
        </Field>
        <Field label="Vence no dia" htmlFor="bill-day" error={tried ? errors.day : null}>
          <Input id="bill-day" type="number" inputMode="numeric" min={1} max={28} value={day} aria-invalid={tried && Boolean(errors.day)} onChange={(e) => setDay(e.target.value)} className={INPUT} />
        </Field>
      </div>
      <Field label="Categoria">
        <CategoryChips value={category} onChange={setCategory} />
      </Field>
      <p className="text-[13px] leading-5 text-muted-foreground">Vence todo mês e entra em “A pagar”.</p>
      <Footer onCancel={onClose} submit={row ? "Salvar" : "Criar conta fixa"} />
    </form>
  )
}

// ----------------------------------------------------------- Guardar

export function FundDialog({ goal, onClose }: { goal: FinancialGoalRow | null; onClose: () => void }) {
  return (
    <ResponsiveSheet
      open={Boolean(goal)}
      onOpenChange={(open) => !open && onClose()}
      title={goal ? `Guardar para ${goal.name}` : "Guardar"}
      description={goal ? `Faltam ${formatBRL(Math.max(0, goal.target_cents - goal.current_cents))} para chegar lá.` : undefined}
    >
      {goal ? <FundForm key={goal.id} goal={goal} onClose={onClose} /> : null}
    </ResponsiveSheet>
  )
}

function FundForm({ goal, onClose }: { goal: FinancialGoalRow; onClose: () => void }) {
  const f = useFinance()
  const [amount, setAmount] = useState("")
  const [tried, setTried] = useState(false)
  const cents = parseBRL(amount)
  const monthly = projection(goal, f.today).monthly
  const suggestions = [...new Set([monthly, 50_000, 10_000].filter((v) => v > 0))]
  const error = cents && cents > 0 ? null : "Informe um valor maior que zero."
  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        setTried(true)
        if (error || !cents) return
        f.saveGoalFunds(goal, cents)
        onClose()
      }}
    >
      <Field label="Valor" htmlFor="fund-amount" error={tried ? error : null}>
        <Input id="fund-amount" autoFocus inputMode="decimal" placeholder="R$ 0,00" value={amount} aria-invalid={tried && Boolean(error)} onChange={(e) => setAmount(e.target.value)} className={INPUT} />
      </Field>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Sugestões de valor">
        {suggestions.map((value) => (
          <button key={value} type="button" data-suggestion onClick={() => setAmount((value / 100).toFixed(2).replace(".", ","))} className={pillClass(cents === value)}>
            {formatBRL(value)}
            {value === monthly ? " por mês" : ""}
          </button>
        ))}
      </div>
      <Footer onCancel={onClose} submit="Guardar" />
    </form>
  )
}

// ----------------------------------------------------------- Nova meta

export function GoalDialog({ open, onOpenChange, row }: { open: boolean; onOpenChange: (open: boolean) => void; row: FinancialGoalRow | null }) {
  return (
    <ResponsiveSheet open={open} onOpenChange={onOpenChange} title={row ? "Editar meta" : "Nova meta"} description="Uma meta de economia, com valor e prazo.">
      {open ? <GoalForm key={row?.id ?? "new"} row={row} onClose={() => onOpenChange(false)} /> : null}
    </ResponsiveSheet>
  )
}

function GoalForm({ row, onClose }: { row: FinancialGoalRow | null; onClose: () => void }) {
  const f = useFinance()
  const [name, setName] = useState(row?.name ?? "")
  const [target, setTarget] = useState(row ? (row.target_cents / 100).toFixed(2).replace(".", ",") : "")
  const [deadline, setDeadline] = useState(row?.deadline ?? "")
  const [icon, setIcon] = useState<GoalIconKey>(row ? (f.goalIcons[row.id] ?? "piggy") : "piggy")
  const [tried, setTried] = useState(false)
  const cents = parseBRL(target)
  const errors = { name: name.trim() ? null : "Dê um nome para a meta.", target: cents && cents > 0 ? null : "Informe um valor maior que zero." }
  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        setTried(true)
        if (errors.name || errors.target || !cents) return
        const now = new Date().toISOString()
        f.saveGoal(
          { ...(row ?? {}), id: row?.id ?? newId(), user_id: USER, name: name.trim(), target_cents: cents, current_cents: row?.current_cents ?? 0, deadline: deadline || null, created_at: row?.created_at ?? now, updated_at: now },
          icon
        )
        onClose()
      }}
    >
      <Field label="Nome" htmlFor="goal-name" error={tried ? errors.name : null}>
        <Input id="goal-name" autoFocus value={name} maxLength={60} placeholder="Ex.: Viagem de fim de ano" aria-invalid={tried && Boolean(errors.name)} onChange={(e) => setName(e.target.value)} className={INPUT} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Valor da meta" htmlFor="goal-target" error={tried ? errors.target : null}>
          <Input id="goal-target" inputMode="decimal" placeholder="R$ 0,00" value={target} aria-invalid={tried && Boolean(errors.target)} onChange={(e) => setTarget(e.target.value)} className={INPUT} />
        </Field>
        <Field label="Prazo (opcional)" htmlFor="goal-deadline">
          <Input id="goal-deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={INPUT} />
        </Field>
      </div>
      <Field label="Ícone">
        <div role="radiogroup" aria-label="Ícone da meta" className="flex flex-wrap gap-2">
          {GOAL_ICON_KEYS.map((key) => {
            const Icon = GOAL_ICONS[key]
            const on = key === icon
            return (
              <button key={key} type="button" role="radio" aria-checked={on} aria-label={GOAL_ICON_LABELS[key]} title={GOAL_ICON_LABELS[key]} data-goal-icon={key} onClick={() => setIcon(key)} className={cn("relative flex size-11 items-center justify-center rounded-full border outline-none transition-colors duration-[400ms] focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none", on ? "border-transparent bg-highlight text-highlight-foreground" : "border-border hover:bg-accent")}>
                <Icon aria-hidden strokeWidth={1.75} className="size-5" />
              </button>
            )
          })}
        </div>
      </Field>
      <Footer onCancel={onClose} submit={row ? "Salvar" : "Criar meta"} />
    </form>
  )
}

// ----------------------------------------------------------- Conta

export function AccountDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <ResponsiveSheet open={open} onOpenChange={onOpenChange} title="Nova conta" description="Uma conta, banco ou carteira para registrar seus lançamentos.">
      {open ? <AccountForm onClose={() => onOpenChange(false)} /> : null}
    </ResponsiveSheet>
  )
}

function AccountForm({ onClose }: { onClose: () => void }) {
  const f = useFinance()
  const [name, setName] = useState("")
  const [institution, setInstitution] = useState("")
  const [opening, setOpening] = useState("")
  const [tried, setTried] = useState(false)
  const error = name.trim() ? null : "Dê um nome para a conta."
  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        setTried(true)
        if (error) return
        const now = new Date().toISOString()
        const account: AccountRow = { id: newId(), user_id: USER, name: name.trim(), institution: institution.trim() || name.trim(), opening_balance_cents: parseBRL(opening) ?? 0, created_at: now, updated_at: now }
        f.saveAccount(account)
        onClose()
      }}
    >
      <Field label="Nome" htmlFor="acc-name" error={tried ? error : null}>
        <Input id="acc-name" autoFocus value={name} maxLength={60} placeholder="Ex.: Nubank" aria-invalid={tried && Boolean(error)} onChange={(e) => setName(e.target.value)} className={INPUT} />
      </Field>
      <Field label="Instituição (opcional)" htmlFor="acc-inst">
        <Input id="acc-inst" value={institution} maxLength={60} placeholder="Ex.: Nu Pagamentos" onChange={(e) => setInstitution(e.target.value)} className={INPUT} />
      </Field>
      <Field label="Saldo inicial (opcional)" htmlFor="acc-open">
        <Input id="acc-open" inputMode="decimal" placeholder="R$ 0,00" value={opening} onChange={(e) => setOpening(e.target.value)} className={INPUT} />
      </Field>
      <Footer onCancel={onClose} submit="Adicionar conta" />
    </form>
  )
}

// ----------------------------------------------------------- Limites

export function LimitsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <ResponsiveSheet open={open} onOpenChange={onOpenChange} title="Editar limites" description="O quanto você quer gastar por mês em cada categoria. Deixe vazio para não ter limite.">
      {open ? <LimitsForm onClose={() => onOpenChange(false)} /> : null}
    </ResponsiveSheet>
  )
}

function LimitsForm({ onClose }: { onClose: () => void }) {
  const f = useFinance()
  const spending = f.categories.filter((c) => !INCOME_CATEGORIES.includes(c.name))
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(spending.map((c) => [c.id, c.monthly_limit_cents ? (c.monthly_limit_cents / 100).toFixed(2).replace(".", ",") : ""])))
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        f.saveLimits(Object.fromEntries(spending.map((c) => [c.id, parseBRL(values[c.id] ?? "") || null])))
        onClose()
      }}
    >
      {spending.map((c) => (
        <Field key={c.id} label={c.name} htmlFor={`limit-${c.id}`}>
          <Input id={`limit-${c.id}`} inputMode="decimal" placeholder="Sem limite" value={values[c.id] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [c.id]: e.target.value }))} className={INPUT} />
        </Field>
      ))}
      <Footer onCancel={onClose} submit="Salvar limites" />
    </form>
  )
}

