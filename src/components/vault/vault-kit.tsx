"use client"

import { createContext, useContext, useState } from "react"
import { EyeIcon, EyeOffIcon } from "lucide-react"

import { HatchedProgress } from "@/components/finance/parts"
import { Input } from "@/components/ui/input"
import { fieldClass } from "@/components/workouts/sheet-fields"
import { STRENGTH_LABELS, passwordStrength, type Strength } from "@/features/vault/passwords"
import type { VaultRepo } from "@/features/vault/storage"
import { cn } from "@/lib/utils"

/** The vault of this account in this browser. Only ciphertext ever goes through the repository. */
export const VaultContext = createContext<{ repo: VaultRepo; scope: string } | null>(null)

export function useVaultRepo() {
  const value = useContext(VaultContext)
  if (!value) throw new Error("VaultContext missing")
  return value
}

export const chip = "tabular inline-flex h-6 shrink-0 items-center gap-1 rounded-full border border-foreground/25 px-2 text-[12px] leading-4 whitespace-nowrap text-muted-foreground"
export const SMALL_CAPS = "text-[11px] leading-4 font-semibold tracking-[0.12em] text-muted-foreground uppercase"

/**
 * A password field with a show/hide button (44 px). It asks the browser not to remember or autofill it: the master password and the secrets
 * of the vault must never end up in the browser's own password manager.
 */
export function PasswordField({ id, value, onChange, label, autoComplete = "off", invalid, autoFocus, describedBy, className, inputMode, maxLength }: { id: string; value: string; onChange: (value: string) => void; label: string; autoComplete?: "off" | "new-password"; invalid?: boolean; autoFocus?: boolean; describedBy?: string; className?: string; inputMode?: "numeric"; maxLength?: number }) {
  const [shown, setShown] = useState(false)
  return (
    <div className={cn("relative", className)}>
      <Input
        id={id}
        type={shown ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        inputMode={inputMode}
        maxLength={maxLength}
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        autoFocus={autoFocus}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        data-1p-ignore
        data-lpignore="true"
        className={cn(fieldClass, "pr-12")}
      />
      <button type="button" aria-label={shown ? `Ocultar ${label}` : `Mostrar ${label}`} aria-pressed={shown} onClick={() => setShown((s) => !s)} className="absolute top-0 right-0 flex size-11 items-center justify-center rounded-full text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50">
        {shown ? <EyeOffIcon aria-hidden strokeWidth={1.75} className="size-4" /> : <EyeIcon aria-hidden strokeWidth={1.75} className="size-4" />}
      </button>
    </div>
  )
}

const STRENGTH_VALUE: Record<Strength, number> = { weak: 33, medium: 66, strong: 100 }

/** How strong a password is: a hatched bar and the word ("Fraca", "Média", "Forte"), so the meaning never depends on color. */
export function StrengthMeter({ password, className }: { password: string; className?: string }) {
  const strength = passwordStrength(password)
  const empty = password === ""
  return (
    <div className={cn("flex flex-col gap-1.5", className)} data-strength={empty ? "none" : strength}>
      <HatchedProgress value={empty ? 0 : STRENGTH_VALUE[strength]} label={`Força da senha: ${empty ? "vazia" : STRENGTH_LABELS[strength]}`} />
      <p className="text-[13px] leading-5 text-muted-foreground" aria-live="polite">
        Força: <span className="font-semibold text-foreground">{empty ? "—" : STRENGTH_LABELS[strength]}</span>
      </p>
    </div>
  )
}

/** Shortest master password the Cofre accepts. */
export const MIN_MASTER_LENGTH = 10
