"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { SettingsIcon } from "lucide-react"

import { moduleList } from "@/components/organizzou/modules"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"

type CommandPaletteProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// Shell only: for now it navigates between modules. Content search comes with each module.
export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
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

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Buscar ou ir para…" />
      <CommandList>
        <CommandEmpty>Nada encontrado.</CommandEmpty>
        <CommandGroup heading="Módulos">
          {moduleList.map((m) => (
            <CommandItem key={m.id} value={m.name} onSelect={() => go(m.href)}>
              <m.icon strokeWidth={1.75} />
              {m.name}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Conta">
          <CommandItem value="Configurações" onSelect={() => go("/configuracoes")}>
            <SettingsIcon strokeWidth={1.75} />
            Configurações
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
