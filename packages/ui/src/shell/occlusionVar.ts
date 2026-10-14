/**
 * Publishes the frame plan's `occlusionLeft` as `--cf-occlusion-left`, which `globals.css` reads to keep
 * maplibre's attribution (outside the RN tree) clear of the landscape card, including when the card is
 * dismissed on the Map tab.
 *
 * Written, not rendered: the resize drag moves an `Animated.Value` without re-rendering the shell, so this
 * is called from the pan handler once per frame and the attribution follows the card edge live. The host
 * element is cached and revalidated via `isConnected` so a drag does not run `querySelector` every frame.
 *
 * Not a `.web` seam: plain guarded functions, a no-op on native where there is no `document`.
 */

const VAR = "--cf-occlusion-left"
const HOST_SELECTOR = ".cf-shell"

let cached: HTMLElement | null = null

/** Falls back to `<html>`: custom properties inherit, so it still reaches the maplibre nodes. */
function hostElement(): HTMLElement | null {
  if (typeof document === "undefined") return null
  if (cached?.isConnected) return cached
  cached = (document.querySelector(HOST_SELECTOR) as HTMLElement | null) ?? document.documentElement
  return cached
}

export function writeOcclusionLeft(px: number): void {
  hostElement()?.style.setProperty(VAR, `${Math.round(px)}px`)
}

/** So the CSS falls back to its own default rather than a stale desktop measurement. */
export function clearOcclusionLeft(): void {
  hostElement()?.style.removeProperty(VAR)
  cached = null
}
