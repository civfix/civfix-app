/**
 * The map long-press "drop a pin" FLOW (Area 3, step A3.4): the two impure entry points that sit between
 * the pure drop-pin modules (`./droppedPinStore`, `./dropPinCamera`, `./longPressGate`) and the nav store.
 *
 * Both hosts (civfix-mobile `app/index.tsx`, civfix-web `features/map/home-map.tsx`) call
 * {@link openDropPinMenu} from their `onLongPressMap` handler; `bodies/DropPinBody` calls
 * {@link armDropPinCleanup} on mount.
 *
 * THE HOSTS MUST GATE EVERYTHING ELSE IN THE HANDLER ON {@link openDropPinMenu}'s RETURN VALUE. It DECLINES
 * (returns false, changing nothing) while a creation flow owns the stack - and both hosts used to call it
 * for effect and then fly their drop-pin camera unconditionally, so a declined long press still zoomed to
 * z17 and offset the centre for a pin and a menu that were never there: a camera yank out of nowhere, on a
 * map the user had deliberately exposed to pick a location. The mobile host also fired a medium haptic for
 * the same non-event. Gate the fly (and the haptic) on `if (!openDropPinMenu(lat, lng)) return`.
 *
 * THE COMPACT SHEET ALWAYS SETTLES AT MID FOR A DROP PIN, AND THAT IS A GEOMETRY REQUIREMENT, NOT A TASTE
 * CALL. `openDetail`'s `openIfPeeked` bumps a PEEKED sheet to mid but KEEPS a FULL one, so a long press in
 * the sliver of map above an already-full sheet used to open the menu at FULL. `sheetSnapPoints` clamps its
 * `full` anchor to `windowHeight - topReserve`, so the strip of map left above a FULL sheet is EXACTLY the
 * top reserve - `insets.top + 32` on native, which is 91px on an iPhone 16 of which the first 59 are the
 * Dynamic Island: 32 usable px, on every notched phone, whatever its size. `DropPin` is a 52pt teardrop
 * anchored at its BOTTOM, so no camera offset can fit it in that strip; the best `dropPinCamera` could do
 * was centre the anchor point and let two thirds of the art sit under the status bar. On mobile web with the
 * app-download banner showing it is worse than useless - reserve 32 against a measured banner of 64-80, so
 * the strip is NEGATIVE and the pin cannot be seen at any offset.
 *
 * So the fix is not in the camera: at FULL there is no viewable answer, and the sheet has to come down. MID
 * leaves 328 usable px on that same iPhone 16, which is the strip `dropPinCamera` centres in. It also costs
 * the user nothing they asked for - they long-pressed the MAP, which is a map-intent gesture, and
 * `DropPinBody` is a two-action menu (report here / host here) plus Cancel that never wanted FULL.
 * `setSnap` runs BEFORE `openDetail` so the final state is reached in one update and the new menu never
 * paints at FULL for a frame on its way down.
 *
 * WHY THE CLEANUP IS A NAV SUBSCRIPTION AND NOT A BODY-UNMOUNT EFFECT: under React StrictMode (which the
 * web host runs in Next dev) every effect is mounted, torn down and re-mounted. An unmount cleanup that
 * cleared the dropped pin would therefore wipe the pin the instant the menu opened. The store
 * subscription below is armed idempotently and fires exactly once - when the "drop-pin" entry actually
 * leaves the nav stack - so a double-mount is harmless.
 */
import { useNavStore, isFlowKind, type DetailEntry } from "../nav"
import { useDroppedPin } from "./droppedPinStore"
import { useMapViewport } from "./mapViewportStore"
import {
  shouldRestoreDropPinCamera,
  type DropPinCameraSnapshot,
  type DropPinCameraTarget,
} from "./dropPinCamera"

/** Live nav subscription while a drop-pin menu is on the stack; null when disarmed. */
let unsubscribeDropPin: (() => void) | null = null

