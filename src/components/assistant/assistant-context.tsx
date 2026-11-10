"use client"

import { createContext, useContext } from "react"

type AssistantContextValue = { openAssistant: () => void; openQuickCapture: () => void; openSearch: () => void }

const AssistantContext = createContext<AssistantContextValue>({ openAssistant: () => {}, openQuickCapture: () => {}, openSearch: () => {} })

export const AssistantProvider = AssistantContext.Provider

/** Lets any screen open the assistant sheet, the quick capture dialog or the search owned by the app shell. */
export function useAssistant() {
  return useContext(AssistantContext)
}
