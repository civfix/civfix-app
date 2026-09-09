import React, { useCallback, useEffect, useRef, useState } from "react"
import { StyleSheet, View, useWindowDimensions } from "react-native"
import { makeThemedStyles, useAppearancePreference, useTheme } from "../theme"
import { Icon, iconMap, Text } from "../typography"
import { AnchoredPopover, GlassButton, useMenuCardSize, usePopoverAnchor, type AnchorRect } from "../primitives"
import { menuOrigin, useMenuMotion } from "../primitives/menuMotion"
import { BlurSurface } from "../surface"
import { HeaderIconButton } from "../bodies/HeaderIconButton"
import { AppearanceOptionList } from "../bodies/AppearanceOptionList"
import { useT } from "../i18n"
import { MAP_THEME_TOGGLE_ENABLED } from "./themeTogglePlatform"
import { themeMenuFrame } from "./themeMenuPlacement"

export interface MapThemeToggleProps {
  variant: "solid" | "glass"
}

export function MapThemeToggle({ variant }: MapThemeToggleProps) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("map-ui")
  const { t: tAppearance } = useT("appearance-settings")
  const [open, setOpen] = useState(false)
  const preference = useAppearancePreference()
  const lastPreference = useRef(preference)
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions()
  const [anchorRect, setAnchorRect] = useState<AnchorRect | null>(null)
  const pendingOpen = useRef(false)
  const onMeasured = useCallback((rect: AnchorRect) => {
    setAnchorRect(rect)
    if (!pendingOpen.current) return
    pendingOpen.current = false
    setOpen(true)
  }, [])
  const { ref: anchorRef, measure } = usePopoverAnchor(onMeasured)
  const { size: cardSize, onLayout: onCardLayout, reset: resetCardSize } = useMenuCardSize()
  const close = useCallback(() => {
    pendingOpen.current = false
    setOpen(false)
  }, [])
  const measuring = anchorRect === null || cardSize === null
  const motion = useMenuMotion({ visible: open, ready: !measuring })
  const rendered = motion.rendered
  useEffect(() => {
    resetCardSize()
  }, [rendered, resetCardSize])

  useEffect(() => {
    if (lastPreference.current === preference) return
    lastPreference.current = preference
    close()
  }, [preference, close])

  useEffect(() => {
    measure()
  }, [measure, viewportWidth, viewportHeight])

  const toggle = useCallback(() => {
    if (open) {
      close()
      return
    }
    pendingOpen.current = true
    measure()
  }, [open, measure, close])

  if (!MAP_THEME_TOGGLE_ENABLED) return null

  const label = t("appearance.toggle")
  const frame = anchorRect
    ? themeMenuFrame({
        anchor: anchorRect,
        viewportWidth,
        margin: th.space["3"],
        gap: th.space["2"],
      })
    : null
  const origin = menuOrigin(
    anchorRect,
    frame && cardSize
      ? { left: viewportWidth - frame.right - frame.width, top: frame.top, ...cardSize }
      : null,
  )

  return (
    <View ref={anchorRef} onLayout={measure}>
      {variant === "glass" ? (
        <GlassButton accessibilityLabel={label} onPress={toggle} active={open} expanded={open}>
          <Icon icon={iconMap.SunMoon} size={19} color={th.colors.neutral.ink2} />
        </GlassButton>
      ) : (
        <HeaderIconButton
          icon="SunMoon"
          label={label}
          onPress={toggle}
          surface="solid"
          expanded={open}
        />
      )}

      <AnchoredPopover
        motion={motion}
        origin={origin}
        onClose={close}
        dismissLabel={t("appearance.dismiss")}
        onCardLayout={onCardLayout}
        cardStyle={[styles.popover, frame]}
      >
        <BlurSurface kind="popover" style={[styles.card, th.shadows.s3]}>
          <Text style={styles.cardTitle}>{tAppearance("title")}</Text>
          <AppearanceOptionList />
        </BlurSurface>
      </AnchoredPopover>
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  popover: {
    position: "absolute",
  },
  card: {
    alignSelf: "stretch",
    borderRadius: t.radius.md,
    paddingHorizontal: t.space["3"],
    paddingTop: t.space["3"],
    paddingBottom: t.space["1"],
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.glass.popover.border,
  },
  cardTitle: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: t.fontSize["14"],
    color: t.colors.text,
    paddingHorizontal: t.space["1"],
  },
}))
