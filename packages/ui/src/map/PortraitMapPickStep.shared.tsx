/**
 * PortraitMapPickStep.shared - the platform-NEUTRAL half of the compact/portrait big-map location picker.
 *
 * The two seams (PortraitMapPickStep.native.tsx = a full-screen RN Modal with its own moveable map;
 * PortraitMapPickStep.web.tsx = a pointer-events-through portal over the persistent home map) genuinely
 * differ only in their HOST CHROME and their middle content. Everything else was copy-pasted twice and had
 * already started to drift, so it lives here once:
 *
 *   - `usePickStepSheetSnap(visible)` - capture + collapse the sheet detent on open, restore it on close.
 *   - `usePickStepAddressQuery(visible)` - the AddressSearch query state, reset on each open.
 *   - `PickStepBottomBar` - the floating coord-echo + Cancel / Confirm bar.
 *   - `pickStepStyles` - the bar's card + button styles (each seam adds only its own positioning).
 *
 * Pure RN primitives + the shared theme/i18n, so it renders unchanged on native and (via react-native-web)
 * on web. `webCursorPointer` is an empty style on native, so the seams no longer diverge on it either.
 */
import React, { useEffect, useRef, useState } from "react"
import { View, Pressable, StyleSheet, type StyleProp, type ViewStyle } from "react-native"
import { webCursorPointer, focusRingProps, makeThemedStyles, useTheme } from "../theme"
import { Text, Icon, iconMap } from "../typography"
import { useT } from "../i18n"
import { useNavStore } from "../nav"
import type { LatLng } from "./LocationPicker.types"

/**
 * Collapse the host sheet to peek while the pick step is open (so nothing peeks under the full-screen
 * picker) and restore the previous detent when it closes / unmounts. Mirrors CleanupForm's PickOnMapButton.
 *
 * Keyed ONLY on `visible` - a seam that also reacts to some other flip (the web seam's `mapRegistered`)
 * must keep that in its own effect, or the sheet gets restored-then-recollapsed mid-pick.
 */
export function usePickStepSheetSnap(visible: boolean): void {
  const restoreSnapRef = useRef<number | null>(null)
  useEffect(() => {
    if (!visible) return
    const nav = useNavStore.getState()
    restoreSnapRef.current = nav.snap === 0 ? 1 : nav.snap
    nav.setSnap(0)
    return () => {
      const snap = restoreSnapRef.current
      restoreSnapRef.current = null
      if (snap != null) useNavStore.getState().setSnap(snap as 0 | 1 | 2)
    }
  }, [visible])
}

/** The floating AddressSearch's query state, cleared each time the step opens. */
export function usePickStepAddressQuery(visible: boolean): [string, (next: string) => void] {
  const [addrQuery, setAddrQuery] = useState("")
  useEffect(() => {
    if (visible) setAddrQuery("")
  }, [visible])
  return [addrQuery, setAddrQuery]
}

export interface PickStepBottomBarProps {
  /** The currently placed point, or null - drives the echo text and gates Confirm. */
  point: LatLng | null
  /** Commit the placed point. Only reachable while `point` is set. */
  onConfirm: () => void
  /** Discard the pick. */
  onCancel: () => void
  /** Seam-owned POSITIONING only (native: absolute + insets; web: margins). The card look lives here. */
  style?: StyleProp<ViewStyle>
}

/** The floating "coordinate echo + Cancel / Confirm" bar shared by both pick-step seams. */
export function PickStepBottomBar({ point, onConfirm, onCancel, style }: PickStepBottomBarProps) {
  const pickStepStyles = usePickStepStyles()
  const th = useTheme()
  const { t } = useT("map-ui")
  const hasPoint = point != null

  return (
    <View style={[pickStepStyles.bar, style]}>
      <Text style={[pickStepStyles.echo, hasPoint ? pickStepStyles.echoCoords : null]} numberOfLines={1}>
        {hasPoint ? `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}` : t("pickStep.needPin")}
      </Text>
      <View style={pickStepStyles.actions}>
        <Pressable
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel={t("pickStep.cancelA11y")}
          {...focusRingProps}
          style={({ pressed }) => [
            pickStepStyles.cancelBtn,
            webCursorPointer,
            pressed ? pickStepStyles.pressed : null,
          ]}
        >
          <Text style={pickStepStyles.cancelText}>{t("pickStep.cancel")}</Text>
        </Pressable>
        <Pressable
          onPress={onConfirm}
          disabled={!hasPoint}
          accessibilityRole="button"
          accessibilityLabel={t("pickStep.confirmA11y")}
          accessibilityState={{ disabled: !hasPoint }}
          {...focusRingProps}
          style={({ pressed }) => [
            pickStepStyles.confirmBtn,
            webCursorPointer,
            !hasPoint ? pickStepStyles.confirmDisabled : th.shadows.pin,
            pressed && hasPoint ? pickStepStyles.pressed : null,
          ]}
        >
          <Icon
            icon={iconMap.Check}
            size={16}
            color={hasPoint ? th.colors.onAccent : th.colors.textSubtle}
          />
          <Text
            style={[
              pickStepStyles.confirmText,
              { color: hasPoint ? th.colors.onAccent : th.colors.textSubtle },
            ]}
          >
            {t("pickStep.confirm")}
          </Text>
        </Pressable>
      </View>
    </View>
  )
}

const usePickStepStyles = makeThemedStyles((t) => ({
  // The bar's CARD look. Positioning is the seam's job (passed in via `style`).
  bar: {
    padding: t.space["3"],
    gap: t.space["3"],
    borderRadius: t.radius.lg,
    backgroundColor: t.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    ...t.shadows.s2,
  },
  // Prose (the "tap the map" hint) reads in the body font; the lat/lng echo swaps to mono via echoCoords.
  echo: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["12"],
    color: t.colors.textMuted,
    textAlign: "center",
  },
  echoCoords: {
    fontFamily: t.fontFamily.mono,
  },
  actions: {
    flexDirection: "row",
    gap: t.space["3"],
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: t.radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.surface,
    borderWidth: 1.5,
    borderColor: t.colors.borderStrong,
  },
  cancelText: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: t.fontSize["14"],
    color: t.colors.text,
  },
  confirmBtn: {
    flex: 2,
    height: 48,
    borderRadius: t.radius.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: t.colors.brand.bloom,
  },
  confirmDisabled: {
    backgroundColor: t.colors.neutral.ink5,
  },
  confirmText: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: t.fontSize["14"],
  },
  pressed: { opacity: 0.9 },
}))
