"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { MicIcon, MicOffIcon } from "lucide-react"
import { toast } from "sonner"

import { CapturePreview } from "@/components/assistant/capture-preview"
import { showCaptureToast } from "@/components/assistant/capture-toasts"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { useIsMobile } from "@/hooks/use-mobile"
import { captureQuick } from "@/features/assistant/actions"
import { cn } from "@/lib/utils"
import { type CaptureItem, type CaptureType, isConfident, parseCapture, readAs, TYPE_LABELS } from "@/server/assistant/parse"

type QuickCaptureProps = { open: boolean; onOpenChange: (open: boolean) => void }

/** Quick-type chips: they force the destination and swap the placeholder for an example of that type. */
const CHIPS: { type: CaptureType; example: string }[] = [
  { type: "tarefa", example: "Ex.: pagar o aluguel sexta" },
  { type: "gasto", example: "Ex.: gastei 45 no mercado" },
  { type: "nota", example: "Ex.: anotar a ideia do projeto novo" },
  { type: "habito", example: "Ex.: criar hábito de meditar" },
  { type: "evento", example: "Ex.: reunião com a Marina amanhã 15h" },
  { type: "lembrete", example: "Ex.: me lembra de ligar para o contador sexta" },
  { type: "humor", example: "Ex.: humor 4" },
  { type: "agua", example: "Ex.: bebi 500 ml de água" },
  { type: "peso", example: "Ex.: pesei 72,4" },
  { type: "treino", example: "Ex.: treinei peito 50 min" },
]
const DEFAULT_PLACEHOLDER = "Ex.: pagar o aluguel sexta, gastei 45 no mercado…"

/** Same form in a dialog (desktop) and in a bottom drawer (mobile). */
const dialogParts = { Header: DialogHeader, Title: DialogTitle, Description: DialogDescription, Footer: DialogFooter }
const sheetParts = { Header: SheetHeader, Title: SheetTitle, Description: SheetDescription, Footer: SheetFooter }

export function QuickCapture({ open, onOpenChange }: QuickCaptureProps) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="max-h-[92dvh] gap-0 overflow-y-auto rounded-t-[20px] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {open ? <QuickCaptureBody parts={sheetParts} onClose={() => onOpenChange(false)} /> : null}
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] gap-5 overflow-y-auto rounded-[20px] sm:max-w-xl">{open ? <QuickCaptureBody parts={dialogParts} onClose={() => onOpenChange(false)} /> : null}</DialogContent>
    </Dialog>
  )
}

/** The browser's speech recognition, if it has one (Chrome, Edge, Safari). Nothing is simulated when it does not. */
type Recognition = {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>; resultIndex: number }) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
  start(): void
  stop(): void
}
const recognitionCtor = (): (new () => Recognition) | null => {
  if (typeof window === "undefined") return null
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

function useDebounced<T>(value: T, ms: number) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(timer)
  }, [value, ms])
  return debounced
}

