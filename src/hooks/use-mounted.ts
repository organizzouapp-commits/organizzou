import * as React from "react"

const subscribe = () => () => {}

/** False during server render and hydration, true afterwards. Use it for values only the browser knows. */
export function useMounted() {
  return React.useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  )
}
