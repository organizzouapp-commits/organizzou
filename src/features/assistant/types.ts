import type { ModuleId } from "@/components/organizzou/modules"

/** What the assistant did after understanding the message. Executed actions are audit-logged on the server later. */
export type AssistantAction = {
  module: ModuleId
  /** Short past-tense summary, e.g. "Gasto registrado". */
  title: string
  detail: string
  undoable: boolean
}

export type AssistantConfirm = {
  /** Sensitive actions never run without an explicit yes. */
  question: string
  confirmLabel: string
  onConfirm: { reply: string; action?: AssistantAction }
}

export type AssistantReply = {
  text: string
  action?: AssistantAction
  confirm?: AssistantConfirm
  /** Quick replies that resend as a user message. */
  choices?: string[]
  /** Lines of a read-only answer (summaries and queries). */
  rows?: { label: string; value: string }[]
}

export type ChatMessage =
  | { id: string; role: "user"; text: string; audioSeconds?: number }
  | { id: string; role: "assistant"; reply: AssistantReply; resolved?: "confirmed" | "cancelled" | "undone" }
