import { useCallback, useEffect, useMemo, useState } from "react"
import { Platform } from "react-native"
import { type LatLng } from "@civfix/shared/geocode"
import { reportPinTarget } from "../../map"
import type { PinTarget } from "../../map/pins"
import { useDraftReportStore } from "../../report/draftStore"
import { pickLayerVisible, type Step } from "../../report/wizardSteps"
import { useApproxCenter, type ApproxCenter } from "./useApproxCenter"

const PICK_LAYER_LINGER_MS = 400

const PICK_LAYER_LINGERS = Platform.OS !== "web"

export interface PickLayer {
  pickPoint: LatLng | null
  pickPin: PinTarget
  pickCenter: ApproxCenter
  openPicker: () => void
  onPickConfirm: (lat: number, lng: number) => void
  onPickCancel: () => void
  pickLayerOpen: boolean
  pickLayerMounted: boolean
}

export function usePickLayer({
  activeStep,
  hasMedia,
  hasLocation,
  stackNonEmpty,
  runActive,
  advanceFromLocation,
  cancelLocation,
}: {
  activeStep: Step
  hasMedia: boolean
  hasLocation: boolean
  stackNonEmpty: boolean
  runActive: boolean
  advanceFromLocation: () => void
  cancelLocation: () => void
}): PickLayer {
  const draftLat = useDraftReportStore((s) => s.draft.lat)
  const draftLng = useDraftReportStore((s) => s.draft.lng)
  const draftCategory = useDraftReportStore((s) => s.draft.category)
  const pickPoint = draftLat != null && draftLng != null ? { lat: draftLat, lng: draftLng } : null
  const pickPin = useMemo(() => reportPinTarget(draftCategory), [draftCategory])
  const [picking, setPicking] = useState(false)
  const pickCenter = useApproxCenter(
    hasMedia || activeStep === "location" || activeStep === "review" || picking,
    picking,
  )
  const openPicker = useCallback(() => setPicking(true), [])
  useEffect(() => {
    if (activeStep === "location" && !hasLocation) setPicking(true)
  }, [activeStep, hasLocation])
  const onPickConfirm = useCallback(
    (lat: number, lng: number) => {
      useDraftReportStore.getState().setLocation(lat, lng, "manual")
      setPicking(false)
      if (activeStep === "location") advanceFromLocation()
    },
    [activeStep, advanceFromLocation],
  )
  const onPickCancel = useCallback(() => {
    setPicking(false)
    if (activeStep === "location") cancelLocation()
  }, [activeStep, cancelLocation])
  const pickLayerOpen = pickLayerVisible(picking, stackNonEmpty, runActive)
  const pickLayerOffViewHold =
    PICK_LAYER_LINGERS && pickLayerVisible(picking, stackNonEmpty, true) && !runActive
  const [pickLingerArmed, setPickLingerArmed] = useState(false)
  const [seenPickHold, setSeenPickHold] = useState(pickLayerOffViewHold)
  if (seenPickHold !== pickLayerOffViewHold) {
    setSeenPickHold(pickLayerOffViewHold)
    setPickLingerArmed(pickLayerOffViewHold)
  }
  useEffect(() => {
    if (!pickLingerArmed) return
    const handle = setTimeout(() => setPickLingerArmed(false), PICK_LAYER_LINGER_MS)
    return () => clearTimeout(handle)
  }, [pickLingerArmed])
  const pickLayerMounted = pickLayerOpen || (pickLingerArmed && pickLayerOffViewHold)

  return { pickPoint, pickPin, pickCenter, openPicker, onPickConfirm, onPickCancel, pickLayerOpen, pickLayerMounted }
}
