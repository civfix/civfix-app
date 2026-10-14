import React, { useCallback, useRef } from "react"
import type { BBox } from "@civfix/shared"
import { Map as SharedMap, type MapHandle, type MapProps } from "@civfix/ui"

let nextMapMountGeneration = 0

export type ManagedMapProps = Omit<MapProps, "onRegionChange"> & {
  onMapHandle: (generation: number, map: MapHandle | null) => void
  onInstanceRegionChange: (generation: number, bbox: BBox, zoom: number) => void
}

export function ManagedMap({
  onMapHandle,
  onInstanceRegionChange,
  ...mapProps
}: ManagedMapProps) {
  const generationRef = useRef<number | null>(null)
  if (generationRef.current === null) {
    nextMapMountGeneration += 1
    generationRef.current = nextMapMountGeneration
  }
  const generation = generationRef.current

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
