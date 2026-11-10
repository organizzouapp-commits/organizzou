// Deleting the account is not available yet. This only holds the rule of the confirmation text so the (disabled) flow is ready and tested.

export const DELETE_CONFIRMATION = "EXCLUIR"

/** True only when the person typed the word exactly (capitals, surrounding spaces ignored). */
export const isDeleteConfirmation = (typed: string): boolean => typed.trim() === DELETE_CONFIRMATION
