"use client"

import { useState } from "react"
import { BanknoteIcon, CircleAlertIcon, CreditCardIcon, LandmarkIcon, PiggyBankIcon, PlusIcon, WalletIcon } from "lucide-react"

import { ManageablePicker } from "@/components/tasks/manageable-picker"
import { PillTabs, dashedPillClass, pillClass } from "@/components/tasks/pill-tabs"
import { ResponsiveSheet } from "@/components/tasks/responsive-sheet"
import { Button } from "@/components/ui/button"
import { SwatchPicker } from "@/components/organizzou/SwatchPicker"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ACCOUNT_ICON_KEYS, ACCOUNT_ICON_LABELS, ACCOUNT_KINDS, ACCOUNT_KIND_LABELS, DEFAULT_ICON, type AccountIconKey, type AccountKind, type AccountMeta } from "@/features/finance/account-meta"
import { GOAL_ICON_KEYS, GOAL_ICON_LABELS, type GoalIconKey } from "@/features/finance/goal-icons"
import type { AccountRow, FinancialGoalRow, RecurringBillRow, TransactionKind, TransactionRow } from "@/features/finance/types"
import { CurrencyInput } from "@/components/organizzou/currency-input"
import { formatBRL } from "@/lib/money"
import { goalStart, validateGoalDates } from "@/features/finance/goal-schedule"
import { installmentAmount, installmentCents, installmentPreview, MAX_INSTALLMENTS, MIN_INSTALLMENTS, newInstallmentMeta, remainingFrom, type AmountMode, type Scope } from "@/features/finance/installments"
import type { SwatchId } from "@/lib/swatches"
import { newId } from "@/lib/sp-time"
import { cn } from "@/lib/utils"

