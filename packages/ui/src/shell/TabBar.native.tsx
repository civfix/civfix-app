import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  AccessibilityInfo,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
} from "react-native"
import { Gesture, GestureDetector } from "react-native-gesture-handler"
import Animated, {
  Easing,
  ReduceMotion,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
  type DerivedValue,
  type SharedValue,
} from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { makeThemedStyles, space, useTheme } from "../theme"
import { Icon, iconMap, type LucideIcon } from "../typography"
import {
  LiquidGlassDock,
  DOCK_H,
  DOCK_GAP,
  DOCK_MORPH_SHRINK,
  dockShapes,
  lerp,
  type DockShapes,
} from "../surface"
import { useNavStore, type View as NavView } from "../nav"
import { useT } from "../i18n"
import { useTabBarStore } from "./tabBarStore"
import { useSearchBarStore } from "./searchBarStore"
import { searchExitPublish } from "./searchExitModel"
import {
  DOCK_MOUNT_MS,
  DOCK_MOUNT_SCALE_FROM,
  DOCK_OCCLUSION_SINK,
  dockBottomGap,
  dockKeyboardRestOffset,
  TAB_ICON_SIZE,
  TAB_ICON_STROKE_WIDTH,
  TAB_ICON_CENTER_Y,
  TAB_PILL_LOCK_COUNT,
  activeTabIndex,
  lockedIndexForPillCenter,
  pillDragRect,
  selectedPillRect,
  placeholderMorph,
  resolvePreviousView,
  searchMorphTarget,
  seedPreviousView,
  tabIconMorph,
  travelFactor,
  windowProgress,
  type DockPlatform,
} from "./tabBarLogic"
import {
  dockMinimizeConfig,
  dockMorphInConfig,
  dockMorphOutConfig,
  tabPillConfig,
} from "./motionConfigs.native"
import { useDockedSearchRise } from "./SearchHeader.native"
import { dockMorphProgress } from "./dockMorphProgress.native"
import { sheetDockOcclusion } from "./sheetDockOcclusion.native"
import { useDockMinimizeStore } from "./dockMinimizeStore"
import {
  TABS,
  TAB_COUNT,
  useTabBarModel,
  useDockedSearchModel,
  type TabDef,
} from "./TabBar.shared"

const EASING = Easing.bezier(0.22, 1, 0.36, 1)

const DOCK_PLATFORM: DockPlatform = Platform.OS === "android" ? "android" : "other"

const H = DOCK_H
const G = DOCK_GAP
const ICON_SIZE = TAB_ICON_SIZE
const ICON_STROKE = TAB_ICON_STROKE_WIDTH
const ICON_CENTER_Y = TAB_ICON_CENTER_Y
const PILL_TOP = selectedPillRect(0, 0).y
const PILL_HEIGHT = selectedPillRect(0, 0).height
const DOCKED_D = H - DOCK_MORPH_SHRINK
const FIELD_PAD = space["5"]
const FIELD_H = space["10"]
const CLEAR_BUTTON_SIZE = space["10"]
const FIELD_GUTTER = space["4"]
const DOCKED_MAG_X = DOCKED_D + G + FIELD_PAD

function MorphTabCell({
  index,
  persist,
  restCenterX,
  shapes,
  tabW,
  tab,
  icon,
  label,
  active,
  interactive,
  onTab,
  p,
  mz,
}: {
  index: number
  persist: boolean
  restCenterX: number
  shapes: DerivedValue<DockShapes>
  tabW: number
  tab: TabDef
  icon: LucideIcon
  label: string
  active: boolean
  interactive: boolean
  onTab: (tab: TabDef, index: number) => void
  p: SharedValue<number>
  mz: SharedValue<number>
}) {
  const styles = useStyles()
  const th = useTheme()
  const onPress = useCallback(() => onTab(tab, index), [onTab, tab, index])
  const wrapStyle = useAnimatedStyle(() => {
    if (persist) {
      const t = Math.max(travelFactor(p.value), mz.value)
      const left = shapes.value.left
      const cx = left.x + left.width / 2
      const cy = left.y + left.height / 2
      return {
        opacity: 1,
        transform: [
          { translateX: t * (cx - restCenterX) },
          { translateY: t * (cy - ICON_CENTER_Y) },
          { scale: 1 },
        ],
      }
    }
    const m = tabIconMorph(p.value)
    const eff = m.opacity * (1 - mz.value)
    return { opacity: eff, transform: [{ translateX: 0 }, { translateY: 0 }, { scale: 0.82 + 0.18 * eff }] }
  })
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      pointerEvents={interactive ? "auto" : "none"}
      {...a11yReachableWhen(interactive)}
      style={[styles.tabHit, { left: index * tabW, width: tabW }]}
    >
      <Animated.View style={[styles.iconBox, wrapStyle]}>
        <Icon icon={icon} size={ICON_SIZE} strokeWidth={ICON_STROKE} color={th.colors.textMuted} />
      </Animated.View>
    </Pressable>
  )
}

