"use client"

import { useState } from "react"
import { CopyIcon, RefreshCwIcon } from "lucide-react"
import { toast } from "sonner"

import { AddPill, HatchedProgress } from "@/components/finance/parts"
import { ItemSheet } from "@/components/vault/item-form"
import { SMALL_CAPS, chip } from "@/components/vault/vault-kit"
import { useVaultActions } from "@/components/vault/use-vault-actions"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { GENERATOR_STRENGTH_LABELS, generatePassword, generatorEntropyBits, strengthFromBits, type GeneratorOptions } from "@/features/vault/passwords"

const OPTIONS: { key: "upper" | "lower" | "digits" | "symbols"; label: string; sample: string }[] = [
  { key: "upper", label: "Maiúsculas", sample: "A–Z" },
  { key: "lower", label: "Minúsculas", sample: "a–z" },
  { key: "digits", label: "Números", sample: "0–9" },
  { key: "symbols", label: "Símbolos", sample: "!@#$" },
]

const CARD = "flex min-w-0 flex-col gap-4 rounded-[20px] border border-border bg-card p-4 md:p-6"
const STRENGTH_VALUE = { weak: 33, medium: 66, strong: 100 } as const
const DEFAULTS: GeneratorOptions = { length: 20, upper: true, lower: true, digits: true, symbols: true }

/**
 * The password generator. The password lives only in this component's state: it is not stored anywhere (not even in the vault) until the user
 * saves it as an item, and it is gone when they leave the tab. Random characters come from crypto.getRandomValues (see generatePassword).
 */
export function GeneratorTab() {
  const actions = useVaultActions()
  const [options, setOptions] = useState<GeneratorOptions>(DEFAULTS)
  const [password, setPassword] = useState(() => generatePassword(DEFAULTS))
  const [saving, setSaving] = useState(false)
  const enabled = OPTIONS.filter((o) => options[o.key]).length
  const bits = generatorEntropyBits(options)
  const strength = strengthFromBits(bits)

  function change(next: GeneratorOptions) {
    setOptions(next)
    setPassword(generatePassword(next))
  }

  return (
    <div data-testid="vault-generator" className="grid grid-cols-1 gap-4 md:grid-cols-12">
      <section aria-label="Senha gerada" className={`${CARD} md:col-span-7`}>
        <h3 className="text-[17px] leading-6 font-semibold">Senha gerada</h3>
        <output data-testid="generated-password" aria-live="polite" className="tabular flex min-h-28 items-center rounded-[14px] border border-border bg-muted/40 px-4 py-4 font-mono text-[22px] leading-9 break-all select-all md:min-h-36 md:px-6 md:text-[30px] md:leading-10">
          {password || <span className="font-sans text-[15px] leading-6 text-muted-foreground">Ligue ao menos um tipo de caractere.</span>}
        </output>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" variant="outline" data-testid="regenerate" onClick={() => setPassword(generatePassword(options))} disabled={!password} className="h-11 rounded-full md:h-11 sm:flex-1">
            <RefreshCwIcon strokeWidth={1.75} /> Gerar outra
          </Button>
          <Button type="button" data-testid="copy-generated" onClick={() => void actions.copy(password, "Senha copiada")} disabled={!password} className="h-11 rounded-full bg-highlight text-highlight-foreground hover:bg-highlight/90 md:h-11 sm:flex-1">
            <CopyIcon strokeWidth={1.75} /> Copiar
          </Button>
        </div>
        {password ? <AddPill label="Salvar no cofre como novo item" onClick={() => setSaving(true)} className="h-11 shrink-0 md:h-11" /> : null}
        <p className="text-[13px] leading-5 text-muted-foreground">A senha só existe aqui. Nada é guardado até você salvar.</p>
        <ItemSheet open={saving} item={null} defaultType="login" prefillPassword={password} onClose={() => setSaving(false)} onSaved={() => toast.success("Item guardado no Cofre.")} />
      </section>

      <section aria-label="Opções" className={`${CARD} md:col-span-5`}>
        <h3 className="text-[17px] leading-6 font-semibold">Opções</h3>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="gen-length">Tamanho</Label>
            <span data-chip data-testid="gen-length-chip" className={chip}>
              {options.length} caracteres
            </span>
          </div>
          <Slider id="gen-length" aria-label="Tamanho da senha" min={8} max={64} step={1} value={[options.length]} onValueChange={([length]) => change({ ...options, length })} className="py-3" />
        </div>
        <div className="flex flex-col">
          <span className={SMALL_CAPS}>Caracteres</span>
          {OPTIONS.map(({ key, label, sample }) => {
            const last = options[key] && enabled === 1
            return (
              <div key={key} className="flex min-h-11 items-center gap-3 border-b border-border last:border-b-0">
                <Label htmlFor={`gen-${key}`} className="flex min-w-0 flex-1 items-center justify-between gap-2 py-2 text-[15px] font-normal whitespace-nowrap">
                  <span>{label}</span>
                  <span className="tabular text-[13px] text-muted-foreground">{sample}</span>
                </Label>
                <Switch id={`gen-${key}`} checked={options[key]} disabled={last} aria-describedby={last ? "gen-last-note" : undefined} onCheckedChange={(v) => change({ ...options, [key]: v === true })} />
              </div>
            )
          })}
          <p id="gen-last-note" className="sr-only">
            Pelo menos um tipo de caractere precisa ficar ligado.
          </p>
        </div>
        <div data-testid="generator-strength" data-strength={password ? strength : "none"} className="flex flex-col gap-2 rounded-[14px] border border-border p-3">
          <div className="flex items-center justify-between gap-2">
            <span className={SMALL_CAPS}>Força</span>
            <span className="text-[15px] leading-6 font-semibold">{password ? GENERATOR_STRENGTH_LABELS[strength] : "—"}</span>
          </div>
          <HatchedProgress value={password ? STRENGTH_VALUE[strength] : 0} label={`Força da senha: ${password ? GENERATOR_STRENGTH_LABELS[strength] : "vazia"}`} />
          <p className="tabular text-[13px] leading-5 text-muted-foreground">Cerca de {bits} bits de aleatoriedade.</p>
        </div>
      </section>
    </div>
  )
}
