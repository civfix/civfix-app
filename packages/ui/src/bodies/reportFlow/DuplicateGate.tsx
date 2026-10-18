import React, { useCallback, useRef, useState } from "react"
import { ErrorCode, appErrorCode } from "@civfix/contract"
import { View } from "react-native"
import { makeThemedStyles, useTheme } from "../../theme"
import { Text } from "../../typography"
import { useNavStore } from "../../nav"
import { useScrollHost } from "../../shell/ScrollHost"
import { useT } from "../../i18n"
import { useAuthState, useConfirmMatch } from "../../data"
import { useToast } from "../../primitives"
import type { NearbyReportRow } from "../linkReportsModel"
import { DuplicateMatchCard } from "./DuplicateMatchCard"
import { useHardwareBack } from "./useHardwareBack"

// Below this a list row is too narrow for two cards side by side (two phone-width cards plus the gap).
const TWO_COLUMNS_FROM = 640

/**
 * The "Possible duplicate" screen's list, in place of the step content while it shows. The flow's pinned
 * footer carries "Report a new problem", so it never scrolls away.
 */
export function DuplicateGate({
  rows,
  onOpen,
  onBack,
}: {
  rows: NearbyReportRow[]
  onOpen: (row: NearbyReportRow) => void
  onBack: () => void
}) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("report-wizard")
  const { ScrollView } = useScrollHost()
  const [listWidth, setListWidth] = useState(0)
  const cardWidth = listWidth >= TWO_COLUMNS_FROM ? (listWidth - th.space["3"]) / 2 : undefined

  // Android's back otherwise leaves the whole flow. The body stays mounted under a match's page and in the
  // kept-alive report tab, so it answers only while the screen is what the reporter sees.
  const onScreen = useNavStore((s) => s.view === "report" && s.stack.length === 0)
  useHardwareBack(onScreen, onBack)

  // Guests start the flow too; Me too is only offered once the reporter is signed in (#156 D8).
  const { isAuthenticated } = useAuthState()
  const toast = useToast()
  const confirm = useConfirmMatch()
  const { mutate: confirmMatch } = confirm
  const busyId = confirm.isPending ? confirm.variables : null
  // A second tap can land before the busy state renders; the ref drops it so one tap sends one Me too.
  const sending = useRef(false)
  const onMeToo = useCallback(
    (row: NearbyReportRow) => {
      if (sending.current) return
      sending.current = true
      confirmMatch(row.pin.id, {
        onSettled: () => {
          sending.current = false
        },
        onSuccess: () => onOpen(row),
        onError: (err) => {
          // Their own earlier report: Me too cannot apply, so it opens like the card does.
          if (appErrorCode(err) === ErrorCode.FORBIDDEN) onOpen(row)
          else toast.show(t("wizard.duplicate.me_too_error"), { variant: "error" })
        },
      })
    },
    [confirmMatch, onOpen, toast, t],
  )

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={styles.head}>
        <Text variant="title" style={styles.title} accessibilityRole="header">
          {t("wizard.duplicate.title")}
        </Text>
        <Text style={styles.help}>{t("wizard.duplicate.help", { count: rows.length })}</Text>
      </View>
      <View style={styles.list} onLayout={(e) => setListWidth(e.nativeEvent.layout.width)}>
        {rows.map((row) => (
          <DuplicateMatchCard
            key={row.pin.id}
            row={row}
            width={cardWidth}
            onOpen={onOpen}
            onMeToo={isAuthenticated ? onMeToo : undefined}
            meTooBusy={busyId === row.pin.id}
            meTooDisabled={busyId !== null}
          />
        ))}
      </View>
    </ScrollView>
  )
}

const useStyles = makeThemedStyles((t) => ({
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: t.space["4"],
    paddingTop: t.space["2"],
    paddingBottom: t.space["8"],
    gap: t.space["4"],
  },
  head: { gap: t.space["1"], paddingTop: t.space["2"] },
  title: {
    fontFamily: t.fontFamily.bodyExtraBold,
    lineHeight: t.fontSize["20"] * t.lineHeight.snug,
  },
  help: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["13"],
    lineHeight: t.fontSize["13"] * t.lineHeight.base,
    color: t.colors.textMuted,
  },
  list: { flexDirection: "row", flexWrap: "wrap", gap: t.space["3"] },
}))
