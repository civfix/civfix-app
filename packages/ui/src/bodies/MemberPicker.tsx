import React, { memo, useCallback, useState } from "react"
import { View, Pressable, StyleSheet } from "react-native"
import { TextInput } from "../primitives/TextInput"
import type { PersonDTO, UserSearchResultDTO } from "@civfix/shared"
import { makeThemedStyles, useTheme, webInputReset, focusRingProps, inputFocusedStyle } from "../theme"
import { Text, Icon, iconMap } from "../typography"
import { Avatar, EmptyState, LoadingState } from "../primitives"
import { useUserSearch, normalizeUserSearchTerm } from "../data"
import { useScrollHost } from "../shell/ScrollHost"
import { useT } from "../i18n"
import { idKeyExtractor } from "../primitives/listKeys"
import { toggleMember, removeMember, filterExcluded, searchResultToPerson } from "./memberSelect"

export interface MemberPickerProps {
  selected: PersonDTO[]
  onChange: (selected: PersonDTO[]) => void
  excludeIds?: readonly string[]
  emptyPromptBody?: string
  suggested?: readonly UserSearchResultDTO[]
  suggestedLabel?: string
}

const NO_SUGGESTIONS: readonly UserSearchResultDTO[] = []

const SelectedChip = memo(function SelectedChip({
  person,
  onRemove,
}: {
  person: PersonDTO
  onRemove: (id: string) => void
}) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("group-create")
  return (
    <Pressable
      onPress={() => onRemove(person.id)}
      accessibilityRole="button"
      accessibilityLabel={t("chip.remove_a11y", { name: person.name })}
      {...focusRingProps}
      style={({ pressed }) => [styles.chip, pressed ? styles.chipPressed : null]}
    >
      <Avatar
        name={person.name}
        seed={person.id}
        photoUrl={person.avatarUrl}
        gradient={person.avatar ?? null}
        size={24}
      />
      <Text style={styles.chipName} numberOfLines={1}>
        {person.name}
      </Text>
      <Icon icon={iconMap.Close} size={13} color={th.colors.textMuted} />
    </Pressable>
  )
})

