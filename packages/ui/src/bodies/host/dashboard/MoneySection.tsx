import React, { useCallback, useMemo, useState } from "react"
import { StyleSheet, View } from "react-native"
import type { OrganizationDTO, PayoutDTO } from "@civfix/shared"
import { makeThemedStyles, useTheme, headingLevel } from "../../../theme"
import { Text, Icon, iconMap } from "../../../typography"
import {
  ModalCardSheet,
  PrimaryButton,
  SecondaryButton,
  SkeletonGroup,
  SkeletonText,
  useToast,
} from "../../../primitives"
import { useOpenExternal } from "../../../capabilities"
import { useLocale, useT } from "../../../i18n"
import { randomId } from "../../../data/randomId"
import {
  payoutRows,
  useCreateOrgPayout,
  useCreateOrgStripeAccountLink,
  useOrgBalance,
  useOrgDonationSummary,
  useOrgPaymentsStatus,
  useOrgPayouts,
} from "../../../data/hooks/dashboard"
import { FeedNotice } from "../../FeedNotice"
import { appErrorCode } from "../../errorCode"
import { formatMinor, formatMoney } from "../donationFormat"
import {
  canManageOrgPayments,
  canViewOrgMoney,
  donationSummaryFrom,
  payoutBlockedKey,
  payoutButtonModel,
  payoutErrorKey,
  type DashboardRange,
} from "./dashboardModel"

const RECENT_PAYOUTS = 3

function PayoutRow({ payout, locale }: { payout: PayoutDTO; locale: string }) {
  const styles = useStyles()
  const { t } = useT("event-dashboard")
  const when = (() => {
    const parsed = new Date(payout.arrivalDate ?? payout.createdAt)
    if (Number.isNaN(parsed.getTime())) return ""
    try {
      return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(parsed)
    } catch {
      return parsed.toISOString().slice(0, 10)
    }
  })()
  return (
    <View style={styles.payoutRow}>
      <View style={styles.payoutMeta}>
        <Text style={styles.payoutAmount}>{formatMoney(payout.amount, locale)}</Text>
        {when ? (
          <Text style={styles.payoutWhen} numberOfLines={1}>
            {when}
          </Text>
        ) : null}
      </View>
      <Text style={styles.payoutStatus} numberOfLines={1}>
        {t(`money.payout_status_${payout.status}`)}
      </Text>
    </View>
  )
}

export interface MoneySectionProps {
  org: OrganizationDTO
  range: DashboardRange
}

