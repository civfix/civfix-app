import type { EventKind } from "@civfix/shared"
import type { ClusterNode } from "./clusterer"
import type { FocusedEntity } from "./mapFocusStore"
import type { MapFlyToHighlight } from "./mapFlyToStore"

export function markerNodeIsActive(
  node: ClusterNode,
  focusedPinId: string | null,
  focusedCleanupId: string | null,
): boolean {
  if (node.type === "cluster") return false
  if (node.type === "report") return focusedPinId !== null && focusedPinId === node.id
  return focusedCleanupId !== null && focusedCleanupId === node.id
}

export function activeMarkerIds(
  focusedPinId: string | null,
  focusedCleanupId: string | null,
  highlight: MapFlyToHighlight | null,
): { pinId: string | null; cleanupId: string | null } {
  return {
    pinId: focusedPinId ?? (highlight?.kind === "report" ? highlight.id : null),
    cleanupId: focusedCleanupId ?? (highlight?.kind === "cleanup" ? highlight.id : null),
  }
}

export function flyToTargetOffMap(
  nodes: readonly ClusterNode[],
  highlight: MapFlyToHighlight | null,
): MapFlyToHighlight | null {
  if (!highlight) return null
  const pinId = highlight.kind === "report" ? highlight.id : null
  const cleanupId = highlight.kind === "cleanup" ? highlight.id : null
  return nodes.some((node) => markerNodeIsActive(node, pinId, cleanupId)) ? null : highlight
}

export type MarkerLabelT = (key: string, options?: Record<string, unknown>) => string

function reportMarkerLabel(category: string, title: string | null | undefined, t: MarkerLabelT): string {
  const categoryLabel = t(`enums:category.${category}`)
  const named = title?.trim()
  return named
    ? t("a11y.reportPin", { category: categoryLabel, title: named })
    : t("a11y.reportPinUntitled", { category: categoryLabel })
}

function eventMarkerLabel(eventKind: EventKind, title: string | null | undefined, t: MarkerLabelT): string {
  const kindLabel = t(`enums:eventKind.${eventKind}`)
  const named = title?.trim()
  return named
    ? t("a11y.eventPin", { kind: kindLabel, title: named })
    : t("a11y.eventPinUntitled", { kind: kindLabel })
}

/** The screen-reader name of one map marker; `t` is the `map-ui` translator. */
export function markerA11yLabel(node: ClusterNode, t: MarkerLabelT): string {
  if (node.type === "cluster") return t("a11y.cluster", { count: node.count })
  if (node.type === "report") return reportMarkerLabel(node.pin.category, node.pin.title, t)
  const event = eventMarkerLabel(node.event.eventKind, node.event.title, t)
  if (node.type === "event") return event
  return t("a11y.blendPin", { event, count: node.reports.length })
}

/** The name of the standalone focus / fly-to marker, which carries no title. */
export function targetMarkerA11yLabel(target: FocusedEntity, t: MarkerLabelT): string {
  return target.kind === "cleanup"
    ? eventMarkerLabel(target.eventKind, null, t)
    : reportMarkerLabel(target.category, null, t)
}

/** A native marker press hands back only this id, so it carries the node kind the handler strips off. */
export function nativeMarkerId(node: ClusterNode): string {
  switch (node.type) {
    case "cluster":
      return node.key
    case "report":
      return `pin-${node.id}`
    case "event":
      return `cleanup-${node.id}`
    case "blend":
      return `blend-${node.id}`
  }
}

/** The only part of maplibre's MarkerEvent the map's press handlers read. */
export interface MarkerPressEvent {
  nativeEvent: { id: string }
}

const MARKER_A11Y_ACTIONS = [{ name: "activate" }] as const

/**
 * A native marker's pin is wrapped in an accessible view, which becomes the screen reader's focus target
 * instead of maplibre's native marker; without an explicit activate action a VoiceOver or TalkBack
 * double-tap on it never reaches the marker's onPress.
 */
export function markerButtonA11y(
  label: string,
  markerId: string,
  onPress: (event: MarkerPressEvent) => void,
) {
  return {
    accessible: true,
    accessibilityRole: "button" as const,
    accessibilityLabel: label,
    accessibilityActions: MARKER_A11Y_ACTIONS,
    onAccessibilityAction: (event: { nativeEvent: { actionName: string } }) => {
      if (event.nativeEvent.actionName === "activate") onPress({ nativeEvent: { id: markerId } })
    },
  }
}
