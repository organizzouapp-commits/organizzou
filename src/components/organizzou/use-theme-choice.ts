"use client"

import { useCallback } from "react"
import { useTheme } from "next-themes"

import { updateTheme } from "@/features/settings/actions"

export type ThemeChoice = "light" | "dark" | "system"

/**
 * The one way to change the theme, used by the header switch (the only theme control). It sets the theme on this device (next-themes
 * keeps it in localStorage and applies it before first paint) AND saves it on the profile, so the choice follows the person to their
 * other devices. "Sistema" follows the device's setting on this device; the profile (light or dark only) stores what it resolves to.
 * Signed out (login screens) the profile save simply does nothing.
 */
export function useThemeChoice() {
  const { theme, resolvedTheme, setTheme } = useTheme()
  const choose = useCallback(
    (value: ThemeChoice) => {
      setTheme(value)
      const stored = value === "system" ? (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark") : value
      void updateTheme(stored).catch(() => undefined)
    },
    [setTheme]
  )
  return { theme: (theme ?? "dark") as ThemeChoice, resolved: resolvedTheme === "light" ? ("light" as const) : ("dark" as const), choose }
}
