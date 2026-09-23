import type { ClusterNode } from "./clusterer"
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
