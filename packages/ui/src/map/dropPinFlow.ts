/**
 * Hosts must gate everything else in their long-press handler (the fly, the haptic) on
 * {@link openDropPinMenu}'s return value: it declines while a creation flow owns the stack, and a fly
 * with no pin and no menu is a camera yank out of nowhere.
 *
 * The compact sheet always settles at MID for a drop pin. Above a FULL sheet the strip of map is just the
 * top reserve (32 usable px under the notch, negative under the web app-download banner), too small for
 * the 52pt teardrop at any camera offset.
 *
 * The cleanup is a nav-store subscription, not a body-unmount effect, because StrictMode's
 * mount-unmount-remount in Next dev would clear the pin the instant the menu opened.
 */
import { useNavStore, isFlowKind, type DetailEntry } from "../nav"
import { useDroppedPin } from "./droppedPinStore"
import { useMapViewport } from "./mapViewportStore"
import {
  shouldRestoreDropPinCamera,
  type DropPinCameraSnapshot,
  type DropPinCameraTarget,
} from "./dropPinCamera"

let unsubscribeDropPin: (() => void) | null = null

// A module singleton because only the app owns a generation-guarded camera, and that is constant for the
// app's lifetime. Mobile registers its lng-first `flyTo(lng, lat, zoom)`; web registers the lat-first
// `MapHandle.flyTo`. With nothing registered the restore no-ops.
export type DropPinCameraRestorer = (target: DropPinCameraTarget) => void

let restoreCamera: DropPinCameraRestorer | null = null

export function setDropPinCameraRestorer(restore: DropPinCameraRestorer | null): void {
  restoreCamera = restore
}

/**
 * A module `let` because it has exactly the subscription's lifetime and nothing renders it; on
 * `droppedPinStore` it would churn both map seams' marker subtrees.
 */
let cameraSnapshot: DropPinCameraSnapshot | null = null

/**
 * Called after `openDropPinMenu` returned true and before the fly. "drop-pin" is not a flow kind, so a
 * second long press while the menu is open replaces the entry: `menuAlreadyOpen` keeps the first press's
 * camera and re-points `flownTo`, or the app's own second fly would read as a user pan.
 */
export function captureDropPinCamera(
  snapshot: DropPinCameraSnapshot,
  menuAlreadyOpen: boolean,
): void {
  cameraSnapshot =
    menuAlreadyOpen && cameraSnapshot
      ? { ...cameraSnapshot, flownTo: snapshot.flownTo }
      : snapshot
}

/**
 * Idempotent, so a StrictMode double-mount cannot double-clear. Pushing `create-cleanup` on top of the
 * menu keeps the drop-pin entry, so the pin stays painted under the host form.
 *
 * The restore fires on the store event rather than the sheet's `onClosed`: that callback is private to
 * the shell (which stays out of camera decisions), a missed gorhom `onClose` on native is a known failure
 * mode, and deferring the camera past the synchronous pin clear would leave a visible dead beat.
 */
export function armDropPinCleanup(): void {
  if (unsubscribeDropPin) return
  unsubscribeDropPin = useNavStore.subscribe((state, previous) => {
    if (state.stack.some((entry) => entry.kind === "drop-pin")) return
    // Decide before disarming, which drops the snapshot.
    const snapshot = cameraSnapshot
    const restore = shouldRestoreDropPinCamera(snapshot, {
      previousStack: previous.stack,
      view: state.view,
      viewport: useMapViewport.getState().viewport,
    })
    disarmDropPinCleanup()
    useDroppedPin.getState().clear()
    // After the pin clear so the marker and the camera move on the same frame.
    if (restore && snapshot) restoreCamera?.(snapshot.from)
  })
}

/**
 * Drops the camera snapshot too: one that outlived its subscription would arm the next dismissal with a
 * camera from a menu the user already left.
 */
export function disarmDropPinCleanup(): void {
  const unsubscribe = unsubscribeDropPin
  unsubscribeDropPin = null
  cameraSnapshot = null
  unsubscribe?.()
}

/**
 * The store rounds to 6 dp, so the nav entry carries the rounded point and the menu, marker and seeded
 * draft agree. Compact uses `openDetail` so pressing spot after spot builds no back-stack; expanded uses
 * `push`, matching the web home map's `selectMapDetail`.
 *
 * @returns false when the press was declined and nothing changed; the caller must then fly no camera and
 * fire no haptic.
 */
export function openDropPinMenu(rawLat: number, rawLng: number): boolean {
  const nav = useNavStore.getState()
  // Flow bodies peek the sheet to expose a long-pressable map, and `openDetail` replaces the whole stack,
  // so accepting the press would silently destroy a half-written event.
  if (nav.stack.some((entry) => isFlowKind(entry.kind))) return false

  const pinStore = useDroppedPin.getState()
  pinStore.drop(rawLat, rawLng)
  const pin = useDroppedPin.getState().pin
  const entry: DetailEntry = {
    kind: "drop-pin",
    lat: pin ? pin.lat : rawLat,
    lng: pin ? pin.lng : rawLng,
  }

  if (nav.mode === "expanded") {
    nav.push(entry)
  } else {
    // Before `openDetail` so the menu never paints at FULL for a frame on its way down.
    if (nav.snap !== 1) nav.setSnap(1)
    nav.openDetail(entry)
  }

  // Also armed in DropPinBody's mount effect; arming here covers a route race where the body never mounts.
  armDropPinCleanup()
  return true
}
