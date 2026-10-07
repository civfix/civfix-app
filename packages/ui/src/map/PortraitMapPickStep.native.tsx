import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { BackHandler, Modal, View, StyleSheet } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { space, makeThemedStyles } from "../theme"
import { AddressSearch, type AddressPick } from "../bodies/AddressSearch"
import { LocationPicker } from "./LocationPicker"
import type { LatLng } from "./LocationPicker.types"
import {
  PickStepBottomBar,
  usePickStepAddressQuery,
  usePickStepSheetSnap,
} from "./PortraitMapPickStep.shared"
import type { PortraitMapPickStepProps } from "./PortraitMapPickStep.types"

const BOTTOM_BAR_CLEARANCE = 124
const BAR_Z_INDEX = 10
const LAYER_Z_INDEX = 20

export function PortraitMapPickStep({
  visible,
  value,
  initialCenter,
  centerSettled,
  onConfirm,
  onCancel,
  pin,
  presentation = "modal",
  inert = false,
}: PortraitMapPickStepProps) {
  const styles = useStyles()
  const insets = useSafeAreaInsets()
  const layered = presentation === "layer"

  const [session, setSession] = useState<{ open: boolean; point: LatLng | null }>(() => ({
    open: visible,
    point: visible ? value ?? null : null,
  }))
  if (session.open !== visible) {
    setSession({ open: visible, point: visible ? value ?? null : null })
  }
  const localPoint = session.open ? session.point : null
  const setLocalPoint = useCallback(
    (point: LatLng | null) => setSession((s) => ({ open: s.open, point })),
    [],
  )

  const onConfirmRef = useRef(onConfirm)
  const onCancelRef = useRef(onCancel)
  useLayoutEffect(() => {
    onConfirmRef.current = onConfirm
    onCancelRef.current = onCancel
  })

  usePickStepSheetSnap(visible && presentation === "modal")

  const [addrQuery, setAddrQuery] = usePickStepAddressQuery(visible)

  const onPickPlace = useCallback(
    (place: AddressPick) => setLocalPoint({ lat: place.lat, lng: place.lng }),
    [setLocalPoint],
  )
  const onMapDrop = useCallback((lat: number, lng: number) => setLocalPoint({ lat, lng }), [setLocalPoint])

  const confirm = useCallback(() => {
    if (!localPoint) return
    onConfirmRef.current(localPoint.lat, localPoint.lng)
  }, [localPoint])
  const cancel = useCallback(() => onCancelRef.current(), [])

  useEffect(() => {
    if (!layered || !visible || inert) return
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      cancel()
      return true
    })
    return () => sub.remove()
  }, [layered, visible, inert, cancel])

  if (!visible) return null

  const topOffset = (layered ? 0 : insets.top) + space["2"]
  const bottomOffset = (layered ? 0 : insets.bottom) + space["3"]
  const creditInset = (layered ? 0 : insets.bottom) + BOTTOM_BAR_CLEARANCE

  const content = (
    <View style={styles.fill}>
      <LocationPicker
        value={localPoint}
        onChange={onMapDrop}
        initialCenter={initialCenter ?? undefined}
        centerSettled={centerSettled}
        mode="standalone"
        interactive
        fullBleed
        attributionBottomInset={creditInset}
        pin={pin}
      />

      <View style={[styles.topBar, { top: topOffset }]} pointerEvents="box-none">
        <AddressSearch value={addrQuery} onChangeText={setAddrQuery} onPick={onPickPlace} />
      </View>

      <PickStepBottomBar
        point={localPoint}
        onConfirm={confirm}
        onCancel={cancel}
        style={[styles.bottomBar, { bottom: bottomOffset }]}
      />
    </View>
  )

  if (layered)
    return (
      <View style={styles.layer} pointerEvents={inert ? "none" : "auto"}>
        {content}
      </View>
    )

  return (
    <Modal visible transparent statusBarTranslucent animationType="fade" onRequestClose={cancel}>
      {content}
    </Modal>
  )
}

const useStyles = makeThemedStyles((t) => ({
  fill: {
    flex: 1,
    backgroundColor: t.colors.bg,
  },
  topBar: {
    position: "absolute",
    left: t.space["3"],
    right: t.space["3"],
    zIndex: BAR_Z_INDEX,
    elevation: BAR_Z_INDEX,
  },
  bottomBar: {
    position: "absolute",
    left: t.space["3"],
    right: t.space["3"],
    zIndex: BAR_Z_INDEX,
    elevation: BAR_Z_INDEX,
  },
  layer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: LAYER_Z_INDEX,
    elevation: LAYER_Z_INDEX,
    backgroundColor: t.colors.bg,
  },
}))
