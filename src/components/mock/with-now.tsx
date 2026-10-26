import { connection } from "next/server"

/**
 * Gives a server page the request time as an ISO string. With Cache Components the clock may only be
 * read at request time, so every mock-backed screen builds its data from this value.
 */
export async function WithNow({ children }: { children: (nowIso: string) => React.ReactNode }) {
  await connection()
  return children(new Date().toISOString())
}
