import * as React from "react"
import type { BBox } from "@civfix/shared"
import { buildIndex, queryClusters, type ClusterNode, type MapPoint } from "./clusterer"

export function useClusters(points: MapPoint[]) {
  const index = React.useMemo(() => buildIndex(points), [points])
  const query = React.useCallback(
    (bbox: BBox, zoom: number): ClusterNode[] => queryClusters(index, bbox, zoom),
    [index],
  )
  return { index, query }
}
