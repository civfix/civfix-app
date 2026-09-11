import React, { useEffect, useState } from "react"
import { View, type ViewStyle } from "react-native"
import { theme, useTheme } from "../theme"
import { useTabBarStore } from "./tabBarStore"
import { compactBottomChrome, tabDividerRect, tabPillTransition } from "./tabBarLogic"
import { SearchHeader } from "./SearchHeader.web"
import {
  TABS,
  TAB_COUNT,
  BAR_HEIGHT,
  PILL_INSET,
  useTabBarModel,
  useDockedSearchModel,
  TabButton,
  SearchOrb,
  BarGlass,
  useTabBarStyles,
} from "./TabBar.shared"
import { prefersReducedMotion } from "./webMedia"

export function TabBar() {
  const styles = useTabBarStyles()
  const th = useTheme()
  const { view, activeIndex, searchActive, onTab, onSearch } = useTabBarModel()
  const dockedSearch = useDockedSearchModel()
  const setTabBarHeight = useTabBarStore((s) => s.setTabBarHeight)

  const [barW, setBarW] = useState(0)
  const tabW = barW / TAB_COUNT
  const pillW = Math.max(tabW - PILL_INSET * 2, 0)
  const visible = activeIndex >= 0
  const targetX = (visible ? activeIndex : 0) * tabW + PILL_INSET

  const pillStyle = {
    width: pillW,
    transform: `translateX(${targetX}px)`,
    opacity: visible ? 1 : 0,
    transition: tabPillTransition(prefersReducedMotion()),
  } as unknown as ViewStyle

  useEffect(() => () => setTabBarHeight(0), [setTabBarHeight])

  const divider = tabDividerRect(tabW, BAR_HEIGHT)

  const containerStyle = [styles.container, { paddingBottom: theme.space["3"] }]

  if (compactBottomChrome(view) === "docked-search") {
    return (
      <View style={containerStyle} onLayout={(e) => setTabBarHeight(e.nativeEvent.layout.height)}>
        <SearchHeader {...dockedSearch} docked />
      </View>
    )
  }

  return (
    <View
      style={containerStyle}
      onLayout={(e) => setTabBarHeight(e.nativeEvent.layout.height)}
    >
      <View style={[styles.bar, th.shadows.s3]} onLayout={(e) => setBarW(e.nativeEvent.layout.width)}>
        <BarGlass />
        {barW > 0 ? <View style={[styles.pill, pillStyle]} /> : null}
        {barW > 0 ? (
          <View
            style={[styles.divider, { left: divider.left, top: divider.top, height: divider.height }]}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
        ) : null}
        <View style={styles.row}>
          {TABS.map((tab, i) => (
            <TabButton
              key={tab.id}
              tab={tab}
              active={i === activeIndex}
              onPress={() => onTab(tab)}
            />
          ))}
        </View>
      </View>
      <SearchOrb active={searchActive} onPress={onSearch} />
    </View>
  )
}
