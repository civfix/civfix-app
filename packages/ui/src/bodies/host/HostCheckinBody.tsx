import React, { useCallback, useMemo, useState } from "react"
import { View } from "react-native"
import { TextInput } from "../../primitives/TextInput"
import type { CheckinResultDTO, EventCheckinCountersDTO } from "@civfix/shared"
import { headingLevel, makeThemedStyles, useTheme, webInputReset } from "../../theme"
import { Text, TextLink, Icon, iconMap } from "../../typography"
import {
  PrimaryButton,
  SecondaryButton,
  StatTile,
  StatTileRow,
  fieldFocusedStyle,
  useToast,
} from "../../primitives"
import { formatStatValue } from "../../primitives/statTileModel"
import { presentScanner } from "../../primitives/scannerPresenter"
import { useScannerAvailable } from "../../primitives/useScannerAvailable"
import { useHaptics } from "../../capabilities"
import { useAuthState, useCleanup } from "../../data"
import {
  cleanupHostStanding,
  hasHostCapability,
  rosterRows,
  useCheckInEventSeat,
  useHostCounters,
  useHostRoster,
  useScanEventTicket,
  useUndoEventCheckIn,
} from "../../data/hooks/host"
import { useDebouncedValue } from "../../data/hooks/useDebouncedValue"
import { useLocale, useT } from "../../i18n"
import { useScrollHost } from "../../shell/ScrollHost"
import { FeedNotice } from "../FeedNotice"
import { appErrorCode } from "../errorCode"
import { checkinResultRender, manualCodeReady, normalizeManualCode, MANUAL_CODE_MAX } from "./checkinResult"
import { useCheckinOutbox } from "./useCheckinOutbox"
import { TilesSkeleton } from "./HostSkeletons"
import { RosterCheckinList } from "./RosterCheckinList"
import { rosterMutationErrorKey } from "./rosterFiltersModel"

interface ResultState {
  result: CheckinResultDTO
  seatId: string | null
}

function CheckinCounters({
  counters,
}: {
  counters: { data?: EventCheckinCountersDTO; isLoading: boolean; isError: boolean }
}) {
  const { t } = useT("host-common")
  const { locale } = useLocale()
  if (counters.isLoading) return <TilesSkeleton columns={4} />
  const data = counters.data
  if (counters.isError || !data) {
    return (
      <Text variant="caption" accessibilityRole="alert">
        {t("counters.error")}
      </Text>
    )
  }
  const shown = (value: number) => formatStatValue(value, locale) ?? String(value)
  return (
    <StatTileRow columns={4}>
      <StatTile label={t("counters.checked_in")} value={shown(data.checkedIn)} />
      <StatTile
        label={t("counters.registered")}
        value={shown(data.registered)}
        hint={data.capacity != null ? t("counters.of_capacity", { capacity: data.capacity }) : undefined}
      />
      <StatTile label={t("counters.waitlist")} value={shown(data.waitlisted)} />
      <StatTile label={t("counters.no_show")} value={shown(data.noShow)} />
    </StatTileRow>
  )
}

