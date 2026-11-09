"use client"

import { useState } from "react"
import { CopyIcon, RefreshCwIcon } from "lucide-react"

import { StrengthMeter, SMALL_CAPS, chip } from "@/components/vault/vault-kit"
import { useVaultActions } from "@/components/vault/use-vault-actions"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { entropyBits, generatePassword, type GeneratorOptions } from "@/features/vault/passwords"

const OPTIONS: { key: "upper" | "lower" | "digits" | "symbols"; label: string; sample: string }[] = [
  { key: "upper", label: "Maiúsculas", sample: "A–Z" },
  { key: "lower", label: "Minúsculas", sample: "a–z" },
  { key: "digits", label: "Números", sample: "0–9" },
  { key: "symbols", label: "Símbolos", sample: "!@#$" },
]

const CARD = "flex min-w-0 flex-col gap-4 rounded-[20px] border border-border bg-card p-4 md:p-6"

/** The password generator: the password and its buttons on the left, the options and the strength on the right (stacked on phones). */
export function GeneratorTab() {
  const actions = useVaultActions()
  const [options, setOptions] = useState<GeneratorOptions>({ length: 20, upper: true, lower: true, digits: true, symbols: true })
  const [password, setPassword] = useState(() => generatePassword({ length: 20, upper: true, lower: true, digits: true, symbols: true }))
  const enabled = OPTIONS.filter((o) => options[o.key]).length

  function change(next: GeneratorOptions) {
    setOptions(next)
    setPassword(generatePassword(next))
  }

  return (
    <div data-testid="vault-generator" className="grid grid-cols-1 gap-4 md:grid-cols-12">
      <section aria-label="Senha gerada" className={`${CARD} md:col-span-7`}>
        <h3 className="text-[17px] leading-6 font-semibold">Senha gerada</h3>
        <output data-testid="generated-password" aria-live="polite" className="flex min-h-24 items-center rounded-[14px] border border-border bg-muted/40 px-4 py-3 font-mono text-[20px] leading-8 break-all select-all md:text-[24px]">
          {password || "Escolha ao menos um tipo de caractere."}
        </output>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" variant="outline" data-testid="regenerate" onClick={() => setPassword(generatePassword(options))} disabled={!password} className="h-12 rounded-full sm:flex-1">
            <RefreshCwIcon strokeWidth={1.75} /> Gerar outra
          </Button>
          <Button type="button" data-testid="copy-generated" onClick={() => void actions.copy(password, "Senha")} disabled={!password} className="h-12 rounded-full bg-highlight text-highlight-foreground hover:bg-highlight/90 sm:flex-1">
            <CopyIcon strokeWidth={1.75} /> Copiar
          </Button>
        </div>
        <p className="text-[13px] leading-5 text-muted-foreground">A senha é criada aqui, no seu aparelho, e não é guardada em lugar nenhum até você copiá-la para um item.</p>
      </section>

      <section aria-label="Opções" className={`${CARD} md:col-span-5`}>
        <h3 className="text-[17px] leading-6 font-semibold">Opções</h3>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="gen-length">Tamanho</Label>
            <span data-chip className={chip}>
              {options.length} caracteres
            </span>
          </div>
          <Slider id="gen-length" aria-label="Tamanho da senha" min={8} max={64} step={1} value={[options.length]} onValueChange={([length]) => change({ ...options, length })} className="py-3" />
        </div>
        <div className="flex flex-col">
          <span className={SMALL_CAPS}>Caracteres</span>
          {OPTIONS.map(({ key, label, sample }) => (
            <div key={key} className="flex min-h-11 items-center gap-3">
              <Checkbox id={`gen-${key}`} checked={options[key]} disabled={options[key] && enabled === 1} onCheckedChange={(v) => change({ ...options, [key]: v === true })} />
              <Label htmlFor={`gen-${key}`} className="flex min-w-0 flex-1 items-center justify-between gap-2 text-[15px] font-normal whitespace-nowrap">
                <span>{label}</span>
                <span className="tabular text-[13px] text-muted-foreground">{sample}</span>
              </Label>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-2 border-t border-border pt-4">
          <StrengthMeter password={password} />
          <p className="tabular text-[13px] leading-5 text-muted-foreground">Cerca de {entropyBits(password)} bits de aleatoriedade.</p>
        </div>
      </section>
    </div>
  )
}