const MorphTab = memo(MorphTabCell)

// pointerEvents only stops touches: a screen reader still reaches a view it
// gates, so every morphing hit target also leaves the a11y tree while inert.
function a11yReachableWhen(reachable: boolean) {
  return {
    accessibilityElementsHidden: !reachable,
    importantForAccessibility: reachable ? ("auto" as const) : ("no-hide-descendants" as const),
  }
}

export function TabBar() {
  const styles = useStyles()
  const th = useTheme()
  const insets = useSafeAreaInsets()
  const { t } = useT("nav")
  const { t: tSearch } = useT("common-search")
  const { view, activeIndex, searchActive, onTab, onSearch } = useTabBarModel()
  const dockedSearch = useDockedSearchModel()
  const selectView = useNavStore((s) => s.selectView)
  const setTabBarHeight = useTabBarStore((s) => s.setTabBarHeight)
  const noteView = useTabBarStore((s) => s.noteView)
  const minimized = useDockMinimizeStore((s) => s.minimized)
  const resetMinimize = useDockMinimizeStore((s) => s.reset)

  const [regionW, setRegionW] = useState(0)
  const wide = Math.max(regionW - H - G, 0)
  const tabW = wide / TAB_COUNT
  const pillW = selectedPillRect(0, tabW).width

  const [reduceMotion, setReduceMotion] = useState(false)
  useEffect(() => {
    let mounted = true
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => mounted && setReduceMotion(!!enabled))
      // A failed probe keeps motion on; the reduceMotionChanged listener below still corrects it.
      .catch(() => {})
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", (enabled) => setReduceMotion(!!enabled))
    return () => {
      mounted = false
      sub?.remove()
    }
  }, [])

  const [prevView, setPrevView] = useState<NavView>(() =>
    seedPreviousView(view, useTabBarStore.getState().lastNonSearchView),
  )
  useEffect(() => {
    noteView(view)
    setPrevView((stored) => resolvePreviousView(stored, view))
  }, [view, noteView])

  const p = useSharedValue(searchActive ? 1 : 0)
  const setSearchExitSettled = useSearchBarStore((s) => s.setSearchExitSettled)
  useEffect(() => {
    const target = searchMorphTarget(view)
    const animated = !reduceMotion && regionW > 0
    const publish = searchExitPublish(target, animated)
    setSearchExitSettled(publish === "settle")
    if (!animated) {
      p.value = target
      return
    }
    p.value =
      target === 1
        ? withTiming(target, { ...dockMorphInConfig(), reduceMotion: ReduceMotion.System })
        : withTiming(target, { ...dockMorphOutConfig(), reduceMotion: ReduceMotion.System }, (finished) => {
            "worklet"
            if (finished) runOnJS(setSearchExitSettled)(true)
          })
  }, [view, reduceMotion, regionW, p, setSearchExitSettled])

  const mz = useSharedValue(minimized ? 1 : 0)
  useEffect(() => {
    const target = minimized ? 1 : 0
    if (reduceMotion || regionW === 0) {
      mz.value = target
      return
    }
    mz.value = withTiming(target, { ...dockMinimizeConfig(), reduceMotion: ReduceMotion.System })
  }, [minimized, reduceMotion, regionW, mz])

  useAnimatedReaction(
    () => p.value,
    (v) => {
      dockMorphProgress.value = v
    },
  )

  const mount = useSharedValue(0)
  useEffect(() => {
    mount.value = reduceMotion ? 1 : withTiming(1, { duration: DOCK_MOUNT_MS, easing: EASING })
  }, [reduceMotion, mount])

  const visible = activeIndex >= 0
  const persistIndex = visible ? activeIndex : Math.max(activeTabIndex(prevView), 0)
  const pillIndex = visible ? activeIndex : persistIndex
  const targetX = selectedPillRect(pillIndex, tabW).x
  const tx = useSharedValue(targetX)
  const pillOp = useSharedValue(visible ? 1 : 0)

  const pillCfg = useMemo(() => tabPillConfig(), [])

  const kickedXRef = useRef<number | null>(null)

  useEffect(() => {
    if (regionW === 0 || reduceMotion) {
      kickedXRef.current = null
      tx.value = targetX
      pillOp.value = visible ? 1 : 0
      return
    }
    if (visible && kickedXRef.current === targetX) {
      kickedXRef.current = null
      return
    }
    kickedXRef.current = null
    tx.value = withTiming(targetX, pillCfg)
    pillOp.value = withTiming(visible ? 1 : 0, pillCfg)
  }, [targetX, visible, regionW, reduceMotion, tx, pillOp, pillCfg])

  const onTabPress = useCallback(
    (tab: TabDef, index: number) => {
      if (index !== activeIndex && visible && regionW > 0 && !reduceMotion) {
        const x = selectedPillRect(index, tabW).x
        kickedXRef.current = x
        tx.value = withTiming(x, pillCfg)
        pillOp.value = withTiming(1, pillCfg)
      }
      onTab(tab)
    },
    [activeIndex, visible, regionW, reduceMotion, tabW, tx, pillOp, pillCfg, onTab],
  )

  const lockOnTab = useCallback(
    (index: number) => {
      const tab = TABS[index]
      if (!tab) return
      kickedXRef.current = selectedPillRect(index, tabW).x
      onTab(tab)
    },
    [onTab, tabW],
  )
  const panLive = useSharedValue(0)
  const panArmed = visible && !searchActive && !minimized && regionW > 0
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(panArmed)
        .activeOffsetX([-6, 6])
        .failOffsetY([-16, 16])
        .onStart((e) => {
          if (sheetDockOcclusion.value > 0.01) return
          panLive.value = 1
          tx.value = pillDragRect(e.x, tabW, TAB_PILL_LOCK_COUNT).x
        })
        .onUpdate((e) => {
          if (!panLive.value) return
          tx.value = pillDragRect(e.x, tabW, TAB_PILL_LOCK_COUNT).x
        })
        .onFinalize(() => {
          if (!panLive.value) return
          panLive.value = 0
          const index = lockedIndexForPillCenter(tx.value + pillW / 2, tabW, TAB_PILL_LOCK_COUNT)
          const lockedX = selectedPillRect(index, tabW).x
          tx.value = reduceMotion ? lockedX : withTiming(lockedX, pillCfg)
          runOnJS(lockOnTab)(index)
        }),
    [panArmed, tabW, pillW, reduceMotion, pillCfg, lockOnTab, panLive, tx],
  )

  const riseRef = useRef<Animated.View>(null)
  const { riseStyle, onLayout: onRiseLayout, onFieldFocus, onFieldBlur, focusProgress, pinned } =
    useDockedSearchRise(riseRef, dockedSearch.value, dockKeyboardRestOffset(insets.bottom, DOCK_PLATFORM), searchActive, p)

  const shapes = useDerivedValue<DockShapes>(
    () => dockShapes(p.value, regionW, focusProgress.value, mz.value),
    [regionW],
  )

  useEffect(() => () => setTabBarHeight(0), [setTabBarHeight])

  const onExitSearch = () => {
    Keyboard.dismiss()
    selectView(prevView)
  }

  const onClearSearch = () => {
    dockedSearch.onClear()
    Keyboard.dismiss()
  }

  const minimizedActive = minimized && !searchActive

  const mountStyle = useAnimatedStyle(() => ({
    opacity: mount.value,
    transform: [{ scale: DOCK_MOUNT_SCALE_FROM + (1 - DOCK_MOUNT_SCALE_FROM) * mount.value }],
  }))
  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }],
    opacity: pillOp.value * (1 - windowProgress(p.value, 0, 0.35)) * (1 - mz.value),
  }))
  const restMagX = Math.max(regionW - H / 2, 0)
  const magStyle = useAnimatedStyle(() => {
    const right = shapes.value.right
    const targetX = right.x + lerp(p.value, H / 2, FIELD_PAD)
    return {
      transform: [
        { translateX: targetX - restMagX },
        { translateY: right.y + right.height / 2 - H / 2 },
      ],
    }
  })
  const dockedFieldLeft = DOCKED_MAG_X + FIELD_GUTTER
  const dockedFieldW = Math.max(regionW - dockedFieldLeft - FIELD_GUTTER, 0)
  const focusedFieldW = Math.max(regionW - DOCKED_D - G - dockedFieldLeft - space["2"], 0)
  const fieldStyle = useAnimatedStyle(() => {
    const right = shapes.value.right
    return {
      left: dockedFieldLeft,
      width: dockedFieldW + focusProgress.value * (focusedFieldW - dockedFieldW),
      transform: [{ translateY: right.y + right.height / 2 - H / 2 }],
    }
  })
  const placeholderStyle = useAnimatedStyle(() => {
    const ph = placeholderMorph(p.value)
    return { opacity: dockedSearch.value.length > 0 ? 0 : ph.opacity, transform: [{ translateX: ph.translateX }] }
  })
  const inputStyle = useAnimatedStyle(() => ({ opacity: windowProgress(p.value, 0.65, 1) }))
  const clearStyle = useAnimatedStyle(() => {
    const clear = shapes.value.clear
    return {
      opacity: focusProgress.value,
      transform: [{ translateY: clear.y + clear.height / 2 - H / 2 }],
    }
  })

  const occlusionStyle = useAnimatedStyle(() => ({
    opacity: 1 - sheetDockOcclusion.value,
    transform: [{ translateY: sheetDockOcclusion.value * DOCK_OCCLUSION_SINK }],
  }))

  return (
    <Animated.View
      style={[styles.container, { paddingBottom: dockBottomGap(insets.bottom, DOCK_PLATFORM) }, occlusionStyle]}
      onLayout={(e) => setTabBarHeight(e.nativeEvent.layout.height)}
    >
      <Animated.View ref={riseRef} onLayout={onRiseLayout} style={riseStyle}>
        <Animated.View
          style={[styles.dockRegion, mountStyle]}
          onLayout={(e) => setRegionW(e.nativeEvent.layout.width)}
        >
          <LiquidGlassDock
            regionW={regionW}
            progress={p}
            focus={focusProgress}
            minimize={mz}
            shapes={shapes}
            style={StyleSheet.absoluteFill}
          >
            {regionW > 0 ? (
              <>
                <Animated.View
                  style={[styles.pill, { width: pillW }, pillStyle]}
                  pointerEvents="none"
                />

                <GestureDetector gesture={pan}>
                  <Animated.View style={[styles.tabStrip, { width: wide }]} accessibilityRole="tablist">
                    {TABS.map((tab, i) => (
                      <MorphTab
                        key={tab.id}
                        index={i}
                        persist={i === persistIndex}
                        restCenterX={i * tabW + tabW / 2}
                        shapes={shapes}
                        tabW={tabW}
                        tab={tab}
                        icon={tab.icon}
                        label={t(tab.labelKey)}
                        active={i === activeIndex}
                        interactive={!searchActive && !minimizedActive}
                        onTab={onTabPress}
                        p={p}
                        mz={mz}
                      />
                    ))}
                  </Animated.View>
                </GestureDetector>

                <Pressable
                  onPress={resetMinimize}
                  accessibilityRole="button"
                  accessibilityLabel={t("a11y.show_tab_bar")}
                  pointerEvents={minimizedActive ? "auto" : "none"}
                  {...a11yReachableWhen(minimizedActive)}
                  style={styles.exitHit}
                />

                <Pressable
                  onPress={onExitSearch}
                  accessibilityRole="button"
                  accessibilityLabel={tSearch("a11y.home")}
                  pointerEvents={searchActive ? "auto" : "none"}
                  {...a11yReachableWhen(searchActive)}
                  style={styles.exitHit}
                />

                <Pressable
                  onPress={onSearch}
                  accessibilityRole="button"
                  accessibilityState={{ selected: searchActive }}
                  accessibilityLabel={t("tab.search")}
                  pointerEvents={searchActive ? "none" : "auto"}
                  {...a11yReachableWhen(!searchActive)}
                  style={[styles.orbHit, { left: regionW - H, width: H }]}
                />

                <Animated.View
                  style={[styles.magnifier, { left: restMagX - ICON_SIZE / 2 }, magStyle]}
                  pointerEvents="none"
                >
                  <Icon icon={iconMap.Search} size={ICON_SIZE} strokeWidth={ICON_STROKE} color={th.colors.textMuted} />
                </Animated.View>

                <Animated.View
                  style={[styles.field, fieldStyle]}
                  pointerEvents={searchActive ? "auto" : "none"}
                  {...a11yReachableWhen(searchActive)}
                >
                  <Animated.View style={[StyleSheet.absoluteFill, inputStyle]}>
                    <TextInput
                      value={dockedSearch.value}
                      placeholder=""
                      accessibilityLabel={dockedSearch.placeholder}
                      style={styles.input}
                      returnKeyType="search"
                      editable={searchActive}
                      onChangeText={dockedSearch.onChangeText}
                      onFocus={() => {
                        onFieldFocus()
                        dockedSearch.onFocus()
                      }}
                      onBlur={onFieldBlur}
                    />
                  </Animated.View>
                  <Animated.Text
                    style={[styles.placeholderLabel, placeholderStyle]}
                    numberOfLines={1}
                    pointerEvents="none"
                    accessibilityElementsHidden
                    importantForAccessibility="no"
                  >
                    {dockedSearch.placeholder}
                  </Animated.Text>
                </Animated.View>

                <Animated.View style={[styles.clear, clearStyle]} pointerEvents={pinned ? "auto" : "none"} {...a11yReachableWhen(pinned)}>
                  <Pressable
                    onPress={onClearSearch}
                    accessibilityRole="button"
                    accessibilityLabel={tSearch("a11y.clear")}
                    hitSlop={8}
                    style={styles.clearHit}
                  >
                    <Icon icon={iconMap.Close} size={20} strokeWidth={ICON_STROKE} color={th.colors.textMuted} />
                  </Pressable>
                </Animated.View>
              </>
            ) : null}
          </LiquidGlassDock>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: t.space["5"],
    paddingTop: t.space["2"],
    pointerEvents: "box-none",
  },
  dockRegion: {
    height: H,
    justifyContent: "center",
  },
  tabStrip: {
    position: "absolute",
    top: 0,
    left: 0,
    height: H,
  },
  tabHit: {
    position: "absolute",
    top: 0,
    height: H,
  },
  iconBox: {
    position: "absolute",
    top: ICON_CENTER_Y - ICON_SIZE / 2,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
    height: ICON_SIZE,
  },
  pill: {
    position: "absolute",
    top: PILL_TOP,
    left: 0,
    height: PILL_HEIGHT,
    borderRadius: PILL_HEIGHT / 2,
    backgroundColor: t.glass.dock.selected,
  },
  exitHit: {
    position: "absolute",
    top: 0,
    left: 0,
    width: H,
    height: H,
  },
  orbHit: {
    position: "absolute",
    top: 0,
    height: H,
  },
  magnifier: {
    position: "absolute",
    top: H / 2 - ICON_SIZE / 2,
    width: ICON_SIZE,
    height: ICON_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  field: {
    position: "absolute",
    top: H / 2 - FIELD_H / 2,
    height: FIELD_H,
    justifyContent: "center",
  },
  placeholderLabel: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["15"],
    color: t.colors.textSubtle,
  },
  input: {
    flex: 1,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["15"],
    color: t.colors.text,
    padding: 0,
  },
  clear: {
    position: "absolute",
    top: H / 2 - CLEAR_BUTTON_SIZE / 2,
    right: (DOCKED_D - CLEAR_BUTTON_SIZE) / 2,
    width: CLEAR_BUTTON_SIZE,
    height: CLEAR_BUTTON_SIZE,
  },
  clearHit: {
    width: CLEAR_BUTTON_SIZE,
    height: CLEAR_BUTTON_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
}))
