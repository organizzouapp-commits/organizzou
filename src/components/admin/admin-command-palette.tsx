"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

import { ArrowLeftIcon } from "lucide-react"

import { BACK_TO_APP_HREF } from "@/components/shell/nav-brand"
import { useNav } from "@/components/shell/nav-config"
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command"

type AdminCommandPaletteProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Text typed in the header's inline search; pre-fills the input when the palette opens. */
  initialQuery?: string
}

/** Cmd/Ctrl+K inside the admin: jumps to any admin page. */
export function AdminCommandPalette({ open, onOpenChange, initialQuery = "" }: AdminCommandPaletteProps) {
  const router = useRouter()
  const nav = useNav()
  const [query, setQuery] = useState(initialQuery)
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    setQuery(open ? initialQuery : "")
  }

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
    <CommandDialog open={open} onOpenChange={onOpenChange} title="Busca" description="Vá para uma página do admin.">
      <Command>
        <CommandInput
          placeholder="Ir para…"
          value={query}
          onValueChange={setQuery}
          onFocus={(event) => {
            const input = event.currentTarget
            requestAnimationFrame(() => input.setSelectionRange(input.value.length, input.value.length))
          }}
        />
        <CommandList>
          <CommandEmpty>Nada encontrado.</CommandEmpty>
          {nav.groups.map((group) => (
            <CommandGroup key={group.id} heading={group.label}>
              {group.items.map((item) => (
                <CommandItem key={item.id} value={`${group.label} ${item.label}`} onSelect={() => go(item.href)}>
                  <item.icon strokeWidth={1.75} />
                  {item.label}
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
          <CommandSeparator />
          <CommandGroup heading="Ações">
            <CommandItem value="Voltar ao app" onSelect={() => go(BACK_TO_APP_HREF)}>
              <ArrowLeftIcon strokeWidth={1.75} /> Voltar ao app
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
