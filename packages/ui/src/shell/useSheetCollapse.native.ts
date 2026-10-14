import { useCallback, useRef, type MutableRefObject } from "react"
import { useSharedValue, useAnimatedReaction, runOnJS, type SharedValue } from "react-native-reanimated"
import { useNavStore, type Snap } from "../nav"
import { useHaptics } from "../capabilities"
import { COLLAPSE_SWAP_AT, isPeekIndex } from "./dragCollapse"

export interface SheetCollapse {
  onChange: (index: number) => void
  onAnimate: (fromIndex: number, toIndex: number) => void
  /** The last settled snap, tracked on the JS thread so the grab-handle tap can cycle without a shared value. */
  currentIndexRef: MutableRefObject<number>
  /** What the sheet last reported, so a store-to-sheet sync only snaps for programmatic changes. */
  reportedSnapRef: MutableRefObject<number>
}

/**
 * gorhom's snap callbacks mirrored into the nav store, plus the drag-a-detail-to-peek collapse to its
 * parent view.
 */
export function useSheetCollapse(animatedIndex: SharedValue<number>): SheetCollapse {
  const setSnap = useNavStore((s) => s.setSnap)
  const collapseToParent = useNavStore((s) => s.collapseToParent)
  const haptics = useHaptics()
  const currentIndexRef = useRef(0)
  const reportedSnapRef = useRef(0)
  const collapseCommitted = useSharedValue(false)

  const onChange = useCallback(
    (index: number) => {
      if (index >= 0 && index <= 2) {
        const prevIndex = currentIndexRef.current
        currentIndexRef.current = index
        reportedSnapRef.current = index
        setSnap(index as Snap)
        if (index !== prevIndex) haptics.impactLight()
        // Settle-time backstop for the detail-to-parent collapse; the swap usually already happened mid-
        // animation (onAnimate + the reaction below). Gating on the arrival index alone matters: after an
        // interrupted pull-up then a quick pull-down, `prevIndex` is still 0. collapseToParent no-ops at home
        // and mid-flow, so the initial mount at peek is harmless.
        if (isPeekIndex(index)) collapseToParent()
      }
    },
    [setSnap, collapseToParent, haptics],
  )

  // gorhom fires this at the start of a settle, before onChange (which fires on arrival). Gate on the
  // destination only: an interrupted pull-up never settles, so the following pull-down still reports
  // `fromIndex` 0.
  const onAnimate = useCallback(
    (_fromIndex: number, toIndex: number) => {
      collapseCommitted.value = isPeekIndex(toIndex)
    },
    [collapseCommitted],
  )

  // Swapping to the origin view while the sheet is still moving hides the DetailBar-to-SearchHeader change
  // in the motion instead of popping it after the sheet settles at peek.
  useAnimatedReaction(
    () => animatedIndex.value,
    (idx) => {
      if (collapseCommitted.value && idx <= COLLAPSE_SWAP_AT) {
        collapseCommitted.value = false
        runOnJS(collapseToParent)()
      }
    },
    [collapseToParent],
  )

  return { onChange, onAnimate, currentIndexRef, reportedSnapRef }
}
