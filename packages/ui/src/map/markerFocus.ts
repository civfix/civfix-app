import type { ClusterNode } from "./clusterer"

export function markerNodeIsActive(
  node: ClusterNode,
  focusedPinId: string | null,
  focusedCleanupId: string | null,
): boolean {
  if (node.type === "cluster") return false
  if (node.type === "report") return focusedPinId !== null && focusedPinId === node.id
  return focusedCleanupId !== null && focusedCleanupId === node.id
}
