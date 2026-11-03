import "server-only"

import pkg from "../../../package.json"
import { getSupabaseEnv } from "@/lib/supabase/env"

import { lastMigration } from "./data"
import { requireAdmin } from "./guard"
import { createSecretClient, SECRET_KEY_HINT, secretKeyConfigured } from "./secret"

export type CheckState = "ok" | "slow" | "down" | "unknown" | "info"

export type Check = {
  id: string
  label: string
  state: CheckState
  /** Overrides the default text of the state ("Operacional", ...), for presence checks. */
  text?: string
  detail: string
}

/** Past this many milliseconds a reachable service counts as slow. */
const SLOW_MS = 1200
const TIMEOUT_MS = 6000

async function timed<T>(run: () => PromiseLike<T>): Promise<{ ms: number; value?: T; error?: string }> {
  const start = performance.now()
  try {
    const value = await run()
    return { ms: Math.round(performance.now() - start), value }
  } catch (error) {
    return { ms: Math.round(performance.now() - start), error: error instanceof Error ? error.message : "erro" }
  }
}

const stateFor = (ms: number): CheckState => (ms > SLOW_MS ? "slow" : "ok")

/** Live checks, run on the server each time the page renders (and when "Verificar agora" refreshes it). No external monitoring service. */
export async function runChecks(): Promise<Check[]> {
  const { supabase } = await requireAdmin()
  const { url, anonKey } = getSupabaseEnv()

  const [db, auth, storage, migration] = await Promise.all([
    // A head count of the admin's own profile row: the cheapest authenticated round trip through the Data API and RLS.
    timed(() => supabase.from("profiles").select("id", { head: true, count: "exact" }).limit(1)),
    timed(() => fetch(`${url}/auth/v1/health`, { headers: { apikey: anonKey }, signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" })),
    secretKeyConfigured() ? timed(() => createSecretClient().storage.listBuckets()) : Promise.resolve(null),
    lastMigration(),
  ])

  const checks: Check[] = []

  const dbError = db.error ?? (db.value?.error ? db.value.error.message : undefined)
  checks.push({
    id: "database",
    label: "Banco de dados",
    state: dbError ? "down" : stateFor(db.ms),
    detail: dbError ? "Sem resposta do banco." : `Resposta em ${db.ms} ms.`,
  })

  const authOk = auth.value?.ok === true
  checks.push({
    id: "auth",
    label: "Autenticação",
    state: authOk ? stateFor(auth.ms) : "down",
    detail: authOk ? `Resposta em ${auth.ms} ms.` : "O serviço de login não respondeu.",
  })

  if (storage === null) {
    checks.push({ id: "storage", label: "Armazenamento de arquivos", state: "unknown", detail: `Não verificado: ${SECRET_KEY_HINT.toLowerCase()}.` })
  } else {
    const storageError = storage.error ?? (storage.value?.error ? storage.value.error.message : undefined)
    checks.push({
      id: "storage",
      label: "Armazenamento de arquivos",
      state: storageError ? "down" : stateFor(storage.ms),
      detail: storageError ? "O serviço de arquivos não respondeu." : `Resposta em ${storage.ms} ms.`,
    })
  }

  // Presence only: the key is never read into the page, and no call is made with it.
  const hasClaudeKey = Boolean(process.env.ANTHROPIC_API_KEY)
  checks.push({
    id: "claude",
    label: "Chave da Claude API",
    state: hasClaudeKey ? "ok" : "unknown",
    text: hasClaudeKey ? "Configurada" : "Não configurada",
    detail: hasClaudeKey ? "Chave presente no servidor (não testada)." : "ANTHROPIC_API_KEY não está definida: o chat fica como Assistente indisponível e a captura rápida segue só com regras.",
  })

  const commit = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_COMMIT_SHA
  checks.push({ id: "version", label: "Versão do app", state: "info", text: `v${pkg.version}`, detail: commit ? `Commit ${commit.slice(0, 7)}.` : "Commit não informado neste ambiente." })
  checks.push({ id: "env", label: "Ambiente", state: "info", text: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "desconhecido", detail: "Onde este servidor está rodando." })
  checks.push({
    id: "migration",
    label: "Última migration aplicada",
    state: migration.ok && migration.data ? "info" : "unknown",
    text: migration.ok && migration.data ? migration.data : "Indisponível",
    detail: migration.ok ? (migration.data ? "Registrada pelo Supabase CLI." : "O banco não guarda o histórico de migrations.") : "Não foi possível consultar (a migration do admin foi aplicada?).",
  })

  return checks
}
