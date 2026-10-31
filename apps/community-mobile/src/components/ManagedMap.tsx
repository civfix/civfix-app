import React, { useCallback, useState } from "react"
import type { BBox } from "@civfix/contract"
import { Map as SharedMap, type MapHandle, type MapProps } from "@civfix/ui"

let lastMapMountGeneration = 0

// Each mounted map claims the next number once; a remount is a new instance with a new number.
function claimMapMountGeneration(): number {
  lastMapMountGeneration += 1
  return lastMapMountGeneration
}

export type ManagedMapProps = Omit<MapProps, "onRegionChange"> & {
  onMapHandle: (generation: number, map: MapHandle | null) => void
  onInstanceRegionChange: (generation: number, bbox: BBox, zoom: number) => void
}

export function ManagedMap({ onMapHandle, onInstanceRegionChange, ...mapProps }: ManagedMapProps) {
  const [generation] = useState(claimMapMountGeneration)

  const setMapHandle = useCallback(
    (map: MapHandle | null) => onMapHandle(generation, map),
    [generation, onMapHandle],
  )
  const onRegionChange = useCallback(
    (bbox: BBox, zoom: number) => onInstanceRegionChange(generation, bbox, zoom),
    [generation, onInstanceRegionChange],
  )

  return <SharedMap {...mapProps} ref={setMapHandle} onRegionChange={onRegionChange} />
}
