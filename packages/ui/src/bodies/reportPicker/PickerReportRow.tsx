import React, { memo, useMemo } from "react"
import { View } from "react-native"
import { makeThemedStyles } from "../../theme"
import { useT } from "../../i18n"
import { LinkedReportCard } from "../LinkedReportCard"
import { pinToCardData, useLinkedReportCards } from "../linkedReportCards"
import { localReportThumb } from "../localReportThumbs"
import { reportHitRowModel } from "../reportHitRowModel"
import { isChosen, reportShortCode, rowTagKey, type PickerMode, type PickerRow } from "./reportPickerModel"

const FOCUS_BORDER_WIDTH = 2

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
  const cachedReference = useLinkedReportCards((s) => s.cards[row.pin.id]?.referenceCode ?? null)
  const card = useMemo(() => {
    const data = pinToCardData(row.pin)
    return {
      ...data,
      referenceCode: data.referenceCode ?? cachedReference,
      thumbUrl: data.thumbUrl ?? localReportThumb(data.id),
    }
  }, [cachedReference, row.pin])
  const chosen = isChosen(row.state)

  const view = useMemo(() => {
    const categoryLabel = tEnums(`category.${card.category}`)
    const tagKey = rowTagKey(row.state, mode)
    const { title, distance, subtitle } = reportHitRowModel({
      report: card,
      categoryLabel,
      distanceM: row.distanceM,
      leadingTag: tagKey ? t(tagKey) : null,
    })
    const code = reportShortCode(card)
    return {
      title,
      code,
      subtitle,
      a11yLabel: t("row_a11y", { title, category: categoryLabel, code, distance }),
    }
  }, [card, mode, row.distanceM, row.state, t, tEnums])

  return (
    <View style={[styles.wrap, focused ? styles.focused : null]}>
      <LinkedReportCard
        report={card}
        layout="list"
        headline="title"
        subtitle={view.subtitle}
        code={view.code}
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
    borderRadius: t.radius.lg + FOCUS_BORDER_WIDTH,
    borderWidth: FOCUS_BORDER_WIDTH,
    borderColor: "transparent",
  },
  focused: {
    borderColor: t.colors.accent,
  },
}))
