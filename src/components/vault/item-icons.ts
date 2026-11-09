import { CreditCardIcon, FileTextIcon, KeyRoundIcon, StickyNoteIcon, type LucideIcon } from "lucide-react"

import type { VaultItemType } from "@/features/vault/types"

export const ITEM_ICONS: Record<VaultItemType, LucideIcon> = { login: KeyRoundIcon, card: CreditCardIcon, document: FileTextIcon, secure_note: StickyNoteIcon }
