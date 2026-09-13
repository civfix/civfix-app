import React, { useCallback, useMemo, useRef, useState } from "react"
import { View } from "react-native"
import type { OrganizationDTO, PayoutDTO } from "@civfix/shared"
import { makeThemedStyles, useTheme } from "../../../theme"
import { Text, iconMap } from "../../../typography"
import {
  IconTile,
  LIST_DIVIDER_INSET,
  ListRow,
  ModalCardSheet,
  PopoverMenu,
  PrimaryButton,
  SecondaryButton,
  SectionCard,
  useToast,
  usePopoverAnchor,
} from "../../../primitives"
import type { AnchorRect } from "../../../primitives"
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
import { RowsSkeleton } from "../HostSkeletons"
import { formatMinor, formatMoney } from "../donationFormat"
import {
  canManageOrgPayments,
  canViewOrgMoney,
  DASHBOARD_RANGES,
  DEFAULT_DASHBOARD_RANGE,
  donationSummaryFrom,
  payoutBlockedKey,
  payoutButtonModel,
  payoutErrorKey,
  type DashboardRange,
} from "./dashboardModel"

const RECENT_PAYOUTS = 3

const CLOSED = "closed"

function payoutDateLabel(payout: PayoutDTO, locale: string): string {
  const parsed = new Date(payout.arrivalDate ?? payout.createdAt)
  if (Number.isNaN(parsed.getTime())) return ""
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(parsed)
  } catch {
    return parsed.toISOString().slice(0, 10)
  }
}

export interface MoneySectionProps {
  org: OrganizationDTO
}

export function MoneySection({ org }: MoneySectionProps) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("event-dashboard")
  const { locale } = useLocale()
  const toast = useToast()
  const openExternal = useOpenExternal()

  const [range, setRange] = useState<DashboardRange>(DEFAULT_DASHBOARD_RANGE)
  const [rangeOpen, setRangeOpen] = useState<string>(CLOSED)
  const [rangeRect, setRangeRect] = useState<AnchorRect | null>(null)
  const { ref: rangeAnchorRef, measure: measureRange } = usePopoverAnchor(setRangeRect)

  const canView = canViewOrgMoney(org.myRole)
  const status = useOrgPaymentsStatus(org.id, { enabled: canView })
  const connected = !!status.data?.stripeAccountId
  const balance = useOrgBalance(org.id, { enabled: connected })
  const summaryRange = useMemo(
    () => ({ from: donationSummaryFrom(range, new Date()) }),
    [range],
  )
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

  if (status.isPending) return <RowsSkeleton rows={3} />

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
      <SectionCard label={t("money.section")} variant="list" dividerInset={LIST_DIVIDER_INSET}>
        <ListRow
          leading={<IconTile icon="ReceiptText" />}
          title={t("money.connect")}
          titleLines={1}
          sub={canManage ? t("money.not_connected") : t("money.connect_owner_only")}
          {...(canManage ? { chevron: true, onPress: onboard } : {})}
        />
      </SectionCard>
    )
  }

  const payoutSub = blockedKey
    ? t(blockedKey)
    : !button.visible
      ? t("money.payout_owner_only")
      : balance.data?.payoutSchedule
        ? t(`money.schedule_${balance.data.payoutSchedule.interval}`)
        : undefined

  const captions = [
    balance.isError ? t("money.balance_error") : null,
    summary.data
      ? t("money.donations_total", {
          amount: formatMinor(summary.data.netMinor, "USD", locale),
          count: summary.data.donationCount,
        })
      : null,
    summary.isError ? t("money.summary_error") : null,
    payouts.isError ? t("money.payouts_error") : null,
  ].filter((line): line is string => line !== null)

  const rangePill = (
    <View ref={rangeAnchorRef}>
      <SecondaryButton
        size="sm"
        label={t(`range.${range}`)}
        trailingIcon={iconMap.ChevronDown}
        accessibilityLabel={t("money.range_a11y")}
        onPress={() => {
          measureRange()
          setRangeOpen("range")
        }}
      />
    </View>
  )

  return (
    <View>
      <SectionCard
        label={t("money.section")}
        trailing={rangePill}
        variant="list"
        dividerInset={LIST_DIVIDER_INSET}
      >
        <ListRow
          leading={<IconTile icon="CheckCircle2" />}
          title={t("money.available")}
          titleLines={1}
          trailing={balance.data ? formatMoney(balance.data.available, locale) : t("money.dash")}
        />
        <ListRow
          leading={<IconTile icon="Clock" />}
          title={t("money.pending")}
          titleLines={1}
          trailing={balance.data ? formatMoney(balance.data.pending, locale) : t("money.dash")}
        />
        <ListRow
          leading={<IconTile icon="ReceiptText" />}
          title={t("money.payout")}
          titleLines={1}
          {...(payoutSub ? { sub: payoutSub } : {})}
          {...(button.enabled ? { chevron: true, onPress: askPayout } : {})}
        />
        {rows.map((payout) => (
          <ListRow
            key={payout.id}
            leading={<IconTile icon="Check" tone="success" />}
            title={t("money.sent_on", { date: payoutDateLabel(payout, locale) })}
            titleLines={1}
            sub={t(`money.payout_status_${payout.status}`)}
            trailing={formatMoney(payout.amount, locale)}
          />
        ))}
        {captions.length > 0 ? (
          <View style={styles.captionRow}>
            {captions.map((caption) => (
              <Text key={caption} variant="caption">
                {caption}
              </Text>
            ))}
          </View>
        ) : null}
      </SectionCard>

      <PopoverMenu
        visible={rangeOpen === "range"}
        anchorRect={rangeRect}
        onClose={() => setRangeOpen(CLOSED)}
        items={DASHBOARD_RANGES.map((key) => ({
          key,
          label: t(`range.${key}`),
          ...(key === range ? { icon: "Check" as const } : {}),
          onPress: () => {
            setRangeOpen(CLOSED)
            setRange(key)
          },
        }))}
      />

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
  captionRow: {
    gap: t.space["1"],
    paddingHorizontal: t.space["4"],
    paddingVertical: t.space["3"],
  },
}))
