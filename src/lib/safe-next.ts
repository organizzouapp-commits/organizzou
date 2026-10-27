/**
 * Post-login destination: only same-site relative paths are allowed (no "//host", no backslashes, no control
 * characters), anything else falls back to the dashboard. Used by the login forms, the Google flow and /auth/callback.
 */
export function safeNextPath(value: string | null | undefined, fallback = "/dashboard") {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback
  if (value.includes("\\") || /[\u0000-\u001f]/.test(value)) return fallback
  return value
}
