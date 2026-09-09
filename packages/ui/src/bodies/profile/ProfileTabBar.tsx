/**
 * The shared profile tab bar - ONE control on both profiles (own `ProfileView`, other-person
 * `PersonDetailBody`). The pill track is the existing house vocabulary, lifted from
 * `PersonDetailBody.styles.sectionTabs`, which is also what `ProfileEventsSection` and
 * `CleanupForm.KindSelector` already use.
 *
 * MOTION: none. The tab swap is a content replace, and a slide here would fight `BodyTransition`.
 *
 * `minHeight`, NOT `height`: "Publicaciones" is not the only label that needs a second line of headroom
 * on a 4-up track at 375pt, and a fixed height clips it instead of growing.
 *
 * THE TRACK IS LABELLED because it is not the only tablist on screen: with `events` active, the profile
 * renders `ProfileEventsSection`, which opens its OWN `accessibilityRole="tablist"` (Hosting / Going)
 * directly underneath. Two nested tab groups, one of them unnamed, is what a screen reader announces
 * without `tabs.a11y` here - the inner one has carried `events.section` since it shipped.
 *
 * The explicit `aria-selected` beside `accessibilityState` is not belt-and-braces: react-native-web drops
 * `accessibilityState` for the `tab` role, so without it a screen reader on web announces four tabs and
 * none of them selected. Same fix the feed's filter tabs already carry.
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
          // 34pt of pill + 5pt top/bottom = the 44pt floor, without growing the track. VERTICAL only:
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
    padding: 4,
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
    // minHeight, not height: locale wrap headroom.
    minHeight: 34,
    paddingVertical: t.space["2"],
    paddingHorizontal: 4,
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
    fontSize: 13,
    lineHeight: 17,
    color: t.colors.textSubtle,
  },
  textOn: {
    color: t.colors.text,
  },
}))
