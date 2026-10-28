import { useEffect, useState } from "react"

/** Inputs that bring up the on-screen keyboard (read-only fields, checkboxes and buttons do not). */
function isTextEntry(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  if (target instanceof HTMLTextAreaElement) return !target.readOnly
  if (!(target instanceof HTMLInputElement) || target.readOnly) return false
  return !["checkbox", "radio", "button", "submit", "reset", "range", "file", "color", "image"].includes(target.type)
}

/** True while a text field has focus, i.e. while the keyboard covers the bottom of the screen. */
export function useTextEntryFocused() {
  const [focused, setFocused] = useState(false)
  useEffect(() => {
    const onIn = (event: FocusEvent) => setFocused(isTextEntry(event.target))
    const onOut = () => setFocused(false)
    document.addEventListener("focusin", onIn)
    document.addEventListener("focusout", onOut)
    return () => {
      document.removeEventListener("focusin", onIn)
      document.removeEventListener("focusout", onOut)
    }
  }, [])
  return focused
}
