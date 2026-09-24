import React, { memo, useCallback, useMemo, useState } from "react"
import { View, Pressable, StyleSheet, ActivityIndicator, Platform, type ViewStyle } from "react-native"
import { TextInput } from "../primitives/TextInput"
import type { PersonDTO } from "@civfix/shared"
import { tokens } from "@civfix/shared/tokens"
import { makeThemedStyles, useTheme, webInputReset, focusRingProps, MIN_TOUCH_TARGET } from "../theme"
import { Text, Icon, iconMap } from "../typography"
import { Avatar, FollowButton, EmptyState, LoadingState, OrgAffiliationBadge, VerifiedBadge } from "../primitives"
import { useAuthState, useFollowers, useFollowing } from "../data"
import { useNavStore } from "../nav"
import { useScrollHost } from "../shell/ScrollHost"
import { useT } from "../i18n"
import { idKeyExtractor } from "../primitives/listKeys"

const ConnectionRow = memo(function ConnectionRow({
  person,
  showFollow,
  onOpenPerson,
}: {
  person: PersonDTO
  showFollow: boolean
  onOpenPerson: (person: PersonDTO) => void
}) {
  const styles = useStyles()
  const { t } = useT("profile-connections")
  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => onOpenPerson(person)}
        accessibilityRole="button"
        accessibilityLabel={t("row.open_a11y", { name: person.name })}
        {...focusRingProps}
        style={({ pressed }) => [styles.rowTap, pressed ? styles.rowPressed : null]}
      >
        <Avatar
          name={person.name}
          seed={person.id}
          photoUrl={person.avatarUrl}
          gradient={person.avatar ?? null}
          size={46}
        />
        <View style={styles.meta}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {person.name}
            </Text>
            {person.official ? <VerifiedBadge size="sm" /> : null}
            {person.organization ? (
              <OrgAffiliationBadge organization={person.organization} size="sm" interactive={false} />
            ) : null}
          </View>
          {person.handle ? (
            <Text style={styles.handle} numberOfLines={1}>
              @{person.handle}
            </Text>
          ) : null}
        </View>
      </Pressable>
      {showFollow ? (
        <FollowButton
          personId={person.id}
          isFollowing={person.isFollowing}
          nextPath={`/people/${person.handle ?? person.id}`}
          size="sm"
        />
      ) : null}
    </View>
  )
})

function PeopleSearchField({
  value,
  onChangeText,
}: {
  value: string
  onChangeText: (q: string) => void
}) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("profile-connections")
  const [focused, setFocused] = useState(false)
  return (
    <View style={[styles.searchField, focused ? styles.searchFieldFocused : null]}>
      <Icon icon={iconMap.Search} size={16} color={th.colors.textSubtle} />
      <TextInput
        style={[styles.searchInput, webInputReset]}
        placeholder={t("search.placeholder")}
        placeholderTextColor={th.colors.textSubtle}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        accessibilityLabel={t("search.a11y")}
      />
      {value ? (
        <Pressable
          onPress={() => onChangeText("")}
          accessibilityRole="button"
          accessibilityLabel={t("search.clear_a11y")}
          hitSlop={CLEAR_BTN_HIT_SLOP}
          {...focusRingProps}
          style={({ pressed }) => [styles.clearBtn, pressed ? styles.clearBtnPressed : null]}
        >
          <Icon icon={iconMap.Close} size={14} color={th.colors.textSubtle} />
        </Pressable>
      ) : null}
    </View>
  )
}

export interface ConnectionsBodyProps {
  id: string
  mode: "followers" | "following"
}

