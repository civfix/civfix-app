import React, { useCallback, useMemo } from "react"
import { View, StyleSheet } from "react-native"
import type { DonationDTO } from "@civfix/shared"
import { makeThemedStyles, useTheme } from "../../theme"
import { Text, TextLink, Icon, iconMap } from "../../typography"
import { SignInPrompt, useToast } from "../../primitives"
import { useOpenExternal } from "../../capabilities"
import { useAuthState, useRequireAuth } from "../../data"
import { donationRows, useMyDonationReceipt, useMyDonations } from "../../data/hooks/donations"
import { useLocale, useT } from "../../i18n"
import { useScrollHost } from "../../shell/ScrollHost"
import { FeedNotice } from "../FeedNotice"
import { formatMoney } from "./donationFormat"

function DonationRow({
  donation,
  locale,
  onReceipt,
  receiptPending,
}: {
  donation: DonationDTO
  locale: string
  onReceipt: (id: string) => void
  receiptPending: boolean
}) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("donations")
  const when = donation.chargedAt ?? donation.createdAt
  const dateLabel = (() => {
    const parsed = new Date(when)
    if (Number.isNaN(parsed.getTime())) return ""
    try {
      return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(parsed)
    } catch {
      return parsed.toISOString().slice(0, 10)
    }
  })()

  return (
    <View style={styles.row}>
      <View style={styles.rowMeta}>
        <Text style={styles.rowOrg} numberOfLines={1}>
          {donation.orgLegalName?.trim() || donation.orgName}
        </Text>
        <Text style={styles.rowSub} numberOfLines={1}>
          {[dateLabel, t(`enums:donationStatus.${donation.status}`), donation.eventTitle ?? null]
            .filter((part): part is string => !!part && part.length > 0)
            .join(" · ")}
        </Text>
        {donation.receiptAvailable ? (
          <TextLink
            variant="label"
            standalone
            disabled={receiptPending}
            onPress={() => onReceipt(donation.id)}
            accessibilityLabel={t("receipt.download_a11y")}
          >
            {t("receipt.download")}
          </TextLink>
        ) : null}
      </View>
      <View style={styles.rowAmount}>
        <Text style={styles.amount}>{formatMoney(donation.amount, locale)}</Text>
        {donation.refundedTotalMinor > 0 ? (
          <View style={styles.refundRow}>
            <Icon icon={iconMap.RefreshCw} size={12} color={th.colors.textSubtle} />
            <Text style={styles.refund}>
              {t("row.refunded", {
                amount: formatMoney(
                  { amountMinor: donation.refundedTotalMinor, currency: donation.amount.currency },
                  locale,
                ),
              })}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  )
}

export function MyDonationsBody() {
  const styles = useStyles()
  const { t } = useT("donations")
  const { ScrollView } = useScrollHost()
  const { locale } = useLocale()
  const toast = useToast()
  const openExternal = useOpenExternal()
  const requireAuth = useRequireAuth()
  const { isAuthenticated, isPending } = useAuthState()

  const query = useMyDonations()
  const receipt = useMyDonationReceipt()
  const rows = useMemo(() => donationRows(query.data?.pages), [query.data?.pages])

  const onReceipt = useCallback(
    (id: string) => {
      receipt.mutate(
        { id },
        {
          onSuccess: (res) => {
            if (!openExternal) {
              toast.show(t("receipt.unavailable"), { variant: "error" })
              return
            }
            void openExternal.open(res.url)
          },
          onError: () => toast.show(t("receipt.error"), { variant: "error" }),
        },
      )
    },
    [openExternal, receipt, t, toast],
  )

  const { fetchNextPage, hasNextPage, isFetchingNextPage } = query
  const loadMore = useCallback(() => {
    if (!hasNextPage || isFetchingNextPage) return
    void fetchNextPage()
  }, [fetchNextPage, hasNextPage, isFetchingNextPage])

  if (!isAuthenticated && !isPending) {
    return (
      <View style={styles.fill}>
        <SignInPrompt
          icon={iconMap.ReceiptText}
          iconSize={32}
          variant="detail"
          title={t("state.signed_out_title")}
          body={t("state.signed_out_body")}
          onSignIn={() => requireAuth(() => {}, { next: "/me/donations" })}
        />
      </View>
    )
  }

  if (isPending || query.isLoading) {
    return (
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.muted}>{t("state.loading")}</Text>
      </ScrollView>
    )
  }

  if (query.isError) {
    return (
      <View style={styles.fill}>
        <FeedNotice plain icon="CloudOff" title={t("state.error_title")} body={t("state.error_body")} />
      </View>
    )
  }

  if (rows.length === 0) {
    return (
      <View style={styles.fill}>
        <FeedNotice plain icon="HandHeart" title={t("state.empty_title")} body={t("state.empty_body")} />
      </View>
    )
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {rows.map((donation) => (
        <DonationRow
          key={donation.id}
          donation={donation}
          locale={locale}
          onReceipt={onReceipt}
          receiptPending={receipt.isPending}
        />
      ))}
      {hasNextPage ? (
        <View style={styles.more}>
          <TextLink
            variant="label"
            standalone
            disabled={isFetchingNextPage}
            onPress={loadMore}
            accessibilityLabel={t("list.load_more_a11y")}
          >
            {isFetchingNextPage ? t("list.loading_more") : t("list.load_more")}
          </TextLink>
        </View>
      ) : null}
      <Text style={styles.footnote}>{t("list.footnote")}</Text>
    </ScrollView>
  )
}

const useStyles = makeThemedStyles((t) => ({
  scroll: {
    flex: 1,
  },
  fill: {
    flex: 1,
  },
  content: {
    paddingHorizontal: t.space["4"],
    paddingTop: t.space["2"],
    paddingBottom: t.space["10"],
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: t.space["3"],
    paddingVertical: t.space["3"],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.colors.border,
  },
  rowMeta: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rowOrg: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["14"],
    color: t.colors.text,
  },
  rowSub: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["12"],
    color: t.colors.textSubtle,
  },
  rowAmount: {
    alignItems: "flex-end",
    gap: 2,
  },
  amount: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: t.fontSize["15"],
    color: t.colors.text,
  },
  refundRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  refund: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["12"],
    color: t.colors.textSubtle,
  },
  more: {
    alignSelf: "flex-start",
    paddingVertical: t.space["3"],
  },
  footnote: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["12"],
    lineHeight: 16,
    color: t.colors.textSubtle,
    marginTop: t.space["3"],
  },
  muted: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["13"],
    color: t.colors.textSubtle,
  },
}))
