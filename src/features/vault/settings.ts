// The Cofre's own preferences: when it locks by itself and the day of the last exported backup. Nothing secret: no keys, no passwords, no
// backup contents. They live behind a small repository so the storage can change; today the only adapter is the browser's localStorage (the
// Cofre itself is per device, so its settings are too).

export type AutoLock = "1" | "5" | "15" | "30" | "hidden"
export const AUTO_LOCK_OPTIONS: { value: AutoLock; label: string }[] = [
  { value: "1", label: "1 minuto" },
  { value: "5", label: "5 minutos" },
  { value: "15", label: "15 minutos" },
  { value: "30", label: "30 minutos" },
  { value: "hidden", label: "Ao fechar a aba" },
]

export type VaultSettings = { autoLock: AutoLock; /** ISO instant of the last backup file exported from this device, or null. */ lastBackupAt: string | null }
export const DEFAULT_SETTINGS: VaultSettings = { autoLock: "5", lastBackupAt: null }

export interface VaultSettingsRepo {
  load(): VaultSettings
  save(patch: Partial<VaultSettings>): void
}

const SETTINGS_KEY = "organizzou:cofre-settings"

/** Keeps only what is valid; anything else falls back to the default. */
export function parseSettings(raw: unknown): VaultSettings {
  const value = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>
  const autoLock = AUTO_LOCK_OPTIONS.some((o) => o.value === value.autoLock) ? (value.autoLock as AutoLock) : DEFAULT_SETTINGS.autoLock
  const lastBackupAt = typeof value.lastBackupAt === "string" && !Number.isNaN(Date.parse(value.lastBackupAt)) ? value.lastBackupAt : null
  return { autoLock, lastBackupAt }
}

export function createLocalSettingsRepo(): VaultSettingsRepo {
  const read = (): VaultSettings => {
    try {
      return parseSettings(JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}"))
    } catch {
      return { ...DEFAULT_SETTINGS }
    }
  }
  return {
    load: read,
    save(patch) {
      try {
        const next = parseSettings({ ...read(), ...patch })
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
      } catch {
        // Private mode: the choice just does not survive the visit.
      }
    },
  }
}

/** The repository the app uses. */
export const settingsRepo: VaultSettingsRepo = createLocalSettingsRepo()