function QuickCaptureBody({ parts, onClose }: { parts: typeof dialogParts | typeof sheetParts; onClose: () => void }) {
  const { Header, Title, Description, Footer } = parts
  const router = useRouter()
  const [now] = useState(() => new Date())
  const [text, setText] = useState("")
  const [saving, setSaving] = useState(false)
  const [forced, setForced] = useState<CaptureType | null>(null)
  const [overrides, setOverrides] = useState<Record<string, CaptureType>>({})
  const [listening, setListening] = useState(false)
  const [canListen] = useState(() => recognitionCtor() !== null)
  const recognition = useRef<Recognition | null>(null)
  const debounced = useDebounced(text, 250)

  /** What will be created for `value`: the rule reading, with the chip and the per-item selector applied. */
  function resolve(value: string): { items: CaptureItem[]; cannotRead: Set<string> } {
    const cannotRead = new Set<string>()
    const items = parseCapture(value, now).map((item) => {
      const want = overrides[item.source] ?? forced
      if (!want || (want === item.type && isConfident(item))) return item
      const read = readAs(want, item.source, now)
      if (read) return read
      cannotRead.add(item.source)
      return item
    })
    return { items, cannotRead }
  }
  const preview = useMemo(() => resolve(debounced), [debounced, forced, overrides]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => recognition.current?.stop(), [])

  function toggleMic() {
    if (listening) return void recognition.current?.stop()
    const Ctor = recognitionCtor()
    if (!Ctor) return
    const r = new Ctor()
    r.lang = "pt-BR"
    r.interimResults = false
    r.continuous = false
    r.onresult = (event) => {
      let heard = ""
      for (let i = event.resultIndex; i < event.results.length; i++) heard += event.results[i][0].transcript
      if (heard.trim()) setText((t) => (t.trim() ? `${t.trim()} ${heard.trim()}` : heard.trim()))
    }
    r.onend = () => setListening(false)
    r.onerror = () => {
      setListening(false)
      toast.error("Não consegui ouvir. Confira a permissão do microfone.")
    }
    recognition.current = r
    setListening(true)
    r.start()
  }

  function submit() {
    if (!text.trim() || saving) return
    setSaving(true)
    void captureQuick({ text, items: resolve(text).items }).then((result) => {
      setSaving(false)
      if (!result.ok) {
        // Stay open with the text, so nothing the person wrote is lost.
        toast.error(result.error)
        return
      }
      onClose()
      router.refresh()
      showCaptureToast(result.entries, () => router.refresh())
    })
  }

  const placeholder = CHIPS.find((c) => c.type === forced)?.example ?? DEFAULT_PLACEHOLDER

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <Header className="p-0">
        <Title className="text-[20px] leading-7 font-semibold">Captura rápida</Title>
        <Description>Escreva do jeito que vier: vira tarefa, gasto ou nota, e fica salvo.</Description>
      </Header>

      <div className="relative">
        <Textarea
          autoFocus
          aria-label="O que você quer registrar?"
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setOverrides({})
          }}
          onKeyDown={(e) => {
            // Enter saves; Shift+Enter breaks the line; Ctrl/Cmd+Enter saves too. Never while an IME is composing.
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              submit()
            }
          }}
          placeholder={placeholder}
          className="min-h-36 resize-none rounded-2xl p-4 pr-16 text-[17px] leading-7"
        />
        <Button
          type="button"
          variant={listening ? "default" : "outline"}
          size="icon-lg"
          className="absolute right-3 bottom-3 rounded-full"
          aria-label={listening ? "Parar de ouvir" : "Ditar por voz"}
          aria-pressed={listening}
          disabled={!canListen}
          title={canListen ? undefined : "O ditado por voz não está disponível neste navegador."}
          onClick={toggleMic}
        >
          {listening ? <MicOffIcon strokeWidth={1.75} /> : <MicIcon strokeWidth={1.75} />}
        </Button>
      </div>

      <div role="group" aria-label="Tipo do registro" className="flex flex-wrap gap-2">
        {CHIPS.map(({ type }) => {
          const on = forced === type
          return (
            <Button
              key={type}
              type="button"
              variant="outline"
              size="sm"
              aria-pressed={on}
              className={cn("rounded-full px-4", on && "border-highlight bg-highlight text-highlight-foreground hover:bg-highlight/90 hover:text-highlight-foreground")}
              onClick={() => {
                setForced(on ? null : type)
                setOverrides({})
              }}
            >
              {TYPE_LABELS[type]}
            </Button>
          )
        })}
      </div>

      <CapturePreview
        items={preview.items}
        now={now}
        cannotRead={preview.cannotRead}
        onChangeType={(source, type) => {
          setOverrides((o) => ({ ...o, [source]: type }))
        }}
      />

      <Footer className="m-0 flex-row items-center justify-between gap-3 border-0 bg-transparent p-0 sm:justify-between">
        <p className="hidden text-[13px] leading-5 text-muted-foreground sm:block">Enter salva · Shift+Enter quebra a linha</p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="lg" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" size="lg" disabled={!text.trim() || saving}>
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </Footer>
    </form>
  )
}
