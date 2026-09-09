import React from "react"
import { Pressable } from "react-native"
import { ModalCardSheet, PrimaryButton, SecondaryButton, Text } from "@civfix/ui"
import { useT } from "@civfix/ui/i18n"
import { makeThemedStyles, useTheme } from "@/theme"

export interface LocationPrimerSheetProps {
  visible: boolean
  onUseLocation: () => void
  onEnterAddress: () => void
  onLater: () => void
}

export function LocationPrimerSheet({
  visible,
  onUseLocation,
  onEnterAddress,
  onLater,
}: LocationPrimerSheetProps) {
  const { t } = useT("mobile-onboarding")
  const th = useTheme()
  const styles = useStyles()

  return (
    <ModalCardSheet
      visible={visible}
      onClose={onLater}
      onCommit={onUseLocation}
      headerIcon="MapPin"
      headerIconColor={th.colors.accent}
      title={t("location.title")}
      dismissLabel={t("location.a11y_dismiss")}
      actions={
        <>
          <SecondaryButton label={t("location.address")} onPress={onEnterAddress} size="sm" />
          <PrimaryButton label={t("location.use")} onPress={onUseLocation} />
        </>
      }
    >
      <Text variant="body" color={th.colors.textMuted}>
        {t("location.body")}
      </Text>

      <Pressable
        onPress={onLater}
        accessibilityRole="button"
        accessibilityLabel={t("location.later")}
        style={styles.later}
      >
        <Text variant="caption" color={th.colors.textSubtle}>
          {t("location.later")}
        </Text>
      </Pressable>
    </ModalCardSheet>
  )
}

const useStyles = makeThemedStyles(() => ({
  later: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
}))
