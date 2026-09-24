import React, { useCallback, type RefObject } from "react"
import { View, type LayoutChangeEvent } from "react-native"
import { makeThemedStyles } from "../../theme"
import { Text } from "../../typography"
import { PrimaryButton, SkeletonGroup, SkeletonList } from "../../primitives"
import { useScrollHost, type ScrollHostListHandle } from "../../shell/ScrollHost"
import { useT } from "../../i18n"
import type { TFunction } from "i18next"
import { FeedNotice } from "../FeedNotice"
import { PickerReportRow } from "./PickerReportRow"
import {
  PICKER_PAGE_STEP,
  PICKER_ROW_GAP,
  type LoadMoreState,
  type PickerListItem,
  type PickerListState,
  type PickerMode,
} from "./reportPickerModel"

const LOADING_SKELETON_ROWS = 3

export function PickerList({
  listRef,
  listState,
  items,
  mode,
  focusedId,
  atLimit,
  query,
  more,
  shown,
  total,
  onPressRow,
  onItemLayout,
  onLoadMore,
  onRetry,
}: {
  listRef: RefObject<ScrollHostListHandle | null>
  listState: PickerListState
  items: readonly PickerListItem[]
  mode: PickerMode
  focusedId: string | null
  atLimit: boolean
  query: string
  more: LoadMoreState
  shown: number
  total: number
  onPressRow: (id: string, title: string) => void
  onItemLayout: (key: string, event: LayoutChangeEvent) => void
  onLoadMore: () => void
  onRetry: () => void
}) {
  const styles = useStyles()
  const { t } = useT("report-picker")
  const { FlatList } = useScrollHost()

  const renderItem = useCallback(
    ({ item }: { item: PickerListItem }) => {
      if (item.kind === "header") {
        return (
          <Text style={styles.sectionHeader} onLayout={(e) => onItemLayout(item.key, e)}>
            {t(
              item.place === "linked" && mode === "draft" ? "section_added" : `section_${item.place}`,
              { count: item.count },
            )}
          </Text>
        )
      }
      return (
        <View onLayout={(e) => onItemLayout(item.key, e)}>
          <PickerReportRow
            row={item.row}
            mode={mode}
            focused={focusedId === item.row.pin.id}
            atLimit={atLimit}
            onPress={onPressRow}
          />
        </View>
      )
    },
    [atLimit, focusedId, mode, onItemLayout, onPressRow, styles.sectionHeader, t],
  )

  const listFooter =
    more === "hidden" ? null : (
      <View style={styles.loadMore}>
        <PrimaryButton
          variant="outline"
          label={t("load_more", { count: PICKER_PAGE_STEP })}
          accessibilityLabel={t("load_more_a11y", { count: PICKER_PAGE_STEP, shown, total })}
          onPress={onLoadMore}
          loading={more === "loading"}
          disabled={more === "loading"}
        />
      </View>
    )

  if (listState === "rows") {
    return (
      <FlatList
        ref={listRef}
        data={items}
        keyExtractor={(item: PickerListItem) => item.key}
        renderItem={renderItem}
        extraData={focusedId}
        ListFooterComponent={listFooter}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      />
    )
  }

  return (
    <View style={styles.stateBox}>
      {listState === "loading" ? (
        <SkeletonGroup>
          <SkeletonList kind="report" rows={LOADING_SKELETON_ROWS} />
        </SkeletonGroup>
      ) : listState === "error" ? (
        <FeedNotice icon="CloudOff" title={t("load_error")} actionLabel={t("retry")} onAction={onRetry} />
      ) : (
        <Text style={styles.stateText}>{stateCopy(listState, query, t)}</Text>
      )}
    </View>
  )
}

function stateCopy(
  listState: Exclude<PickerListState, "rows" | "loading" | "error">,
  query: string,
  t: TFunction,
): string {
  if (listState === "no_match") return t("no_match", { query: query.trim() })
  if (listState === "too_wide") return t("zoom_in")
  if (listState === "no_layers") return t("empty_layers")
  return t("empty_view")
}

const useStyles = makeThemedStyles((t) => ({
  listContent: {
    paddingHorizontal: t.space["3"],
    paddingBottom: t.space["3"],
    gap: PICKER_ROW_GAP,
  },
  loadMore: {
    alignItems: "center",
    paddingTop: t.space["1"],
  },
  sectionHeader: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: t.fontSize["12"],
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: t.colors.textSubtle,
    paddingTop: t.space["2"],
  },
  stateBox: {
    flex: 1,
    padding: t.space["4"],
    gap: t.space["3"],
  },
  stateText: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["13"],
    lineHeight: 18,
    color: t.colors.textSubtle,
    textAlign: "center",
    paddingTop: t.space["4"],
  },
}))
