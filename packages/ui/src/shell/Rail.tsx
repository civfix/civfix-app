import React, { useEffect, useState } from "react"
import {
  Platform,
  Pressable,
  StyleSheet,
  View,
  type ViewStyle,
} from "react-native"
import {
  theme,
  coloredShadow,
  makeThemedStyles,
  useTheme,
  webCursorPointer,
  webHover,
  webTransition,
  focusRingProps,
  type Theme,
} from "../theme"
import { Icon, iconMap } from "../typography"
import { BlurSurface } from "../surface"
import { Brand, openBrandAbout } from "../primitives"
import { useT } from "../i18n"
import { useNavStore } from "../nav"
import {
  TABS,
  useTabBarModel,
  type TabDef,
} from "./TabBar.shared"
import { useSearchBarStore } from "./searchBarStore"
import { searchPressOpensSearch } from "./shellKeyModel"
import { activeTabIndex, tabPillTransition } from "./tabBarLogic"
import {
  NAV_GAP,
  NAV_H,
  NAV_LEFT,
  NAV_TOP,
  RAIL_BRAND_PAD_H,
  RAIL_BRAND_SIZE,
  RAIL_CAPSULE_H,
  RAIL_CAPSULE_RADIUS,
  RAIL_CAPSULE_W,
  RAIL_ITEM,
  RAIL_ITEM_GAP,
  RAIL_ORB,
  RAIL_PAD_H,
  railActiveView,
  railItemLeft,
} from "./expandedFramePlan"
import { cssTransition } from "./motionCss"
import { prefersReducedMotion } from "./webMedia"

const RAIL_ICON = 24
const RAIL_ICON_STROKE = 2.4
const ORB_ICON = 22
const BRAND_SIZE = RAIL_BRAND_SIZE
const RAIL_BORDER = StyleSheet.hairlineWidth
const LOZENGE_TOP = (RAIL_CAPSULE_H - RAIL_BORDER * 2 - RAIL_ITEM) / 2
const railShadow = (t: Theme): ViewStyle =>
  coloredShadow(
    t.glass.dock.shadow.color,
    t.glass.dock.shadow.offsetY,
    t.glass.dock.shadow.radius,
    1,
    8,
  )
const MOUNT_TRANSITION = cssTransition(["opacity", "transform"], theme.motion.glassIn)
const MOUNT_SCALE_FROM = theme.motion.glassIn.scaleFrom
const isWeb = Platform.OS === "web"

export function Rail() {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("nav")
  const { t: tMap } = useT("map-ui")
  const { onTab, onSearch, view } = useTabBarModel()
  const active = useNavStore((s) => s.active)
  const stackLength = useNavStore((s) => s.stack.length)
  const requestSearchFocus = useSearchBarStore((s) => s.requestSearchFocus)

  const onOrb = () => {
    const shouldFocus = searchPressOpensSearch(view, stackLength)
    onSearch()
    if (shouldFocus) requestSearchFocus()
  }
  const onBrand = () => openBrandAbout()

  const railView = railActiveView(view, active)
  const index = railView ? activeTabIndex(railView) : -1
  const lozengeVisible = index >= 0
  const searchActive = railView === "search"

  const shadow = railShadow(th)
  const reduceMotion = prefersReducedMotion()
  const [mounted, setMounted] = useState(reduceMotion)
  useEffect(() => setMounted(true), [])

  const lozengeStyle: ViewStyle = {
    opacity: lozengeVisible ? 1 : 0,
    transform: [{ translateX: railItemLeft(lozengeVisible ? index : 0) }],
    ...(isWeb ? ({ transition: tabPillTransition(reduceMotion) } as unknown as ViewStyle) : null),
  }

  return (
    <View
      style={styles.rail}
      {...({ dataSet: { civfixRail: "" } } as object)}
    >
      <View
        style={[
          styles.cluster,
          {
            opacity: mounted ? 1 : 0,
            transform: [{ scale: mounted ? 1 : MOUNT_SCALE_FROM }],
          },
          isWeb && !reduceMotion ? ({ transition: MOUNT_TRANSITION } as unknown as ViewStyle) : null,
        ]}
      >
        <Pressable
          onPress={onBrand}
          accessibilityRole="button"
          accessibilityLabel={tMap("brand.home")}
          {...focusRingProps}
          style={({ pressed }) => [
            styles.brandPill,
            shadow,
            webCursorPointer,
            webTransition,
            pressed ? styles.pressed : null,
          ]}
        >
          <BlurSurface kind="dock" style={[StyleSheet.absoluteFill, styles.noPointer]} />
          <Brand size={BRAND_SIZE} />
        </Pressable>

        <View
          style={[styles.capsule, shadow]}
          accessibilityRole="tablist"
          {...({ "aria-orientation": "horizontal" } as object)}
        >
          <BlurSurface kind="dock" style={[StyleSheet.absoluteFill, styles.noPointer]} />
          <View style={[styles.lozenge, lozengeStyle, styles.noPointer]} />
          {TABS.map((tab, i) => (
            <RailTab
              key={tab.id}
              tab={tab}
              selected={i === index}
              onPress={() => onTab(tab)}
            />
          ))}
        </View>

        <Pressable
          onPress={onOrb}
          accessibilityRole="button"
          accessibilityState={{ selected: searchActive }}
          {...({ "aria-pressed": searchActive } as object)}
          accessibilityLabel={t("tab.search")}
          {...focusRingProps}
          style={(state) => [
            styles.orb,
            shadow,
            webCursorPointer,
            webTransition,
            state.pressed ? styles.pressed : null,
          ]}
        >
          {(state) => (
            <>
              <BlurSurface kind="dock" style={[StyleSheet.absoluteFill, styles.noPointer]} />
              {searchActive ? <View style={[styles.orbSelected, styles.noPointer]} /> : null}
              {webHover(state) && !searchActive ? (
                <View style={[styles.hoverLozenge, styles.orbHoverLozenge, styles.noPointer]} />
              ) : null}
              <View style={styles.noPointer}>
                <Icon icon={iconMap.Search} size={ORB_ICON} color={th.colors.textMuted} strokeWidth={RAIL_ICON_STROKE} />
              </View>
            </>
          )}
        </Pressable>
      </View>
    </View>
  )
}

