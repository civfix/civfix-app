import React, { memo, useCallback, useState } from "react"
import { View, Pressable, StyleSheet, Platform, type ViewStyle } from "react-native"
import { TextInput } from "../primitives/TextInput"
import type { PersonDTO, UserSearchResultDTO } from "@civfix/shared"
import { tokens } from "@civfix/shared/tokens"
import { focusRingProps, makeThemedStyles, space, useTheme, useLayoutMode, webHover, webInputReset, webTransition, headingLevel } from "../theme"
import { Text, Icon, iconMap } from "../typography"
import { Avatar, FollowButton, SignInPrompt } from "../primitives"
import {
  useUserSearch,
  normalizeUserSearchTerm,
  useStartDm,
  useAuthState,
  useFollowSuggestions,
  useMyHours,
  useRequireAuth,
} from "../data"
import { useNavStore } from "../nav"
import { useScrollHost } from "../shell/ScrollHost"
import { useT } from "../i18n"
import { FeedNotice } from "./FeedNotice"
import { idKeyExtractor } from "../primitives/listKeys"
import { useRowHover } from "./rowHover"
import { resolveDiscoveryGeoid } from "./leaderboardGeoid"

const PersonRow = memo(function PersonRow({
  person,
  onOpenPerson,
  onMessage,
}: {
  person: UserSearchResultDTO
  onOpenPerson: (person: UserSearchResultDTO) => void
  onMessage: (person: UserSearchResultDTO) => void
}) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("search")
  const { hovered, hoverProps } = useRowHover()
  return (
    <View {...hoverProps} style={[styles.row, webTransition, hovered ? styles.rowHovered : null]}>
      <Pressable
        onPress={() => onOpenPerson(person)}
        accessibilityRole="button"
        accessibilityLabel={t("row.view_profile_a11y", { name: person.displayName })}
        {...focusRingProps}
        style={({ pressed }) => [styles.rowTap, pressed ? styles.rowPressed : null]}
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
          <Text style={styles.handle} numberOfLines={1}>
            @{person.handle}
          </Text>
        </View>
      </Pressable>
      <Pressable
        onPress={() => onMessage(person)}
        accessibilityRole="button"
        accessibilityLabel={t("row.message_a11y", { name: person.displayName })}
        hitSlop={ICON_BTN_HIT_SLOP}
        {...focusRingProps}
        style={(state) => [
          styles.iconBtn,
          webTransition,
          webHover(state) ? styles.iconBtnHovered : null,
          state.pressed ? styles.iconBtnPressed : null,
        ]}
      >
        <Icon icon={iconMap.MessageCircle} size={15} color={th.colors.textMuted} />
      </Pressable>
    </View>
  )
})

const SuggestedPersonRow = memo(function SuggestedPersonRow({
  person,
  onOpenPerson,
}: {
  person: PersonDTO
  onOpenPerson: (person: PersonDTO) => void
}) {
  const styles = useStyles()
  const { t } = useT("search")
  const { hovered, hoverProps } = useRowHover()
  return (
    <View {...hoverProps} style={[styles.row, webTransition, hovered ? styles.rowHovered : null]}>
      <Pressable
        onPress={() => onOpenPerson(person)}
        accessibilityRole="button"
        accessibilityLabel={t("row.view_profile_a11y", { name: person.name })}
        {...focusRingProps}
        style={({ pressed }) => [styles.rowTap, pressed ? styles.rowPressed : null]}
      >
        <Avatar
          name={person.name}
          seed={person.id}
          photoUrl={person.avatarUrl ?? null}
          gradient={person.avatar ?? null}
          size={46}
        />
        <View style={styles.meta}>
          <Text style={styles.name} numberOfLines={1}>
            {person.name}
          </Text>
          <Text style={styles.handle} numberOfLines={1}>
            {person.handle ? `@${person.handle}` : ""}
          </Text>
        </View>
      </Pressable>
      <FollowButton
        personId={person.id}
        isFollowing={person.isFollowing}
        nextPath={`/people/${person.handle ?? person.id}`}
        size="sm"
      />
    </View>
  )
})

function RowSkeleton() {
  const styles = useStyles()
  return (
    <View style={styles.row}>
      <View style={styles.skelAvatar} />
      <View style={styles.meta}>
        <View style={[styles.skelLine, { width: "45%" }]} />
        <View style={[styles.skelLine, styles.skelLineSm, { width: "60%" }]} />
      </View>
    </View>
  )
}

