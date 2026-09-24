import React from "react"
import { View, Pressable } from "react-native"
import { focusRingProps } from "../../../theme"
import { Text } from "../../../typography"
import { useT } from "../../../i18n"
import {
  CONFIRM_BTN_HIT_SLOP,
  REVOKE_LINK_HIT_SLOP,
  useCertificateCardStyles,
} from "./certificateCardStyles"

/**
 * Revoke is the ONLY control over a code that has already been handed to a registrar, so it is a
 * first-class (if low-emphasis) action rather than a hidden one. The confirm is an INLINE two-button block:
 * a `Modal` inside the profile sheet is the banned pattern.
 */
export function CertificateRevokeControl({
  confirming,
  pending,
  onAskConfirm,
  onCancel,
  onConfirm,
}: {
  confirming: boolean
  pending: boolean
  onAskConfirm: () => void
  onCancel: () => void
  onConfirm: () => void
}) {
  const styles = useCertificateCardStyles()
  const { t } = useT("volunteer-hours")

  if (!confirming) {
    return (
      <Pressable
        onPress={onAskConfirm}
        accessibilityRole="button"
        accessibilityLabel={t("transcript.revoke_a11y")}
        hitSlop={REVOKE_LINK_HIT_SLOP}
        {...focusRingProps}
        style={({ pressed }) => [styles.revokeLink, pressed ? styles.pressedDim : null]}
      >
        <Text style={styles.revokeLinkText}>{t("transcript.revoke")}</Text>
      </Pressable>
    )
  }

  return (
    <View style={styles.confirm}>
      <Text style={styles.confirmBody}>{t("transcript.revoke_confirm")}</Text>
      <View style={styles.confirmActions}>
        <Pressable
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel={t("transcript.revoke_cancel")}
          hitSlop={CONFIRM_BTN_HIT_SLOP}
          {...focusRingProps}
          style={({ pressed }) => [styles.confirmKeep, pressed ? styles.pressedDim : null]}
        >
          <Text style={styles.confirmKeepText}>{t("transcript.revoke_cancel")}</Text>
        </Pressable>
        <Pressable
          onPress={onConfirm}
          disabled={pending}
          accessibilityRole="button"
          accessibilityLabel={t("transcript.revoke_ok")}
          accessibilityState={{ busy: pending }}
          hitSlop={CONFIRM_BTN_HIT_SLOP}
          {...focusRingProps}
          style={({ pressed }) => [styles.confirmRevoke, pressed ? styles.pressedDim : null]}
        >
          <Text style={styles.confirmRevokeText}>{t("transcript.revoke_ok")}</Text>
        </Pressable>
      </View>
    </View>
  )
}
