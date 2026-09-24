import React from "react"
import { Pressable, View } from "react-native"
import { ModalCardSheet, PrimaryButton, Text, iconMap } from "@civfix/ui"
import { useT } from "@civfix/ui/i18n"
import { PRESSED_OPACITY, makeThemedStyles, useTheme } from "@/theme"

export interface LocationPrimerSheetProps {
  visible: boolean
  onUseLocation: () => void
  onApproximate: () => void
}

export function LocationPrimerSheet({
  visible,
  onUseLocation,
  onApproximate,
}: LocationPrimerSheetProps) {
  const { t } = useT("mobile-onboarding")
  const th = useTheme()
  const styles = useStyles()

  return (
    <ModalCardSheet
      visible={visible}
      onClose={onApproximate}
      onCommit={onUseLocation}
      headerIcon="MapPin"
      headerIconColor={th.colors.accent}
      title={t("location.title")}
      dismissLabel={t("location.a11y_dismiss")}
      actions={
        <View style={styles.stack}>
          <PrimaryButton label={t("location.use")} icon={iconMap.Navigation} onPress={onUseLocation} />
          <Pressable
            onPress={onApproximate}
            accessibilityRole="button"
            accessibilityLabel={t("location.approximate")}
            style={({ pressed }) => [styles.later, pressed ? styles.laterPressed : null]}
          >
            <Text variant="label" color={th.colors.textMuted}>
              {t("location.approximate")}
            </Text>
          </Pressable>
        </View>
      }
    >
      <Text variant="body" color={th.colors.textMuted}>
        {t("location.body")}
      </Text>
    </ModalCardSheet>
  )
}

const useStyles = makeThemedStyles((t) => ({
  stack: {
    flex: 1,
    gap: t.space["3"],
    paddingTop: t.space["1"],
  },
  later: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: t.radius.pill,
  },
  laterPressed: {
    opacity: PRESSED_OPACITY,
  },
}))
