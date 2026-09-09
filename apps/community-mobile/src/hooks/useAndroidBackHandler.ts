/**
 * useAndroidBackHandler (issue #73a) - make the Android hardware back button / back-gesture "go back" the
 * way the in-app DetailBar back chip does, instead of always collapsing to the home menu.
 *
 * THE PROBLEM: the community app's primary surfaces are not expo-router routes - they are in-sheet details
 * and lists living in the SHARED nav store (@civfix/ui `useNavStore`), rendered by the always-mounted
 * map-home. The router sits at "/" the whole time, so the OS back press is handled by expo-router (nothing
 * to pop -> it falls through to the default, which on the map-home reads as "exit"/home) and the open
 * detail in the nav store is never popped. The DetailBar's own back chip calls `useNavStore.back()` and
 * works; the hardware back didn't go through it.
 *
 * THE FIX: register a focus-scoped `BackHandler` listener on the map-home screen that mirrors the nav
 * store's Back. We scope it with `useFocusEffect` so it is active ONLY while the index (map) screen is
 * focused - the full-screen routes (/report, /messages/[id], /host, /about, /activity, ...) keep their own
 * default router back behavior when THEY are focused. The cleanup returned from the focus effect removes
 * the listener on blur.
 *
 * Handler precedence (first match wins, consuming the event by returning true):
 *   1. The LayersPopover is open (`layersOpen`) -> dismiss it (`setLayersOpen(false)`). It is a transient
 *      map overlay outside the nav store / sheet, so back should close it first (the Android convention,
 *      and the same dismissal an empty-map tap does via onMapPress).
 *   2. A detail is open (`active !== null`) -> `back()` pops it (KEEPS the current list view, so a detail
 *      returns to the list it was opened from, or home for a map-pin detail). This is the core fix, and it
 *      covers BOTH presentations: a full-page detail and the one surviving pull-up (`drop-pin`) alike.
 *   3. Otherwise return false: let the OS default fire (at a bare tab root that means exit the app).
 *
 * THE BRANCH THAT USED TO SIT BETWEEN 2 AND 3, and why it is gone rather than fixed in place. It read
 * "no detail, but the sheet is expanded above peek (`snap > 0`) -> collapse it to peek", which was written
 * when every list view lived INSIDE the compact sheet. It stopped describing anything on screen:
 *   - a pull-up is only ever mounted FOR a detail (`portraitFramePlan`'s `sheet.visible` is
 *     `detailPresentation === "sheet"`), so reaching that branch - i.e. `active === null` - already
 *     guaranteed there was no sheet to collapse; and
 *   - since the sheet -> page conversion (`@civfix/ui` `shell/detailPresentationPlatform`) the only sheet
 *     left on mobile at all is `drop-pin`, which branch 2 consumes first anyway.
 * Meanwhile `snap` is a plain store value that outlives whatever last used it, and it defaults to 2 and
 * stays there for every non-map tab (`snapForView`: home / messaging / search / report all land on FULL).
 * So the branch fired on essentially EVERY hardware back at a bare tab, called `setSnap(0)` on nothing,
 * and returned true - swallowing the press with no visible effect whatsoever. Back now falls through to
 * the OS default there, which is what the Map tab (snap 0) already did.
 *
 * iOS has no hardware back, so the listener simply never fires there - the `useFocusEffect` pattern is
 * harmless on both platforms, so there is no Platform gate.
 */
import { useCallback } from "react"
import { BackHandler } from "react-native"
import { useFocusEffect } from "expo-router"
import { useNavStore, useReportFilterStore } from "@civfix/ui"

/**
 * Mount once in app/index.tsx (the map-home screen). Registers/removes the Android hardware-back listener
 * on focus/blur via `useFocusEffect`. Renders nothing.
 */
export function useAndroidBackHandler(): void {
  useFocusEffect(
    useCallback(() => {
      const onBackPress = (): boolean => {
        // 1) Dismiss the transient LayersPopover first (matches onMapPress + the Android overlay-first order).
        const filter = useReportFilterStore.getState()
        if (filter.layersOpen) {
          filter.setLayersOpen(false)
          return true
        }
        const nav = useNavStore.getState()
        // 2) Pop an open detail - the true "go back" (returns to its parent list, or home). Whether that
        //    detail is drawn as a full page or as the surviving `drop-pin` pull-up is not this hook's
        //    business: `back()` is the same one exit either way, and it is the one the header chip calls.
        if (nav.active !== null) {
          nav.back()
          return true
        }
        // 3) Nothing open: let the OS default fire (exit the app at a bare tab root). Deliberately NOT a
        //    `snap > 0` collapse - see the module doc for why that branch swallowed the press for nothing.
        return false
      }

      const subscription = BackHandler.addEventListener("hardwareBackPress", onBackPress)
      return () => subscription.remove()
    }, []),
  )
}