import { useFinance } from "./context"
import { GOAL_ICONS } from "./parts"
import { projection, useGoalSets } from "./goals"

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
function Footer({ onCancel, submit, extra }: { onCancel: () => void; submit: string; extra?: React.ReactNode }) {
  return (
    <div className="sticky bottom-0 -mx-4 mt-1 flex gap-2 border-t border-border bg-popover px-4 pt-3 pb-1 md:static md:mx-0 md:justify-end md:border-0 md:px-0 md:pt-1 md:pb-0">
      {extra}
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
  const [cents, setCents] = useState<number | null>(row?.amount_cents ?? null)
  const [description, setDescription] = useState(row?.description ?? "")
  const [category, setCategory] = useState(row?.category_id ?? (f.categories.find((c) => !INCOME_CATEGORIES.includes(c.name)) ?? f.categories[0])?.id ?? "")
  const [account, setAccount] = useState(row?.account_id ?? f.accounts[0]?.id ?? "")
  const [date, setDate] = useState(row?.occurred_on ?? f.today)
  const [tried, setTried] = useState(false)
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
          <CurrencyInput id="tx-amount" value={cents} onValueChange={setCents} aria-invalid={tried && Boolean(errors.amount)} className={INPUT} />
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
            {f.allAccounts.filter((a) => a.id === row?.account_id || f.accounts.some((x) => x.id === a.id)).map((a) => (
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

type BillKind = "monthly" | "installments"

function BillForm({ row, onClose }: { row: RecurringBillRow | null; onClose: () => void }) {
  const f = useFinance()
  const series = row ? f.billMeta[row.id] : undefined
  const [kind, setKind] = useState<BillKind>("monthly")
  const [name, setName] = useState(row?.name ?? "")
  const shownCents = row && series ? installmentAmount(row, series, f.month) : (row?.amount_cents ?? null)
  const [cents, setCents] = useState<number | null>(shownCents)
  const [mode, setMode] = useState<AmountMode>("installment")
  const [count, setCount] = useState("10")
  const [firstDate, setFirstDate] = useState(f.today)
  const [day, setDay] = useState(String(row?.due_day ?? 10))
  const [category, setCategory] = useState(row?.category_id ?? (f.categories.find((c) => c.name === "Assinaturas") ?? f.categories[0])?.id ?? "")
  const [tried, setTried] = useState(false)
  const [scopeAsk, setScopeAsk] = useState<{ name: string; category: string | null; cents: number } | null>(null)
  const creatingInstallments = !row && kind === "installments"
  const dueDay = Number(day)
  const installments = Number(count)
  const perInstallment = cents && creatingInstallments ? installmentCents(mode, cents, installments) : cents
  const errors = {
    name: name.trim() ? null : "Dê um nome para a conta.",
    amount: cents && cents > 0 ? null : "Informe um valor maior que zero.",
    day: creatingInstallments || series || (Number.isInteger(dueDay) && dueDay >= 1 && dueDay <= 28) ? null : "Use um dia de 1 a 28.",
    count: !creatingInstallments || (Number.isInteger(installments) && installments >= MIN_INSTALLMENTS && installments <= MAX_INSTALLMENTS) ? null : `Use de ${MIN_INSTALLMENTS} a ${MAX_INSTALLMENTS} parcelas.`,
    date: !creatingInstallments || /^\d{4}-\d{2}-\d{2}$/.test(firstDate) ? null : "Escolha a data da primeira parcela.",
  }
  const left = row && series ? remainingFrom(row, series, f.month) : null

  return (
    <>
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          setTried(true)
          if (errors.name || errors.amount || errors.day || errors.count || errors.date || !cents || !perInstallment) return
          const now = new Date().toISOString()
          if (row && series) {
            // An installment already running: the amount may apply to this one, to the next ones or to all; ask before saving.
            if (perInstallment !== shownCents) return setScopeAsk({ name: name.trim(), category: category || null, cents: perInstallment })
            f.saveInstallmentEdit(row, { name: name.trim(), category_id: category || null, cents: perInstallment }, "all")
            return onClose()
          }
          f.saveBill(
            {
              ...(row ?? {}),
              id: row?.id ?? newId(),
              user_id: USER,
              name: name.trim(),
              amount_cents: perInstallment,
              due_day: creatingInstallments ? Math.min(28, Number(firstDate.slice(8, 10))) : dueDay,
              category_id: category || null,
              active: row?.active ?? true,
              last_paid_month: row?.last_paid_month ?? null,
              created_at: row?.created_at ?? now,
              updated_at: now,
            },
            creatingInstallments ? newInstallmentMeta(installments, firstDate) : undefined
          )
          onClose()
        }}
      >
        {!row ? (
          <div role="radiogroup" aria-label="Tipo de conta fixa" className="flex gap-2">
            {(
              [
                ["monthly", "Mensal"],
                ["installments", "Parcelada"],
              ] as const
            ).map(([value, label]) => (
              <button key={value} type="button" role="radio" aria-checked={kind === value} data-bill-kind={value} onClick={() => setKind(value)} className={pillClass(kind === value)}>
                {label}
              </button>
            ))}
          </div>
        ) : null}
        <Field label="Nome" htmlFor="bill-name" error={tried ? errors.name : null}>
          <Input id="bill-name" autoFocus value={name} maxLength={60} placeholder={creatingInstallments ? "Ex.: Notebook" : "Ex.: Disney+"} aria-invalid={tried && Boolean(errors.name)} onChange={(e) => setName(e.target.value)} className={INPUT} />
        </Field>
        {creatingInstallments ? (
          <div role="radiogroup" aria-label="O valor informado é" className="flex flex-wrap gap-2">
            {(
              [
                ["installment", "Valor da parcela"],
                ["total", "Valor total"],
              ] as const
            ).map(([value, label]) => (
              <button key={value} type="button" role="radio" aria-checked={mode === value} data-amount-mode={value} onClick={() => setMode(value)} className={pillClass(mode === value)}>
                {label}
              </button>
            ))}
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-3">
          <Field label={creatingInstallments ? (mode === "total" ? "Valor total" : "Valor da parcela") : series ? "Valor desta parcela" : "Valor"} htmlFor="bill-amount" error={tried ? errors.amount : null}>
            <CurrencyInput id="bill-amount" value={cents} onValueChange={setCents} aria-invalid={tried && Boolean(errors.amount)} className={INPUT} />
          </Field>
          {creatingInstallments ? (
            <Field label="Parcelas" htmlFor="bill-count" error={tried ? errors.count : null}>
              <Input id="bill-count" type="number" inputMode="numeric" min={MIN_INSTALLMENTS} max={MAX_INSTALLMENTS} value={count} aria-invalid={tried && Boolean(errors.count)} onChange={(e) => setCount(e.target.value)} className={INPUT} />
            </Field>
          ) : series ? null : (
            <Field label="Vence no dia" htmlFor="bill-day" error={tried ? errors.day : null}>
              <Input id="bill-day" type="number" inputMode="numeric" min={1} max={28} value={day} aria-invalid={tried && Boolean(errors.day)} onChange={(e) => setDay(e.target.value)} className={INPUT} />
            </Field>
          )}
        </div>
        {creatingInstallments ? (
          <Field label="Primeira parcela vence em" htmlFor="bill-first" error={tried ? errors.date : null}>
            <Input id="bill-first" type="date" value={firstDate} onChange={(e) => setFirstDate(e.target.value)} className={INPUT} />
          </Field>
        ) : null}
        <Field label="Categoria">
          <CategoryChips value={category} onChange={setCategory} />
        </Field>
        {creatingInstallments && perInstallment && !errors.count && !errors.date ? (
          <p data-testid="installment-preview" className="rounded-[12px] border border-border px-3 py-2 text-[14px] leading-5">
            {installmentPreview(installments, perInstallment, firstDate.slice(0, 7))}
            <span className="block text-[13px] text-muted-foreground">Total: {formatBRL(perInstallment * installments)}</span>
          </p>
        ) : null}
        {left ? (
          <p data-testid="installment-remaining" className="text-[13px] leading-5 text-muted-foreground">
            Restam {left.count} {left.count === 1 ? "parcela" : "parcelas"} · {formatBRL(left.cents)}. Ao mudar o valor você escolhe se vale só para esta parcela, para as próximas ou para todas.
          </p>
        ) : (
          <p className="text-[13px] leading-5 text-muted-foreground">{creatingInstallments ? "Vence todo mês, nas datas da série, e termina sozinha na última parcela." : "Vence todo mês e entra em “A pagar”."}</p>
        )}
        <Footer onCancel={onClose} submit={row ? "Salvar" : creatingInstallments ? "Criar conta parcelada" : "Criar conta fixa"} />
      </form>
      <ScopeSheet
        open={scopeAsk !== null}
        title="Alterar o valor de qual parcela?"
        onCancel={() => setScopeAsk(null)}
        onPick={(scope) => {
          if (row && scopeAsk) f.saveInstallmentEdit(row, { name: scopeAsk.name, category_id: scopeAsk.category, cents: scopeAsk.cents }, scope)
          setScopeAsk(null)
          onClose()
        }}
      />
    </>
  )
}

/** "Só esta parcela / Esta e as próximas / Todas": the question every edit or delete of an installment series asks. */
export function ScopeSheet({ open, title, description, onPick, onCancel }: { open: boolean; title: string; description?: string; onPick: (scope: Scope) => void; onCancel: () => void }) {
  return (
    <ResponsiveSheet open={open} onOpenChange={(next) => !next && onCancel()} title={title} description={description ?? "Esta conta é parcelada: escolha o que muda."}>
      <div className="flex flex-col gap-2 pb-1" data-testid="scope-sheet">
        {(
          [
            ["this", "Só esta parcela"],
            ["following", "Esta e as próximas"],
            ["all", "Todas as parcelas"],
          ] as const
        ).map(([scope, label]) => (
          <Button key={scope} type="button" variant="outline" data-scope={scope} className="h-12 justify-start rounded-[12px] px-4 text-[15px]" onClick={() => onPick(scope)}>
            {label}
          </Button>
        ))}
        <Button type="button" variant="ghost" className="h-11 rounded-full" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </ResponsiveSheet>
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
  const [cents, setCents] = useState<number | null>(null)
  const [tried, setTried] = useState(false)
  const monthly = projection(goal, f.today, f.goalMeta[goal.id]).monthly
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
        <CurrencyInput id="fund-amount" autoFocus value={cents} onValueChange={setCents} aria-invalid={tried && Boolean(error)} className={INPUT} />
      </Field>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Sugestões de valor">
        {suggestions.map((value) => (
          <button key={value} type="button" data-suggestion onClick={() => setCents(value)} className={pillClass(cents === value)}>
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
    <ResponsiveSheet open={open} onOpenChange={onOpenChange} title={row ? "Editar meta" : "Nova meta"} description="Uma meta de economia, com valor, início e prazo.">
      {open ? <GoalForm key={row?.id ?? "new"} row={row} onClose={() => onOpenChange(false)} /> : null}
    </ResponsiveSheet>
  )
}

function GoalForm({ row, onClose }: { row: FinancialGoalRow | null; onClose: () => void }) {
  const f = useFinance()
  const sets = useGoalSets()
  const [name, setName] = useState(row?.name ?? "")
  const [cents, setCents] = useState<number | null>(row?.target_cents ?? null)
  const [deadline, setDeadline] = useState(row?.deadline ?? "")
  const meta = row ? f.goalMeta[row.id] : undefined
  const [saved, setSaved] = useState<number | null>(meta?.openingCents ?? null)
  const [startDate, setStartDate] = useState(row ? goalStart(row, meta) : f.today)
  const [icon, setIcon] = useState<GoalIconKey>(row ? (f.goalIcons[row.id] ?? "piggy") : "piggy")
  const [tried, setTried] = useState(false)
  const dates = validateGoalDates(startDate, deadline)
  const errors = { name: name.trim() ? null : "Dê um nome para a meta.", target: cents && cents > 0 ? null : "Informe um valor maior que zero.", saved: saved !== null && cents && saved > cents ? "O valor já guardado passa do valor da meta." : null, start: dates.start, end: dates.end }
  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        setTried(true)
        if (errors.name || errors.target || errors.saved || errors.start || errors.end || !cents) return
        const now = new Date().toISOString()
        f.saveGoal(
          { ...(row ?? {}), id: row?.id ?? newId(), user_id: USER, name: name.trim(), target_cents: cents, current_cents: row?.current_cents ?? 0, deadline: deadline || null, created_at: row?.created_at ?? now, updated_at: now },
          icon,
          { startDate, openingCents: saved ?? 0 }
        )
        onClose()
      }}
    >
      <Field label="Nome" htmlFor="goal-name" error={tried ? errors.name : null}>
        <Input id="goal-name" autoFocus value={name} maxLength={60} placeholder="Ex.: Viagem de fim de ano" aria-invalid={tried && Boolean(errors.name)} onChange={(e) => setName(e.target.value)} className={INPUT} />
      </Field>
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
      <div className="grid grid-cols-2 gap-3">
        <Field label="Valor da meta" htmlFor="goal-target" error={tried ? errors.target : null}>
          <CurrencyInput id="goal-target" value={cents} onValueChange={setCents} aria-invalid={tried && Boolean(errors.target)} className={INPUT} />
        </Field>
        <Field label="Quanto já guardei" htmlFor="goal-saved" error={tried ? errors.saved : null} helper="Opcional. Conta no progresso, não vira lançamento.">
          <CurrencyInput id="goal-saved" value={saved} onValueChange={setSaved} aria-invalid={tried && Boolean(errors.saved)} className={INPUT} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Data de início" htmlFor="goal-start" error={tried ? errors.start : null}>
          <Input id="goal-start" type="date" value={startDate} aria-invalid={tried && Boolean(errors.start)} onChange={(e) => setStartDate(e.target.value)} className={INPUT} />
        </Field>
        <Field label="Prazo final" htmlFor="goal-deadline" error={tried || deadline ? errors.end : null}>
          <Input id="goal-deadline" type="date" value={deadline} min={startDate} aria-invalid={Boolean(errors.end) && (tried || Boolean(deadline))} onChange={(e) => setDeadline(e.target.value)} className={INPUT} />
        </Field>
      </div>
      <Footer
        onCancel={onClose}
        submit={row ? "Salvar" : "Criar meta"}
        extra={
          row ? (
            <div className="flex flex-1 gap-2 md:mr-auto md:flex-none">
              {sets.open.some((g) => g.id === row.id) && sets.open[0]?.id !== row.id ? (
                <Button type="button" variant="outline" className="h-11 flex-1 md:h-10 md:flex-none" onClick={() => (f.featureGoal(row, sets.open.map((g) => g.id)), onClose())}>
                  Destacar
                </Button>
              ) : null}
              <Button type="button" variant="outline" className="h-11 flex-1 md:h-10 md:flex-none" onClick={() => (f.removeGoal(row), onClose())}>
                Excluir meta
              </Button>
            </div>
          ) : null
        }
      />
    </form>
  )
}

// ----------------------------------------------------------- Conta

export function AccountDialog({ open, onOpenChange, row }: { open: boolean; onOpenChange: (open: boolean) => void; row: AccountRow | null }) {
  return (
    <ResponsiveSheet open={open} onOpenChange={onOpenChange} title={row ? "Editar conta" : "Nova conta"} description="Uma conta, banco, carteira, cartão ou poupança para registrar seus lançamentos.">
      {open ? <AccountForm key={row?.id ?? "new"} row={row} onClose={() => onOpenChange(false)} /> : null}
    </ResponsiveSheet>
  )
}

const ACCOUNT_ICON_COMPONENTS = { landmark: LandmarkIcon, wallet: WalletIcon, card: CreditCardIcon, piggy: PiggyBankIcon, banknote: BanknoteIcon } as const
export const accountIcon = (key: AccountIconKey) => ACCOUNT_ICON_COMPONENTS[key]

/** The icon a wallet shows: the one chosen, else the one of its kind (an old "Dinheiro" account keeps the banknote). */
export function accountIconKey(row: AccountRow, meta: AccountMeta | undefined): AccountIconKey {
  return meta?.icon ?? (meta?.kind ? DEFAULT_ICON[meta.kind] : row.institution === "Dinheiro" ? "banknote" : "landmark")
}

export function AccountGlyph({ account, meta, className }: { account: AccountRow; meta: AccountMeta | undefined; className?: string }) {
  const Icon = ACCOUNT_ICON_COMPONENTS[accountIconKey(account, meta)]
  return <Icon aria-hidden strokeWidth={1.75} className={className} />
}

function AccountForm({ row, onClose }: { row: AccountRow | null; onClose: () => void }) {
  const f = useFinance()
  const meta = row ? f.accountMeta[row.id] : undefined
  const [name, setName] = useState(row?.name ?? "")
  const [institution, setInstitution] = useState(row && row.institution !== row.name ? row.institution : "")
  const [opening, setOpening] = useState<number | null>(row?.opening_balance_cents ?? null)
  const [kind, setKind] = useState<AccountKind>(meta?.kind ?? "bank")
  const [icon, setIcon] = useState<AccountIconKey | null>(meta?.icon ?? null)
  const [color, setColor] = useState<SwatchId>(meta?.color ?? "neutro")
  const [archived, setArchived] = useState(meta?.archived ?? false)
  const [tried, setTried] = useState(false)
  const error = name.trim() ? null : "Dê um nome para a conta."
  const shownIcon = icon ?? DEFAULT_ICON[kind]
  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        setTried(true)
        if (error) return
        const now = new Date().toISOString()
        const account: AccountRow = {
          id: row?.id ?? newId(),
          user_id: row?.user_id ?? USER,
          name: name.trim(),
          institution: institution.trim() || name.trim(),
          opening_balance_cents: opening ?? 0,
          created_at: row?.created_at ?? now,
          updated_at: now,
        }
        f.saveAccount(account, { kind, icon: icon ?? undefined, color, archived })
        onClose()
      }}
    >
      <Field label="Nome" htmlFor="acc-name" error={tried ? error : null}>
        <Input id="acc-name" autoFocus value={name} maxLength={60} placeholder="Ex.: Nubank" aria-invalid={tried && Boolean(error)} onChange={(e) => setName(e.target.value)} className={INPUT} />
      </Field>
      <Field label="Instituição (opcional)" htmlFor="acc-inst">
        <Input id="acc-inst" value={institution} maxLength={60} placeholder="Ex.: Nu Pagamentos" onChange={(e) => setInstitution(e.target.value)} className={INPUT} />
      </Field>
      <Field label="Tipo">
        <div role="radiogroup" aria-label="Tipo da conta" className="flex flex-wrap gap-2">
          {ACCOUNT_KINDS.map((k) => (
            <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)} className={pillClass(kind === k)}>
              {ACCOUNT_KIND_LABELS[k]}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Ícone">
        <div role="radiogroup" aria-label="Ícone da conta" className="flex flex-wrap gap-2">
          {ACCOUNT_ICON_KEYS.map((key) => {
            const Icon = accountIcon(key)
            const on = shownIcon === key
            return (
              <button key={key} type="button" role="radio" aria-checked={on} aria-label={ACCOUNT_ICON_LABELS[key]} title={ACCOUNT_ICON_LABELS[key]} onClick={() => setIcon(key)} className={cn("relative flex size-11 items-center justify-center rounded-full border outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:size-10", on ? "border-transparent bg-highlight text-highlight-foreground" : "border-border")}>
                <Icon aria-hidden strokeWidth={1.75} className="size-[18px]" />
              </button>
            )
          })}
        </div>
      </Field>
      <Field label="Cor">
        <SwatchPicker value={color} onChange={setColor} label="Cor da conta" />
      </Field>
      <Field label={row ? "Saldo inicial" : "Saldo inicial (opcional)"} htmlFor="acc-open" helper={row ? "O saldo atual é este valor mais as entradas e menos as saídas. Ajuste-o para corrigir o saldo." : undefined}>
        <CurrencyInput id="acc-open" allowNegative value={opening} onValueChange={setOpening} className={INPUT} />
      </Field>
      {row ? (
        <label className="flex min-h-11 items-center justify-between gap-3 text-[15px]">
          Arquivada
          <Switch checked={archived} onCheckedChange={setArchived} aria-label="Arquivada" />
        </label>
      ) : null}
      <Footer
        onCancel={onClose}
        submit={row ? "Salvar" : "Adicionar conta"}
        extra={
          row ? (
            <Button type="button" variant="outline" className="h-11 flex-1 md:mr-auto md:h-10 md:flex-none" onClick={() => (onClose(), f.askDeleteAccount(row))}>
              Excluir conta
            </Button>
          ) : null
        }
      />
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
  const [values, setValues] = useState<Record<string, number | null>>(() => Object.fromEntries(spending.map((c) => [c.id, c.monthly_limit_cents || null])))
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        f.saveLimits(Object.fromEntries(spending.map((c) => [c.id, values[c.id] || null])))
        onClose()
      }}
    >
      {spending.map((c) => (
        <Field key={c.id} label={c.name} htmlFor={`limit-${c.id}`}>
          <CurrencyInput id={`limit-${c.id}`} placeholder="Sem limite" value={values[c.id] ?? null} onValueChange={(next) => setValues((v) => ({ ...v, [c.id]: next }))} className={INPUT} />
        </Field>
      ))}
      <Footer onCancel={onClose} submit="Salvar limites" />
    </form>
  )
}

