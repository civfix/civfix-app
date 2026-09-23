import React, { useCallback } from "react"
import { Pressable, StyleSheet, View, type ViewStyle } from "react-native"
import { makeThemedStyles, useTheme } from "../theme"
import { Icon, iconMap, type LucideIcon } from "../typography"
import { BlurSurface } from "../surface"
import { searchModeFor, useNavStore, type View as NavView } from "../nav"
import { discardSearchInput } from "../bodies/searchRecentStore"
import { openReportFlow } from "../bodies/composerCreateFlow"
import { useT } from "../i18n"
import { useHaptics } from "../capabilities"
import {
  TAB_BAR_HEIGHT,
  TAB_SPECS,
  activeTabIndex,
  type TabId,
  type TabSpec,
} from "./tabBarLogic"

export interface TabDef extends TabSpec {
  id: TabId
  view: NavView | null
  icon: LucideIcon
  labelKey: string
}

const TAB_VISUALS: Record<TabId, Pick<TabDef, "icon" | "labelKey">> = {
  home: { icon: iconMap.Newspaper, labelKey: "tab.home" },
  map: { icon: iconMap.Map, labelKey: "tab.map" },
  messages: { icon: iconMap.MessageCircle, labelKey: "tab.messages" },
  report: { icon: iconMap.Camera, labelKey: "tab.report" },
}

export const TABS: readonly TabDef[] = TAB_SPECS.map((spec) => ({ ...spec, ...TAB_VISUALS[spec.id] }))

export const TAB_COUNT = TABS.length

export const BAR_HEIGHT = TAB_BAR_HEIGHT
export const ORB_SIZE = 58
export const PILL_INSET = 6

export type TabPressHandler = (tab: TabDef) => void

export function useTabBarModel(): {
  view: NavView
  activeIndex: number
  searchActive: boolean
  onTab: TabPressHandler
  onSearch: () => void
} {
  const view = useNavStore((s) => s.view)
  const selectView = useNavStore((s) => s.selectView)
  const haptics = useHaptics()

  const activeIndex = activeTabIndex(view)

  const onTab = useCallback<TabPressHandler>(
    (tab) => {
      if (tab.id === "report") {
        haptics.impactLight()
        openReportFlow()
        return
      }
      if (tab.view === null) return
      if (tab.view !== useNavStore.getState().view) haptics.selection()
      selectView(tab.view)
    },
    [selectView, haptics],
  )
  const onSearch = useCallback(() => selectView("search"), [selectView])

  return { view, activeIndex, searchActive: view === "search", onTab, onSearch }
}

export function useDockedSearchModel() {
  const query = useNavStore((s) => s.query)
  const setQuery = useNavStore((s) => s.setQuery)
  const setSnap = useNavStore((s) => s.setSnap)
  const selectView = useNavStore((s) => s.selectView)
  const { t } = useT("nav")
  const spec = searchModeFor("search", null)

  return {
    value: query,
    placeholder: t(spec.placeholder),
    mode: spec.kind,
    onChangeText: setQuery,
    onFocus: () => setSnap(2),
    onHome: () => selectView("home"),
    onClear: () => {
      discardSearchInput()
      setQuery("")
    },
  }
}

export function TabButton({
  tab,
  active,
  onPress,
}: {
  tab: TabDef
  active: boolean
  onPress: () => void
}) {
  const styles = useTabBarStyles()
  const th = useTheme()
  const { t } = useT("nav")
  const label = t(tab.labelKey)
  const color = th.colors.textMuted
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      style={({ pressed }) => [styles.tab, pressed ? styles.pressed : null]}
    >
      <Icon icon={tab.icon} size={24} color={color} />
    </Pressable>
  )
}

export function SearchOrb({ active, onPress }: { active: boolean; onPress: () => void }) {
  const styles = useTabBarStyles()
  const th = useTheme()
  const { t } = useT("nav")
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={t("tab.search")}
      style={({ pressed }) => [styles.orb, th.shadows.s3, pressed ? styles.pressed : null]}
    >
      <BlurSurface kind="button" style={[StyleSheet.absoluteFill, styles.noPointer]} />
      <View style={styles.orbIcon}>
        <Icon icon={iconMap.Search} size={22} color={active ? th.colors.accent : th.colors.textMuted} />
      </View>
    </Pressable>
  )
}

export const useTabBarStyles = makeThemedStyles((t) => ({
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: t.space["2"],
    paddingHorizontal: t.space["4"],
    paddingTop: t.space["2"],
    pointerEvents: "box-none",
  },
  bar: {
    flex: 1,
    height: BAR_HEIGHT,
    borderRadius: BAR_HEIGHT / 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.glass.button.border,
    overflow: "hidden",
    justifyContent: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    height: "100%",
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
  },
  pill: {
    position: "absolute",
    top: PILL_INSET,
    height: BAR_HEIGHT - PILL_INSET * 2,
    borderRadius: (BAR_HEIGHT - PILL_INSET * 2) / 2,
    backgroundColor: t.glass.button.fill,
  },
  orb: {
    width: ORB_SIZE,
    height: ORB_SIZE,
    borderRadius: ORB_SIZE / 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.glass.button.border,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  orbIcon: {
    zIndex: 1,
    pointerEvents: "none",
  },
  noPointer: {
    pointerEvents: "none",
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.96 }],
  },
}))

export function BarGlass() {
  const styles = useTabBarStyles()
  return <BlurSurface kind="button" style={[StyleSheet.absoluteFill, styles.noPointer]} />
}

export type WebViewStyle = ViewStyle
