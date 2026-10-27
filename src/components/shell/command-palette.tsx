"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { SettingsIcon, SparklesIcon } from "lucide-react"

import { moduleList, modules } from "@/components/organizzou/modules"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { buildSearchIndex } from "@/mocks/search"

type CommandPaletteProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAskAssistant: () => void
  nowIso: string
}

const GROUPS = [
  { module: "tarefas", heading: "Tarefas" },
  { module: "notas", heading: "Notas" },
  { module: "agenda", heading: "Agenda" },
  { module: "rotina", heading: "Hábitos" },
  { module: "estudos", heading: "Estudos" },
  { module: "metas", heading: "Metas" },
] as const

export function CommandPalette({ open, onOpenChange, onAskAssistant, nowIso }: CommandPaletteProps) {
  const router = useRouter()

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        onOpenChange(!open)
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [open, onOpenChange])

  function go(href: string) {
    onOpenChange(false)
    router.push(href)
  }

  const hits = open ? buildSearchIndex(nowIso) : []

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title="Busca" description="Busque em todos os módulos ou escolha uma ação.">
      <Command>
        <CommandInput placeholder="Buscar em tudo ou ir para…" />
        <CommandList>
          <CommandEmpty>Nada encontrado.</CommandEmpty>
          <CommandGroup heading="Ações">
            <CommandItem
              value="Perguntar ao assistente"
              onSelect={() => {
                onOpenChange(false)
                onAskAssistant()
              }}
            >
              <SparklesIcon strokeWidth={1.75} /> Perguntar ao assistente
            </CommandItem>
            <CommandItem value="Configurações" onSelect={() => go("/dashboard/configuracoes")}>
              <SettingsIcon strokeWidth={1.75} /> Configurações
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Módulos">
            {moduleList.map((m) => (
              <CommandItem key={m.id} value={`Módulo ${m.name}`} onSelect={() => go(m.href)}>
                <m.icon strokeWidth={1.75} />
                {m.name}
              </CommandItem>
            ))}
          </CommandGroup>
          {GROUPS.map(({ module, heading }) => {
            const list = hits.filter((h) => h.module === module)
            if (list.length === 0) return null
            const Icon = modules[module].icon
            return (
              <CommandGroup key={module} heading={heading}>
                {list.map((hit) => (
                  <CommandItem key={hit.id} value={`${heading} ${hit.title} ${hit.hint}`} onSelect={() => go(hit.href)}>
                    <Icon strokeWidth={1.75} />
                    <span className="flex-1 truncate">{hit.title}</span>
                    <span className="text-[13px] text-muted-foreground">{hit.hint}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )
          })}
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
