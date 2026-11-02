"use client"

import { useState, useTransition, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import type { AdminActionResult } from "@/features/admin/actions"

type ConfirmActionProps = {
  /** Button label (with its icon as a child). */
  trigger: ReactNode
  title: string
  description: string
  confirmLabel: string
  /** Server action to run once confirmed. Its message or error becomes a toast; on success the page data is refreshed. */
  run: () => Promise<AdminActionResult>
  disabled?: boolean
  /** Extra fields shown inside the dialog (the plan picker). */
  children?: ReactNode
  /** Blocks the confirm button until the fields are valid. */
  canConfirm?: boolean
}

/** Every admin write goes through this: an alert-dialog first, then the server action, then a toast. Never fires on the first click. */
export function ConfirmAction({ trigger, title, description, confirmLabel, run, disabled, children, canConfirm = true }: ConfirmActionProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()

  function confirm() {
    start(async () => {
      const result = await run()
      if (result.ok) {
        toast.success(result.message)
        setOpen(false)
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <>
      <Button type="button" variant="outline" className="h-11 justify-start rounded-full px-5" disabled={disabled} onClick={() => setOpen(true)}>
        {trigger}
      </Button>
      <AlertDialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          {children}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            <Button type="button" className="h-11 rounded-full px-5" disabled={pending || !canConfirm} onClick={confirm}>
              {pending ? "Aplicando…" : confirmLabel}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
