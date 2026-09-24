/**
 * Two-phase by necessity, not by taste: "Prepare transcript" issues the document;
 * a SECOND, real press opens it. On web `openExternal.open` is `window.open`, and a `window.open`
 * executed in a promise continuation after an `await` has lost its user-activation token - Chrome and
 * Safari block it silently. The second press restores a genuine gesture, and it costs nothing: it is
 * where the verification code wants to be shown anyway.
 *
 * The issued certificate lives in LOCAL component state and is never cached: its `url` is a presigned
 * R2 link that lapses in 15 minutes, so a persisted copy would be a link that looks live and is not.
 * Re-issuing is free: the server is idempotent on a fingerprint of the included ledger rows and hands
 * back the SAME code with a fresh URL, which is exactly what the `expired` branch offers.
 *
 * The card is still seeded from the list: local-only state alone would drop it back to `idle` on a tab
 * switch or a reload, losing the code, the summary and above all REVOKE, the only control over a code
 * already handed to a registrar. So `useMyServiceHoursCertificates()` seeds the newest non-revoked row
 * whenever the card holds nothing. Those rows carry `url: null` deliberately (the list endpoint presigns
 * nothing), which `certificateCardState` reads as `expired` - correct, and its "Refresh link" press is
 * the free fingerprint-reuse path. The seed never overwrites a certificate this session issued, and a
 * code revoked here is remembered so the still-warm list cache cannot resurrect it.
 *
 * SHEET SAFETY: a fixed-height View inside the profile body's existing scroller. No `Modal`, no
 * `FlatList`, no inner `ScrollView` (so no ScrollHostProvider escape hatch and no gorhom sheet-collapse
 * handoff), no nested `Pressable` (the copy buttons sit BESIDE the text they copy, never inside a
 * pressable row), and no reanimated. The revoke confirm is an INLINE two-button block, the
 * `DropPinBody` idiom - a `Modal` inside the sheet is the banned pattern.
 *
 * Coral as ink is always `th.colors.accentText`; `th.colors.accent` is a FILL token (WCAG).
 */
import React, { useCallback, useEffect, useMemo, useState } from "react"
import { View, Pressable, ActivityIndicator } from "react-native"
import { formatCertificateCode } from "@civfix/shared"
import { useTheme, focusRingProps } from "../../theme"
import { Text, Icon, iconMap } from "../../typography"
import { shareLink, useToast } from "../../primitives"
import { useClipboard, useOpenExternal } from "../../capabilities"
import { useIssueServiceHoursCertificate, useRevokeServiceHoursCertificate } from "../../data"
import { useLocale, useT } from "../../i18n"
import { certificateCardState, certificateErrorKey } from "../serviceCertificate"
import { formatHoursDisplay } from "../formatHours"
import { CertificateCode } from "./certificate/CertificateCode"
import { CertificateIssuedPanel } from "./certificate/CertificateIssuedPanel"
import { CertificateRevokeControl } from "./certificate/CertificateRevokeControl"
import { useSeededCertificate } from "./certificate/useSeededCertificate"
import { useCertificateCardStyles } from "./certificate/certificateCardStyles"

/**
 * How often the expiry countdown re-reads the clock. The presigned link lives 15 minutes and the copy
 * is minute-granular, so a 30s tick is twice the resolution the label needs and cheap enough to run
 * only while a certificate is actually held (the effect is keyed on `urlExpiresAt`).
 */
const COUNTDOWN_TICK_MS = 30_000

export interface ServiceHoursCertificateCardProps {
  /** The viewer's verified total. 0 renders the inert `disabled` pill: there is nothing to certify. */
  totalHours: number
}

