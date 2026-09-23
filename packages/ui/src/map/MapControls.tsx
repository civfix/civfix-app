import React, { useEffect, useRef, useState } from "react"
import { View, Pressable, StyleSheet } from "react-native"
import { space, useLayoutMode, focusRingProps, makeThemedStyles, useTheme, webCursor, webHover, webTransition } from "../theme"
import { Brand, GlassButton, Avatar, openBrandAbout } from "../primitives"
import { Text, Icon, iconMap } from "../typography"
import { BlurSurface } from "../surface"
import { useNavStore } from "../nav"
import { useAuthState, useNotifications, useRequireAuth } from "../data"
import { LayersPopover, LAYERS_POPOVER_ANIM_MS } from "./LayersPopover"
import { MapHeaderActions } from "./MapHeaderActions"
import { MapThemeToggle } from "./MapThemeToggle"
import { useReportFilterStore } from "./filterStore"
import { useT } from "../i18n"
import { HEADER_AVATAR_SIZE, HEADER_GLYPH_SIZE } from "../bodies/headerControls"
import { MAP_ACTION_SIZE } from "../shell/expandedFramePlan"

export const GLASS_CONTROL_SIZE = MAP_ACTION_SIZE

export interface MapControlsProps {
  topInset?: number
  unreadCount?: number
  onLocate: () => void
}

export function MapControls({ topInset = 0, onLocate }: MapControlsProps) {
  const styles = useStyles()
  const th = useTheme()
  const top = topInset + space["2"]
  const mode = useLayoutMode()
  const { t } = useT("map-ui")

  const reportsShown = useReportFilterStore((s) => s.enabled.size > 0)
  const layersOpen = useReportFilterStore((s) => s.layersOpen)
  const setLayersOpen = useReportFilterStore((s) => s.setLayersOpen)

  const [isClosing, setIsClosing] = useState(false)
  const prevOpenRef = useRef(layersOpen)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const wasOpen = prevOpenRef.current
    prevOpenRef.current = layersOpen
    if (wasOpen && !layersOpen) {
      setIsClosing(true)
      if (closeTimer.current) clearTimeout(closeTimer.current)
      closeTimer.current = setTimeout(() => {
        setIsClosing(false)
      }, LAYERS_POPOVER_ANIM_MS + 40)
    } else if (!wasOpen && layersOpen) {
      if (closeTimer.current) {
        clearTimeout(closeTimer.current)
        closeTimer.current = null
      }
      setIsClosing(false)
    }
  }, [layersOpen])

  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current)
    },
    [],
  )

  const onPopoverClosed = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
    setIsClosing(false)
  }

  const popoverVisible = layersOpen || isClosing

  const onBrand = () => openBrandAbout()

  const onActivity = () => useNavStore.getState().push({ kind: "activity" })

  const brandPill = (
    <Pressable
      onPress={onBrand}
      accessibilityRole="button"
      accessibilityLabel={t("brand.home")}
      {...focusRingProps}
      style={(state) => [
        styles.logoPill,
        th.shadows.s2,
        webCursor(),
        webTransition,
        webHover(state) ? styles.hovered : null,
        state.pressed ? styles.pressed : null,
      ]}
    >
      <BlurSurface kind="button" style={StyleSheet.absoluteFill} pointerEvents="none" />
      <Brand size={23} />
    </Pressable>
  )

  const layersButton = (
    <GlassButton
      accessibilityLabel={t("layers.toggle")}
      onPress={() => setLayersOpen(!layersOpen)}
      active={layersOpen}
    >
      <Icon
        icon={iconMap.Layers}
        size={HEADER_GLYPH_SIZE}
        color={
          layersOpen ? th.glass.active.icon : reportsShown ? th.glass.on : th.colors.neutral.ink2
        }
      />
    </GlassButton>
  )

  if (mode === "expanded") {
    return (
      <View style={[styles.topBar, { top }]}>
        <View style={styles.topActions}>
          <GlassButton accessibilityLabel={t("actions.locate")} onPress={onLocate}>
            <Icon icon={iconMap.Navigation} size={HEADER_GLYPH_SIZE} color={th.colors.neutral.ink2} />
          </GlassButton>
          {layersButton}
          <ActivityBell onPress={onActivity} />
          <MapThemeToggle variant="glass" />
          <ProfileEntry />
        </View>

        {popoverVisible ? (
          <View style={styles.topPopoverAnchor}>
            <LayersPopover isClosing={isClosing} onClosed={onPopoverClosed} />
          </View>
        ) : null}
      </View>
    )
  }

  return (
    <>
      <MapHeaderActions topInset={topInset} />

      <View style={[styles.topLeft, { top }]}>
        <View style={styles.topRow}>
          {brandPill}

          <GlassButton accessibilityLabel={t("actions.locate")} onPress={onLocate}>
            <Icon icon={iconMap.Navigation} size={HEADER_GLYPH_SIZE} color={th.colors.neutral.ink2} />
          </GlassButton>

          {layersButton}
        </View>

        {popoverVisible ? (
          <View style={styles.popoverAnchor}>
            <LayersPopover isClosing={isClosing} onClosed={onPopoverClosed} />
          </View>
        ) : null}
      </View>
    </>
  )
}

