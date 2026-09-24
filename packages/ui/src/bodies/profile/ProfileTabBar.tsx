/**
 * No tab-swap motion: the swap is a content replace, and a slide here would fight `BodyTransition`.
 *
 * `minHeight`, not `height`: "Publicaciones" is not the only label that needs a second line of headroom
 * on a 4-up track at 375pt, and a fixed height clips it instead of growing.
 *
 * The track is labelled because it is not the only tablist on screen: with `events` active,
 * `ProfileEventsSection` opens its own tablist (Upcoming / Past) directly underneath, labelled
 * `events.section`. Without `tabs.a11y` a screen reader would announce two nested tab groups, one unnamed.
 *
 * react-native-web drops `accessibilityState` for the `tab` role, so the explicit `aria-selected` is
 * what lets a web screen reader announce which tab is selected.
 */
import React from "react"
import { View, Pressable } from "react-native"
import { makeThemedStyles, webCursorPointer, webTransition, focusRingProps } from "../../theme"
import { Text } from "../../typography"
import { useT } from "../../i18n"
import type { ProfileTabId, ProfileTabsModel } from "../profileTabsModel"

/** Deliberately SHORT strings - see the `profile-view:tabs.*` catalog entries. */
const LABEL_KEY: Record<ProfileTabId, string> = {
  posts: "tabs.posts",
  events: "tabs.events",
  hours: "tabs.hours",
  reports: "tabs.reports",
}

export interface ProfileTabBarProps {
  model: ProfileTabsModel
  onSelect: (id: ProfileTabId) => void
}

export function ProfileTabBar({ model, onSelect }: ProfileTabBarProps) {
  const styles = useStyles()
  const { t } = useT("profile-view")
  return (
    <View style={styles.track} accessibilityRole={model.role} accessibilityLabel={t("tabs.a11y")}>
      {model.tabs.map((tab) => (
        <Pressable
          key={tab.id}
          onPress={() => onSelect(tab.id)}
          accessibilityRole={tab.role}
          accessibilityState={{ selected: tab.selected }}
          {...({ "aria-selected": tab.selected } as object)}
          {...focusRingProps}
          // 34pt of pill + 5pt top/bottom reaches the 44pt floor without growing the track. Vertical only:
          // the tabs are `flex: 1` neighbours, so horizontal slop would overlap the next tab's region.
          hitSlop={{ top: 5, bottom: 5 }}
          style={({ pressed }) => [
            styles.tab,
            webCursorPointer,
            webTransition,
            tab.selected ? styles.tabOn : null,
            pressed && !tab.selected ? styles.tabPressed : null,
          ]}
        >
          <Text style={[styles.text, tab.selected ? styles.textOn : null]} numberOfLines={1}>
            {t(LABEL_KEY[tab.id])}
          </Text>
        </Pressable>
      ))}
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  track: {
    flexDirection: "row",
    padding: t.space["1"],
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.bgAlt,
    marginTop: t.space["5"],
    marginBottom: t.space["4"],
  },
  tab: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 34,
    paddingVertical: t.space["2"],
    paddingHorizontal: t.space["1"],
    borderRadius: t.radius.pill,
  },
  tabOn: {
    backgroundColor: t.colors.surface,
    ...t.shadows.s1,
  },
  tabPressed: {
    opacity: 0.7,
  },
  text: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: t.fontSize["13"],
    lineHeight: 17,
    color: t.colors.textSubtle,
  },
  textOn: {
    color: t.colors.text,
  },
}))
