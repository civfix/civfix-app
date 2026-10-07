import React from "react"
import {
  View,
  Pressable,
  Image,
  Linking,
  StyleSheet,
  type LayoutChangeEvent,
} from "react-native"
import {
  makeThemedStyles,
  useTheme,
  focusRingProps,
  headingLevel,
  linkKeyProps,
  webCursor,
  webTransition,
  webHover,
  HOVERED_OPACITY,
  PRESSED_OPACITY,
} from "../theme"
import { Text, Icon, iconMap } from "../typography"
import { useT } from "../i18n"
import { useOpenExternal } from "../capabilities"
import { useToast } from "../primitives/toastContext"
import { useAppPromo } from "./useAppPromo"
import { useAppPromoStore } from "./appPromoStore"
import type { AppStore } from "./platform"

// The store badge artwork's own aspect, not a spacing value.
const BADGE_HEIGHT = 40
const BADGE_WIDTH: Record<AppStore, number> = {
  "app-store": 120,
  "google-play": 135,
}

const DISMISS_SIZE = 32
const DISMISS_HIT_SLOP = 6
const DISMISS_ICON_SIZE = 15
const DISMISS_PRESSED_OPACITY = 0.55
const TITLE_LETTER_SPACING = -0.15
const BODY_FONT_SIZE = 12.5

export function AppPromoCard() {
  const styles = useStyles()
  const th = useTheme()
  const { surface, links, dismiss } = useAppPromo()
  const setCardHeight = useAppPromoStore((s) => s.setCardHeight)
  const { t } = useT("web-common")
  const openExternal = useOpenExternal()
  const toast = useToast()

  const visible = surface === "card"

  const openStore = React.useCallback(
    (href: string) => {
      const opening = openExternal ? openExternal.open(href) : Linking.openURL(href)
      opening.catch(() => {
        toast.show(t("app_promo.open_failed"), { variant: "error" })
      })
    },
    [openExternal, toast, t],
  )

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
          hitSlop={DISMISS_HIT_SLOP}
          {...focusRingProps}
          style={(state) => [
            styles.dismiss,
            webCursor(),
            webTransition,
            webHover(state) ? styles.hovered : null,
            state.pressed ? styles.dismissPressed : null,
          ]}
        >
          <Icon icon={iconMap.Close} size={DISMISS_ICON_SIZE} color={th.colors.textMuted} />
        </Pressable>
      </View>

      <Text style={styles.body}>{t("app_promo.card_body")}</Text>

      <View style={styles.badges}>
        {links.map((link) => (
          <Pressable
            key={link.store}
            onPress={() => openStore(link.href)}
            accessibilityRole="link"
            accessibilityLabel={t(link.labelKey)}
            {...linkKeyProps(() => openStore(link.href))}
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
              style={{ width: BADGE_WIDTH[link.store], height: BADGE_HEIGHT }}
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
    paddingBottom: t.space["3"],
    paddingHorizontal: t.space["4"],
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
    fontSize: t.fontSize["15"],
    color: t.colors.text,
    letterSpacing: TITLE_LETTER_SPACING,
  },
  dismiss: {
    width: DISMISS_SIZE,
    height: DISMISS_SIZE,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: t.radius.pill,
  },
  dismissPressed: {
    opacity: DISMISS_PRESSED_OPACITY,
  },
  hovered: {
    opacity: HOVERED_OPACITY,
  },
  body: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: BODY_FONT_SIZE,
    color: t.colors.textSubtle,
    marginBottom: 10,
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: t.space["2"],
    paddingBottom: t.space["1"],
  },
  badge: {
    borderRadius: t.radius.xs,
  },
  badgePressed: {
    opacity: PRESSED_OPACITY,
  },
}))
