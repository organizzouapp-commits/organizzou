// Copying a secret from the Cofre: it goes to the clipboard and is taken off again after a while (or when the vault locks).
// Browser only. Nothing is logged.

export const CLIPBOARD_CLEAR_MS = 30_000

type ClipboardLike = Pick<Clipboard, "writeText"> & Partial<Pick<Clipboard, "readText">>

let pending: { text: string; timer: ReturnType<typeof setTimeout>; clipboard: ClipboardLike } | null = null

/**
 * Empties the clipboard ONLY if it still holds the copied text: something the person copied since is never touched. When the browser does
 * not let the page read the clipboard the check cannot be made, so nothing is cleared (it would risk erasing something else).
 */
async function clear(clipboard: ClipboardLike, text: string) {
  try {
    if (!clipboard.readText) return
    if ((await clipboard.readText()) !== text) return
    await clipboard.writeText("")
  } catch {
    // Reading was refused: the value cannot be confirmed, so it is left alone.
  }
}

/** Copies `text`; it is cleared `ttl` ms later. A new copy replaces the pending clear of the previous one. */
export async function copySecret(text: string, options: { clipboard?: ClipboardLike; ttl?: number } = {}): Promise<void> {
  const clipboard = options.clipboard ?? navigator.clipboard
  await clipboard.writeText(text)
  if (pending) clearTimeout(pending.timer)
  const timer = setTimeout(() => {
    pending = null
    void clear(clipboard, text)
  }, options.ttl ?? CLIPBOARD_CLEAR_MS)
  pending = { text, timer, clipboard }
}

/** Clears right now whatever copy is still waiting to be cleared (used when the vault locks or the person signs out). */
export function clearClipboardNow(): void {
  if (!pending) return
  const { text, timer, clipboard } = pending
  clearTimeout(timer)
  pending = null
  void clear(clipboard, text)
}