export function MoneySection({ org, range }: MoneySectionProps) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("event-dashboard")
  const { locale } = useLocale()
  const toast = useToast()
  const openExternal = useOpenExternal()

  const canView = canViewOrgMoney(org.myRole)
  const status = useOrgPaymentsStatus(org.id, { enabled: canView })
  const connected = !!status.data?.stripeAccountId
  const balance = useOrgBalance(org.id, { enabled: connected })
  const summaryRange = useMemo(() => ({ from: donationSummaryFrom(range, new Date()) }), [range])
  const summary = useOrgDonationSummary(org.id, summaryRange, { enabled: connected })
  const payouts = useOrgPayouts(org.id, { enabled: connected })
  const createPayout = useCreateOrgPayout(org.id)
  const accountLink = useCreateOrgStripeAccountLink(org.id)

  const [confirming, setConfirming] = useState(false)
  const [payoutKey, setPayoutKey] = useState<string | null>(null)

  const canManage = canManageOrgPayments(org.myRole)
  const button = payoutButtonModel({
    role: org.myRole,
    balance: balance.data ?? null,
    pending: createPayout.isPending,
  })
  const blockedKey = payoutBlockedKey(button.reason)

  const rows = useMemo(() => payoutRows(payouts.data?.pages).slice(0, RECENT_PAYOUTS), [payouts.data])

  const onboard = useCallback(() => {
    accountLink.mutate(
      { type: "onboarding" },
      {
        onSuccess: (res) => {
          const opener = openExternal?.openInAppBrowser ?? openExternal?.open
          if (!opener) {
            toast.show(t("money.link_unavailable"), { variant: "error" })
            return
          }
          void opener(res.url)
        },
        onError: () => toast.show(t("money.link_error"), { variant: "error" }),
      },
    )
  }, [accountLink, openExternal, t, toast])

  const askPayout = useCallback(() => {
    if (!button.enabled) return
    setPayoutKey(randomId())
    setConfirming(true)
  }, [button.enabled])

  const confirmPayout = useCallback(() => {
    if (payoutKey === null || createPayout.isPending) return
    createPayout.mutate(
      { idempotencyKey: payoutKey },
      {
        onSuccess: () => {
          setConfirming(false)
          setPayoutKey(null)
          toast.show(t("money.payout_started"), { variant: "success" })
        },
        onError: (err) => {
          setConfirming(false)
          toast.show(t(payoutErrorKey(appErrorCode(err))), { variant: "error" })
        },
      },
    )
  }, [createPayout, payoutKey, t, toast])

  if (!canView) return null

  const header = (
    <View style={styles.sectionHead}>
      <Icon icon={iconMap.HandHeart} size={17} color={th.colors.textMuted} />
      <Text style={styles.sectionTitle} accessibilityRole="header" {...headingLevel(2)}>
        {t("money.section")}
      </Text>
    </View>
  )

  if (status.isPending) {
    return (
      <View style={styles.section}>
        {header}
        <SkeletonGroup>
          <SkeletonText width="70%" height={16} />
        </SkeletonGroup>
      </View>
    )
  }

  if (status.isError) {
    return (
      <View style={styles.section}>
        {header}
        <FeedNotice
          icon="CloudOff"
          title={t("money.error_title")}
          body={t("money.error_body")}
          actionLabel={t("money.retry")}
          onAction={() => void status.refetch()}
        />
      </View>
    )
  }

  if (!connected) {
    return (
      <View style={styles.section}>
        {header}
        <View style={styles.card}>
          <Text style={styles.cardBody}>{t("money.not_connected")}</Text>
          {canManage ? (
            <PrimaryButton
              label={t("money.connect")}
              variant="outline"
              loading={accountLink.isPending}
              onPress={onboard}
            />
          ) : (
            <Text style={styles.note}>{t("money.connect_owner_only")}</Text>
          )}
        </View>
      </View>
    )
  }

  return (
    <View style={styles.section}>
      {header}
      <View style={styles.card}>
        <View style={styles.balanceRow}>
          <View style={styles.balanceCell}>
            <Text style={styles.balanceValue}>
              {balance.data ? formatMoney(balance.data.available, locale) : t("money.dash")}
            </Text>
            <Text style={styles.balanceLabel}>{t("money.available")}</Text>
          </View>
          <View style={styles.balanceCell}>
            <Text style={styles.balanceValue}>
              {balance.data ? formatMoney(balance.data.pending, locale) : t("money.dash")}
            </Text>
            <Text style={styles.balanceLabel}>{t("money.pending")}</Text>
          </View>
        </View>

        {balance.isError ? <Text style={styles.note}>{t("money.balance_error")}</Text> : null}

        {summary.data ? (
          <Text style={styles.note}>
            {t("money.donations_total", {
              amount: formatMinor(summary.data.netMinor, "USD", locale),
              count: summary.data.donationCount,
            })}
          </Text>
        ) : null}
        {summary.isError ? <Text style={styles.note}>{t("money.summary_error")}</Text> : null}

        {balance.data?.payoutSchedule ? (
          <Text style={styles.note}>
            {t(`money.schedule_${balance.data.payoutSchedule.interval}`)}
          </Text>
        ) : null}

        {button.visible ? (
          <>
            <PrimaryButton
              label={t("money.payout")}
              variant="outline"
              disabled={!button.enabled}
              loading={createPayout.isPending}
              onPress={askPayout}
            />
            {blockedKey ? <Text style={styles.note}>{t(blockedKey)}</Text> : null}
          </>
        ) : (
          <Text style={styles.note}>{t("money.payout_owner_only")}</Text>
        )}
      </View>

      {rows.length > 0 ? (
        <View style={styles.list}>
          <Text style={styles.subhead}>{t("money.recent_payouts")}</Text>
          {rows.map((payout) => (
            <PayoutRow key={payout.id} payout={payout} locale={locale} />
          ))}
        </View>
      ) : null}
      {payouts.isError ? <Text style={styles.note}>{t("money.payouts_error")}</Text> : null}

      <ModalCardSheet
        visible={confirming}
        onClose={() => setConfirming(false)}
        onCommit={confirmPayout}
        headerIcon="ReceiptText"
        headerIconColor={th.colors.moss["700"]}
        title={t("money.confirm_title")}
        dismissLabel={t("money.confirm_dismiss_a11y")}
        backdropDismissDisabled={createPayout.isPending}
        actions={
          <>
            <SecondaryButton
              label={t("common:cancel")}
              onPress={() => setConfirming(false)}
              size="sm"
              disabled={createPayout.isPending}
            />
            <PrimaryButton
              label={t("money.confirm_action")}
              onPress={confirmPayout}
              loading={createPayout.isPending}
            />
          </>
        }
      >
        <Text variant="caption" color={th.colors.textSubtle}>
          {t("money.confirm_body", {
            amount: balance.data ? formatMoney(balance.data.available, locale) : t("money.dash"),
          })}
        </Text>
      </ModalCardSheet>
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  section: {
    gap: t.space["2"],
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
  },
  sectionTitle: {
    fontFamily: t.fontFamily.displayBold,
    fontSize: t.fontSize["16"],
    color: t.colors.text,
  },
  card: {
    gap: t.space["3"],
    padding: t.space["3"],
    borderRadius: t.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
    ...t.shadows.s1,
  },
  cardBody: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["13"],
    color: t.colors.textMuted,
  },
  balanceRow: {
    flexDirection: "row",
    gap: t.space["3"],
  },
  balanceCell: {
    flex: 1,
    minWidth: 0,
  },
  balanceValue: {
    fontFamily: t.fontFamily.displayBold,
    fontSize: t.fontSize["20"],
    color: t.colors.text,
  },
  balanceLabel: {
    marginTop: 2,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["12"],
    color: t.colors.textSubtle,
  },
  note: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["12"],
    color: t.colors.textSubtle,
  },
  list: {
    gap: t.space["2"],
  },
  subhead: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["13"],
    color: t.colors.textMuted,
  },
  payoutRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
    paddingVertical: t.space["2"],
    paddingHorizontal: t.space["3"],
    borderRadius: t.radius.md,
    backgroundColor: t.colors.bgAlt,
  },
  payoutMeta: {
    flex: 1,
    minWidth: 0,
  },
  payoutAmount: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: t.fontSize["14"],
    color: t.colors.text,
  },
  payoutWhen: {
    marginTop: 1,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["12"],
    color: t.colors.textSubtle,
  },
  payoutStatus: {
    flexShrink: 0,
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["12"],
    color: t.colors.textMuted,
  },
}))
