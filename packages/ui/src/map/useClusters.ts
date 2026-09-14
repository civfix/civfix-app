import * as React from "react"
import type { BBox } from "@civfix/shared"
import {
  buildIndex,
  expansionZoomOfCluster,
  leavesOfCluster,
  queryClusters,
  type ClusterNode,
  type MapPoint,
} from "./clusterer"

export function useClusters(points: MapPoint[]) {
  const index = React.useMemo(() => buildIndex(points), [points])
  const query = React.useCallback(
    (bbox: BBox, zoom: number): ClusterNode[] => queryClusters(index, bbox, zoom),
    [index],
  )
  const leaves = React.useCallback(
    (clusterId: number): MapPoint[] => leavesOfCluster(index, clusterId),
    [index],
  )
  const expansionZoom = React.useCallback(
    (clusterId: number): number | null => expansionZoomOfCluster(index, clusterId),
    [index],
  )
  return { index, query, leaves, expansionZoom }
}
