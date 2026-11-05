"use client"

/**
 * TEMPORARY splash debugging, one flag, easy to remove (see "Removing" below).
 *
 * Turn on:   open the app with ?splashDebug=1 once (it sticks in localStorage.splashDebug), then do the Google login.
 * Turn off:  ?splashDebug=0, or the "Desligar" button of the panel.
 * What it records (sessionStorage.splashLog, survives the page loads of the login): document start, the submit click, the sign-in request and its
 *   response time, router.replace, every route commit, the overlay shown / marked pending / marked ready / removed (with the reason), the dashboard
 *   shell mounted, the first data paint, frames where the wallpaper was visible without the splash or content ("bare-frame"), boot decision of a
 *   resumed document (elapsed, final), controller checks.
 * Where you read it: a panel at the bottom of the dashboard with a "Copiar" button (paste the text back).
 *
 * Removing: delete this file and splash-debug-boot.ts, the SPLASH_DEBUG_BOOT import in splash-boot.ts (and its use at the top of SPLASH_BOOT), the
 * <SplashDebugPanel /> in src/app/layout.tsx, and the splashLog calls (they are no-ops without the flag).
 */
import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"

import { SPLASH_DEBUG_FLAG as FLAG, SPLASH_DEBUG_LOG as LOG } from "./splash-debug-boot"

type Logger = (ev: string, extra?: Record<string, unknown>) => void
export const splashLog: Logger = (ev, extra) => {
  try {
    ;(window as unknown as { __splashLog?: Logger }).__splashLog?.(ev, extra)
  } catch {
    // Debugging only.
  }
}

const enabled = () => {
  try {
    return localStorage.getItem(FLAG) === "1"
  } catch {
    return false
  }
}

/** The "Splash log" panel on the dashboard, plus a frame sampler that notes every frame the wallpaper shows without splash or content. */
export function SplashDebugPanel() {
  const [on, setOn] = useState(false)
  const [text, setText] = useState("")
  const pathname = usePathname()
  // Every route commit of the client router, with the time (the missing piece of the login timeline).
  useEffect(() => {
    splashLog("route-commit", { pathname })
  }, [pathname])

  useEffect(() => {
    if (!enabled()) return
    // Reading localStorage / sessionStorage is only possible in the browser, after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOn(true)
    splashLog("panel-mounted")
    let raf = 0
    let bare = 0
    let painted = false
    const sample = () => {
      const shellNow = document.querySelector("[data-app-scroll]")
      if (!painted && shellNow && (shellNow.textContent ?? "").trim().length > 20) {
        painted = true
        splashLog("first-data-paint", { chars: (shellNow.textContent ?? "").trim().length })
      }
      const onDashboard = location.pathname === "/dashboard" || location.pathname.startsWith("/dashboard/")
      // Covered = the server-rendered splash (data-splash) or the hand-off overlay of the e-mail flow ([data-handoff]) is on screen.
      const covered = document.documentElement.hasAttribute("data-splash") || Boolean(document.querySelector("[data-handoff]"))
      if (onDashboard && !covered) {
        const shell = document.querySelector("[data-app-scroll]")
        if ((!shell || (shell.textContent ?? "").trim().length <= 20) && bare < 30) {
          bare += 1
          splashLog("bare-frame", { n: bare, shell: Boolean(shell) })
        }
      }
      raf = requestAnimationFrame(sample)
    }
    raf = requestAnimationFrame(sample)
    const read = () => setText(sessionStorage.getItem(LOG) ?? "[]")
    read()
    const timer = window.setInterval(read, 1000)
    return () => {
      cancelAnimationFrame(raf)
      window.clearInterval(timer)
    }
  }, [])

  if (!on) return null
  const pretty = (() => {
    try {
      return (JSON.parse(text || "[]") as { ev: string; date: number; perf: number; path: string; x: unknown }[]).map((e) => `${new Date(e.date).toISOString().slice(11, 23)}  perf=${String(e.perf).padStart(6)}ms  ${e.path}  ${e.ev}  ${e.x ? JSON.stringify(e.x) : ""}`).join("\n")
    } catch {
      return text
    }
  })()
  return (
    <div className="fixed right-2 bottom-24 left-2 z-[300] max-h-[40dvh] overflow-auto rounded-[14px] border border-border bg-popover p-3 text-[11px] leading-4 text-popover-foreground md:right-auto md:max-w-xl">
      <div className="mb-2 flex gap-2">
        <strong className="mr-auto">Splash log</strong>
        <button type="button" className="rounded-full border border-border px-3 py-1" onClick={() => navigator.clipboard?.writeText(pretty)}>
          Copiar
        </button>
        <button type="button" className="rounded-full border border-border px-3 py-1" onClick={() => (sessionStorage.removeItem(LOG), setText("[]"))}>
          Limpar
        </button>
        <button type="button" className="rounded-full border border-border px-3 py-1" onClick={() => (localStorage.removeItem(FLAG), setOn(false))}>
          Desligar
        </button>
      </div>
      <pre className="whitespace-pre-wrap">{pretty}</pre>
    </div>
  )
}
