"use client"

import { useState } from "react"

import { ResponsiveSheet } from "@/components/tasks/responsive-sheet"
import { Button } from "@/components/ui/button"
import { FOLDER_NAME_MAX, validateFolderName } from "@/features/notes/folders"

export type FolderDialogState = { mode: "create" } | { mode: "rename"; id: string; name: string }

/** "Nova pasta" / "Renomear pasta": a dialog on desktop, a bottom sheet on phones. Enter submits when valid, Esc closes. */
export function FolderDialog({ state, folders, onClose, onCreate, onRename }: { state: FolderDialogState | null; folders: { id: string; name: string }[]; onClose: () => void; onCreate: (name: string) => void; onRename: (id: string, name: string) => void }) {
  const rename = state?.mode === "rename"
  return (
    <ResponsiveSheet open={state !== null} onOpenChange={(open) => !open && onClose()} title={rename ? "Renomear pasta" : "Nova pasta"} description="Pastas organizam as suas notas.">
      {state ? (
        <FolderForm
          key={state.mode === "rename" ? state.id : "new"}
          initial={state.mode === "rename" ? state.name : ""}
          ignoreId={state.mode === "rename" ? state.id : undefined}
          folders={folders}
          submitLabel={rename ? "Salvar" : "Criar pasta"}
          onCancel={onClose}
          onSubmit={(name) => {
            if (state.mode === "rename") onRename(state.id, name)
            else onCreate(name)
            onClose()
          }}
        />
      ) : null}
    </ResponsiveSheet>
  )
}

function FolderForm({ initial, ignoreId, folders, submitLabel, onCancel, onSubmit }: { initial: string; ignoreId?: string; folders: { id: string; name: string }[]; submitLabel: string; onCancel: () => void; onSubmit: (name: string) => void }) {
  const [value, setValue] = useState(initial)
  const [touched, setTouched] = useState(false)
  const result = validateFolderName(value, folders, ignoreId)
  const error = touched && !result.ok ? result.error : null
  return (
    <form
      data-testid="folder-form"
      noValidate
      className="flex flex-col gap-4 pb-1"
      onSubmit={(e) => {
        e.preventDefault()
        setTouched(true)
        if (result.ok) onSubmit(result.name)
      }}
    >
      <div className="flex flex-col gap-2">
        <label htmlFor="folder-name" className="text-[13px] leading-5 font-medium">
          Nome
        </label>
        <input
          id="folder-name"
          autoFocus
          required
          value={value}
          maxLength={FOLDER_NAME_MAX}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "folder-name-error" : undefined}
          placeholder="Ex.: Trabalho"
          autoComplete="off"
          onChange={(e) => {
            setValue(e.target.value)
            setTouched(true)
          }}
          className="h-11 w-full rounded-[12px] border border-input bg-transparent px-3 text-[15px] outline-none placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary aria-invalid:border-foreground"
        />
        {error ? (
          <p id="folder-name-error" role="alert" className="text-[13px] leading-5 text-foreground">
            {error}
          </p>
        ) : null}
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" className="h-11 rounded-full px-5" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!result.ok} className="h-11 rounded-full bg-highlight px-5 text-highlight-foreground hover:bg-highlight/90 disabled:bg-muted disabled:text-muted-foreground">
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
