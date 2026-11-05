// Part of the temporary splash debugging (see splash-debug.tsx). Server-safe: just a string the boot script inlines.
export const SPLASH_DEBUG_FLAG = "splashDebug"
export const SPLASH_DEBUG_LOG = "splashLog"

/** Inline part of the boot script: defines window.__splashLog when the flag is on, and logs the document start. */
export const SPLASH_DEBUG_BOOT = `(function(){try{var u=new URL(location.href);var q=u.searchParams.get("${SPLASH_DEBUG_FLAG}");if(q==="1")localStorage.setItem("${SPLASH_DEBUG_FLAG}","1");if(q==="0"){localStorage.removeItem("${SPLASH_DEBUG_FLAG}");sessionStorage.removeItem("${SPLASH_DEBUG_LOG}")}if(localStorage.getItem("${SPLASH_DEBUG_FLAG}")==="1"){window.__splashLog=function(ev,x){try{var a=JSON.parse(sessionStorage.getItem("${SPLASH_DEBUG_LOG}")||"[]");a.push({ev:ev,date:Date.now(),perf:Math.round(performance.now()),path:location.pathname,x:x||null});sessionStorage.setItem("${SPLASH_DEBUG_LOG}",JSON.stringify(a))}catch(e){}};var n=(performance.getEntriesByType("navigation")[0]||{});window.__splashLog("doc-start",{navType:n.type||null,referrer:document.referrer||null,cookies:document.cookie.split("; ").map(function(c){return c.split("=")[0]}).filter(function(k){return k.indexOf("org_splash")===0})})}}catch(e){}})();`

