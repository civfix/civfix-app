/**
 * The 404 for an app link to a path the app has no screen for (an unknown
 * `civfix://` path reaches here; unknown civfix.org links still go home).
 * The React Native port of community-web's 404: one of three stages, picked at
 * random on every mount, with the copy from the shared `not-found` catalog.
 */
import React, { useCallback, useState } from "react"
import { Pressable, View } from "react-native"
import { useRouter } from "expo-router"
import { ScrollView } from "react-native-gesture-handler"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { PrimaryButton, Text, useNavStore } from "@civfix/ui"
import { useT } from "@civfix/ui/i18n"
import { lineHeight, makeThemedStyles, useReducedMotion, useTheme } from "@/theme"
import { Wordmark } from "@/components/Wordmark"
import { PotholeStage } from "@/components/notFound/PotholeStage"
import { SignStage } from "@/components/notFound/SignStage"
import { TilesStage } from "@/components/notFound/TilesStage"
import { goToMap } from "@/lib/goHome"
import { pickNotFoundVariant, type NotFoundVariant } from "@/lib/notFoundVariant"

const STAGES: Record<NotFoundVariant, React.ComponentType<{ live: boolean }>> = {
  tiles: TilesStage,
  pothole: PotholeStage,
  sign: SignStage,
}

// The phone geometry of community-web's not-found.css.
const STAGE_HEIGHT = 240
const EYEBROW_TRACKING = 0.08

export default function NotFoundScreen() {
  const { t } = useT("not-found")
  const styles = useStyles()
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const [variant] = useState(pickNotFoundVariant)
  const reduced = useReducedMotion()
  const Stage = STAGES[variant]

  const home = useCallback(() => goToMap(router, useNavStore.getState()), [router])

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top, paddingBottom: insets.bottom, paddingLeft: insets.left, paddingRight: insets.right },
      ]}
    >
      <View style={styles.top}>
        <Pressable
          onPress={home}
          accessibilityRole="link"
          accessibilityLabel={t("home_label")}
          hitSlop={theme.space["2"]}
          style={styles.homeLink}
        >
          <Wordmark size={theme.fontSize["24"]} />
        </Pressable>
      </View>
      {/* The stage mounts once the motion preference is known, so it starts in the right mode. */}
      <View style={[styles.body, reduced === null ? styles.pending : null]}>
        <View style={styles.stage} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {reduced === null ? null : <Stage live={!reduced} />}
        </View>
        <View style={styles.copy}>
          <Text style={styles.eyebrow} color={theme.colors.textSubtle}>
            {t("eyebrow")}
          </Text>
          <Text variant="display" accessibilityRole="header" textBreakStrategy="balanced" style={styles.headline}>
            {t(`variants.${variant}.headline`)}
          </Text>
          <Text style={styles.supporting} color={theme.colors.textMuted}>
            {t(`variants.${variant}.supporting`)}
          </Text>
          <PrimaryButton label={t("cta")} onPress={home} style={styles.cta} />
        </View>
      </View>
    </ScrollView>
  )
}

const useStyles = makeThemedStyles((t) => ({
  page: {
    flex: 1,
    backgroundColor: t.colors.bg,
  },
  content: {
    flexGrow: 1,
  },
  top: {
    paddingVertical: t.space["4"],
    paddingHorizontal: t.space["5"],
    alignItems: "flex-start",
  },
  homeLink: {
    borderRadius: t.radius.sm,
  },
  body: {
    flex: 1,
    alignItems: "center",
    gap: t.space["6"],
    paddingTop: t.space["6"],
    paddingHorizontal: t.space["5"],
    paddingBottom: t.space["16"],
  },
  pending: {
    opacity: 0,
  },
  stage: {
    width: "100%",
    height: STAGE_HEIGHT,
  },
  copy: {
    alignItems: "center",
    gap: t.space["3"],
  },
  eyebrow: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: t.fontSize["12"],
    letterSpacing: t.fontSize["12"] * EYEBROW_TRACKING,
    textTransform: "uppercase",
    textAlign: "center",
  },
  headline: {
    lineHeight: t.fontSize["30"] * lineHeight.snug,
    textAlign: "center",
  },
  supporting: {
    fontSize: t.fontSize["16"],
    lineHeight: t.fontSize["16"] * lineHeight.base,
    textAlign: "center",
  },
  cta: {
    marginTop: t.space["3"],
  },
}))
