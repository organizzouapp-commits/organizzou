// The profile photo, apart from the browser and the server: input rules, the square crop, and the localStorage fallback behind a small
// repository (used until the "avatars" bucket migration is applied, or when saving to the server fails).

export const AVATAR_SIZE = 512
export const MAX_INPUT_BYTES = 5 * 1024 * 1024
/** The webp the browser produces at 512x512 is far below this; the server refuses anything bigger. */
export const MAX_UPLOAD_BYTES = 1024 * 1024


export type FileCheck = { ok: true } | { ok: false; error: string }

/** The picked file: an image, at most 5 MB. */
export function checkAvatarFile(file: { type: string; size: number }): FileCheck {
  if (!file.type.startsWith("image/")) return { ok: false, error: "Escolha um arquivo de imagem." }
  if (file.size > MAX_INPUT_BYTES) return { ok: false, error: "A imagem passa de 5 MB. Escolha uma menor." }
  if (file.size === 0) return { ok: false, error: "Esse arquivo está vazio." }
  return { ok: true }
}

/**
 * The square taken from the picture: the largest centered square divided by `zoom` (1 = whole short side), then moved by `focusX` and `focusY`
 * (-1..1, where 0 is the center). Always inside the image.
 */
export function cropRect(width: number, height: number, zoom = 1, focusX = 0, focusY = 0): { sx: number; sy: number; size: number } {
  const z = Math.min(4, Math.max(1, zoom))
  const size = Math.min(width, height) / z
  const slackX = (width - size) / 2
  const slackY = (height - size) / 2
  const clamp = (v: number) => Math.min(1, Math.max(-1, v))
  return { sx: slackX + clamp(focusX) * slackX, sy: slackY + clamp(focusY) * slackY, size }
}

/** Where the photo lives on the server: one folder per user. */
export const avatarPath = (userId: string) => `${userId}/avatar.webp`

/** Only a path inside the person's own folder is accepted. */
export const isOwnAvatarPath = (path: string, userId: string) => path === avatarPath(userId)

// ---------------------------------------------------------------- fallback: a data URL on this device

export interface AvatarRepo {
  load(): string | null
  save(dataUrl: string): void
  clear(): void
  subscribe(listener: () => void): () => void
}

const KEY = "organizzou:avatar"
const EVENT = "organizzou:avatar-change"

export const isImageDataUrl = (value: unknown): value is string => typeof value === "string" && /^data:image\/(webp|png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(value)

export const localAvatarRepo: AvatarRepo = {
  load() {
    try {
      const value = localStorage.getItem(KEY)
      return isImageDataUrl(value) ? value : null
    } catch {
      return null
    }
  },
  save(dataUrl) {
    try {
      if (isImageDataUrl(dataUrl)) localStorage.setItem(KEY, dataUrl)
    } catch {
      // Storage full or private mode: the photo just does not survive the visit.
    }
    window.dispatchEvent(new Event(EVENT))
  },
  clear() {
    try {
      localStorage.removeItem(KEY)
    } catch {
      // Nothing to clear.
    }
    window.dispatchEvent(new Event(EVENT))
  },
  subscribe(listener) {
    window.addEventListener(EVENT, listener)
    window.addEventListener("storage", listener)
    return () => {
      window.removeEventListener(EVENT, listener)
      window.removeEventListener("storage", listener)
    }
  },
}
