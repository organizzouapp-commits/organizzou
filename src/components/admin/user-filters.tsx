"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { SearchIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const ALL = "todos"

/** One `<Select>` that writes its value into the URL (and drops the key for "Todos"). */
function FilterSelect({ label, param, options, value, onChange }: { label: string; param: string; options: { value: string; label: string }[]; value: string; onChange: (param: string, value: string) => void }) {
  return (
    <Select value={value || ALL} onValueChange={(next) => onChange(param, next === ALL ? "" : next)}>
      <SelectTrigger aria-label={label} className="h-11 min-w-36 rounded-full px-4 text-[15px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{label}: todos</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/**
 * Filters of the users table. Everything is in the URL, so the server renders the right page and a link keeps the filters.
 * Changing any filter goes back to page 1; the search box waits 300 ms after the last key.
 */
export function UserFilters({ q, plano, status, atividade, de, ate }: { q: string; plano: string; status: string; atividade: string; de: string; ate: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [text, setText] = useState(q)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  function update(param: string, value: string) {
    const next = new URLSearchParams(searchParams.toString())
    if (value) next.set(param, value)
    else next.delete(param)
    next.delete("pagina")
    next.delete("usuario")
    const query = next.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  useEffect(() => () => clearTimeout(timer.current), [])

  const dirty = Boolean(q || plano || status || atividade || de || ate)

  return (
    <form role="search" aria-label="Filtrar usuários" onSubmit={(event) => event.preventDefault()} className="flex flex-wrap items-center gap-3">
      <div className="relative min-w-60 flex-1">
        <SearchIcon aria-hidden strokeWidth={1.75} className="pointer-events-none absolute top-1/2 left-4 size-[18px] -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          aria-label="Buscar por nome ou e-mail"
          placeholder="Buscar por nome ou e-mail"
          value={text}
          onChange={(event) => {
            setText(event.target.value)
            clearTimeout(timer.current)
            const value = event.target.value
            timer.current = setTimeout(() => update("q", value.trim()), 300)
          }}
          className="h-11 rounded-full bg-card pr-4 pl-11 text-[15px]"
        />
      </div>
      <FilterSelect label="Plano" param="plano" value={plano} onChange={update} options={[{ value: "free", label: "Gratuito" }, { value: "pro", label: "Pro" }]} />
      <FilterSelect label="Status" param="status" value={status} onChange={update} options={[{ value: "active", label: "Ativo" }, { value: "pending", label: "Aguardando confirmação" }, { value: "suspended", label: "Suspenso" }]} />
      <FilterSelect label="Atividade" param="atividade" value={atividade} onChange={update} options={[{ value: "active", label: "Ativos (7 dias)" }, { value: "inactive", label: "Inativos" }]} />
      <fieldset className="flex w-full min-w-0 flex-wrap items-center gap-2 text-[13px] text-muted-foreground sm:w-auto sm:flex-nowrap">
        <legend className="sr-only">Período do cadastro</legend>
        <span aria-hidden>Cadastro de</span>
        <Input type="date" value={de} onChange={(event) => update("de", event.target.value)} aria-label="Cadastro a partir de" className="h-11 min-w-0 flex-1 rounded-full bg-card px-4 text-[15px] sm:w-40 sm:flex-none" />
        <span aria-hidden>até</span>
        <Input type="date" value={ate} onChange={(event) => update("ate", event.target.value)} aria-label="Cadastro até" className="h-11 min-w-0 flex-1 rounded-full bg-card px-4 text-[15px] sm:w-40 sm:flex-none" />
      </fieldset>
      {dirty ? (
        <Button
          type="button"
          variant="ghost"
          className="h-11 rounded-full px-4"
          onClick={() => {
            setText("")
            router.replace(pathname, { scroll: false })
          }}
        >
          <XIcon strokeWidth={1.75} /> Limpar filtros
        </Button>
      ) : null}
    </form>
  )
}