export function ServiceHoursCertificateCard({ totalHours }: ServiceHoursCertificateCardProps) {
  const styles = useCertificateCardStyles()
  const th = useTheme()
  const { t } = useT("volunteer-hours")
  const { locale } = useLocale()
  const toast = useToast()
  const openExternal = useOpenExternal()
  const clipboard = useClipboard()
  const issue = useIssueServiceHoursCertificate()
  const revoke = useRevokeServiceHoursCertificate()
  const { certificate, setCertificate, revokedCodesRef } = useSeededCertificate()

  const [revokedNotice, setRevokedNotice] = useState(false)
  const [confirmingRevoke, setConfirmingRevoke] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  // The countdown runs ONLY while a link is held, and it is what flips the card from `ready` to
  // `expired` (certificateCardState reads `now`; nothing in the model touches the clock itself).
  const urlExpiresAt = certificate?.urlExpiresAt ?? null
  useEffect(() => {
    if (!urlExpiresAt) return
    const id = setInterval(() => setNow(Date.now()), COUNTDOWN_TICK_MS)
    return () => clearInterval(id)
  }, [urlExpiresAt])

  const state = certificateCardState({
    hasCertificate: certificate != null,
    isPending: issue.isPending,
    isError: issue.isError,
    totalHours,
    urlExpiresAt,
    now,
  })

  const onPrepare = useCallback(() => {
    if (issue.isPending) return
    setRevokedNotice(false)
    setConfirmingRevoke(false)
    issue.mutate(
      { locale },
      {
        onSuccess: (res) => {
          setCertificate(res.certificate)
          setNow(Date.now())
        },
      },
    )
  }, [issue, locale, setCertificate])

  // A DIRECT gesture -> the user-activation token is intact -> window.open is not blocked on web.
  const onOpen = useCallback(() => {
    const url = certificate?.url
    if (!url || !openExternal) return
    void openExternal.open(url)
  }, [certificate?.url, openExternal])

  const onShare = useCallback(() => {
    const code = certificate?.code
    if (!code) return
    // The VERIFY link travels, never the presigned PDF: the code is the capability that is printed on
    // the document, and it does not expire.
    void shareLink({
      title: t("transcript.share_title"),
      path: `/service-record/${formatCertificateCode(code)}`,
    })
  }, [certificate?.code, t])

  const onCopy = useCallback(
    (text: string) => {
      if (!clipboard) return
      void clipboard
        .setString(text)
        .then(() => toast.show(t("transcript.copied"), { variant: "success" }))
        .catch(() => toast.show(t("transcript.copy_error"), { variant: "error" }))
    },
    [clipboard, toast, t],
  )

  const onConfirmRevoke = useCallback(() => {
    const code = certificate?.code
    if (!code || revoke.isPending) return
    setConfirmingRevoke(false)
    revoke.mutate(
      { code },
      {
        onSuccess: () => {
          // Remember it BEFORE clearing: the list cache is still warm and the seed effect re-runs.
          revokedCodesRef.current.add(code)
          setCertificate(null)
          setRevokedNotice(true)
        },
        onError: () => toast.show(t("transcript.revoke_error"), { variant: "error" }),
      },
    )
  }, [certificate?.code, revoke, toast, t, revokedCodesRef, setCertificate])

  const summaryParts = useMemo(() => {
    if (!certificate) return []
    const issued = new Date(certificate.issuedAt)
    const issuedLabel = Number.isNaN(issued.getTime())
      ? null
      : issued.toLocaleDateString(locale, { month: "short", day: "numeric" })
    return [
      t("transcript.summary_hours", { hours: formatHoursDisplay(certificate.totalHours, locale) }),
      t("transcript.summary_activities", { count: certificate.entryCount }),
      issuedLabel ? t("transcript.summary_issued", { date: issuedLabel }) : null,
    ].filter((part): part is string => !!part)
  }, [certificate, locale, t])

  const disabled = state === "disabled"
  const preparing = state === "preparing"
  // Once a document is held, every subsequent press is a REFRESH: the server returns the same code with
  // a new link, so "Prepare transcript" would misdescribe it - including after a failed refresh.
  const holdsCertificate = certificate != null
  const pillLabel = holdsCertificate ? t("transcript.refresh_link") : t("transcript.prepare")
  const pillA11y = holdsCertificate
    ? t("transcript.refresh_link_a11y")
    : t("transcript.prepare_a11y")

  return (
    <View style={styles.wrap}>
      <View style={styles.headRow}>
        <Icon icon={iconMap.FileText} size={16} color={th.colors.textMuted} />
        <Text style={styles.eyebrow}>{t("transcript.eyebrow")}</Text>
      </View>
      <Text style={styles.blurb}>{t("transcript.blurb")}</Text>

      {state === "ready" && certificate ? (
        <CertificateIssuedPanel
          certificate={certificate}
          summaryParts={summaryParts}
          urlExpiresAt={urlExpiresAt}
          now={now}
          canCopy={clipboard != null}
          canOpen={openExternal != null}
          onCopy={onCopy}
          onOpen={onOpen}
          onShare={onShare}
        />
      ) : (
        <>
          <Pressable
            onPress={onPrepare}
            disabled={disabled || preparing}
            accessibilityRole="button"
            accessibilityLabel={pillA11y}
            accessibilityState={{ disabled, busy: preparing }}
            {...focusRingProps}
            style={({ pressed }) => [
              styles.pill,
              disabled ? styles.pillDisabled : null,
              pressed && !disabled && !preparing ? styles.pressedDim : null,
            ]}
          >
            {preparing ? (
              <ActivityIndicator size="small" color={th.colors.textMuted} />
            ) : (
              <Icon icon={iconMap.FileText} size={16} color={th.colors.text} />
            )}
            <Text style={styles.pillText}>{preparing ? t("transcript.preparing") : pillLabel}</Text>
          </Pressable>

          {disabled ? <Text style={styles.hint}>{t("transcript.disabled_hint")}</Text> : null}
          {state === "expired" ? <Text style={styles.hint}>{t("transcript.expired")}</Text> : null}
          {/* The CODE outlives the link, so it is shown here too - a document seeded from the list (or
              whose link has lapsed) is still the one printed on the paper a registrar is holding, and
              reading it back should not cost a refresh. */}
          {certificate ? (
            <CertificateCode
              code={certificate.code}
              canCopy={clipboard != null}
              onCopy={onCopy}
              copyColor={th.colors.textMuted}
            />
          ) : null}
          {state === "error" ? (
            <Text style={styles.errorLine}>
              {certificateErrorKey(issue.error) === "rate_limited"
                ? t("transcript.error_rate_limited")
                : t("transcript.error_generic")}
            </Text>
          ) : null}
          {revokedNotice ? <Text style={styles.hint}>{t("transcript.revoked")}</Text> : null}
        </>
      )}

      {/* Offered whenever a document is held, live link or not. */}
      {certificate ? (
        <CertificateRevokeControl
          confirming={confirmingRevoke}
          pending={revoke.isPending}
          onAskConfirm={() => setConfirmingRevoke(true)}
          onCancel={() => setConfirmingRevoke(false)}
          onConfirm={onConfirmRevoke}
        />
      ) : null}
    </View>
  )
}
