/* Organizzou service worker: web push only. It caches nothing and never touches fetches, so API and auth responses always come from the network. */
// A new version waits until the person taps "Atualizar" in the app (the page sends SKIP_WAITING); the very first install activates at once.
self.addEventListener("install", () => {})
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting()
})
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()))

// Tells the open pages what happened to a push (for the Avisos debug panel): "received" when the event reached this worker, then "shown" or
// "error" (with the error name only). No payload, no endpoint.
function report(stage, detail) {
  return self.clients
    .matchAll({ type: "window", includeUncontrolled: true })
    .then((windows) => windows.forEach((client) => client.postMessage({ type: "ORG_PUSH", stage, detail: detail || null, at: Date.now() })))
    .catch(() => undefined)
}

self.addEventListener("push", (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch (error) {
    data = { title: "Organizzou", body: event.data ? event.data.text() : "" }
  }
  const title = typeof data.title === "string" && data.title ? data.title : "Organizzou"
  const url = typeof data.url === "string" && data.url.startsWith("/") ? data.url : "/dashboard"
  const options = {
    body: typeof data.body === "string" ? data.body : "",
    icon: "/brand/pwa-192.png",
    badge: "/brand/pwa-badge-96.png",
    lang: "pt-BR",
    // Noticeable: never silent, a short vibration pattern on phones, and the banner waits for a click when the push says so (the test and
    // reminders with a due time).
    vibrate: [100, 50, 100],
    requireInteraction: data.sticky === true,
    // A stable tag (the sender's, else one made from the destination) with renotify: a repeat replaces the old banner AND alerts again.
    tag: typeof data.tag === "string" && data.tag ? data.tag : "org:" + url,
    renotify: true,
    data: { url },
  }
  event.waitUntil(
    report("received")
      .then(() => self.registration.showNotification(title, options))
      .then(() => report("shown"))
      .catch((error) => {
        // Last resort: a plain notification, so a push is never swallowed by an option the platform refuses.
        report("error", error && error.name ? error.name : "Error")
        return self.registration.showNotification(title, { body: options.body, data: options.data })
      })
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const target = new URL((event.notification.data && event.notification.data.url) || "/dashboard", self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin && "focus" in client) {
          if ("navigate" in client) client.navigate(target)
          return client.focus()
        }
      }
      return self.clients.openWindow(target)
    })
  )
})
