import React from "react"
import { View, Pressable } from "react-native"
import { formatCertificateCode } from "@civfix/shared"
import { webSelectableText, focusRingProps } from "../../../theme"
import { Text, Icon, iconMap } from "../../../typography"
import { useT } from "../../../i18n"
import { useCertificateCardStyles } from "./certificateCardStyles"

export function CertificateCopyButton({
  onPress,
  color,
}: {
  onPress: () => void
  color: string
}) {
  const styles = useCertificateCardStyles()
  const { t } = useT("volunteer-hours")
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={t("transcript.copy_a11y")}
      {...focusRingProps}
      style={({ pressed }) => [styles.copyBtn, pressed ? styles.pressedDim : null]}
    >
      <Icon icon={iconMap.Copy} size={14} color={color} />
    </Pressable>
  )
}

/** The copy button sits BESIDE the code, never wrapping it: no nested Pressable in the sheet. */
export function CertificateCode({
  code,
  canCopy,
  onCopy,
  copyColor,
}: {
  code: string
  canCopy: boolean
  onCopy: (text: string) => void
  copyColor: string
}) {
  const styles = useCertificateCardStyles()
  const { t } = useT("volunteer-hours")
  const formatted = formatCertificateCode(code)
  return (
    <View style={styles.codeRow}>
      <Text
        style={[styles.code, webSelectableText]}
        accessibilityLabel={t("transcript.code_a11y", { code: formatted })}
      >
        {t("transcript.code", { code: formatted })}
      </Text>
      {canCopy ? <CertificateCopyButton onPress={() => onCopy(formatted)} color={copyColor} /> : null}
    </View>
  )
}
