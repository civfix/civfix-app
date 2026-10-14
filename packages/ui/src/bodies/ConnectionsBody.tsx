import React, { memo, useCallback, useMemo, useState } from "react"
import { View, Pressable, StyleSheet, ActivityIndicator } from "react-native"
import type { PersonDTO } from "@civfix/shared"
import { makeThemedStyles, useTheme, focusRingProps, MIN_TOUCH_TARGET } from "../theme"
import { Text, iconMap } from "../typography"
import {
  Avatar,
  FollowButton,
  ListBodyEmpty,
  ListSearchField,
  OrgAffiliationBadge,
  VerifiedBadge,
  useListBodyStyles,
  useListEndReached,
} from "../primitives"
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

export interface ConnectionsBodyProps {
  id: string
  mode: "followers" | "following"
}

export function ConnectionsBody({ id, mode }: ConnectionsBodyProps) {
  const { FlatList } = useScrollHost()
  const styles = useStyles()
  const listStyles = useListBodyStyles()
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
  const onEndReached = useListEndReached(query, filtering)
  // useListEndReached holds still while a filter is on, so the filter reaches unloaded pages on an
  // explicit tap instead.
  const onSearchMore = useCallback(() => {
    if (!isFetchingNextPage) void fetchNextPage()
  }, [isFetchingNextPage, fetchNextPage])

  const phase = filtering ? "noMatch" : query.isLoading ? "loading" : query.isError ? "error" : "empty"

  return (
    <FlatList
      data={filtered}
      keyExtractor={idKeyExtractor}
      style={listStyles.list}
      contentContainerStyle={filtered.length === 0 ? listStyles.listEmpty : listStyles.listContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.4}
      renderItem={renderItem}
      ListHeaderComponent={
        <ListSearchField
          value={search}
          onChangeText={setSearch}
          placeholder={t("search.placeholder")}
          a11yLabel={t("search.a11y")}
          clearA11yLabel={t("search.clear_a11y")}
          autoCapitalize="none"
          clearTarget="slop"
        />
      }
      ListEmptyComponent={
        <ListBodyEmpty
          phase={phase}
          skeleton="person"
          skeletonRows={8}
          copy={{
            noMatch: {
              title: t("no_matches.title"),
              body: t(hasNextPage ? "no_matches.body_partial" : "no_matches.body", {
                query: search.trim(),
              }),
            },
            error: { title: t("error.title"), body: t("error.body") },
            empty: {
              icon: iconMap.Users,
              title: t(`empty.${mode}.title`),
              body: t(`empty.${mode}.body`),
            },
          }}
        />
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
          <View style={listStyles.footer}>
            <ActivityIndicator size="small" color={th.colors.textSubtle} />
          </View>
        ) : null
      }
    />
  )
}

const useStyles = makeThemedStyles((t) => ({
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
