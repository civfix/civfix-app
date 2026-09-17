import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { View, ScrollView as RNScrollView } from "react-native"
import type { MyEventTicketSeat } from "@civfix/shared"
import { makeThemedStyles, useTheme } from "../../theme"
import { Text, Icon, iconMap } from "../../typography"
import { PrimaryButton, SecondaryButton, QrTicket, useToast } from "../../primitives"
import { calendarSaveAvailable, saveCalendarFile } from "../../primitives/calendarFile"
import { useCalendarFile } from "../../capabilities"
import { useCancelEventRegistration, useMyEventTicket } from "../../data/hooks/host"
import { useCleanup } from "../../data"
import { useEventIcs } from "../../data/eventIcs"
import { useLocale, useT } from "../../i18n"
import { useNavStore } from "../../nav"
import { useScrollHost } from "../../shell/ScrollHost"
import { AddressRow } from "../AddressRow"
import { FeedNotice } from "../FeedNotice"
import { appErrorCode } from "../errorCode"
import {
  formatTicketCode,
  ticketPageIndex,
  ticketPageWidth,
  ticketQrSize,
  ticketAddressView,
  ticketSeatIndex,
  ticketSeatOffset,
  ticketWhen,
} from "./ticketModel"

export function MyTicketBody({ id, seatId }: { id: string; seatId?: string }) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("host-ticket")
  const { ScrollView } = useScrollHost()
  const { locale } = useLocale()
  const toast = useToast()
  const calendarWriter = useCalendarFile()
  const pagerRef = useRef<RNScrollView | null>(null)

  const query = useMyEventTicket(id)
  const cancel = useCancelEventRegistration(id)
  const icsDocument = useEventIcs(id, { enabled: false })
  const [page, setPage] = useState(0)
  const [pagerWidth, setPagerWidth] = useState(0)
  const [errorText, setErrorText] = useState<string | null>(null)
  const seededSeat = useRef(false)
  const pageRef = useRef(0)

  const ticket = query.data ?? null
  const event = useCleanup(ticket?.cleanupId)
  const where = useMemo(
    () => (ticket ? ticketAddressView(ticket, event.data ?? null) : null),
    [ticket, event.data],
  )
  const seats = useMemo<MyEventTicketSeat[]>(() => ticket?.seats ?? [], [ticket])
  const pageWidth = ticketPageWidth(pagerWidth)
  const qrSize = ticketQrSize(pageWidth)

  const goToPage = useCallback((index: number) => {
    pageRef.current = index
    setPage(index)
  }, [])

  useEffect(() => {
    if (seats.length === 0 || pageWidth === 0) return
    if (!seededSeat.current) {
      seededSeat.current = true
      const index = ticketSeatIndex(seats, seatId)
      if (index === 0) return
      pageRef.current = index
      setPage(index)
    }
    pagerRef.current?.scrollTo({ x: ticketSeatOffset(pageRef.current, pageWidth), animated: false })
  }, [pageWidth, seatId, seats])

  const onAddToCalendar = useCallback(async () => {
    if (!ticket) return
    const served = await icsDocument.refetch()
    if (served.isError || !served.data) {
      toast.show(t("calendar.error"), { variant: "error" })
      return
    }
    const result = await saveCalendarFile({
      filename: served.data.filename,
      ics: served.data.ics,
      writer: calendarWriter,
    })
    if (result === "unavailable") toast.show(t("calendar.unavailable"), { variant: "error" })
  }, [calendarWriter, icsDocument, t, ticket, toast])

  const onCancel = useCallback(() => {
    if (!ticket) return
    setErrorText(null)
    cancel.mutate(
      { registrationId: ticket.registrationId },
      {
        onSuccess: () => {
          toast.show(t("toast.cancelled"), { variant: "success" })
          useNavStore.getState().back()
        },
        onError: (err) =>
          setErrorText(appErrorCode(err) === "CONFLICT" ? t("outcome.closed") : t("error.generic")),
      },
    )
  }, [cancel, t, ticket, toast])

  if (query.isLoading) {
    return (
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.muted}>{t("state.loading")}</Text>
      </ScrollView>
    )
  }

  if (query.isError || !ticket) {
    return (
      <View style={styles.fill}>
        <FeedNotice plain icon="CloudOff" title={t("state.error_title")} body={t("state.error_body")} />
      </View>
    )
  }

  const waitlisted = ticket.waitlistPosition != null
  const active = seats[page] ?? seats[0] ?? null

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={2}>
          {ticket.title}
        </Text>
        <View style={styles.metaRow}>
          <Icon icon={iconMap.Calendar} size={14} color={th.colors.textSubtle} />
          <Text style={styles.meta}>{ticketWhen(ticket, locale)}</Text>
        </View>
        {where?.address ? (
          <AddressRow
            address={where.address}
            point={where.point}
            verified={where.verified}
            title={ticket.title}
            numberOfLines={2}
          />
        ) : null}
        {ticket.ticketTypeName ? (
          <View style={styles.metaRow}>
            <Icon icon={iconMap.Ticket} size={14} color={th.colors.textSubtle} />
            <Text style={styles.meta}>{ticket.ticketTypeName}</Text>
          </View>
        ) : null}
      </View>

      {waitlisted ? (
        <View style={styles.waitlist} accessibilityRole="alert">
          <Icon icon={iconMap.Hourglass} size={16} color={th.colors.sun["700"]} />
          <Text style={styles.waitlistText}>
            {t("mine.position", { position: ticket.waitlistPosition as number })}
          </Text>
        </View>
      ) : seats.length === 0 ? (
        <Text style={styles.muted}>{t("state.no_seats")}</Text>
      ) : (
        <>
          <RNScrollView
            ref={pagerRef}
            horizontal
            pagingEnabled={seats.length > 1}
            showsHorizontalScrollIndicator={false}
            onLayout={(event) => setPagerWidth(event.nativeEvent.layout.width)}
            onMomentumScrollEnd={(event) =>
              goToPage(
                ticketPageIndex(
                  event.nativeEvent.contentOffset.x,
                  ticketPageWidth(event.nativeEvent.layoutMeasurement.width),
                  seats.length,
                ),
              )
            }
            style={styles.pager}
          >
            {seats.map((seat, index) => (
              <View key={seat.id} style={[styles.page, pageWidth > 0 ? { width: pageWidth } : null]}>
                <QrTicket
                  value={seat.ticketToken}
                  size={qrSize}
                  label={t("qr.a11y", { index: index + 1, total: seats.length })}
                  code={formatTicketCode(seat.ticketToken)}
                  caption={
                    seat.checkedInAt
                      ? t("qr.checked_in")
                      : (seat.holderName ?? t("qr.seat", { index: index + 1 }))
                  }
                />
              </View>
            ))}
          </RNScrollView>
          {seats.length > 1 ? (
            <Text style={styles.pageIndicator}>
              {t("qr.page", { index: Math.min(page, seats.length - 1) + 1, total: seats.length })}
            </Text>
          ) : null}
          {active?.holderName ? <Text style={styles.holder}>{active.holderName}</Text> : null}
        </>
      )}

      {errorText ? (
        <Text style={styles.error} accessibilityRole="alert">
          {errorText}
        </Text>
      ) : null}

      <View style={styles.actions}>
        {calendarSaveAvailable({ writer: calendarWriter }) ? (
          <PrimaryButton
            label={t("calendar.add")}
            icon={iconMap.Calendar}
            loading={icsDocument.isFetching}
            onPress={() => void onAddToCalendar()}
          />
        ) : null}
        {ticket.canCancel ? (
          <SecondaryButton
            label={t("mine.cancel")}
            onPress={onCancel}
            size="sm"
            disabled={cancel.isPending}
          />
        ) : null}
      </View>
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
    gap: t.space["4"],
  },
  header: {
    gap: t.space["1"],
  },
  title: {
    fontFamily: t.fontFamily.displayBold,
    fontSize: t.fontSize["20"],
    color: t.colors.text,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  meta: {
    flexShrink: 1,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["13"],
    color: t.colors.textMuted,
  },
  muted: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["13"],
    color: t.colors.textSubtle,
  },
  waitlist: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
    padding: t.space["3"],
    borderRadius: t.radius.lg,
    backgroundColor: t.colors.sun["50"],
  },
  waitlistText: {
    flex: 1,
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["13"],
    color: t.colors.sun["700"],
  },
  pager: {
    marginHorizontal: -t.space["4"],
  },
  page: {
    alignItems: "center",
    paddingHorizontal: t.space["4"],
  },
  pageIndicator: {
    textAlign: "center",
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["12"],
    color: t.colors.textSubtle,
  },
  holder: {
    textAlign: "center",
    fontFamily: t.fontFamily.bodyBold,
    fontSize: t.fontSize["15"],
    color: t.colors.text,
  },
  actions: {
    gap: t.space["2"],
  },
  error: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["12"],
    color: t.colors.dangerInk,
  },
}))
