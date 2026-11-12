"use client"

import { useEffect, useRef, useState } from "react"
import { CameraIcon, ImageIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"

import { FormMessage } from "@/components/organizzou/FormMessage"
import { ResponsiveSheet } from "@/components/tasks/responsive-sheet"
import { Button } from "@/components/ui/button"
import { AVATAR_SIZE, checkAvatarFile, cropRect, localAvatarRepo } from "@/features/settings/avatar"
import { removeAvatar, saveAvatar } from "@/features/settings/avatar-actions"

const PREVIEW = 224

/**
 * "Alterar foto": pick a picture (gallery or camera), center it in a square with a zoom, see the round preview, then save. The crop is done in
 * the browser (512x512 webp). The photo goes to the server; if that is not possible it stays on this device (localStorage) and the person is told.
 */
export function AvatarDialog({ open, onOpenChange, hasPhoto }: { open: boolean; onOpenChange: (open: boolean) => void; hasPhoto: boolean }) {
  const gallery = useRef<HTMLInputElement>(null)
  const camera = useRef<HTMLInputElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null)
  const [zoom, setZoom] = useState(1)
  const [focusX, setFocusX] = useState(0)
  const [focusY, setFocusY] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBitmap(null)
      setZoom(1)
      setFocusX(0)
      setFocusY(0)
      setError(null)
      setBusy(false)
    }
  }, [open])

  function draw(target: HTMLCanvasElement, size: number) {
    if (!bitmap) return
    const { sx, sy, size: side } = cropRect(bitmap.width, bitmap.height, zoom, focusX, focusY)
    target.width = size
    target.height = size
    target.getContext("2d")?.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size)
  }
  useEffect(() => {
    if (canvas.current) draw(canvas.current, PREVIEW * 2)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bitmap, zoom, focusX, focusY])

  async function onPick(file: File | undefined) {
    if (!file) return
    const check = checkAvatarFile(file)
    if (!check.ok) return setError(check.error)
    try {
      setError(null)
      setBitmap(await createImageBitmap(file, { imageOrientation: "from-image" }))
    } catch {
      setError("Não consegui abrir essa imagem. Tente outra.")
    }
  }

  async function onSave() {
    if (!bitmap || busy) return
    setBusy(true)
    const out = document.createElement("canvas")
    draw(out, AVATAR_SIZE)
    const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, "image/webp", 0.85))
    if (!blob) {
      setBusy(false)
      return setError("Não consegui preparar a foto.")
    }
    const form = new FormData()
    form.set("file", blob, "avatar.webp")
    const result = await saveAvatar(form).catch(() => ({ ok: false as const, error: "" }))
    if (result.ok) {
      localAvatarRepo.clear()
      toast.success("Foto atualizada.")
    } else {
      // The server could not keep it (no bucket yet, offline): keep it on this device so the person still sees it.
      localAvatarRepo.save(out.toDataURL("image/webp", 0.85))
      toast("Foto salva só neste aparelho.", { description: "Ela aparece aqui, mas ainda não sincroniza com a sua conta." })
    }
    setBusy(false)
    onOpenChange(false)
  }

  async function onRemove() {
    setBusy(true)
    const result = await removeAvatar().catch(() => ({ ok: false as const, error: "" }))
    localAvatarRepo.clear()
    setBusy(false)
    if (!result.ok && result.error) toast(result.error)
    else toast("Foto removida.")
    onOpenChange(false)
  }

  return (
    <ResponsiveSheet open={open} onOpenChange={onOpenChange} title="Foto do perfil" description="Escolha uma imagem e ajuste o enquadramento.">
      <div className="flex flex-col gap-5 pb-1">
        <input ref={gallery} type="file" accept="image/*" hidden data-testid="avatar-file" onChange={(e) => (onPick(e.target.files?.[0]), (e.target.value = ""))} />
        <input ref={camera} type="file" accept="image/*" capture="user" hidden onChange={(e) => (onPick(e.target.files?.[0]), (e.target.value = ""))} />

        {bitmap ? (
          <div className="flex flex-col items-center gap-4">
            <canvas ref={canvas} data-testid="avatar-preview" aria-label="Prévia da foto" role="img" style={{ width: PREVIEW, height: PREVIEW }} className="rounded-full border border-border" />
            <div className="flex w-full flex-col gap-3">
              {(
                [
                  ["Zoom", zoom, setZoom, 1, 4, 0.05],
                  ["Mover na horizontal", focusX, setFocusX, -1, 1, 0.05],
                  ["Mover na vertical", focusY, setFocusY, -1, 1, 0.05],
                ] as const
              ).map(([label, value, set, min, max, step]) => (
                <label key={label} className="flex items-center gap-3 text-[13px] leading-5 text-muted-foreground">
                  <span className="w-36 shrink-0">{label}</span>
                  <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => set(Number(e.target.value))} className="h-11 w-full accent-[var(--primary)]" />
                </label>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <Button type="button" variant="outline" className="h-12 justify-start gap-3 rounded-[12px] px-4" onClick={() => gallery.current?.click()}>
              <ImageIcon strokeWidth={1.75} /> Escolher da galeria
            </Button>
            <Button type="button" variant="outline" className="h-12 justify-start gap-3 rounded-[12px] px-4 md:hidden" onClick={() => camera.current?.click()}>
              <CameraIcon strokeWidth={1.75} /> Tirar uma foto
            </Button>
            <p className="text-[13px] leading-5 text-muted-foreground">Imagens de até 5 MB. A foto vira um quadrado de 512 px.</p>
          </div>
        )}

        {error ? <FormMessage kind="error">{error}</FormMessage> : null}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          {hasPhoto ? (
            <Button type="button" variant="ghost" disabled={busy} className="h-11 rounded-full px-4 text-muted-foreground" onClick={onRemove}>
              <Trash2Icon strokeWidth={1.75} /> Remover foto
            </Button>
          ) : (
            <span />
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            {bitmap ? (
              <Button type="button" variant="outline" disabled={busy} className="h-11 rounded-full px-5" onClick={() => gallery.current?.click()}>
                Outra imagem
              </Button>
            ) : null}
            <Button type="button" variant="outline" className="h-11 rounded-full px-5" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="button" disabled={!bitmap || busy} onClick={onSave} data-testid="avatar-save" className="h-11 rounded-full bg-highlight px-6 text-highlight-foreground hover:bg-highlight/90">
              {busy ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </div>
      </div>
    </ResponsiveSheet>
  )
}
