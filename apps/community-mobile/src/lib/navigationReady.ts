export interface NavigationReadiness {
  isReady: () => boolean
  addListener: (event: "ready", callback: () => void) => () => void
}

/**
 * When Back finishes the Android activity, the JS runtime survives and the next link remounts the
 * whole tree: the screen it targets mounts in the same commit as the root navigator, and its mount
 * effect runs before that navigator registers with the container. The container emits `ready` once
 * it has, at the end of that commit.
 */
export function whenNavigationReady(container: NavigationReadiness, run: () => void): () => void {
  if (container.isReady()) {
    run()
    return () => undefined
  }
  const unsubscribe = container.addListener("ready", () => {
    unsubscribe()
    run()
  })
  return unsubscribe
}
