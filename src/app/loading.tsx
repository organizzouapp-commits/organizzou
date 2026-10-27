import { LoadingScreen } from "@/components/organizzou/loading-screen"

// Root loading boundary: shows only if a route takes longer than ~300 ms (CSS delay, no timers).
export default function Loading() {
  return <LoadingScreen delayed />
}
