"use client"

import { useState, useTransition } from "react"
import { EyeIcon, EyeOffIcon } from "lucide-react"

import { FormMessage } from "@/components/organizzou/FormMessage"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { signInWithGoogle } from "@/features/auth/actions"
import { cn } from "@/lib/utils"

/**
 * Google "G" mark, drawn with Google's official colors. This is the ONLY place in the product that is allowed
 * to leave the 6-color palette: it is a third-party brand asset (DESIGN-SYSTEM §10).
 */
export function GoogleMark({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 48 48" className={cn("size-5", className)}>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  )
}

export function GoogleButton({ next = "/hoje" }: { next?: string }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        className={authButtonClass}
        onClick={() =>
          startTransition(async () => {
            setError(null)
            const result = await signInWithGoogle(next)
            if (result && !result.ok) setError(result.error)
          })
        }
      >
        <GoogleMark /> {pending ? "Abrindo o Google…" : "Continuar com Google"}
      </Button>
      {error ? <FormMessage kind="error">{error}</FormMessage> : null}
    </div>
  )
}

export function OrDivider() {
  return (
    <div className="flex items-center gap-4 text-[13px] leading-5 text-muted-foreground" role="separator" aria-label="ou">
      <span className="h-px flex-1 bg-border" />
      ou
      <span className="h-px flex-1 bg-border" />
    </div>
  )
}

type PasswordInputProps = Omit<React.ComponentProps<typeof Input>, "type">

/** Password field with a show/hide button. */
export function PasswordInput({ className, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <Input type={visible ? "text" : "password"} className={cn(authInputClass, "pr-12", className)} {...props} />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
        aria-pressed={visible}
        onClick={() => setVisible((v) => !v)}
        className={cn("absolute inset-y-0 right-2 my-auto rounded-full", authMotion)}
      >
        {visible ? <EyeOffIcon strokeWidth={1.75} /> : <EyeIcon strokeWidth={1.75} />}
      </Button>
    </div>
  )
}

/** One transition for every hover/focus/active state on the auth screens (DESIGN-SYSTEM §5.3). */
export const authMotion =
  "transition-[color,background-color,border-color,box-shadow,transform,opacity] duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none"

/** Inputs, primary button and Google button share the same height, radius and horizontal padding (48 px, radius 12, 16 px). */
export const authInputClass = cn("h-12 rounded-xl px-4 py-0 text-base md:h-12 md:text-base", authMotion)

export const authButtonClass = cn("h-12 w-full rounded-xl px-4 text-[15px] leading-6 font-semibold", authMotion)

export const authLinkClass = cn("rounded-sm underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50", authMotion)