export function HostCheckinBody({ id }: { id: string }) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("host-checkin")
  const { t: tRoster } = useT("host-common")
  const { ScrollView } = useScrollHost()
  const haptics = useHaptics()
  const toast = useToast()

  const cleanup = useCleanup(id)
  const scan = useScanEventTicket(id)
  const undo = useUndoEventCheckIn(id)
  const outbox = useCheckinOutbox(id)

  const [code, setCode] = useState("")
  const [state, setState] = useState<ResultState | null>(null)
  const [errorText, setErrorText] = useState<string | null>(null)
  const [codeFocused, setCodeFocused] = useState(false)
  const [rosterSearch, setRosterSearch] = useState("")
  const [rosterFocused, setRosterFocused] = useState(false)
  const canScan = useScannerAvailable()

  const viewerId = useAuthState().user?.id ?? null
  const canCheckIn = hasHostCapability(cleanupHostStanding(cleanup.data, viewerId), "check_in")
  const counters = useHostCounters(id, { enabled: canCheckIn })
  const rosterQuery = useDebouncedValue(rosterSearch, 250)
  const roster = useHostRoster(id, {
    filter: "not_checked_in",
    q: rosterQuery,
    enabled: canCheckIn,
  })
  const waiting = useMemo(() => rosterRows(roster.data?.pages), [roster.data?.pages])
  const checkIn = useCheckInEventSeat(id)
  const onRosterCheckIn = useCallback(
    (seatId: string) => {
      checkIn.mutate(
        { seatId },
        { onError: (err) => toast.show(tRoster(rosterMutationErrorKey(err)), { variant: "error" }) },
      )
    },
    [checkIn, tRoster, toast],
  )
  const onRosterUndo = useCallback(
    (seatId: string) => {
      undo.mutate(
        { seatId },
        { onError: (err) => toast.show(tRoster(rosterMutationErrorKey(err)), { variant: "error" }) },
      )
    },
    [tRoster, toast, undo],
  )
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = roster
  const loadMoreWaiting = useCallback(() => {
    if (!hasNextPage || isFetchingNextPage) return
    void fetchNextPage()
  }, [fetchNextPage, hasNextPage, isFetchingNextPage])

  const submitToken = useCallback(
    (token: string) => {
      setErrorText(null)
      scan.mutate(
        { token },
        {
          onSuccess: (result) => {
            setState({ result, seatId: result.seat?.id ?? null })
            setCode("")
            if (result.outcome === "checked_in" && result.firstTime) haptics.success()
            else haptics.error()
          },
          onError: (err) => {
            const codeName = appErrorCode(err)
            if (codeName === undefined || codeName === "INTERNAL" || codeName === "RATE_LIMITED") {
              outbox.queue({ method: "scan", token })
              setCode("")
              toast.show(t("outbox.queued"), { variant: "info" })
              return
            }
            setErrorText(t("error.generic"))
          },
        },
      )
    },
    [haptics, outbox, scan, t, toast],
  )

  const onScan = useCallback(() => {
    void presentScanner().then((token) => {
      if (token) submitToken(token)
    })
  }, [submitToken])

  const onSubmitCode = useCallback(() => {
    const value = normalizeManualCode(code)
    if (!manualCodeReady(value)) {
      setErrorText(t("error.code_length"))
      return
    }
    submitToken(value)
  }, [code, submitToken, t])

  const onUndo = useCallback(() => {
    const seatId = state?.seatId
    if (!seatId) return
    undo.mutate(
      { seatId },
      {
        onSuccess: () => {
          setState(null)
          toast.show(t("result.undo_done"), { variant: "success" })
        },
        onError: () => setErrorText(t("error.generic")),
      },
    )
  }, [state?.seatId, t, toast, undo])

  if (cleanup.isLoading) {
    return (
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.muted}>{t("state.loading")}</Text>
      </ScrollView>
    )
  }

  if (cleanup.isError || !cleanup.data) {
    return (
      <View style={styles.fill}>
        <FeedNotice plain icon="CloudOff" title={t("state.error_title")} body={t("state.error_body")} />
      </View>
    )
  }

  if (!canCheckIn) {
    return (
      <View style={styles.fill}>
        <FeedNotice plain icon="Lock" title={t("state.denied_title")} body={t("state.denied_body")} />
      </View>
    )
  }

  const render = state ? checkinResultRender(state.result.outcome, state.result.firstTime) : null
  const toneColor =
    render?.tone === "success"
      ? th.colors.moss["700"]
      : render?.tone === "warning"
        ? th.colors.sun["700"]
        : render?.tone === "error"
          ? th.colors.dangerInk
          : th.colors.textMuted

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <CheckinCounters counters={counters} />

      {outbox.pending > 0 ? (
        <View style={styles.outbox} accessibilityRole="alert">
          <Icon icon={iconMap.WifiOff} size={14} color={th.colors.sun["700"]} />
          <Text style={styles.outboxText}>{t("outbox.pending", { count: outbox.pending })}</Text>
          <SecondaryButton
            label={t("outbox.retry")}
            size="sm"
            disabled={outbox.replaying}
            onPress={() => void outbox.replay()}
          />
        </View>
      ) : null}

      {outbox.report ? (
        <View style={styles.replay} accessibilityRole="alert">
          <View style={styles.resultHead}>
            <Icon icon={iconMap.ClipboardList} size={16} color={th.colors.text} />
            <Text style={styles.replayTitle}>{t("replay.title")}</Text>
          </View>
          {outbox.report.sent > 0 ? (
            <Text style={styles.replayLine}>{t("replay.sent", { count: outbox.report.sent })}</Text>
          ) : null}
          {outbox.report.refusals.map((refusal) => (
            <Text key={refusal.outcome} style={styles.replayWarn}>
              {t("replay.refused_line", {
                count: refusal.count,
                label: t(checkinResultRender(refusal.outcome, true).titleKey),
              })}
            </Text>
          ))}
          {outbox.report.forbidden > 0 ? (
            <Text style={styles.replayWarn}>
              {t("replay.forbidden", { count: outbox.report.forbidden })}
            </Text>
          ) : null}
          {outbox.report.discarded > 0 ? (
            <Text style={styles.replayWarn}>
              {t("replay.discarded", { count: outbox.report.discarded })}
            </Text>
          ) : null}
          {outbox.report.held > 0 ? (
            <Text style={styles.replayWarn}>{t("replay.held", { count: outbox.report.held })}</Text>
          ) : null}
          <View style={styles.resultActions}>
            <SecondaryButton
              label={t("replay.dismiss")}
              size="sm"
              onPress={outbox.dismissReport}
            />
          </View>
        </View>
      ) : null}

      {render && state ? (
        <View style={[styles.result, { borderColor: toneColor }]} accessibilityRole="alert">
          <View style={styles.resultHead}>
            <Icon icon={iconMap[render.icon]} size={20} color={toneColor} />
            <Text style={[styles.resultTitle, { color: toneColor }]}>{t(render.titleKey)}</Text>
          </View>
          <Text style={styles.resultBody}>{t(render.bodyKey)}</Text>
          {state.result.attendeeName ? (
            <Text style={styles.resultName}>{state.result.attendeeName}</Text>
          ) : null}
          <Text style={styles.resultMeta}>
            {[
              state.result.ticketTypeName ?? null,
              state.result.partySize != null
                ? t("result.party", { count: state.result.partySize })
                : null,
            ]
              .filter((part): part is string => part !== null)
              .join(" · ")}
          </Text>
          <View style={styles.resultActions}>
            {render.undoable && state.seatId ? (
              <SecondaryButton
                label={t("result.undo")}
                size="sm"
                disabled={undo.isPending}
                onPress={onUndo}
              />
            ) : null}
            <SecondaryButton label={t("result.dismiss")} size="sm" onPress={() => setState(null)} />
          </View>
        </View>
      ) : null}

      {canScan ? (
        <PrimaryButton
          label={t("action.scan")}
          icon={iconMap.ScanLine}
          onPress={onScan}
          loading={scan.isPending}
        />
      ) : (
        <Text style={styles.muted}>{t("action.scan_unavailable")}</Text>
      )}

      <View style={styles.manual}>
        <Text style={styles.manualLabel}>{t("manual.label")}</Text>
        <TextInput
          value={code}
          onChangeText={setCode}
          editable={!scan.isPending}
          maxLength={MANUAL_CODE_MAX}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder={t("manual.placeholder")}
          placeholderTextColor={th.colors.textSubtle}
          accessibilityLabel={t("manual.label")}
          onSubmitEditing={onSubmitCode}
          onFocus={() => setCodeFocused(true)}
          onBlur={() => setCodeFocused(false)}
          style={[webInputReset, styles.input, codeFocused ? fieldFocusedStyle(th) : null]}
        />
        <SecondaryButton
          label={t("manual.submit")}
          onPress={onSubmitCode}
          disabled={scan.isPending || !manualCodeReady(code)}
        />
      </View>

      {errorText ? (
        <Text style={styles.error} accessibilityRole="alert">
          {errorText}
        </Text>
      ) : null}

      <View style={styles.roster}>
        <Text style={styles.rosterTitle} accessibilityRole="header" {...headingLevel(2)}>
          {t("roster.title")}
        </Text>
        <TextInput
          value={rosterSearch}
          onChangeText={setRosterSearch}
          placeholder={t("roster.search")}
          placeholderTextColor={th.colors.textSubtle}
          accessibilityLabel={t("roster.search")}
          autoCapitalize="none"
          autoCorrect={false}
          onFocus={() => setRosterFocused(true)}
          onBlur={() => setRosterFocused(false)}
          style={[webInputReset, styles.rosterSearch, rosterFocused ? fieldFocusedStyle(th) : null]}
        />
        {roster.isLoading ? (
          <Text style={styles.muted}>{tRoster("roster.loading")}</Text>
        ) : roster.isError ? (
          <Text style={styles.error} accessibilityRole="alert">
            {tRoster("roster.error")}
          </Text>
        ) : waiting.length === 0 ? (
          <FeedNotice
            plain
            icon="UserCheck"
            title={t("roster.empty_title")}
            body={t("roster.empty_body")}
          />
        ) : (
          <View>
            <RosterCheckinList
              rows={waiting}
              slots={cleanup.data.slots}
              timeZone={cleanup.data.timezone ?? undefined}
              canCheckIn
              pending={checkIn.isPending || undo.isPending}
              onCheckIn={onRosterCheckIn}
              onUndo={onRosterUndo}
            />
            {hasNextPage ? (
              <View style={styles.rosterMore}>
                <TextLink
                  variant="label"
                  standalone
                  disabled={isFetchingNextPage}
                  onPress={loadMoreWaiting}
                  accessibilityLabel={tRoster("roster.load_more_a11y")}
                >
                  {isFetchingNextPage ? tRoster("roster.loading_more") : tRoster("roster.load_more")}
                </TextLink>
              </View>
            ) : null}
          </View>
        )}
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
  muted: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["13"],
    color: t.colors.textSubtle,
  },
  outbox: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
    padding: t.space["3"],
    borderRadius: t.radius.lg,
    backgroundColor: t.colors.sun["50"],
  },
  outboxText: {
    flex: 1,
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["13"],
    color: t.colors.sun["700"],
  },
  replay: {
    gap: t.space["1"],
    padding: t.space["3"],
    borderRadius: t.radius.lg,
    borderWidth: 1.5,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
  },
  replayTitle: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: t.fontSize["15"],
    color: t.colors.text,
  },
  replayLine: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["13"],
    color: t.colors.textMuted,
  },
  replayWarn: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["13"],
    color: t.colors.dangerInk,
  },
  result: {
    gap: t.space["1"],
    padding: t.space["3"],
    borderRadius: t.radius.lg,
    borderWidth: 1.5,
    backgroundColor: t.colors.surface,
  },
  resultHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
  },
  resultTitle: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: t.fontSize["16"],
  },
  resultBody: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["13"],
    color: t.colors.textMuted,
  },
  resultName: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: t.fontSize["15"],
    color: t.colors.text,
    marginTop: t.space["1"],
  },
  resultMeta: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["12"],
    color: t.colors.textSubtle,
  },
  resultActions: {
    flexDirection: "row",
    gap: t.space["2"],
    marginTop: t.space["2"],
  },
  manual: {
    gap: t.space["2"],
  },
  manualLabel: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["13"],
    color: t.colors.text,
  },
  input: {
    minHeight: 44,
    paddingHorizontal: t.space["3"],
    borderRadius: t.radius.md,
    borderWidth: 1.5,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["15"],
    letterSpacing: 1,
    color: t.colors.text,
  },
  error: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["12"],
    color: t.colors.dangerInk,
  },
  roster: {
    gap: t.space["2"],
  },
  rosterTitle: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: t.fontSize["16"],
    color: t.colors.text,
  },
  rosterSearch: {
    minHeight: 42,
    paddingHorizontal: t.space["3"],
    borderRadius: t.radius.pill,
    borderWidth: 1.5,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["14"],
    color: t.colors.text,
  },
  rosterMore: {
    alignSelf: "flex-start",
    paddingVertical: t.space["2"],
  },
}))
