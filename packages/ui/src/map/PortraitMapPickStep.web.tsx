import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { View, StyleSheet } from "react-native"
import { makeThemedStyles, useTheme } from "../theme"
import { Text, Icon, iconMap } from "../typography"
import { useT } from "../i18n"
import { AddressSearch, type AddressPick } from "../bodies/AddressSearch"
import { useResetOnOpen } from "../primitives/useModalClosed"
import { LocationPicker } from "./LocationPicker"
import { useLocationPick, type PickDraft } from "./locationPickStore"
import type { LatLng } from "./LocationPicker.types"
import {
  PickStepBottomBar,
  usePickStepAddressQuery,
  usePickStepSheetSnap,
} from "./PortraitMapPickStep.shared"
import { INLINE_PICK_HEIGHT, type PortraitMapPickStepProps } from "./PortraitMapPickStep.types"

export function PortraitMapPickStep({
  visible,
  value,
  initialCenter,
  centerSettled,
  onConfirm,
  onCancel,
  pin,
  inert = false,
}: PortraitMapPickStepProps) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("map-ui")
  const live = visible && !inert
  const mapRegistered = useLocationPick((s) => s.mapRegistered)
  const draft = useLocationPick((s) => s.draft)
  const [localPoint, setLocalPoint] = useState<LatLng | null>(value)
  useResetOnOpen(live, () => setLocalPoint(value ?? null))

  const onConfirmRef = useRef(onConfirm)
  const onCancelRef = useRef(onCancel)
  const pinRef = useRef(pin)

  const pointRef = useRef<LatLng | null>(value ?? null)
  // The seed below runs on the open edge only, reading whatever value the parent holds at that moment.
  const valueRef = useRef(value)
  useLayoutEffect(() => {
    onConfirmRef.current = onConfirm
    onCancelRef.current = onCancel
    pinRef.current = pin
    valueRef.current = value
  })

  usePickStepSheetSnap(live)

  useEffect(() => {
    if (!live) return
    pointRef.current = valueRef.current ?? null
  }, [live])

  useEffect(() => {
    if (!live || !mapRegistered) return
    useLocationPick.getState().start((pointRef.current as PickDraft | null) ?? null, pinRef.current)
    return () => {
      useLocationPick.getState().cancel()
    }
  }, [live, mapRegistered])

  useEffect(() => {
    if (!live || !mapRegistered) return
    useLocationPick.getState().setPin(pin)
  }, [live, mapRegistered, pin])

  const point: LatLng | null = mapRegistered ? draft ?? localPoint ?? value : localPoint

  const [addrQuery, setAddrQuery] = usePickStepAddressQuery(live)

  useEffect(() => {
    if (draft) pointRef.current = draft
  }, [draft])

  const onPickPlace = useCallback(
    (place: AddressPick) => {
      pointRef.current = { lat: place.lat, lng: place.lng }
      if (mapRegistered) useLocationPick.getState().setDraft(place.lat, place.lng)
      else setLocalPoint({ lat: place.lat, lng: place.lng })
    },
    [mapRegistered],
  )
  const onInlineChange = useCallback((lat: number, lng: number) => {
    pointRef.current = { lat, lng }
    setLocalPoint({ lat, lng })
  }, [])

  const confirm = useCallback(() => {
    const p = mapRegistered ? useLocationPick.getState().draft ?? pointRef.current : localPoint
    if (!p) return
    onConfirmRef.current(p.lat, p.lng)
  }, [mapRegistered, localPoint])
  const cancel = useCallback(() => onCancelRef.current(), [])

  const topBarRef = useRef<View>(null)

  useEffect(() => {
    if (!live) return
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    // Only a keyboard opener moves focus into the search: on a phone a focused input raises the soft
    // keyboard over the map the step exists to show.
    if (opener?.matches(":focus-visible")) {
      const topBar = topBarRef.current as unknown as HTMLElement | null
      topBar?.querySelector("input")?.focus()
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return
      e.preventDefault()
      onCancelRef.current()
    }
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("keydown", onKeyDown)
      if (opener?.isConnected) opener.focus()
    }
  }, [live])

  if (!live || typeof document === "undefined") return null

  const chrome = (
    <View style={styles.host} pointerEvents="box-none">
      <View ref={topBarRef} style={styles.topBar} pointerEvents="auto">
        <View style={styles.titleRow}>
          <Icon icon={iconMap.MapPin} size={16} color={th.colors.brand.bloom} />
          <Text style={styles.title} numberOfLines={1}>
            {t("pickStep.title")}
          </Text>
        </View>
        <AddressSearch value={addrQuery} onChangeText={setAddrQuery} onPick={onPickPlace} />
      </View>

      {mapRegistered ? (
        <View style={styles.spacer} pointerEvents="box-none" />
      ) : (
        <View style={styles.inlineWrap} pointerEvents="auto">
          <LocationPicker
            value={localPoint}
            onChange={onInlineChange}
            initialCenter={initialCenter ?? undefined}
            centerSettled={centerSettled}
            mode="standalone"
            height={INLINE_PICK_HEIGHT}
            pin={pin}
          />
        </View>
      )}

      <View pointerEvents="auto">
        <PickStepBottomBar point={point} onConfirm={confirm} onCancel={cancel} style={styles.bottomBar} />
      </View>
    </View>
  )

  return createPortal(chrome, document.body)
}

const useStyles = makeThemedStyles((t) => ({
  host: {
    position: "fixed" as unknown as "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "space-between",
    zIndex: 1000,
  },
  topBar: {
    margin: t.space["3"],
    marginTop: t.space["4"],
    padding: t.space["3"],
    gap: t.space["2"],
    borderRadius: t.radius.lg,
    backgroundColor: t.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    ...t.shadows.s2,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
  },
  title: {
    flex: 1,
    fontFamily: t.fontFamily.bodyBold,
    fontSize: t.fontSize["15"],
    color: t.colors.text,
  },
  spacer: { flex: 1 },
  inlineWrap: {
    marginHorizontal: t.space["3"],
  },
  bottomBar: {
    margin: t.space["3"],
    marginBottom: t.space["4"],
  },
}))
