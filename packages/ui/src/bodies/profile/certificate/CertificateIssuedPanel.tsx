import React from "react"
import { View, Pressable } from "react-native"
import type { ServiceHoursCertificateDTO } from "@civfix/shared"
import { useTheme, webSelectableText, focusRingProps } from "../../../theme"
import { Text, Icon, iconMap } from "../../../typography"
import { MetaDot } from "../../../primitives"
import { useT } from "../../../i18n"
import { certificateExpiryLabel } from "../../serviceCertificate"
import { CertificateCode, CertificateCopyButton } from "./CertificateCode"
import { useCertificateCardStyles } from "./certificateCardStyles"

const MS_PER_MINUTE = 60_000

/** Whole minutes of link life left, floored at 0 (the card has already flipped to `expired` by then). */
function minutesLeft(expiresAt: string, now: number): number {
  const at = new Date(expiresAt).getTime()
  if (Number.isNaN(at)) return 0
  return Math.max(0, Math.ceil((at - now) / MS_PER_MINUTE))
}

export function CertificateIssuedPanel({
  certificate,
  summaryParts,
  urlExpiresAt,
  now,
  canCopy,
  canOpen,
  onCopy,
  onOpen,
  onShare,
}: {
  certificate: ServiceHoursCertificateDTO
  summaryParts: string[]
  urlExpiresAt: string | null
  now: number
  canCopy: boolean
  canOpen: boolean
  onCopy: (text: string) => void
  onOpen: () => void
  onShare: () => void
}) {
  const styles = useCertificateCardStyles()
  const th = useTheme()
  const { t } = useT("volunteer-hours")
  return (
    <View style={styles.issued}>
      <View style={styles.issuedHead}>
        <Icon icon={iconMap.CheckCircle2} size={16} color={th.colors.moss["700"]} />
        <Text style={styles.issuedTitle}>{t("transcript.ready")}</Text>
      </View>

      <CertificateCode
        code={certificate.code}
        canCopy={canCopy}
        onCopy={onCopy}
        copyColor={th.colors.moss["700"]}
      />

      {summaryParts.length > 0 ? (
        <View style={styles.summaryRow}>
          {summaryParts.map((part, i) => (
            <React.Fragment key={part}>
              {i > 0 ? (
                <MetaDot color={th.colors.textSubtle} style={styles.summaryDot} />
              ) : null}
              <Text style={styles.summaryText}>{part}</Text>
            </React.Fragment>
          ))}
        </View>
      ) : null}

      <View style={styles.actionRow}>
        {canOpen ? (
          <Pressable
            onPress={onOpen}
            accessibilityRole="button"
            accessibilityLabel={t("transcript.open_a11y")}
            {...focusRingProps}
            style={({ pressed }) => [styles.openBtn, pressed ? styles.pressedDim : null]}
          >
            <Icon icon={iconMap.Download} size={15} color={th.colors.moss["700"]} />
            <Text style={styles.openText}>{t("transcript.open")}</Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={onShare}
          accessibilityRole="button"
          accessibilityLabel={t("transcript.share_a11y")}
          {...focusRingProps}
          style={({ pressed }) => [styles.shareBtn, pressed ? styles.pressedDim : null]}
        >
          <Icon icon={iconMap.Share} size={15} color={th.colors.moss["700"]} />
          <Text style={styles.openText}>{t("transcript.share")}</Text>
        </Pressable>
      </View>

      {/* No openExternal seam (a host that cannot hand a URL to a browser): the link becomes
          selectable text plus the optional clipboard capability, so the document is still reachable. */}
      {!canOpen && certificate.url ? (
        <View style={styles.fallbackBlock}>
          <Text style={styles.fallbackLabel}>{t("transcript.link_label")}</Text>
          <View style={styles.codeRow}>
            <Text style={[styles.fallbackUrl, webSelectableText]}>{certificate.url}</Text>
            {canCopy ? (
              <CertificateCopyButton
                onPress={() => onCopy(certificate.url ?? "")}
                color={th.colors.moss["700"]}
              />
            ) : null}
          </View>
        </View>
      ) : null}

      <Text style={styles.expiry}>{t("transcript.expiry")}</Text>
      {urlExpiresAt ? (
        <Text
          style={[
            styles.expiryCountdown,
            certificateExpiryLabel(urlExpiresAt, now) === "soon" ? styles.expirySoon : null,
          ]}
        >
          {t("transcript.expires_in", { minutes: minutesLeft(urlExpiresAt, now) })}
        </Text>
      ) : null}
      <Text style={styles.verifyAt}>{t("transcript.verify_at")}</Text>
    </View>
  )
}
