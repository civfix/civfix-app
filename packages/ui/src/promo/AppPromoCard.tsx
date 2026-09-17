import React from "react"
import {
  View,
  Pressable,
  Image,
  Linking,
  StyleSheet,
  type LayoutChangeEvent,
} from "react-native"
import { makeThemedStyles, useTheme, focusRingProps, headingLevel, webCursor, webTransition, webHover } from "../theme"
import { Text, Icon, iconMap } from "../typography"
import { useT } from "../i18n"
import { useAppPromo } from "./useAppPromo"
import { useAppPromoStore } from "./appPromoStore"
import { linkKeyProps } from "../bodies/PostCard"

const BADGE_HEIGHT = 40
const BADGE_WIDTH: Record<string, number> = {
  "app-store": 120,
  "google-play": 135,
}

export function AppPromoCard() {
  const styles = useStyles()
  const th = useTheme()
  const { surface, links, dismiss } = useAppPromo()
  const setCardHeight = useAppPromoStore((s) => s.setCardHeight)
  const { t } = useT("web-common")

  const visible = surface === "card"

  const onLayout = React.useCallback(
    (e: LayoutChangeEvent) => setCardHeight(e.nativeEvent.layout.height),
    [setCardHeight],
  )

  React.useEffect(() => {
    if (!visible) setCardHeight(0)
    return () => setCardHeight(0)
  }, [visible, setCardHeight])

  if (!visible) return null

  return (
    <View style={styles.section} onLayout={onLayout}>
      <View style={styles.head}>
        <Text style={styles.title} accessibilityRole="header" {...headingLevel(2)}>
          {t("app_promo.card_title")}
        </Text>
        <Pressable
          onPress={dismiss}
          accessibilityRole="button"
          accessibilityLabel={t("app_promo.dismiss")}
          hitSlop={6}
          {...focusRingProps}
          style={(state) => [
            styles.dismiss,
            webCursor(),
            webTransition,
            webHover(state) ? styles.hovered : null,
            state.pressed ? styles.dismissPressed : null,
          ]}
        >
          <Icon icon={iconMap.Close} size={15} color={th.colors.textMuted} />
        </Pressable>
      </View>

      <Text style={styles.body}>{t("app_promo.card_body")}</Text>

      <View style={styles.badges}>
        {links.map((link) => (
          <Pressable
            key={link.store}
            onPress={() => void Linking.openURL(link.href)}
            accessibilityRole="link"
            accessibilityLabel={t(link.labelKey)}
            {...linkKeyProps(() => void Linking.openURL(link.href))}
            {...focusRingProps}
            style={(state) => [
              styles.badge,
              webCursor(),
              webTransition,
              webHover(state) ? styles.hovered : null,
              state.pressed ? styles.badgePressed : null,
            ]}
          >
            <Image
              source={{ uri: link.badgeSrc }}
              style={{ width: BADGE_WIDTH[link.store] ?? 120, height: BADGE_HEIGHT }}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
            />
          </Pressable>
        ))}
      </View>
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  section: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 11,
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: t.colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: t.colors.border,
    shadowColor: t.colors.shadowColor,
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
    elevation: 3,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  title: {
    fontFamily: t.fontFamily.displayBold,
    fontSize: 15,
    color: t.colors.text,
    letterSpacing: -0.15,
  },
  dismiss: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: t.radius.pill,
  },
  dismissPressed: {
    opacity: 0.55,
  },
  hovered: {
    opacity: 0.85,
  },
  body: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 12.5,
    color: t.colors.textSubtle,
    marginBottom: 10,
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingBottom: 4,
  },
  badge: {
    borderRadius: t.radius.xs,
  },
  badgePressed: {
    opacity: 0.7,
  },
}))