export function SocialBody() {
  const styles = useStyles()
  const { t } = useT("search")
  const { FlatList } = useScrollHost()
  const rawQuery = useNavStore((s) => s.query)
  const setQuery = useNavStore((s) => s.setQuery)
  const layout = useLayoutMode()
  const atViewRoot = useNavStore((s) => s.stack.length === 0)
  const showTitle = layout === "expanded" && atViewRoot
  const { start } = useStartDm()
  const { user, isAuthenticated, isPending: authPending } = useAuthState()
  const requireAuth = useRequireAuth()
  const viewerId = user?.id ?? null
  const myHours = useMyHours()
  const leaderboardGeoid = resolveDiscoveryGeoid({ myHours: myHours.data?.hours ?? null })?.geoid
  const search = useUserSearch(rawQuery)
  const results = search.data?.results ?? []
  const typed = normalizeUserSearchTerm(rawQuery)
  const hasQuery = typed.length > 0
  const searchPending = authPending || search.isLoading || search.term !== typed
  const suggestions = useFollowSuggestions()
  const suggested = suggestions.data ?? []
  const listData: Array<UserSearchResultDTO | PersonDTO> = hasQuery ? results : suggested

  const onOpenPerson = useCallback((person: { id: string; handle?: string | null }) => {
    useNavStore.getState().push({ kind: "person", id: person.handle ?? person.id })
  }, [])

  const onOpenLeaderboard = useCallback(() => {
    if (!leaderboardGeoid) return
    useNavStore.getState().push({ kind: "leaderboard", geoid: leaderboardGeoid })
  }, [leaderboardGeoid])

  const onMessage = useCallback(
    (person: UserSearchResultDTO) => {
      start(
        { id: person.id, name: person.displayName, handle: person.handle },
        `/people/${person.handle}`,
        {
          onResolved: ({ roomId, thread }) =>
            useNavStore.getState().push({
              kind: "thread",
              id: roomId,
              roomKind: "dm",
              peer: thread.peer ?? undefined,
            }),
        },
      )
    },
    [start],
  )

  const renderItem = useCallback(
    ({ item }: { item: UserSearchResultDTO | PersonDTO }) =>
      "displayName" in item ? (
        <PersonRow person={item} onOpenPerson={onOpenPerson} onMessage={onMessage} />
      ) : (
        <SuggestedPersonRow person={item} onOpenPerson={onOpenPerson} />
      ),
    [onOpenPerson, onMessage],
  )

  return (
    <FlatList
      data={listData}
      keyExtractor={idKeyExtractor}
      style={styles.list}
      contentContainerStyle={listData.length === 0 ? styles.listEmpty : styles.listContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        <>
          {showTitle ? <PeopleHeader /> : null}
          {layout === "expanded" || !atViewRoot ? (
            <PeopleSearchField value={rawQuery} onChangeText={setQuery} />
          ) : null}
          {!hasQuery && viewerId && leaderboardGeoid ? (
            <LeaderboardEntry onPress={onOpenLeaderboard} />
          ) : null}
          {!hasQuery && suggested.length > 0 ? <SuggestionsHeader /> : null}
          {hasQuery ? <SearchResultsHeader count={results.length} /> : null}
        </>
      }
      renderItem={renderItem}
      ListEmptyComponent={
        !hasQuery ? (
          suggestions.isLoading ? (
            <View style={styles.skelList}>
              <RowSkeleton />
              <RowSkeleton />
              <RowSkeleton />
            </View>
          ) : (
            <View style={styles.emptyFill}>
              <FeedNotice
                plain
                icon="AtSign"
                title={t("empty.prompt.title")}
                body={t("empty.prompt.body")}
              />
            </View>
          )
        ) : !isAuthenticated && !authPending ? (
          <SignInPrompt
            icon={iconMap.AtSign}
            variant="detail"
            title={t("empty.signed_out.title")}
            body={t("empty.signed_out.body")}
            onSignIn={() => requireAuth(() => {}, { next: "/people" })}
          />
        ) : searchPending ? (
          <View style={styles.skelList}>
            <RowSkeleton />
            <RowSkeleton />
            <RowSkeleton />
          </View>
        ) : search.isError ? (
          <View style={styles.emptyFill}>
            <FeedNotice
              plain
              icon="CloudOff"
              title={t("empty.error.title")}
              body={t("empty.error.body")}
            />
          </View>
        ) : (
          <View style={styles.emptyFill}>
            <FeedNotice
              plain
              icon="Search"
              title={t("empty.no_results.title")}
              body={t("empty.no_results.body", { handle: typed })}
            />
          </View>
        )
      }
    />
  )
}

