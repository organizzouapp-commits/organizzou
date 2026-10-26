"use client"

import { createContext, useContext } from "react"

type AssistantContextValue = { openAssistant: () => void; openQuickCapture: () => void }

const AssistantContext = createContext<AssistantContextValue>({ openAssistant: () => {}, openQuickCapture: () => {} })

export const AssistantProvider = AssistantContext.Provider

/** Lets any screen open the assistant sheet or the quick capture dialog owned by the app shell. */
export function useAssistant() {
  return useContext(AssistantContext)
}
