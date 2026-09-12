import React, { useCallback, useMemo, useRef, useState } from "react"
import { View } from "react-native"
import type { OrganizationDTO, PayoutDTO } from "@civfix/shared"
import { makeThemedStyles, useTheme } from "../../../theme"
import { Text } from "../../../typography"
import {
  ModalCardSheet,
  PrimaryButton,
  SecondaryButton,
  SectionCard,
  SettingsRow,
  SettingsSection,
  StatTile,
  StatTileRow,
  useToast,
} from "../../../primitives"
import { useOpenExternal } from "../../../capabilities"
import { useLocale, useT } from "../../../i18n"
import {
  payoutRows,
  useCreateOrgPayout,
  useCreateOrgStripeAccountLink,
  useOrgBalance,
  useOrgDonationSummary,
  useOrgPaymentsStatus,
  useOrgPayouts,
} from "../../../data/hooks/payouts"
import { FeedNotice } from "../../FeedNotice"
import { appErrorCode } from "../../errorCode"
import { HeroSkeleton } from "../HostSkeletons"
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
          <Text variant="caption" numberOfLines={1}>
            {when}
          </Text>
        ) : null}
      </View>
      <Text variant="caption" numberOfLines={1}>
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
  const summaryRange = useMemo(() => {
    const from = donationSummaryFrom(range, new Date())
    return from ? { from } : {}
  }, [range])
  const summary = useOrgDonationSummary(org.id, summaryRange, { enabled: connected })
  const payouts = useOrgPayouts(org.id, { enabled: connected })
  const createPayout = useCreateOrgPayout(org.id)
  const accountLink = useCreateOrgStripeAccountLink(org.id)

  const [confirming, setConfirming] = useState(false)
  const sendingRef = useRef(false)

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
    setConfirming(true)
  }, [button.enabled])

  const confirmPayout = useCallback(() => {
    if (sendingRef.current) return
    sendingRef.current = true
    createPayout.mutate(
      {},
      {
        onSuccess: () => {
          setConfirming(false)
          toast.show(t("money.payout_started"), { variant: "success" })
        },
        onError: (err) => {
          setConfirming(false)
          toast.show(t(payoutErrorKey(appErrorCode(err))), { variant: "error" })
        },
        onSettled: () => {
          sendingRef.current = false
        },
      },
    )
  }, [createPayout, t, toast])

  if (!canView) return null

  if (status.isPending) return <HeroSkeleton />

  if (status.isError) {
    return (
      <SectionCard label={t("money.section")}>
        <FeedNotice
          icon="CloudOff"
          title={t("money.error_title")}
          body={t("money.error_body")}
          actionLabel={t("money.retry")}
          onAction={() => void status.refetch()}
        />
      </SectionCard>
    )
  }

  if (!connected) {
    return (
      <SectionCard label={t("money.section")}>
        <View style={styles.card}>
          <Text variant="body">{t("money.not_connected")}</Text>
          {canManage ? (
            <SecondaryButton
              label={t("money.connect")}
              disabled={accountLink.isPending}
              onPress={onboard}
            />
          ) : (
            <Text variant="caption">{t("money.connect_owner_only")}</Text>
          )}
        </View>
      </SectionCard>
    )
  }

  const payoutSub = blockedKey
    ? t(blockedKey)
    : balance.data?.payoutSchedule
      ? t(`money.schedule_${balance.data.payoutSchedule.interval}`)
      : undefined

  return (
    <View style={styles.group}>
      <SectionCard label={t("money.section")}>
        <View style={styles.card}>
          <StatTileRow columns={2}>
            <StatTile
              label={t("money.available")}
              value={balance.data ? formatMoney(balance.data.available, locale) : null}
            />
            <StatTile
              label={t("money.pending")}
              value={balance.data ? formatMoney(balance.data.pending, locale) : null}
            />
          </StatTileRow>

          {balance.isError ? <Text variant="caption">{t("money.balance_error")}</Text> : null}

          {summary.data ? (
            <Text variant="caption">
              {t("money.donations_total", {
                amount: formatMinor(summary.data.netMinor, "USD", locale),
                count: summary.data.donationCount,
              })}
            </Text>
          ) : null}
          {summary.isError ? <Text variant="caption">{t("money.summary_error")}</Text> : null}

          {rows.length > 0 ? (
            <View style={styles.payouts}>
              <Text variant="label">{t("money.recent_payouts")}</Text>
              {rows.map((payout) => (
                <PayoutRow key={payout.id} payout={payout} locale={locale} />
              ))}
            </View>
          ) : null}
          {payouts.isError ? <Text variant="caption">{t("money.payouts_error")}</Text> : null}
        </View>
      </SectionCard>

      {button.visible ? (
        <SettingsSection>
          <SettingsRow
            icon="ReceiptText"
            label={t("money.payout")}
            sub={payoutSub}
            disabled={!button.enabled}
            onPress={askPayout}
          />
        </SettingsSection>
      ) : (
        <Text variant="caption">{t("money.payout_owner_only")}</Text>
      )}

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
        <Text variant="caption">
          {t("money.confirm_body", {
            amount: balance.data ? formatMoney(balance.data.available, locale) : t("money.dash"),
          })}
        </Text>
      </ModalCardSheet>
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  group: {
    gap: t.space["2"],
  },
  card: {
    gap: t.space["3"],
  },
  payouts: {
    gap: t.space["2"],
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
}))
