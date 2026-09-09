/**
 * useClusters - the index lifecycle for the two Map seams (UI map clustering).
 *
 * Builds the Supercluster index ONCE per point set (rebuild only when `points` changes - so the caller
 * MUST pass a memoized array, else the index thrashes every render) and exposes stable `query`/`leaves`
 * callbacks. Both Map.web.tsx and Map.native.tsx consume this so the two platforms cluster identically;
 * each seam decides how to render the resulting `ClusterNode[]` (web marker reconcile / native markers).
 */
import * as React from "react"
import type { ReportPinDTO, BBox } from "@civfix/shared"
import { buildIndex, queryClusters, leavesOfCluster, type ClusterNode } from "./clusterer"

export function useClusters(points: ReportPinDTO[]) {
  const index = React.useMemo(() => buildIndex(points), [points])
  const query = React.useCallback(
    (bbox: BBox, zoom: number): ClusterNode[] => queryClusters(index, bbox, zoom),
    [index],
  )
  const leaves = React.useCallback(
    (clusterId: number): ReportPinDTO[] => leavesOfCluster(index, clusterId),
    [index],
  )
  return { index, query, leaves }
}
