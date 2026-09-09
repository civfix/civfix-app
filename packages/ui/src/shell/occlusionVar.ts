/**
 * `--cf-occlusion-left`: the frame plan's `occlusionLeft` published to CSS.
 *
 * The web host paints two things the RN tree cannot reach - maplibre's own attribution and zoom controls -
 * and the bottom-left attribution has to sit clear of the landscape card. That rule used to hardcode
 * `calc(384px + 28px)`, which was stale the moment the default card width moved and had no idea the card
 * can now be DISMISSED entirely (the Map tab). So the shell publishes the one number the frame plan
 * computes, and `globals.css` reads it: `left: calc(var(--cf-occlusion-left, 530px) + 14px)`.
 *
 * WRITTEN, NOT RENDERED, and that is the point: the resize drag moves an `Animated.Value` without
 * re-rendering the shell, so this is called straight from the pan handler (one `setProperty` per frame)
 * and the attribution follows the card's edge LIVE instead of teleporting on release.
 *
 * TARGET: the `.cf-shell` element the web host wraps the app in, falling back to `<html>` (custom
 * properties inherit, so the fallback still reaches the maplibre nodes - it only widens the scope). The
 * element is cached across frames and revalidated cheaply via `isConnected`, so a drag does not run a
 * `querySelector` 60 times a second.
 *
 * NOT a `.web` seam: like `webMedia`, these are plain guarded functions with no web-only imports, so the
 * module is safe to bundle anywhere. On native there is no `document` and every call is a no-op.
 */

const VAR = "--cf-occlusion-left"
const HOST_SELECTOR = ".cf-shell"

let cached: HTMLElement | null = null

/** The element the property is written on: the host's shell wrapper, else the document root. */
function hostElement(): HTMLElement | null {
  if (typeof document === "undefined") return null
  if (cached?.isConnected) return cached
  cached = (document.querySelector(HOST_SELECTOR) as HTMLElement | null) ?? document.documentElement
  return cached
}

/** Publish the occluded strip (px from the viewport's left edge). No-op on native / during SSR. */
export function writeOcclusionLeft(px: number): void {
  hostElement()?.style.setProperty(VAR, `${Math.round(px)}px`)
}

/**
 * Drop the property (the expanded shell unmounting - a rotation to portrait, or a route leaving the shell)
 * so the CSS falls back to its own default rather than to a stale desktop measurement.
 */
export function clearOcclusionLeft(): void {
  hostElement()?.style.removeProperty(VAR)
  cached = null
}