function PeopleSearchField({
  value,
  onChangeText,
}: {
  value: string
  onChangeText: (q: string) => void
}) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("search")
  const [focused, setFocused] = useState(false)
  return (
    <View style={[styles.searchField, focused ? styles.searchFieldFocused : null]}>
      <Icon icon={iconMap.Search} size={16} color={th.colors.textSubtle} />
      <TextInput
        style={[styles.searchInput, webInputReset]}
        placeholder={t("field.placeholder")}
        placeholderTextColor={th.colors.textSubtle}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        accessibilityLabel={t("field.a11y")}
      />
      {value ? (
        <Pressable
          onPress={() => onChangeText("")}
          accessibilityRole="button"
          accessibilityLabel={t("field.clear_a11y")}
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

function PeopleHeader() {
  const styles = useStyles()
  const { t } = useT("nav")
  return (
    <View style={styles.titleRow}>
      <Text style={styles.title} accessibilityRole="header">
        {t("title.people")}
      </Text>
    </View>
  )
}

function SuggestionsHeader() {
  const styles = useStyles()
  const { t } = useT("search")
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle} accessibilityRole="header" {...headingLevel(2)}>
        {t("suggestions.title")}
      </Text>
    </View>
  )
}

function LeaderboardEntry({ onPress }: { onPress: () => void }) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("search")
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t("leaderboard.a11y")}
      {...focusRingProps}
      style={(state) => [
        styles.contactsRow,
        webTransition,
        webHover(state) ? styles.rowHovered : null,
        state.pressed ? styles.rowPressed : null,
      ]}
    >
      <View style={styles.contactsIcon}>
        <Icon icon={iconMap.Award} size={18} color={th.colors.brand.bloom} />
      </View>
      <View style={styles.meta}>
        <Text style={styles.name} numberOfLines={1}>
          {t("leaderboard.title")}
        </Text>
        <Text style={styles.handle} numberOfLines={1}>
          {t("leaderboard.subtitle")}
        </Text>
      </View>
      <Icon icon={iconMap.ChevronRight} size={16} color={th.colors.textSubtle} />
    </Pressable>
  )
}

function SearchResultsHeader({ count }: { count: number }) {
  const styles = useStyles()
  const { t } = useT("search")
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle} accessibilityRole="header" {...headingLevel(2)}>{t("results.title")}</Text>
      {count > 0 ? (
        <Text style={styles.sectionLink}>
          {t("results.count", { count })}
        </Text>
      ) : null}
    </View>
  )
}

const MIN_TOUCH_TARGET = 44
const ICON_BTN_SIZE = 32
const ROW_GAP = space["3"]
const ICON_BTN_HIT_SLOP = {
  top: (MIN_TOUCH_TARGET - ICON_BTN_SIZE) / 2,
  bottom: (MIN_TOUCH_TARGET - ICON_BTN_SIZE) / 2,
  left: ROW_GAP,
  right: 0,
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
    borderRadius: CLEAR_BTN_SIZE / 2,
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
  emptyFill: {
    flexGrow: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
    marginTop: 14,
    marginBottom: t.space["1"],
  },
  title: {
    fontFamily: t.fontFamily.bodyExtraBold,
    fontSize: 32,
    lineHeight: 39,
    letterSpacing: -0.5,
    color: t.colors.text,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: t.space["2"],
    paddingBottom: t.space["3"],
  },
  sectionTitle: {
    fontFamily: t.fontFamily.displayBold,
    fontSize: 19,
    color: t.colors.text,
    letterSpacing: -0.3,
  },
  sectionLink: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["13"],
    color: t.colors.accentText,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: ROW_GAP,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.colors.border,
  },
  contactsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.colors.border,
  },
  contactsIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: t.colors.bgAlt,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  rowTap: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
    borderRadius: t.radius.md,
  },
  rowHovered: {
    backgroundColor: t.colors.bgAlt,
  },
  rowPressed: {
    opacity: 0.7,
  },
  meta: {
    flex: 1,
    minWidth: 0,
  },
  name: {
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
  iconBtn: {
    width: ICON_BTN_SIZE,
    height: ICON_BTN_SIZE,
    borderRadius: ICON_BTN_SIZE / 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  iconBtnHovered: {
    backgroundColor: t.colors.surfaceTint,
    borderColor: t.colors.borderStrong,
  },
  iconBtnPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
  },
  skelList: {
    alignSelf: "stretch",
  },
  skelAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: t.colors.bgAlt,
  },
  skelLine: {
    height: 13,
    borderRadius: 7,
    backgroundColor: t.colors.bgAlt,
  },
  skelLineSm: {
    height: 10,
    marginTop: 7,
  },
}))
