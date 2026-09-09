import React from "react"
import { Pressable, View } from "react-native"
import { makeThemedStyles, useTheme } from "@/theme"
import { Text, PrimaryButton } from "@civfix/ui"
import { useT } from "@civfix/ui/i18n"

export function OnboardingFooter({
  canGoBack,
  onNext,
  onBack,
}: {
  canGoBack: boolean
  onNext: () => void
  onBack: () => void
}) {
  const { t } = useT("mobile-onboarding")
  const th = useTheme()
  const styles = useStyles()
  return (
    <View style={styles.footer}>
      <PrimaryButton
        label={t("nav.next")}
        accessibilityLabel={t("a11y.next")}
        onPress={onNext}
      />
      <View style={styles.backSlot}>
        {canGoBack ? (
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel={t("a11y.back")}
            style={({ pressed }) => [styles.back, pressed ? styles.pressed : null]}
          >
            <Text variant="bodyStrong" color={th.colors.textMuted}>
              {t("nav.back")}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  footer: {
    paddingHorizontal: t.space["5"],
    gap: t.space["1"],
  },
  backSlot: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  back: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: t.space["4"],
  },
  pressed: {
    opacity: 0.7,
  },
}))
