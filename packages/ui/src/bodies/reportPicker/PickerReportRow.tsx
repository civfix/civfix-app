import React, { memo, useMemo } from "react"
import { View } from "react-native"
import { makeThemedStyles } from "../../theme"
import { useT } from "../../i18n"
import { LinkedReportCard } from "../LinkedReportCard"
import { pinToCardData } from "../linkedReportCards"
import { linkedRowHeadline } from "../linkReportsModel"
import { METERS_PER_MILE } from "../reportHitRowModel"
import { distanceLabel } from "../relativeTime"
import { isChosen, type PickerMode, type PickerRow } from "./reportPickerModel"

export interface PickerReportRowProps {
  row: PickerRow
  mode: PickerMode
  focused: boolean
  atLimit: boolean
  onPress: (id: string, title: string) => void
}

export const PickerReportRow = memo(function PickerReportRow({
  row,
  mode,
  focused,
  atLimit,
  onPress,
}: PickerReportRowProps) {
  const styles = useStyles()
  const { t } = useT("report-picker")
  const { t: tEnums } = useT("enums")
  const { t: tLinked } = useT("report-linked")
  const card = useMemo(() => pinToCardData(row.pin), [row.pin])
  const chosen = isChosen(row.state)

  const view = useMemo(() => {
    const categoryLabel = tEnums(`category.${card.category}`)
    const title = card.title?.trim() || categoryLabel
    const distance = distanceLabel(row.distanceM / METERS_PER_MILE)
    const tag =
      row.state === "linked"
        ? t(mode === "draft" ? "row_added_tag" : "row_linked_tag")
        : row.state === "unlinking"
          ? t("row_unlinking_tag")
          : null
    const addr = card.addr?.trim() ?? ""
    const subtitle = [tag, distance, addr].filter(Boolean).join(" · ")
    return {
      title,
      subtitle: subtitle || card.description?.trim() || null,
      a11yLabel: tLinked("card.a11yLabelDistance", { title, category: categoryLabel, distance }),
    }
  }, [card, mode, row.distanceM, row.state, t, tEnums, tLinked])

  return (
    <View style={[styles.wrap, focused ? styles.focused : null]}>
      <LinkedReportCard
        report={card}
        layout="list"
        headline={linkedRowHeadline(card)}
        subtitle={view.subtitle}
        a11yLabel={view.a11yLabel}
        selectable
        selected={chosen}
        disabled={atLimit && !chosen}
        onPress={() => onPress(row.pin.id, view.title)}
      />
    </View>
  )
})

const useStyles = makeThemedStyles((t) => ({
  wrap: {
    width: "100%",
    borderRadius: t.radius.lg + 2,
    borderWidth: 2,
    borderColor: "transparent",
  },
  focused: {
    borderColor: t.colors.accent,
  },
}))
