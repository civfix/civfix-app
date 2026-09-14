import React, { useEffect, useMemo, useState } from "react"
import { Platform, View } from "react-native"
import { ReportCategorySchema, type ReportCategory } from "@civfix/shared"
import type { LatLng } from "@civfix/shared/geocode"
import { makeThemedStyles, useTheme, webInputReset } from "../theme"
import { Text, TextLink } from "../typography"
import {
  FilterChip,
  ModalCardSheet,
  PrimaryButton,
  SkeletonGroup,
  SkeletonList,
  TextInput,
  modalSheetInputFocusedStyle,
  modalSheetInputStyle,
} from "../primitives"
import { useReportSearch } from "../data"
import { SEARCH_DEBOUNCE_MS, useDebouncedValue } from "../data/hooks/useDebouncedValue"
import { useT } from "../i18n"
import { FeedNotice } from "./FeedNotice"
import { ReportLinkRow } from "./ReportLinkRow"
import { pinToCardData, useLinkedReportCards } from "./linkedReportCards"

const SEARCH_CATEGORIES: readonly ReportCategory[] = ReportCategorySchema.options

export interface ReportSearchSheetProps {
  visible: boolean
  value: readonly string[]
  center: LatLng | null
  onToggle: (id: string, title: string) => void
  onClose: () => void
}

export function ReportSearchSheet({
  visible,
  value,
  center,
  onToggle,
  onClose,
}: ReportSearchSheetProps) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("event-form")
  const { t: tEnums } = useT("enums")
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState<ReportCategory | null>(null)
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!visible) return
    setQuery("")
    setCategory(null)
    setFocused(false)
  }, [visible])

  const debounced = useDebouncedValue(query, SEARCH_DEBOUNCE_MS)
  const categories = useMemo(() => (category ? [category] : []), [category])
  const search = useReportSearch({ q: debounced, categories })

  const hitCards = useMemo(() => search.items.map(pinToCardData), [search.items])

  useEffect(() => {
    if (hitCards.length > 0) useLinkedReportCards.getState().put(hitCards)
  }, [hitCards])

  const idle = debounced.trim().length === 0 && categories.length === 0

  return (
    <ModalCardSheet
      visible={visible}
      onClose={onClose}
      onCommit={onClose}
      headerIcon="Search"
      title={t("linkedReports.sheet_title")}
      dismissLabel={t("linkedReports.sheet_dismiss_a11y")}
      bodyLayout="scroll"
      actions={<PrimaryButton label={t("linkedReports.sheet_done")} onPress={onClose} />}
    >
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder={t("linkedReports.searchPlaceholder")}
        placeholderTextColor={th.colors.textSubtle}
        accessibilityLabel={t("linkedReports.searchPlaceholder")}
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus={Platform.OS === "web"}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[webInputReset, styles.input, focused ? modalSheetInputFocusedStyle(th) : null]}
      />

      <View style={styles.chips} accessibilityRole="radiogroup">
        <FilterChip
          label={t("linkedReports.all_categories")}
          selected={category === null}
          onPress={() => setCategory(null)}
          accessibilityLabel={t("linkedReports.filterByType", {
            type: t("linkedReports.all_categories"),
          })}
        />
        {SEARCH_CATEGORIES.map((cat) => (
          <FilterChip
            key={cat}
            label={tEnums(`category.${cat}`)}
            selected={category === cat}
            onPress={() => setCategory(category === cat ? null : cat)}
            accessibilityLabel={t("linkedReports.filterByType", {
              type: tEnums(`category.${cat}`),
            })}
          />
        ))}
      </View>

      <Text variant="caption" color={th.colors.textSubtle}>
        {value.length > 0
          ? t("linkedReports.selectedCount", { count: value.length })
          : t("linkedReports.search_hint")}
      </Text>

      {search.isError ? (
        <FeedNotice
          icon="CloudOff"
          title={t("linkedReports.loadError")}
          actionLabel={t("linkedReports.retry")}
          onAction={search.refetch}
        />
      ) : search.isLoading ? (
        <SkeletonGroup>
          <SkeletonList kind="report" rows={3} />
        </SkeletonGroup>
      ) : hitCards.length === 0 ? (
        <Text variant="caption" color={th.colors.textSubtle}>
          {idle ? t("linkedReports.emptyNone") : t("linkedReports.emptyNoMatch")}
        </Text>
      ) : (
        <View style={styles.rows}>
          {hitCards.map((card) => (
            <ReportLinkRow
              key={card.id}
              id={card.id}
              card={card}
              center={center}
              selected={value.includes(card.id)}
              onToggle={onToggle}
            />
          ))}
          {search.hasNextPage ? (
            <View style={styles.moreRow}>
              <TextLink
                variant="label"
                standalone
                accessibilityLabel={t("linkedReports.loadMoreA11y")}
                onPress={search.fetchNextPage}
              >
                {search.isFetchingNextPage
                  ? t("linkedReports.loading")
                  : t("linkedReports.loadMore")}
              </TextLink>
            </View>
          ) : null}
        </View>
      )}
    </ModalCardSheet>
  )
}

const useStyles = makeThemedStyles((t) => ({
  input: {
    ...modalSheetInputStyle(t),
    minHeight: 42,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: t.space["1"],
  },
  rows: {
    gap: t.space["2"],
  },
  moreRow: {
    alignItems: "center",
    paddingVertical: t.space["1"],
  },
}))
