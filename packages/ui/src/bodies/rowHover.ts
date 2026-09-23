/**
 * For a row whose Pressable is only PART of it. Every row in a card should answer the pointer the same
 * way, with the row's own fill. `webHover(state)` delivers exactly that wherever the row IS a single
 * Pressable (the inbox thread row, the person and leaderboard hits, the report row). It cannot where the
 * row is a plain View holding a tap column plus a SIBLING control (the event hit, the people rows, the
 * event card), because siblings are how this package keeps a nested <button> out of the DOM on
 * react-native-web, and RNW reports `hovered` only for the element that owns the press. Hovering the
 * trailing pill, or the gutter beside it, would leave those rows flat, and hovering the copy column
 * would dim only the copy column: a third hover vocabulary in one list.
 *
 * So the CONTAINER answers, through W3C pointer events, which are the right primitive twice over:
 *   - ENTER/LEAVE-CORRECT: `pointerenter`/`pointerleave` do NOT fire as the cursor crosses between
 *     descendants (unlike `over`/`out`), so a row cannot flicker as the pointer moves from its text to its
 *     pill - the containment property the mouse-event pair is also chosen for.
 *   - TOUCH-SAFE: RNW's own `useHover` ignores `pointerType === "touch"` in three separate guards, because a
 *     tap otherwise leaves the row stuck in its hover fill until the user touches somewhere else (a
 *     touchscreen row that reads as selected when nothing is). React's mouse-compat events cannot make that
 *     distinction; `pointerType` can, so the guard is reinstated here.
 *
 * WEB ONLY BY CONSTRUCTION: off web the handlers are never attached, so `hovered` is permanently false and
 * every caller's hover style is unreachable on iOS/Android - the same native posture as `webHover`.
 */
import { useMemo, useState } from "react"
import { Platform, type PointerEvent as RNPointerEvent, type ViewProps } from "react-native"

/** Empty off web. */
export type RowHoverProps = Pick<ViewProps, "onPointerEnter" | "onPointerLeave" | "onPointerCancel">

export function useRowHover(): { hovered: boolean; hoverProps: RowHoverProps } {
  const [hovered, setHovered] = useState(false)
  const hoverProps = useMemo<RowHoverProps>(() => {
    if (Platform.OS !== "web") return {}
    return {
      onPointerEnter: (event: RNPointerEvent) => {
        // A touch "enters" the row on tap and never leaves it - see TOUCH-SAFE above.
        if (event.nativeEvent.pointerType !== "touch") setHovered(true)
      },
      onPointerLeave: () => setHovered(false),
      // A cancelled pointer (a touch turning into a scroll, a drag leaving the window) never sends `leave`.
      onPointerCancel: () => setHovered(false),
    }
  }, [])
  return { hovered, hoverProps }
}
