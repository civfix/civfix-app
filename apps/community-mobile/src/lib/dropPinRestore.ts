/**
 * The two pure bits of the map home's drop-pin CAMERA RESTORE (app/index.tsx), kept out of the screen so
 * they are unit-testable with `node --test` - which cannot load a screen that imports expo-router and
 * react-native.
 *
 * Both exist because they are silently-wrong-able. There is no error, no crash and no log when either is
 * inverted; the app just flies somewhere plausible and slightly wrong, or forgets where the user was.
 */
import type { DropPinCameraTarget } from "@civfix/ui"

/**
 * Transpose a shared `{lat, lng, zoom}` camera into the argument order THIS SCREEN'S generation-guarded
 * `flyTo` takes, which is `(lng, lat, zoom?, requestGeneration?)` (app/index.tsx:267-279).
 *
 * THE TRAP: `MapHandle.flyTo` is `(lat, lng, zoom?)` (@civfix/ui map/types.ts:140) - the MIRROR order -
 * and app/index.tsx:243 calls that one inside `replayPendingMapTarget`, 24 lines above the declaration of
 * the one this feeds. Copying the wrong call site flies to the transposed coordinate with no error
 * whatsoever.
 */
export function dropPinRestoreFlyArgs(
  target: DropPinCameraTarget,
): [lng: number, lat: number, zoom: number] {
  return [target.lng, target.lat, target.zoom]
}

/**
 * Is a drop-pin pull-up ALREADY on the nav stack?
 *
 * The host must read this BEFORE calling `openDropPinMenu`, which always leaves one there. "drop-pin" is
 * not a FLOW_KIND, so a SECOND long press while the menu is open is accepted and `openDetail` simply
 * REPLACES the entry - re-running the whole handler. `captureDropPinCamera` uses this flag to KEEP the
 * first press's pre-press camera (still where the user was) while re-pointing the pan check at the new fly.
 *
 * Whole stack, not just the top: expanded APPENDS the entry, and a host form can be drilled in above it.
 */
export function dropPinMenuAlreadyOpen(stack: readonly { kind: string }[]): boolean {
  return stack.some((entry) => entry.kind === "drop-pin")
}
