// Kept out of app/index.tsx so `node --test` can reach them. Either one inverted fails silently: the map
// flies somewhere plausible and slightly wrong, or forgets where the user was.
import type { DropPinCameraTarget } from "@civfix/ui"

/**
 * The map home's generation-guarded `flyTo` takes `(lng, lat, zoom?)`, while `MapHandle.flyTo`, which the
 * same screen calls in `replayPendingMapTarget`, takes `(lat, lng, zoom?)`. Copying the wrong call site
 * flies to the transposed coordinate with no error.
 */
export function dropPinRestoreFlyArgs(
  target: DropPinCameraTarget,
): [lng: number, lat: number, zoom: number] {
  return [target.lng, target.lat, target.zoom]
}

/**
 * Read BEFORE `openDropPinMenu`, which always leaves an entry. "drop-pin" is not a FLOW_KIND, so a second
 * long press replaces the entry and re-runs the handler; this flag lets `captureDropPinCamera` keep the
 * first press's camera. The whole stack is searched because a host form can be drilled in above it.
 */
export function dropPinMenuAlreadyOpen(stack: readonly { kind: string }[]): boolean {
  return stack.some((entry) => entry.kind === "drop-pin")
}
