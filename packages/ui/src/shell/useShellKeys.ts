/**
 * The expanded shell's keyboard listener: `/` focuses Search, Escape pops the stacked surface (§3.5/§4.4).
 *
 * ONE listener, mounted by `ExpandedShell` alone - so the shortcuts exist exactly where the design says
 * they do (web + landscape) with no layout test of its own, and vanish on rotation with the shell that
 * owns them. Every DECISION lives in the pure `shellKeyModel`; this file is the plumbing around it.
 *
 * CAPTURE PHASE, deliberately. react-native-web's TextInput calls `stopPropagation()` on EVERY keydown it
 * sees (its own #612 fix), so a bubble-phase listener on `document` would never learn that a keystroke
 * happened inside a field - it would simply not fire, which looks identical to the guard working right up
 * until some other field forwards its keys. Listening in capture means this handler always runs first and
 * the guard (`isEditableTarget`) is what decides, every time, in the tested place.
 *
 * WHICH IS ALSO WHY IT DOES NOT SWALLOW THE FIELD'S OWN ESCAPE: with a field focused the model answers
 * "none", so nothing is prevented and the event carries on to the search field's `onKeyPress`, which owns
 * clear-then-blur. The two halves of the ladder never fire on the same keystroke. The ONE exception is
 * `blur-field` - a surface that auto-focused a field it answers no Escape for (the composer), where the
 * model hands this listener the first rung because there is no field-side owner to hand it to.
 *
 * NOT a `.web` seam (the `webMedia` / `occlusionVar` posture): plain guarded functions, no web-only
 * imports, so the module bundles anywhere and is inert on native - there is no `document` there, and a
 * tablet has no `/` key to press at the shell.
 */
import { useEffect } from "react"
import { Platform } from "react-native"
import { useNavStore } from "../nav"
import { useSearchBarStore } from "./searchBarStore"
import { isEditableTarget, shellKeyAction } from "./shellKeyModel"

/**
 * The marker every modal surface in this app already carries - the web host's auth dialog, the media
 * lightbox, the web action menu. One query is how the shell learns that something above it owns Escape,
 * without either store reaching across the package boundary or a registry to keep in sync.
 */
const MODAL_SELECTOR = '[aria-modal="true"]'

export function useShellKeys(): void {
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return

    const onKeyDown = (event: KeyboardEvent) => {
      const nav = useNavStore.getState()
      const action = shellKeyAction({
        key: event.key,
        // Both probes: `target` is the element the keystroke was dispatched at, `activeElement` is where
        // the caret actually is. They agree in every ordinary case; asking for both means a retargeted
        // event (a shadow root, a synthetic dispatch) still cannot slip past the guard.
        editable:
          isEditableTarget(event.target as Element | null) || isEditableTarget(document.activeElement),
        view: nav.view,
        stackLength: nav.stack.length,
        chord: event.ctrlKey || event.metaKey || event.altKey,
        composing: event.isComposing,
        modalOpen: document.querySelector(MODAL_SELECTOR) !== null,
        activeKind: nav.active?.kind ?? null,
      })
      if (action === "none") return
      // Only ONCE the action is ours: `/` must not be eaten when it is a character, and Escape must stay
      // available to whatever else is listening when the shell has nothing to pop.
      event.preventDefault()
      if (action === "back") {
        nav.back()
        return
      }
      // The composer's first Escape: give up its auto-focused textarea so the SECOND one arrives with
      // nothing focused and reaches the `back` rung above. Nothing navigates here - see shellKeyModel.
      if (action === "blur-field") {
        const focused = document.activeElement as { blur?: () => void } | null
        focused?.blur?.()
        return
      }
      // "open-search" navigates first; "focus-search" is already there and must NOT call selectView (the
      // re-tap rule would deselect Search back to home). Both then arm the field's one-shot focus signal.
      if (action === "open-search") nav.selectView("search")
      useSearchBarStore.getState().requestSearchFocus()
    }

    document.addEventListener("keydown", onKeyDown, true)
    return () => document.removeEventListener("keydown", onKeyDown, true)
  }, [])
}
