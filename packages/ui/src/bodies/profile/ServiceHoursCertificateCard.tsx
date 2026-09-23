/**
 * ServiceHoursCertificateCard - the "official transcript" export affordance inside the OWN-profile
 * Service Hours section.
 *
 * TWO-PHASE BY NECESSITY, not by taste (C11 / DP D11). "Prepare transcript" issues the document;
 * a SECOND, real press opens it. On web `openExternal.open` is `window.open`, and a `window.open`
 * executed in a promise continuation after an `await` has lost its user-activation token - Chrome and
 * Safari block it silently. The second press restores a genuine gesture, and it costs nothing: it is
 * where the verification code wants to be shown anyway.
 *
 * The issued certificate lives in LOCAL component state and is never cached: its `url` is a presigned
 * R2 link that lapses in 15 minutes, so a persisted copy would be a link that looks live and is not.
 * Re-issuing is free - the server is idempotent on a fingerprint of the included ledger rows and hands
 * back the SAME code with a fresh URL - which is exactly what the `expired` branch offers.
 *
 * ...BUT IT IS SEEDED FROM THE LIST (0.38.1). Local-only state meant a tab switch or a reload dropped the
 * card back to `idle`: no code, no summary and - the part that mattered - no REVOKE, the only control
 * over a code already handed to a registrar. So `useMyServiceHoursCertificates()` seeds the newest
 * non-revoked row on mount. Those rows carry `url: null` deliberately (the list endpoint presigns
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
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { View, Pressable, StyleSheet, ActivityIndicator } from "react-native"
import type { ServiceHoursCertificateDTO } from "@civfix/shared"
import { formatCertificateCode } from "@civfix/shared"
import { makeThemedStyles, useTheme, webSelectableText, focusRingProps } from "../../theme"
import { Text, Icon, iconMap } from "../../typography"
import { MetaDot, shareLink, useToast } from "../../primitives"
import { useClipboard, useOpenExternal } from "../../capabilities"
import {
  useIssueServiceHoursCertificate,
  useMyServiceHoursCertificates,
  useRevokeServiceHoursCertificate,
} from "../../data"
import { useLocale, useT } from "../../i18n"
import { certificateCardState, certificateErrorKey, certificateExpiryLabel } from "../serviceCertificate"
import { formatHoursDisplay } from "../formatHours"

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
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("volunteer-hours")
  const { locale } = useLocale()
  const toast = useToast()
  const openExternal = useOpenExternal()
  const clipboard = useClipboard()
  const issue = useIssueServiceHoursCertificate()
  const revoke = useRevokeServiceHoursCertificate()
  const myCertificates = useMyServiceHoursCertificates()

  const [certificate, setCertificate] = useState<ServiceHoursCertificateDTO | null>(null)
  const [revokedNotice, setRevokedNotice] = useState(false)
  const [confirmingRevoke, setConfirmingRevoke] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  /**
   * Codes revoked in THIS session. The revoke mutation invalidates the list, but the cached rows stay
   * readable until the refetch lands - without this the seed effect would immediately re-adopt the
   * document the viewer just killed.
   */
  const revokedCodesRef = useRef<Set<string>>(new Set())

  /**
   * The newest document still worth showing. `listFor` orders newest-first and INCLUDES revoked rows,
   * so both the server's `status`/`revokedAt` and this session's revocations are filtered out here.
   */
  const latestLive = useMemo(() => {
    const rows = myCertificates.data?.certificates ?? []
    return (
      rows.find(
        (row) =>
          row.status !== "revoked" && row.revokedAt == null && !revokedCodesRef.current.has(row.code),
      ) ?? null
    )
  }, [myCertificates.data])

  // Seed ONCE, and never over a certificate this session issued: that one still holds a live presigned
  // url, while a listed row carries none (`url: null` -> the card's `expired` state -> "Refresh link").
  useEffect(() => {
    if (!latestLive) return
    setCertificate((prev) => prev ?? latestLive)
  }, [latestLive])

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
          // Re-anchor the countdown to the moment the fresh link landed.
          setNow(Date.now())
        },
      },
    )
  }, [issue, locale])

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
  }, [certificate?.code, revoke, toast, t])

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
        <View style={styles.issued}>
          <View style={styles.issuedHead}>
            <Icon icon={iconMap.CheckCircle2} size={16} color={th.colors.moss["700"]} />
            <Text style={styles.issuedTitle}>{t("transcript.ready")}</Text>
          </View>

          {/* The code row: selectable text with the copy button BESIDE it, never wrapping it. */}
          <View style={styles.codeRow}>
            <Text
              style={[styles.code, webSelectableText]}
              accessibilityLabel={t("transcript.code_a11y", {
                code: formatCertificateCode(certificate.code),
              })}
            >
              {t("transcript.code", { code: formatCertificateCode(certificate.code) })}
            </Text>
            {clipboard ? (
              <Pressable
                onPress={() => onCopy(formatCertificateCode(certificate.code))}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t("transcript.copy_a11y")}
                {...focusRingProps}
                style={({ pressed }) => [styles.copyBtn, pressed ? styles.pressedDim : null]}
              >
                <Icon icon={iconMap.Copy} size={14} color={th.colors.moss["700"]} />
              </Pressable>
            ) : null}
          </View>

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
            {openExternal ? (
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
          {!openExternal && certificate.url ? (
            <View style={styles.fallbackBlock}>
              <Text style={styles.fallbackLabel}>{t("transcript.link_label")}</Text>
              <View style={styles.codeRow}>
                <Text style={[styles.fallbackUrl, webSelectableText]}>{certificate.url}</Text>
                {clipboard ? (
                  <Pressable
                    onPress={() => onCopy(certificate.url ?? "")}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={t("transcript.copy_a11y")}
                    {...focusRingProps}
                    style={({ pressed }) => [styles.copyBtn, pressed ? styles.pressedDim : null]}
                  >
                    <Icon icon={iconMap.Copy} size={14} color={th.colors.moss["700"]} />
                  </Pressable>
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
            <View style={styles.codeRow}>
              <Text
                style={[styles.code, webSelectableText]}
                accessibilityLabel={t("transcript.code_a11y", {
                  code: formatCertificateCode(certificate.code),
                })}
              >
                {t("transcript.code", { code: formatCertificateCode(certificate.code) })}
              </Text>
              {clipboard ? (
                <Pressable
                  onPress={() => onCopy(formatCertificateCode(certificate.code))}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={t("transcript.copy_a11y")}
                  {...focusRingProps}
                  style={({ pressed }) => [styles.copyBtn, pressed ? styles.pressedDim : null]}
                >
                  <Icon icon={iconMap.Copy} size={14} color={th.colors.textMuted} />
                </Pressable>
              ) : null}
            </View>
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

      {/* Revoke is the ONLY control over a code that has already been handed to a registrar, so it is a
          first-class (if low-emphasis) action rather than a hidden one - offered whenever a document is
          held, live link or not. */}
      {certificate ? (
        confirmingRevoke ? (
          <View style={styles.confirm}>
            <Text style={styles.confirmBody}>{t("transcript.revoke_confirm")}</Text>
            <View style={styles.confirmActions}>
              <Pressable
                onPress={() => setConfirmingRevoke(false)}
                accessibilityRole="button"
                accessibilityLabel={t("transcript.revoke_cancel")}
                hitSlop={CONFIRM_BTN_HIT_SLOP}
                {...focusRingProps}
                style={({ pressed }) => [styles.confirmKeep, pressed ? styles.pressedDim : null]}
              >
                <Text style={styles.confirmKeepText}>{t("transcript.revoke_cancel")}</Text>
              </Pressable>
              <Pressable
                onPress={onConfirmRevoke}
                disabled={revoke.isPending}
                accessibilityRole="button"
                accessibilityLabel={t("transcript.revoke_ok")}
                accessibilityState={{ busy: revoke.isPending }}
                hitSlop={CONFIRM_BTN_HIT_SLOP}
                {...focusRingProps}
                style={({ pressed }) => [styles.confirmRevoke, pressed ? styles.pressedDim : null]}
              >
                <Text style={styles.confirmRevokeText}>{t("transcript.revoke_ok")}</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable
            onPress={() => setConfirmingRevoke(true)}
            accessibilityRole="button"
            accessibilityLabel={t("transcript.revoke_a11y")}
            hitSlop={REVOKE_LINK_HIT_SLOP}
            {...focusRingProps}
            style={({ pressed }) => [styles.revokeLink, pressed ? styles.pressedDim : null]}
          >
            <Text style={styles.revokeLinkText}>{t("transcript.revoke")}</Text>
          </Pressable>
        )
      ) : null}
    </View>
  )
}

/** Whole minutes of link life left, floored at 0 (the card has already flipped to `expired` by then). */
function minutesLeft(expiresAt: string, now: number): number {
  const at = new Date(expiresAt).getTime()
  if (Number.isNaN(at)) return 0
  return Math.max(0, Math.ceil((at - now) / 60_000))
}

const MIN_TOUCH_TARGET = 44
const CONFIRM_BTN_HEIGHT = 34
const CONFIRM_BTN_HIT_SLOP = {
  top: (MIN_TOUCH_TARGET - CONFIRM_BTN_HEIGHT) / 2,
  bottom: (MIN_TOUCH_TARGET - CONFIRM_BTN_HEIGHT) / 2,
}
// The link renders about 25pt tall (12.5px label, 4px padding); 10pt of slop each way reaches 44.
const REVOKE_LINK_HIT_SLOP = { top: 10, bottom: 10, left: 8, right: 8 }

const useStyles = makeThemedStyles((t) => ({
  wrap: {
    marginTop: t.space["4"],
    gap: t.space["2"],
  },
  headRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  eyebrow: {
    fontFamily: t.fontFamily.bodyExtraBold,
    fontSize: 11,
    letterSpacing: 0.6,
    color: t.colors.textSubtle,
    textTransform: "uppercase",
  },
  blurb: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 12.5,
    lineHeight: 17,
    color: t.colors.textSubtle,
  },

  // Outline secondary pill (design family: height 44 / radius.pill / surface / 1.5 borderStrong).
  pill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 44,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.surface,
    borderWidth: 1.5,
    borderColor: t.colors.borderStrong,
  },
  pillDisabled: {
    opacity: 0.5,
  },
  pillText: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 14,
    color: t.colors.text,
  },
  pressedDim: {
    opacity: 0.85,
  },

  hint: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 12,
    lineHeight: 16,
    color: t.colors.textSubtle,
  },
  errorLine: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: 12,
    lineHeight: 16,
    color: t.colors.bloom["700"],
  },

  issued: {
    padding: t.space["3"],
    gap: t.space["2"],
    borderRadius: t.radius.lg,
    backgroundColor: t.colors.moss["50"],
    borderWidth: 1.5,
    borderColor: t.colors.moss["100"],
  },
  issuedHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  issuedTitle: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: 13,
    color: t.colors.moss["700"],
  },
  codeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
  },
  code: {
    flex: 1,
    minWidth: 0,
    fontFamily: t.fontFamily.mono,
    fontSize: 12,
    color: t.colors.textMuted,
  },
  copyBtn: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.surface,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  summaryDot: {
    marginHorizontal: 5,
  },
  summaryText: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 11.5,
    color: t.colors.textSubtle,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
  },
  openBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 36,
    paddingHorizontal: t.space["4"],
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.surface,
  },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 36,
    paddingHorizontal: t.space["4"],
    borderRadius: t.radius.pill,
    backgroundColor: "transparent",
  },
  openText: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 13,
    color: t.colors.moss["700"],
  },
  fallbackBlock: {
    gap: 4,
  },
  fallbackLabel: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: 11.5,
    color: t.colors.textMuted,
  },
  fallbackUrl: {
    flex: 1,
    minWidth: 0,
    fontFamily: t.fontFamily.mono,
    fontSize: 11,
    color: t.colors.textSubtle,
  },
  expiry: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 11.5,
    lineHeight: 16,
    color: t.colors.textSubtle,
  },
  expiryCountdown: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: 11.5,
    color: t.colors.textSubtle,
  },
  expirySoon: {
    color: t.colors.bloom["700"],
  },
  verifyAt: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 11.5,
    color: t.colors.textSubtle,
  },

  revokeLink: {
    alignSelf: "flex-start",
    paddingVertical: 4,
  },
  revokeLinkText: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 12.5,
    color: t.colors.textSubtle,
  },
  confirm: {
    gap: t.space["2"],
    padding: t.space["3"],
    borderRadius: t.radius.lg,
    backgroundColor: t.colors.bgAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
  },
  confirmBody: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 12.5,
    lineHeight: 17,
    color: t.colors.textMuted,
  },
  confirmActions: {
    flexDirection: "row",
    gap: t.space["2"],
  },
  confirmKeep: {
    height: CONFIRM_BTN_HEIGHT,
    paddingHorizontal: t.space["4"],
    alignItems: "center",
    justifyContent: "center",
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
  },
  confirmKeepText: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 13,
    color: t.colors.text,
  },
  confirmRevoke: {
    height: CONFIRM_BTN_HEIGHT,
    paddingHorizontal: t.space["4"],
    alignItems: "center",
    justifyContent: "center",
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.bloom["50"],
    borderWidth: 1.5,
    borderColor: t.colors.bloom["100"],
  },
  confirmRevokeText: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 13,
    color: t.colors.accentText,
  },
}))