function RailTab({
  tab,
  selected,
  onPress,
}: {
  tab: TabDef
  selected: boolean
  onPress: () => void
}) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("nav")
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      {...({ "aria-selected": selected } as object)}
      accessibilityLabel={t(tab.labelKey)}
      {...focusRingProps}
      style={(state) => [
        styles.tab,
        webCursorPointer,
        webTransition,
        state.pressed ? styles.pressed : null,
      ]}
    >
      {(state) => (
        <>
          {webHover(state) && !selected ? <View style={[styles.hoverLozenge, styles.noPointer]} /> : null}
          <Icon
            icon={tab.icon}
            size={RAIL_ICON}
            color={th.colors.textMuted}
            strokeWidth={RAIL_ICON_STROKE}
          />
        </>
      )}
    </Pressable>
  )
}

const useStyles = makeThemedStyles((t) => ({
  rail: {
    position: "absolute",
    left: NAV_LEFT,
    top: NAV_TOP,
    right: 0,
    height: NAV_H,
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "center",
    zIndex: 65,
    pointerEvents: "box-none",
  },
  cluster: {
    flexDirection: "row",
    alignItems: "center",
    gap: NAV_GAP,
    pointerEvents: "box-none",
  },
  brandPill: {
    height: RAIL_CAPSULE_H,
    paddingHorizontal: RAIL_BRAND_PAD_H,
    borderRadius: t.radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.glass.dock.border,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  capsule: {
    width: RAIL_CAPSULE_W,
    height: RAIL_CAPSULE_H,
    borderRadius: RAIL_CAPSULE_RADIUS,
    paddingHorizontal: RAIL_PAD_H,
    flexDirection: "row",
    gap: RAIL_ITEM_GAP,
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.glass.dock.border,
    overflow: "hidden",
  },
  lozenge: {
    position: "absolute",
    left: 0,
    top: LOZENGE_TOP,
    width: RAIL_ITEM,
    height: RAIL_ITEM,
    borderRadius: RAIL_ITEM / 2,
    backgroundColor: t.glass.dock.selected,
  },
  tab: {
    width: RAIL_ITEM,
    height: RAIL_ITEM,
    borderRadius: RAIL_ITEM / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  hoverLozenge: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: RAIL_ITEM / 2,
    backgroundColor: t.glass.dock.selected,
    opacity: 0.6,
  },
  orb: {
    width: RAIL_ORB,
    height: RAIL_ORB,
    borderRadius: RAIL_ORB / 2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.glass.dock.border,
    overflow: "hidden",
  },
  orbSelected: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: RAIL_ORB / 2,
    backgroundColor: t.glass.dock.selected,
  },
  orbHoverLozenge: {
    borderRadius: RAIL_ORB / 2,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.94 }],
  },
  noPointer: {
    pointerEvents: "none",
  },
}))
