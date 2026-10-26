"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type PromptDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  label: string
  initialValue?: string
  submitLabel?: string
  onSubmit: (value: string) => void | Promise<void>
}

export function PromptDialog({
  open,
  onOpenChange,
  title,
  label,
  initialValue = "",
  submitLabel = "Salvar",
  onSubmit,
}: PromptDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {/* Remounted on every open so the field starts from `initialValue`. */}
        {open ? (
          <PromptForm
            title={title}
            label={label}
            initialValue={initialValue}
            submitLabel={submitLabel}
            onCancel={() => onOpenChange(false)}
            onSubmit={async (value) => {
              await onSubmit(value)
              onOpenChange(false)
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function PromptForm({
  title,
  label,
  initialValue,
  submitLabel,
  onCancel,
  onSubmit,
}: {
  title: string
  label: string
  initialValue: string
  submitLabel: string
  onCancel: () => void
  onSubmit: (value: string) => Promise<void>
}) {
  const [value, setValue] = useState(initialValue)
  const [busy, setBusy] = useState(false)

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={async (e) => {
        e.preventDefault()
        const trimmed = value.trim()
        if (!trimmed || busy) return
        setBusy(true)
        await onSubmit(trimmed)
        setBusy(false)
      }}
    >
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription className="sr-only">{label}</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-2">
        <Label htmlFor="prompt-value">{label}</Label>
        <Input id="prompt-value" autoFocus value={value} maxLength={80} onChange={(e) => setValue(e.target.value)} />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={busy || !value.trim()}>
          {submitLabel}
        </Button>
      </DialogFooter>
    </form>
  )
}
