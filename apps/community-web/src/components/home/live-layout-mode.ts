import { layoutModeFor } from "@civfix/ui"

/** Read at call time so the mount seed matches the surface the store and shell will render. */
export function liveMode(): "compact" | "expanded" {
  if (typeof window === "undefined") return "compact"
  return layoutModeFor(window.innerWidth, window.innerHeight)
}
