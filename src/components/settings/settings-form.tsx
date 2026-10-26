"use client"

import { useState, useTransition } from "react"
import { MoonIcon, SunIcon } from "lucide-react"
import { useTheme } from "next-themes"
import { toast } from "sonner"

import { FormMessage } from "@/components/organizzou/FormMessage"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { signOut } from "@/features/auth/actions"
import { updateDisplayName, updateTheme } from "@/features/settings/actions"

type SettingsFormProps = { displayName: string; email: string }

export function SettingsForm({ displayName, email }: SettingsFormProps) {
  const { theme, resolvedTheme, setTheme } = useTheme()
  const [name, setName] = useState(displayName)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function saveName(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await updateDisplayName({ displayName: name })
      if (!result.ok) {
        setError(result.error)
        return
      }
      toast.success("Nome salvo.")
    })
  }

  function changeTheme(value: string) {
    setTheme(value)
    void updateTheme(value).then((result) => {
      if (!result.ok) toast.error(result.error)
    })
  }

  return (
    <div className="flex max-w-xl flex-col">
      <section className="flex flex-col gap-5 border-b border-border py-8 first:pt-0">
        <h2 className="text-xl leading-7 font-semibold tracking-[-0.01em]">Perfil</h2>
        <form onSubmit={saveName} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="displayName">Nome</Label>
            <Input
              id="displayName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" value={email} readOnly disabled />
          </div>
          {error ? <FormMessage kind="error">{error}</FormMessage> : null}
          <Button type="submit" className="self-start" disabled={pending}>
            {pending ? "Salvando…" : "Salvar"}
          </Button>
        </form>
      </section>

      <section className="flex flex-col gap-5 border-b border-border py-8">
        <h2 className="text-xl leading-7 font-semibold tracking-[-0.01em]">Aparência</h2>
        <RadioGroup value={theme === "light" ? "light" : (resolvedTheme ?? "dark")} onValueChange={changeTheme}>
          <label className="flex min-h-11 items-center gap-3 text-[15px]">
            <RadioGroupItem value="dark" />
            <MoonIcon aria-hidden strokeWidth={1.75} className="size-5 text-muted-foreground" />
            Escuro
          </label>
          <label className="flex min-h-11 items-center gap-3 text-[15px]">
            <RadioGroupItem value="light" />
            <SunIcon aria-hidden strokeWidth={1.75} className="size-5 text-muted-foreground" />
            Claro
          </label>
        </RadioGroup>
      </section>

      <section className="flex flex-col gap-5 py-8">
        <h2 className="text-xl leading-7 font-semibold tracking-[-0.01em]">Conta</h2>
        <form action={signOut}>
          <Button type="submit" variant="outline">
            Sair da conta
          </Button>
        </form>
      </section>
    </div>
  )
}