// ----- THE HOST CAMERA SEAM -----
//
// A module singleton, not a prop and not a hook - the same shape mobile registers its capture surface with
// (`setCameraNavigator`, civfix-mobile/apps/community-mobile/src/lib/nativeCamera.ts:40) and the same
// shape the composer's event-form presenter uses (bodies/composerCreateFlow.ts:186). The reason is
// identical: this module is reached from FOUR dismissal routes and two hosts, only the APP owns a
// generation-guarded camera, and that fact is constant for the whole app lifetime rather than per-render.
//
// THE SHARED PACKAGE MUST NOT TOUCH THE CAMERA (dropPinCamera.ts:64-68). It hands the host a CENTRE and
// the host flies it through its own guarded path - which for civfix-mobile means its screen-local
// `flyTo(lng, lat, zoom)` (app/index.tsx:267-279 - LNG FIRST), NOT `MapHandle.flyTo(lat, lng, zoom)`
// (map/types.ts:140 - LAT first), while civfix-web's home map registers `MapHandle.flyTo`. With nobody
// registered (no home map mounted) the restore simply no-ops.

/** How the host flies its own generation-guarded camera back to a centre. */
export type DropPinCameraRestorer = (target: DropPinCameraTarget) => void

let restoreCamera: DropPinCameraRestorer | null = null

/** Register (or, with `null`, unregister) the host's camera. Call once from the screen that owns the map. */
export function setDropPinCameraRestorer(restore: DropPinCameraRestorer | null): void {
  restoreCamera = restore
}

/**
 * The camera armed for the CURRENT drop-pin menu, or null when none is armed.
 *
 * It lives here, as a module `let`, rather than in `droppedPinStore` or a store of its own, because it has
 * EXACTLY the subscription's lifetime - armed by the same long press, consumed by the same fire, dropped
 * by `disarmDropPinCleanup` - so any other home would be a second lifetime to keep in sync. It is also not
 * a rendering value: nothing subscribes to it. (Putting it on `droppedPinStore` would additionally churn
 * both map seams' marker subtrees on a value neither seam draws - see that module's header.)
 */
let cameraSnapshot: DropPinCameraSnapshot | null = null

/**
 * Arm the pre-press camera for a drop-pin long press. The HOST calls this from `onLongPressMap`, AFTER
 * `openDropPinMenu` returned true (so `flownTo` is the target for the detent the sheet ACTUALLY settled
 * at) and BEFORE it flies.
 *
 * `menuAlreadyOpen` is the host's read of "was a drop-pin entry already on the stack", taken BEFORE
 * `openDropPinMenu` - afterwards there always is one. It matters because "drop-pin" is NOT a FLOW_KIND, so
 * a SECOND long press while the menu is open is accepted and `openDetail` simply REPLACES the entry,
 * re-running the whole handler. When that happens the pre-press camera must be KEPT (the first press is
 * still where the user was) while `flownTo` is RE-POINTED at the new fly - otherwise the pan check would
 * compare the live viewport against a camera the app has already flown away from and read its own second
 * fly as a user pan.
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
 * Arm the ONE nav-store subscription that clears the dropped pin - and, when the pull-up was genuinely
 * DISMISSED rather than acted on, restores the camera - as the drop-pin menu leaves the stack (Cancel, the
 * back chip, a sheet collapse to peek, a map tap, Android hardware back, or "Report an issue here"
 * selecting the report view). Idempotent: re-arming while already armed is a no-op, so a StrictMode
 * double-mount cannot double-clear.
 *
 * Pushing `create-cleanup` on TOP of the menu leaves the drop-pin entry on the stack, so the coral pin
 * stays painted under the host form - which is the point of the drill-down verb in DropPinBody.onHost.
 *
 * WHY THE RESTORE FIRES ON THE STORE EVENT AND NOT ON THE SHEET'S `onClosed`. Three reasons, in order:
 *   1. `onClosed` is not reachable from here. It is a local closure inside the shell's presence gate
 *      (shell/PortraitShell.shared.tsx:149-152, handed down to CompactShell at :237) and is never
 *      published outward; wiring it would thread a camera concern through AppShell -> PortraitShellFrame
 *      -> CompactShell, against the standing contract that the shell does not participate in camera
 *      decisions.
 *   2. On native it is not even guaranteed - `theme.motion.sheetTeardownGuardMs` (300ms) exists precisely
 *      as a safety net for a MISSED gorhom `onClose` (PortraitShell.shared.tsx:134-148). A restore hung
 *      off it inherits that failure mode; this one cannot.
 *   3. The marker is cleared synchronously HERE. Deferring the camera by theme.motion.sheetDismiss (180ms)
 *      would leave the map parked on a drop-pin camera with no drop pin on it - a visible dead beat. On the
 *      same notification, the marker leaving and the camera moving are one gesture, and maplibre's own
 *      eased fly overlaps the card's slide rather than following it.
 */
