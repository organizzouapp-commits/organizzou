/**
 * True when the JWT claims carry app_metadata.role = "admin". Pure (no Next imports), so the proxy, the layouts and the
 * actions share one definition. app_metadata can only be written with the secret key: users cannot grant it to themselves.
 */
export function isAdminClaims(claims: { app_metadata?: unknown } | null | undefined) {
  const meta = claims?.app_metadata
  return typeof meta === "object" && meta !== null && (meta as { role?: unknown }).role === "admin"
}
