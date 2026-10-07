/**
 * The expanded shell's keyboard listener; every decision lives in the pure `shellKeyModel`. Mounted by
 * ExpandedShell alone, so the shortcuts vanish on rotation with the shell that owns them.
 *
 * Capture phase, deliberately: react-native-web's TextInput calls `stopPropagation()` on every keydown,
 * so a bubble-phase listener would never learn a keystroke happened inside a field, and the guard
 * (`isEditableTarget`) would not be the thing deciding. With a field focused the model answers "none", so
 * the field's own Escape is never swallowed; the one exception is `blur-field`.
 *
 * Not a `.web` seam: no web-only imports, so it bundles anywhere and is inert on native.
 */
import { useEffect } from "react"
import { Platform } from "react-native"
import { useNavStore } from "../nav"
import { useSearchBarStore } from "./searchBarStore"
import { isEditableTarget, shellKeyAction } from "./shellKeyModel"

/**
 * Every modal surface (the auth dialog, the media lightbox, the web action menu) already carries this, so
 * one query tells the shell something above it owns Escape without a cross-package registry.
 */
const MODAL_SELECTOR = '[aria-modal="true"]'

export function useShellKeys(): void {
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return

    const onKeyDown = (event: KeyboardEvent) => {
      const nav = useNavStore.getState()
      const action = shellKeyAction({
        key: event.key,
        // Both probes, so a retargeted event (a shadow root, a synthetic dispatch) cannot slip past.
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
      // Only once the action is ours: `/` must not be eaten when it is a character.
      event.preventDefault()
      if (action === "back") {
        nav.back()
        return
      }
      if (action === "blur-field") {
        const focused = document.activeElement as { blur?: () => void } | null
        focused?.blur?.()
        return
      }
      // "focus-search" must not call selectView: the re-tap rule would deselect Search back to home.
      if (action === "open-search") nav.selectView("search")
      useSearchBarStore.getState().requestSearchFocus()
    }

    document.addEventListener("keydown", onKeyDown, true)
    return () => document.removeEventListener("keydown", onKeyDown, true)
  }, [])
}