export function ConnectionsBody({ id, mode }: ConnectionsBodyProps) {
  const { FlatList } = useScrollHost()
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("profile-connections")
  const followers = useFollowers(mode === "followers" ? id : undefined)
  const following = useFollowing(mode === "following" ? id : undefined)
  const query = mode === "followers" ? followers : following
  const viewerId = useAuthState().user?.id ?? null

  const pages = query.data?.pages
  const items = useMemo(() => (pages ?? []).flatMap((p) => p.items), [pages])

  const [search, setSearch] = useState("")
  const trimmed = search.trim().toLowerCase()
  const filtering = trimmed.length > 0
  const filtered = useMemo(() => {
    if (!filtering) return items
    return items.filter(
      (p) =>
        p.name.toLowerCase().includes(trimmed) ||
        (p.handle ? p.handle.toLowerCase().includes(trimmed) : false),
    )
  }, [items, filtering, trimmed])

  const onOpenPerson = useCallback((person: PersonDTO) => {
    if (person.deleted) return
    useNavStore.getState().push({ kind: "person", id: person.handle ?? person.id })
  }, [])

  const renderItem = useCallback(
    ({ item }: { item: PersonDTO }) => (
      <ConnectionRow
        person={item}
        showFollow={!item.deleted && item.id !== viewerId}
        onOpenPerson={onOpenPerson}
      />
    ),
    [onOpenPerson, viewerId],
  )

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query
  const onEndReached = useCallback(() => {
    if (filtering) return
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage()
  }, [filtering, hasNextPage, isFetchingNextPage, fetchNextPage])
  // The filter only sees loaded pages, so while it is on, more pages load on an explicit tap rather
  // than onEndReached, which would fire repeatedly against a short filtered list and pull everyone.
  const onSearchMore = useCallback(() => {
    if (!isFetchingNextPage) void fetchNextPage()
  }, [isFetchingNextPage, fetchNextPage])

  const emptyTitle = t(`empty.${mode}.title`)
  const emptyBody = t(`empty.${mode}.body`)

  return (
    <FlatList
      data={filtered}
      keyExtractor={idKeyExtractor}
      style={styles.list}
      contentContainerStyle={filtered.length === 0 ? styles.listEmpty : styles.listContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.4}
      renderItem={renderItem}
      ListHeaderComponent={<PeopleSearchField value={search} onChangeText={setSearch} />}
      ListEmptyComponent={
        filtering ? (
          <EmptyState
            variant="detail"
            icon={iconMap.Search}
            title={t("no_matches.title")}
            body={t(hasNextPage ? "no_matches.body_partial" : "no_matches.body", {
              query: search.trim(),
            })}
          />
        ) : query.isLoading ? (
          <LoadingState skeleton="person" rows={8} />
        ) : query.isError ? (
          <EmptyState
            variant="detail"
            tone="neutral"
            icon={iconMap.CloudOff}
            iconColor={th.colors.textSubtle}
            iconSize={30}
            title={t("error.title")}
            body={t("error.body")}
          />
        ) : (
          <EmptyState
            variant="detail"
            icon={iconMap.Users}
            title={emptyTitle}
            body={emptyBody}
          />
        )
      }
      ListFooterComponent={
        filtering && hasNextPage ? (
          <Pressable
            onPress={onSearchMore}
            disabled={isFetchingNextPage}
            accessibilityRole="button"
            accessibilityLabel={t("search.more")}
            accessibilityState={{ disabled: isFetchingNextPage, busy: isFetchingNextPage }}
            {...focusRingProps}
            style={({ pressed }) => [styles.searchMore, pressed ? styles.rowPressed : null]}
          >
            {isFetchingNextPage ? (
              <ActivityIndicator size="small" color={th.colors.textSubtle} />
            ) : (
              <Text style={styles.searchMoreText}>{t("search.more")}</Text>
            )}
          </Pressable>
        ) : !filtering && filtered.length > 0 && query.isFetchingNextPage ? (
          <View style={styles.footer}>
            <ActivityIndicator size="small" color={th.colors.textSubtle} />
          </View>
        ) : null
      }
    />
  )
}

const CLEAR_BTN_SIZE = 22
const CLEAR_BTN_HIT_SLOP = (MIN_TOUCH_TARGET - CLEAR_BTN_SIZE) / 2

const useStyles = makeThemedStyles((t) => ({
  searchField: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    minHeight: MIN_TOUCH_TARGET,
    marginTop: t.space["2"],
    marginBottom: t.space["2"],
    paddingHorizontal: t.space["3"],
    backgroundColor: t.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    borderRadius: t.radius.md,
  },
  searchFieldFocused:
    Platform.OS === "web"
      ? ({ boxShadow: tokens.shadow.ring, borderColor: t.colors.accent } as ViewStyle)
      : { borderColor: t.colors.accent },
  searchInput: {
    flex: 1,
    minWidth: 0,
    padding: 0,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["14"],
    color: t.colors.text,
  },
  clearBtn: {
    width: CLEAR_BTN_SIZE,
    height: CLEAR_BTN_SIZE,
    borderRadius: 11,
    backgroundColor: t.colors.bgAlt,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  clearBtnPressed: {
    backgroundColor: t.colors.border,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: t.space["4"],
    paddingTop: 0,
    paddingBottom: t.space["8"],
  },
  listEmpty: {
    flexGrow: 1,
    paddingHorizontal: t.space["4"],
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.colors.border,
  },
  rowTap: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
  },
  rowPressed: {
    opacity: 0.7,
  },
  meta: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  name: {
    flexShrink: 1,
    fontFamily: t.fontFamily.bodyBold,
    fontSize: t.fontSize["15"],
    color: t.colors.text,
  },
  handle: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: 11.5,
    color: t.colors.textSubtle,
    marginTop: 1,
  },
  footer: {
    paddingVertical: t.space["4"],
  },
  searchMore: {
    alignSelf: "center",
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: "center",
    marginVertical: t.space["3"],
    paddingHorizontal: t.space["4"],
    borderRadius: t.radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
  },
  searchMoreText: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: t.fontSize["13"],
    color: t.colors.textMuted,
  },
}))