function ActivityBell({ onPress }: { onPress: () => void }) {
  const th = useTheme()
  const { t } = useT("map-ui")
  const { t: tn } = useT("notifications")
  const { unreadCount } = useNotifications()
  const unread = unreadCount > 0
  const label = t("actions.notifications")
  return (
    <GlassButton
      accessibilityLabel={unread ? tn("row.unreadSuffix", { title: label }) : label}
      onPress={onPress}
      dot={unread}
    >
      <Icon icon={iconMap.Bell} size={HEADER_GLYPH_SIZE} color={th.colors.neutral.ink2} />
    </GlassButton>
  )
}

function ProfileEntry() {
  const styles = useStyles()
  const th = useTheme()
  const { user, isAuthenticated, isPending } = useAuthState()
  const requireAuth = useRequireAuth()
  const { t } = useT("map-ui")
  const { t: tNav } = useT("nav")

  if (isPending) return null

  if (!isAuthenticated) {
    return (
      <Pressable
        onPress={() => requireAuth(() => useNavStore.getState().push({ kind: "profile" }))}
        accessibilityRole="button"
        accessibilityLabel={t("profile.signIn")}
        hitSlop={6}
        {...focusRingProps}
        style={(state) => [
          styles.signInPill,
          th.shadows.s2,
          webCursor(),
          webTransition,
          webHover(state) ? styles.hovered : null,
          state.pressed ? styles.pressed : null,
        ]}
      >
        <BlurSurface kind="button" style={StyleSheet.absoluteFill} pointerEvents="none" />
        <Text style={styles.signInText}>{t("profile.signIn")}</Text>
      </Pressable>
    )
  }

  return (
    <Pressable
      onPress={() => useNavStore.getState().push({ kind: "profile" })}
      accessibilityRole="button"
      accessibilityLabel={t("profile.open")}
      hitSlop={6}
      {...focusRingProps}
      style={(state) => [
        styles.profileWrap,
        th.shadows.s2,
        webCursor(),
        webTransition,
        webHover(state) ? styles.hovered : null,
        state.pressed ? styles.pressed : null,
      ]}
    >
      <Avatar
        name={user?.displayName ?? tNav("fallback_you")}
        photoUrl={user?.avatarUrl ?? null}
        seed={user?.id}
        size={HEADER_AVATAR_SIZE}
      />
    </Pressable>
  )
}

const useStyles = makeThemedStyles((t) => ({
  topBar: {
    position: "absolute",
    right: t.space["3"],
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "flex-end",
    zIndex: 1,
    elevation: 1,
    pointerEvents: "box-none",
  },
  topActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
    pointerEvents: "box-none",
  },
  topPopoverAnchor: {
    position: "absolute",
    top: GLASS_CONTROL_SIZE + t.space["2"],
    right: 0,
  },
  topLeft: {
    position: "absolute",
    left: t.space["3"],
    right: t.space["3"],
    zIndex: 1,
    elevation: 1,
    pointerEvents: "box-none",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
    pointerEvents: "box-none",
  },
  logoPill: {
    height: GLASS_CONTROL_SIZE,
    paddingHorizontal: t.space["4"],
    borderRadius: t.radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.glass.button.border,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  popoverAnchor: {
    marginTop: t.space["2"],
  },
  profileWrap: {
    width: HEADER_AVATAR_SIZE,
    height: HEADER_AVATAR_SIZE,
    borderRadius: HEADER_AVATAR_SIZE / 2,
  },
  signInPill: {
    height: GLASS_CONTROL_SIZE,
    paddingHorizontal: t.space["4"],
    borderRadius: t.radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.glass.button.border,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  signInText: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 14,
    color: t.colors.text,
  },
  hovered: {
    opacity: 0.85,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.96 }],
  },
}))
