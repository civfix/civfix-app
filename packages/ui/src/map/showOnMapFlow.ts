import type { LayoutMode } from "../theme"
import { useNavStore } from "../nav"
import { useMapFocus, type FocusedEntity } from "./mapFocusStore"
import { useMapFlyTo } from "./mapFlyToStore"

let unsubscribeMapLeave: (() => void) | null = null

function armMapLeaveRelease(): void {
  if (unsubscribeMapLeave) return
  unsubscribeMapLeave = useNavStore.subscribe((state) => {
    if (state.view === "map") return
    disarmMapLeaveRelease()
    useMapFlyTo.getState().clear()
  })
}

export function disarmMapLeaveRelease(): void {
  const unsubscribe = unsubscribeMapLeave
  unsubscribeMapLeave = null
  unsubscribe?.()
}

export function showOnMap(mode: LayoutMode, target: FocusedEntity): void {
  if (mode === "expanded") {
    const focus = useMapFocus.getState()
    if (target.kind === "report") {
      focus.setReport({ id: target.id, lat: target.lat, lng: target.lng, category: target.category })
    } else {
      focus.setEvent({ id: target.id, lat: target.lat, lng: target.lng, eventKind: target.eventKind })
    }
    useNavStore.getState().setSnap(1)
    return
  }
  useMapFlyTo.getState().requestFlyTo(target)
  useNavStore.getState().selectView("map")
  armMapLeaveRelease()
}
