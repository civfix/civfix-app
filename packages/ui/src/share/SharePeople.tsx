import React, { memo, useCallback } from "react"
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from "react-native"
import type { PersonDTO, UserSearchResultDTO } from "@civfix/shared"
import {
  makeThemedStyles,
  useTheme,
  focusRingProps,
  webCursor,
  webTransition,
  webHover,
  HOVERED_OPACITY,
  PRESSED_OPACITY,
} from "../theme"
import { Text, Icon, iconMap } from "../typography"
import { useT } from "../i18n"
import { Avatar } from "../primitives/Avatar"
import { idKeyExtractor } from "../bodies/navHelpers"
import { isShareRecipient, shareRecipientsSizing, type SharePeopleView } from "./shareSheetModel"

const TILE_AVATAR = 56
const ROW_AVATAR = 40
const TILE_BADGE_SIZE = 20
/** The row's selected badge and its empty checkbox share one footprint, so toggling never shifts the row. */
const ROW_CHECK_SIZE = 22
const SECTION_LABEL_LETTER_SPACING = 0.4

export interface SharePeopleProps {
  view: SharePeopleView
  selected: readonly PersonDTO[]
  query: string
  searchPending: boolean
  searchFailed: boolean
  onToggle: (person: UserSearchResultDTO) => void
}

const SelectedBadge = memo(function SelectedBadge({ size }: { size: number }) {
  const styles = useStyles()
  const th = useTheme()
  return (
    <View style={[styles.badge, { width: size, height: size, borderRadius: size / 2 }]}>
      <Icon icon={iconMap.Check} size={size * 0.6} color={th.colors.onAccent} />
    </View>
  )
})

const PersonTile = memo(function PersonTile({
  person,
  selected,
  onToggle,
}: {
  person: UserSearchResultDTO
  selected: boolean
  onToggle: (person: UserSearchResultDTO) => void
}) {
  const styles = useStyles()
  const { t } = useT("share-post")
  return (
    <Pressable
      onPress={() => onToggle(person)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={t("recipients.select_a11y", { name: person.displayName })}
      {...focusRingProps}
      style={(state) => [
        styles.tile,
        webCursor(),
        webTransition,
        webHover(state) ? styles.hovered : null,
        state.pressed ? styles.pressed : null,
      ]}
    >
      <View style={[styles.tileAvatar, selected ? styles.tileAvatarSelected : null]}>
        <Avatar
          name={person.displayName}
          seed={person.id}
          photoUrl={person.avatarUrl}
          gradient={person.avatar ?? null}
          size={TILE_AVATAR}
          decorative
        />
        {selected ? (
          <View style={styles.tileBadge}>
            <SelectedBadge size={TILE_BADGE_SIZE} />
          </View>
        ) : null}
      </View>
      <Text variant="caption" numberOfLines={1} style={styles.tileName}>
        {person.displayName}
      </Text>
    </Pressable>
  )
})

const PersonRow = memo(function PersonRow({
  person,
  selected,
  onToggle,
}: {
  person: UserSearchResultDTO
  selected: boolean
  onToggle: (person: UserSearchResultDTO) => void
}) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("share-post")
  return (
    <Pressable
      onPress={() => onToggle(person)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={t("recipients.select_a11y", { name: person.displayName })}
      {...focusRingProps}
      style={(state) => [
        styles.row,
        webCursor(),
        webTransition,
        webHover(state) ? styles.hovered : null,
        state.pressed ? styles.pressed : null,
      ]}
    >
      <Avatar
        name={person.displayName}
        seed={person.id}
        photoUrl={person.avatarUrl}
        gradient={person.avatar ?? null}
        size={ROW_AVATAR}
        decorative
      />
      <View style={styles.rowMeta}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {person.displayName}
        </Text>
        {person.handle.length > 0 ? (
          <Text variant="caption" color={th.colors.textMuted} numberOfLines={1}>
            @{person.handle}
          </Text>
        ) : null}
      </View>
      {selected ? (
        <SelectedBadge size={ROW_CHECK_SIZE} />
      ) : (
        <View style={styles.rowCheckEmpty} />
      )}
    </Pressable>
  )
})

export function SharePeople({ view, selected, query, searchPending, searchFailed, onToggle }: SharePeopleProps) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("share-post")
  const sizing = shareRecipientsSizing(view.mode)

  const renderTile = useCallback(
    ({ item }: { item: UserSearchResultDTO }) => (
      <PersonTile person={item} selected={isShareRecipient(selected, item.id)} onToggle={onToggle} />
    ),
    [selected, onToggle],
  )
  const renderRow = useCallback(
    ({ item }: { item: UserSearchResultDTO }) => (
      <PersonRow person={item} selected={isShareRecipient(selected, item.id)} onToggle={onToggle} />
    ),
    [selected, onToggle],
  )

  if (view.mode === "prompt") {
    return (
      <Text variant="caption" color={th.colors.textMuted} style={[styles.prompt, sizing]}>
        {t("recipients.empty_prompt")}
      </Text>
    )
  }

  if (view.mode === "recent") {
    return (
      <View style={[styles.recent, sizing]}>
        <Text variant="label" color={th.colors.textSubtle} style={styles.sectionLabel}>
          {t("recipients.recent")}
        </Text>
        <FlatList
          horizontal
          data={view.rows}
          keyExtractor={idKeyExtractor}
          renderItem={renderTile}
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.tiles}
        />
      </View>
    )
  }

  if (view.rows.length === 0) {
    return (
      <View style={[styles.prompt, sizing]}>
        {searchPending ? (
          <ActivityIndicator color={th.colors.textSubtle} />
        ) : (
          <Text variant="caption" color={th.colors.textMuted}>
            {searchFailed ? t("recipients.search_failed") : t("recipients.no_results", { handle: query })}
          </Text>
        )}
      </View>
    )
  }

  return (
    <FlatList
      data={view.rows}
      keyExtractor={idKeyExtractor}
      renderItem={renderRow}
      style={sizing}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    />
  )
}

const useStyles = makeThemedStyles((t) => ({
  prompt: {
    paddingVertical: t.space["3"],
    alignItems: "center",
  },
  recent: {
    gap: t.space["2"],
  },
  sectionLabel: {
    textTransform: "uppercase",
    letterSpacing: SECTION_LABEL_LETTER_SPACING,
  },
  tiles: {
    gap: t.space["3"],
    paddingRight: t.space["4"],
  },
  tile: {
    width: TILE_AVATAR + t.space["3"],
    alignItems: "center",
    gap: t.space["1"],
  },
  tileAvatar: {
    padding: 2,
    borderRadius: t.radius.pill,
    borderWidth: 2,
    borderColor: "transparent",
  },
  tileAvatarSelected: {
    borderColor: t.colors.brand.moss,
  },
  tileBadge: {
    position: "absolute",
    right: 0,
    bottom: 0,
  },
  tileName: {
    maxWidth: TILE_AVATAR + t.space["3"],
    textAlign: "center",
  },
  badge: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.brand.moss,
    borderWidth: 2,
    borderColor: t.colors.surface,
  },
  hovered: {
    opacity: HOVERED_OPACITY,
  },
  pressed: {
    opacity: PRESSED_OPACITY,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
    paddingVertical: t.space["2"],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.colors.border,
  },
  rowMeta: {
    flex: 1,
    minWidth: 0,
  },
  rowCheckEmpty: {
    width: ROW_CHECK_SIZE,
    height: ROW_CHECK_SIZE,
    borderRadius: ROW_CHECK_SIZE / 2,
    borderWidth: 1.5,
    borderColor: t.colors.border,
  },
}))
