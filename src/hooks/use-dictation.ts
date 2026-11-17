"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { createTranscriber, dictationMessage, type DictationError, type Transcriber, UNSUPPORTED_MESSAGE } from "@/lib/assistant/transcribe"

/** Joins what was already typed with the dictated text. */
export const joinDictation = (base: string, heard: string) => (base.trim() && heard ? `${base.trim()} ${heard}` : base.trim() || heard)

/**
 * Dictation into a text box: interim text shows live, a stop keeps the final text for the person to review (it is never sent by itself),
 * a cancel puts back what was there before. `makeTranscriber` is injectable for tests.
 */
export function useDictation({ value, onChange, makeTranscriber = createTranscriber }: { value: string; onChange: (next: string) => void; makeTranscriber?: () => Transcriber }) {
  const [listening, setListening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const transcriber = useRef<Transcriber | null>(null)
  const base = useRef("")
  const latest = useRef(value)
  useEffect(() => {
    latest.current = value
  }, [value])
  useEffect(() => () => transcriber.current?.cancel(), [])

  const start = useCallback(() => {
    setError(null)
    const t = (transcriber.current ??= makeTranscriber())
    if (!t.supported) return setError(UNSUPPORTED_MESSAGE)
    base.current = latest.current
    setListening(true)
    t.start({
      onText: (heard) => onChange(joinDictation(base.current, heard)),
      onError: (kind: DictationError) => setError(dictationMessage(kind) || null),
      onEnd: () => setListening(false),
    })
  }, [makeTranscriber, onChange])

  const stop = useCallback(() => transcriber.current?.stop(), [])
  const cancel = useCallback(() => {
    transcriber.current?.cancel()
    onChange(base.current)
    setListening(false)
  }, [onChange])

  return { listening, error, start, stop, cancel, clearError: () => setError(null) }
}
