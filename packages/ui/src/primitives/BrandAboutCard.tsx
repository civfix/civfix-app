import React, { useEffect, useRef } from "react"
import { Animated, Easing, Pressable, ScrollView, StyleSheet, View } from "react-native"
import { makeThemedStyles, useTheme, focusRingProps, webScrimProps } from "../theme"
import { Text, Icon, iconMap } from "../typography"
import { useOpenExternal } from "../capabilities"
import { useT } from "../i18n"
import { Brand } from "./Brand"
import { DONATE_URL, PRIVACY_URL, TERMS_URL, sourceUrl } from "./externalUrls"

/**
 * Zero-width non-joiner (U+200C). Interpolated into the eyebrow's `{{zwnj}}` slot (between "(" and "c") so
 * the font cannot fuse the "(c)" sequence into a single copyright glyph; the line then shows a literal
 * "501(c)(3)". Built from its code point (not a literal char) so it stays visible/reviewable in source.
 */
const ZWNJ = String.fromCharCode(0x200c)

export interface BrandAboutCardProps {
  onClose: () => void
}

export function BrandAboutCard({ onClose }: BrandAboutCardProps) {
  const styles = useStyles()
  const th = useTheme()
  const openExternal = useOpenExternal()
  const { t } = useT("about")

  const progress = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start()
  }, [progress])

  const donate = () => {
    void openExternal?.open(DONATE_URL)
  }

  const openLegal = (url: string) => {
    void openExternal?.open(url)
  }

  const cardTransform = [
    { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) },
    { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
  ]

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, { opacity: progress }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel={t("close")}
          onPress={onClose}
          {...webScrimProps}
        />
      </Animated.View>

      <View style={styles.center} pointerEvents="box-none">
        <Animated.View style={[styles.card, { opacity: progress, transform: cardTransform }]}>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t("close")}
            hitSlop={8}
            {...focusRingProps}
            style={({ pressed }) => [styles.close, pressed ? styles.closePressed : null]}
          >
            <Icon icon={iconMap.Close} size={17} color={th.colors.textSubtle} />
          </Pressable>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <Brand size={40} />
            <Text style={styles.eyebrow}>{t("eyebrow", { zwnj: ZWNJ })}</Text>
            <Text style={styles.lede}>{t("lede")}</Text>

            <Pressable
              onPress={donate}
              accessibilityRole="button"
              accessibilityLabel={t("support_civfix_a11y")}
              {...focusRingProps}
              style={({ pressed }) => [styles.donate, pressed ? styles.donatePressed : null]}
            >
              <Text style={styles.donateText}>{t("support_civfix")}</Text>
              <Icon icon={iconMap.ArrowRight} size={17} color={th.colors.onAccent} />
            </Pressable>

            <View style={styles.legalRow}>
              <Pressable
                onPress={() => openLegal(TERMS_URL)}
                accessibilityRole="link"
                accessibilityLabel={t("legal.terms_a11y")}
                hitSlop={6}
              {...focusRingProps}
              >
                <Text style={styles.legalLink}>{t("legal.terms")}</Text>
              </Pressable>
              <Text style={styles.legalDot}>·</Text>
              <Pressable
                onPress={() => openLegal(PRIVACY_URL)}
                accessibilityRole="link"
                accessibilityLabel={t("legal.privacy_a11y")}
                hitSlop={6}
              {...focusRingProps}
              >
                <Text style={styles.legalLink}>{t("legal.privacy")}</Text>
              </Pressable>
              <Text style={styles.legalDot}>·</Text>
              <Pressable
                onPress={() => openLegal(sourceUrl())}
                accessibilityRole="link"
                accessibilityLabel={t("legal.source_a11y")}
                hitSlop={6}
              {...focusRingProps}
              >
                <Text style={styles.legalLink}>{t("legal.source")}</Text>
              </Pressable>
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  scrim: {
    backgroundColor: t.colors.scrim,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: t.space["5"],
  },
  card: {
    width: "100%",
    maxWidth: 340,
    maxHeight: "86%",
    backgroundColor: t.colors.surface,
    borderRadius: t.radius.xl,
    overflow: "hidden",
    ...t.shadows.s4,
  },
  body: {
    flexGrow: 0,
  },
  bodyContent: {
    paddingTop: 30,
    paddingHorizontal: t.space["6"],
    paddingBottom: t.space["5"] + 2,
  },
  close: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.bgAlt,
    zIndex: 2,
  },
  closePressed: {
    opacity: 0.8,
    transform: [{ scale: 0.92 }],
  },
  eyebrow: {
    fontFamily: t.fontFamily.bodyExtraBold,
    fontSize: 10.5,
    letterSpacing: 0.7,
    color: t.colors.textSubtle,
    marginTop: -t.space["1"],
  },
  lede: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 14,
    lineHeight: 21,
    color: t.colors.textMuted,
    marginTop: t.space["4"],
    marginBottom: t.space["5"],
  },
  donate: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    height: 50,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.brand.bloom,
    ...t.shadows.pin,
  },
  donatePressed: {
    opacity: 0.95,
    transform: [{ scale: 0.98 }],
  },
  donateText: {
    fontFamily: t.fontFamily.bodyExtraBold,
    fontSize: 15.5,
    color: t.colors.onAccent,
  },
  legalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: t.space["4"],
  },
  legalLink: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 12.5,
    color: t.colors.textSubtle,
    textDecorationLine: "underline",
  },
  legalDot: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 12.5,
    color: t.colors.textSubtle,
  },
}))
