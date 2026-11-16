// Kept out of sessions-actions.ts: a "use server" file may only export async functions.
type RpcError = { code?: string | null; message?: string | null } | null

/** The functions refuse with "sessions_delete_not_permitted" (42501) when the database role cannot delete from auth.sessions. */
export const isPermissionError = (error: RpcError) => Boolean(error && (/sessions_delete_not_permitted/.test(error.message ?? "") || error.code === "42501"))

export const PERMISSION_MESSAGE = "O banco não permitiu encerrar sessões (falta permissão em auth.sessions). Nada foi alterado. Fale com o suporte ou revise a migração de sessões."