const ResultRow = memo(function ResultRow({
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
  const { t } = useT("group-create")
  return (
    <Pressable
      onPress={() => onToggle(person)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={t("row.toggle_a11y", { name: person.displayName })}
      {...focusRingProps}
      style={({ pressed }) => [styles.row, pressed ? styles.rowPressed : null]}
    >
      <Avatar
        name={person.displayName}
        seed={person.id}
        photoUrl={person.avatarUrl}
        gradient={person.avatar ?? null}
        size={46}
      />
      <View style={styles.meta}>
        <Text style={styles.name} numberOfLines={1}>
          {person.displayName}
        </Text>
        {person.handle.length > 0 ? (
          <Text style={styles.handle} numberOfLines={1}>
            @{person.handle}
          </Text>
        ) : null}
      </View>
      <View style={[styles.check, selected ? styles.checkOn : null]}>
        {selected ? <Icon icon={iconMap.Check} size={13} color={th.colors.onAccent} /> : null}
      </View>
    </Pressable>
  )
})

export function MemberPicker({
  selected,
  onChange,
  excludeIds,
  emptyPromptBody,
  suggested,
  suggestedLabel,
}: MemberPickerProps) {
  const styles = useStyles()
  const th = useTheme()
  const { FlatList } = useScrollHost()
  const { t } = useT("group-create")
  const { t: tCommon } = useT("common")
  const [query, setQuery] = useState("")
  const [focused, setFocused] = useState(false)
  const search = useUserSearch(query)
  const results = filterExcluded(search.data?.results ?? [], excludeIds)
  const typed = normalizeUserSearchTerm(query)
  const hasQuery = typed.length > 0
  const searchPending = search.isLoading || search.term !== typed
  const suggestions = filterExcluded(suggested ?? NO_SUGGESTIONS, excludeIds)
  const showSuggestions = !hasQuery && suggestions.length > 0
  const rows = showSuggestions ? suggestions : results

  const onToggle = useCallback(
    (person: UserSearchResultDTO) => {
      onChange(toggleMember(selected, searchResultToPerson(person), excludeIds))
    },
    [selected, onChange, excludeIds],
  )

  const onRemove = useCallback(
    (id: string) => onChange(removeMember(selected, id)),
    [selected, onChange],
  )

  const renderItem = useCallback(
    ({ item }: { item: UserSearchResultDTO }) => (
      <ResultRow
        person={item}
        selected={selected.some((p) => p.id === item.id)}
        onToggle={onToggle}
      />
    ),
    [selected, onToggle],
  )

  return (
    <FlatList
      data={rows}
      keyExtractor={idKeyExtractor}
      style={styles.list}
      contentContainerStyle={rows.length === 0 ? styles.listEmpty : styles.listContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        <View>
          {selected.length > 0 ? (
            <View style={styles.chips}>
              {selected.map((p) => (
                <SelectedChip key={p.id} person={p} onRemove={onRemove} />
              ))}
            </View>
          ) : null}
          <View style={[styles.searchWrap, focused ? styles.searchWrapFocused : null]}>
            <Icon icon={iconMap.Search} size={16} color={th.colors.textSubtle} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t("search_placeholder")}
              placeholderTextColor={th.colors.textSubtle}
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel={t("search_placeholder")}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              style={[styles.searchInput, webInputReset]}
            />
          </View>
          {showSuggestions && suggestedLabel ? (
            <Text style={styles.sectionLabel} numberOfLines={1}>
              {suggestedLabel}
            </Text>
          ) : null}
        </View>
      }
      renderItem={renderItem}
      ListEmptyComponent={
        !hasQuery ? (
          <EmptyState
            variant="detail"
            icon={iconMap.AtSign}
            title={t("empty.prompt.title")}
            body={emptyPromptBody ?? t("empty.prompt.body")}
          />
        ) : searchPending ? (
          <View
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={tCommon("loading")}
            accessibilityState={{ busy: true }}
          >
            <LoadingState skeleton="person" rows={3} />
          </View>
        ) : search.isError ? (
          <EmptyState
            variant="detail"
            tone="neutral"
            icon={iconMap.CloudOff}
            iconColor={th.colors.textSubtle}
            title={t("empty.error.title")}
            body={t("empty.error.body")}
          />
        ) : (
          <EmptyState
            variant="detail"
            icon={iconMap.Search}
            title={t("empty.no_results.title")}
            body={t("empty.no_results.body", { handle: typed })}
          />
        )
      }
    />
  )
}

const useStyles = makeThemedStyles((t) => ({
  list: {
    flex: 1,
  },
  sectionLabel: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: t.fontSize["13"],
    color: t.colors.textSubtle,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    paddingBottom: t.space["1"],
  },
  listContent: {
    paddingHorizontal: t.space["4"],
    paddingBottom: t.space["6"],
  },
  listEmpty: {
    flexGrow: 1,
    paddingHorizontal: t.space["4"],
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: t.space["2"],
    paddingBottom: t.space["2"],
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["1"],
    paddingLeft: 3,
    paddingRight: t.space["2"],
    paddingVertical: 3,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.bgAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    maxWidth: 180,
  },
  chipPressed: {
    opacity: 0.7,
  },
  chipName: {
    flexShrink: 1,
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: 12.5,
    color: t.colors.text,
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
    paddingHorizontal: t.space["3"],
    borderRadius: t.radius.lg,
    backgroundColor: t.colors.bgAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    marginBottom: t.space["2"],
  },
  searchWrapFocused: inputFocusedStyle(t),
  searchInput: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 10,
    fontFamily: t.fontFamily.bodyMedium,
    fontSize: t.fontSize["14"],
    color: t.colors.text,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
    paddingVertical: t.space["2"],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.colors.border,
  },
  rowPressed: {
    backgroundColor: t.colors.bgAlt,
  },
  meta: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 14.5,
    color: t.colors.text,
  },
  handle: {
    fontFamily: t.fontFamily.bodyMedium,
    fontSize: 12.5,
    color: t.colors.textMuted,
    marginTop: 1,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: t.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkOn: {
    backgroundColor: t.colors.brand.moss,
    borderColor: t.colors.brand.moss,
  },
}))
