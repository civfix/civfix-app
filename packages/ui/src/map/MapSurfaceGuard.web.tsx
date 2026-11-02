import * as React from "react"

let unsupportedReported = false

/** maplibre-gl 6 renders only through WebGL2 and exposes no support check of its own, so probe a canvas. */
function supportsWebGL2(): boolean {
  if (typeof document === "undefined") return false
  const gl = document.createElement("canvas").getContext("webgl2")
  if (!gl) return false
  // Browsers cap live WebGL contexts per page and evict the oldest, so the probe must not keep one alive
  // next to the real maps.
  gl.getExtension("WEBGL_lose_context")?.loseContext()
  return true
}

interface MapErrorBoundaryProps {
  fallback: React.ReactNode
  children: React.ReactNode
}

interface MapErrorBoundaryState {
  failed: boolean
}

// The host root's onCaughtError (React's default, or Next's) already logs a caught error once, so this
// boundary only swaps in the fallback; logging here as well would print it twice.
class MapErrorBoundary extends React.Component<MapErrorBoundaryProps, MapErrorBoundaryState> {
  override state: MapErrorBoundaryState = { failed: false }

  static getDerivedStateFromError(): MapErrorBoundaryState {
    return { failed: true }
  }

  override render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

interface MapSurfaceGuardProps {
  fallback: React.ReactNode
  children: React.ReactNode
}

/**
 * Keeps a map surface's failure inside the map's own space. Without WebGL2 the map is never constructed;
 * anything the map subtree still throws while constructing or rendering lands on the same fallback instead
 * of unmounting the whole app.
 */
export function MapSurfaceGuard({ fallback, children }: MapSurfaceGuardProps) {
  const [supported] = React.useState(supportsWebGL2)

  React.useEffect(() => {
    if (supported || unsupportedReported) return
    unsupportedReported = true
    console.warn("[map] WebGL2 is unavailable in this browser; showing the map fallback")
  }, [supported])

  if (!supported) return fallback
  return <MapErrorBoundary fallback={fallback}>{children}</MapErrorBoundary>
}
