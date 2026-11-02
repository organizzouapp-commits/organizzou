/**
 * Example data (src/mocks) is used ONLY by the local no-login prototype (PROTOTYPE_BYPASS_AUTH=1, never in production), where there
 * is no session and so no database. Everywhere else the screens read and write Supabase. The flag is set in next.config.ts
 * (NEXT_PUBLIC_DATA_MOCK) so server and client agree. Never shown in the UI.
 */
export const isMock = process.env.NEXT_PUBLIC_DATA_MOCK === "1"
