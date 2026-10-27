"use client"

import { createPortal } from "react-dom"

import { LoadingScreen } from "./loading-screen"

/**
 * LoadingScreen on top of everything, rendered into <body>: the auth card sits inside transformed ancestors, which would
 * otherwise turn `fixed` into "relative to the card". Only render it after a user action (it needs `document`).
 */
export function LoadingOverlay() {
  return createPortal(<LoadingScreen icon />, document.body)
}
