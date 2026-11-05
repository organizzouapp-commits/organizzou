import { splashResume } from "@/lib/splash-resume"

import { SPLASH_DEBUG_BOOT } from "./splash-debug-boot"

/** Cookie names shared by the login, the callback route and the boot script. */
export const SPLASH_START_COOKIE = "org_splash"
export const SPLASH_RETURN_COOKIE = "org_splash_ret"

/** Every route the post-login splash covers: the person lands on the dashboard. Anywhere else (a cancelled Google sign-in goes back to /login) no splash. */
const COVERED = 'location.pathname==="/dashboard"||location.pathname.indexOf("/dashboard/")===0'

/**
 * Inline script, first thing in <body> (parser-blocking, so it runs before anything below it paints): decides from the two cookies whether this
 * document starts with the splash already ON SCREEN, and how far into its intro it is. The splash markup is in the server HTML (SplashShell), hidden
 * by CSS unless <html data-splash> is set here, so the wallpaper can never show alone between pages and nothing depends on hydration.
 * Sets: <html data-splash>, <html data-splash-final> (intro already over or reduced motion: static logo) and --splash-elapsed on <html>.
 */
export const SPLASH_BOOT = `${SPLASH_DEBUG_BOOT}
(function(){try{
var log=window.__splashLog||function(){};
var cookies={};document.cookie.split("; ").forEach(function(p){var i=p.indexOf("=");if(i>0)cookies[p.slice(0,i)]=p.slice(i+1)});
var resume=${splashResume.toString()};
var now=Date.now();
var r=resume(now,+cookies.${SPLASH_START_COOKIE}||null,+cookies.${SPLASH_RETURN_COOKIE}||null);
var covered=${COVERED};
var reduced=window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches;
log("boot",{covered:covered,show:r.show,elapsed:r.elapsed,final:r.final,reduced:reduced,start:+cookies.${SPLASH_START_COOKIE}||null,ret:+cookies.${SPLASH_RETURN_COOKIE}||null});
if(r.show&&covered){var d=document.documentElement;d.setAttribute("data-splash","1");d.style.setProperty("--splash-elapsed",(r.elapsed/1000)+"s");if(r.final||reduced)d.setAttribute("data-splash-final","1");log("splash-shown-from-server-html",{elapsedMs:r.elapsed,final:r.final||reduced})}
}catch(e){}})();`
