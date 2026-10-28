export const PRELOADER_KEY = "organizzou-preloader-seen"
export const PRELOADER_EVENT = "organizzou:preloader"

/**
 * Inline script (runs before first paint, loaded with next/script "beforeInteractive" from the root layout): decides
 * synchronously whether the public-site preloader shows, so a second visit or reduced motion never flashes it. It sets
 * html[data-preloader] to "show" or "skip"; CSS hides the overlay on "skip".
 */
export const PRELOADER_BOOT = `try{var d=document.documentElement;d.dataset.preloader=(sessionStorage.getItem("${PRELOADER_KEY}")||matchMedia("(prefers-reduced-motion: reduce)").matches)?"skip":"show"}catch(e){document.documentElement.dataset.preloader="skip"}`
