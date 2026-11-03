"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"

import {
  colorOf,
  EMPTY_LABEL_COLORS,
  localLabelColorRepo,
  withColor,
  withCustom,
  withoutCustom,
  type ColorValue,
  type LabelColorState,
  type LabelKind,
} from "@/features/tasks/colors"

export type LabelColors = {
  state: LabelColorState
  colorOf: (kind: LabelKind, key: string) => ColorValue
  setColor: (kind: LabelKind, key: string, value: ColorValue) => void
  addCustom: (hex: string) => boolean
  removeCustom: (hex: string) => void
}

const noop: LabelColors = { state: EMPTY_LABEL_COLORS, colorOf: () => null, setColor: () => {}, addCustom: () => false, removeCustom: () => {} }
const LabelColorsContext = createContext<LabelColors>(noop)

export const LabelColorsProvider = LabelColorsContext.Provider
export const useLabelColors = () => useContext(LabelColorsContext)

/** Owns the label colors of the screen (localStorage adapter, loaded after mount so server and client render the same). */
export function useLabelColorsStore(): LabelColors {
  const [state, setState] = useState<LabelColorState>(EMPTY_LABEL_COLORS)
  useEffect(() => {
    // localStorage only exists in the browser.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(localLabelColorRepo.load())
  }, [])
  // Functional updates, so several changes in one tick (a rename moves a color) never overwrite each other.
  const update = useCallback((change: (current: LabelColorState) => LabelColorState) => {
    setState((current) => {
      const next = change(current)
      if (next !== current) localLabelColorRepo.save(next)
      return next
    })
  }, [])
  const setColor = useCallback((kind: LabelKind, key: string, value: ColorValue) => update((current) => withColor(current, kind, key, value)), [update])
  const addCustom = useCallback(
    (hex: string) => {
      const next = withCustom(state, hex)
      if (next === state) return false
      update((current) => withCustom(current, hex))
      return true
    },
    [state, update]
  )
  const removeCustom = useCallback((hex: string) => update((current) => withoutCustom(current, hex)), [update])
  return useMemo(() => ({ state, colorOf: (kind, key) => colorOf(state, kind, key), setColor, addCustom, removeCustom }), [state, setColor, addCustom, removeCustom])
}
