import React, { memo, useMemo } from "react"
import { View } from "react-native"
import { makeThemedStyles } from "../../theme"
import { useT } from "../../i18n"
import { LinkedReportCard } from "../LinkedReportCard"
import { pinToCardData, useLinkedReportCards } from "../linkedReportCards"
import { localReportThumb } from "../localReportThumbs"
import { METERS_PER_MILE } from "../reportHitRowModel"
import { distanceLabel } from "../relativeTime"
import { isChosen, reportShortCode, rowTagKey, type PickerMode, type PickerRow } from "./reportPickerModel"

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
    const title = card.title?.trim() || categoryLabel
    const distance = distanceLabel(row.distanceM / METERS_PER_MILE)
    const code = reportShortCode(card)
    const tagKey = rowTagKey(row.state, mode)
    const tag = tagKey ? t(tagKey) : null
    const addr = card.addr?.trim() ?? ""
    const subtitle = [tag, distance, addr].filter(Boolean).join(" · ")
    return {
      title,
      code,
      subtitle: subtitle || card.description?.trim() || null,
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
    borderRadius: t.radius.lg + 2,
    borderWidth: 2,
    borderColor: "transparent",
  },
  focused: {
    borderColor: t.colors.accent,
  },
}))