export function armDropPinCleanup(): void {
  if (unsubscribeDropPin) return
  unsubscribeDropPin = useNavStore.subscribe((state, previous) => {
    if (state.stack.some((entry) => entry.kind === "drop-pin")) return
    // Decide BEFORE disarming: `disarmDropPinCleanup` drops the snapshot along with the subscription.
    const snapshot = cameraSnapshot
    const restore = shouldRestoreDropPinCamera(snapshot, {
      // zustand hands the PREVIOUS state to every listener, which is the only thing that separates a real
      // dismissal ([.., drop-pin] going away) from the [drop-pin, cleanup] publish trap, where the pin
      // entry is buried under the detail actually being dismissed.
      previousStack: previous.stack,
      view: state.view,
      viewport: useMapViewport.getState().viewport,
    })
    disarmDropPinCleanup()
    useDroppedPin.getState().clear()
    // THE HOST OWNS THE CAMERA (dropPinCamera.ts:64-68): never maplibre from here, only the callback the
    // host registered, which routes through ITS generation-guarded flyTo. Ordered after the pin clear so
    // the marker and the camera move on the same frame. No restorer registered simply no-ops - the pin
    // still clears.
    if (restore && snapshot) restoreCamera?.(snapshot.from)
  })
}

/**
 * Tear the subscription down without touching the pin (also used internally once it has fired), and DROP
 * the armed camera snapshot with it - the two have one lifetime, and a snapshot that outlived its
 * subscription would arm the NEXT dismissal with a camera from a menu the user already left.
 */
export function disarmDropPinCleanup(): void {
  const unsubscribe = unsubscribeDropPin
  unsubscribeDropPin = null
  cameraSnapshot = null
  unsubscribe?.()
}

/**
 * Drop the transient pin at a long-pressed coordinate and open the pull-up create menu.
 *
 * The store rounds the coordinate (6 dp), so the nav entry carries the ROUNDED point - the menu, the
 * marker and the seeded report/event draft therefore all agree on one number.
 *
 * Verb: `openDetail` on compact (lateral map browsing - Back closes the sheet, and pressing spot after
 * spot must not accumulate a back-stack) and `push` on expanded, matching the web home map's
 * `selectMapDetail`.
 *
 * Detent: MID on compact, always - a FULL sheet leaves 32 usable px of map on any notched phone and the pin
 * is a 52pt teardrop, so FULL is not a detent a dropped pin can be SEEN at. See the module header. Expanded
 * has no sheet, so its detent is left exactly as it was.
 *
 * @returns true if the pin was dropped and the menu opened, false if the press was DECLINED and nothing at
 * all changed. The caller must fly no camera and fire no haptic on false - see the module header.
 */
export function openDropPinMenu(rawLat: number, rawLng: number): boolean {
  const nav = useNavStore.getState()
  // Never abandon an in-progress flow: those bodies deliberately collapse the sheet to peek to expose a
  // live, long-pressable map (the host form's meet-location step is exactly that), and `openDetail`
  // REPLACES the whole stack - so a long press on the exposed map would pop `create-cleanup`, trip
  // `isGenuineHostExit`, and `useCleanupDraft.clear()` would silently destroy a half-written event with
  // no confirmation. The kind list is shared (nav/flowKinds) with the store's collapse guard.
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
    // Settle at MID first (see the header): `openIfPeeked` inside `openDetail` then keeps the 1 it finds, so
    // the stack and the detent land together. Skipped when already at MID so the common press does not fire
    // a second store notification for a value that is not changing.
    if (nav.snap !== 1) nav.setSnap(1)
    nav.openDetail(entry)
  }

  // Arm here as well as in DropPinBody's mount effect: on a host where the body never mounts (an
  // unexpected route race), the pin would otherwise stay painted forever. Idempotent.
  armDropPinCleanup()
  return true
}
