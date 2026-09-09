import React, { memo, useCallback, useState } from "react"
import { View, Pressable, StyleSheet } from "react-native"
import type { PersonDTO } from "@civfix/shared"
import { makeThemedStyles, useTheme, focusRingProps } from "../theme"
import { Text, iconMap } from "../typography"
import { Avatar, EmptyState, LoadingState, useToast } from "../primitives"
import { useListBlocks, useUnblockUser } from "../data"
import { useScrollHost } from "../shell/ScrollHost"
import { useT } from "../i18n"
import { idKeyExtractor } from "./navHelpers"

const BlockedRow = memo(function BlockedRow({
  person,
  onUnblock,
  pending,
}: {
  person: PersonDTO
  onUnblock: (id: string) => void
  pending: boolean
}) {
  const styles = useStyles()
  const { t } = useT("account-blocked")
  return (
    <View style={styles.row}>
      <View style={styles.rowMeta}>
        <Avatar
          name={person.name}
          seed={person.id}
          photoUrl={person.avatarUrl}
          gradient={person.avatar ?? null}
          size={46}
        />
        <View style={styles.meta}>
          <Text style={styles.name} numberOfLines={1}>
            {person.name}
          </Text>
          {person.handle ? (
            <Text style={styles.handle} numberOfLines={1}>
              @{person.handle}
            </Text>
          ) : null}
        </View>
      </View>
      <Pressable
        onPress={() => onUnblock(person.id)}
        disabled={pending}
        accessibilityRole="button"
        accessibilityLabel={t("row.unblockA11y", { name: person.name })}
        {...focusRingProps}
        style={({ pressed }) => [styles.unblock, pressed ? styles.unblockPressed : null]}
      >
        <Text style={styles.unblockText}>
          {pending ? t("row.unblocking") : t("row.unblock")}
        </Text>
      </Pressable>
    </View>
  )
})

export function BlockedAccountsBody() {
  const { FlatList } = useScrollHost()
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("account-blocked")
  const toast = useToast()
  const query = useListBlocks()
  const unblock = useUnblockUser()
  const items = query.data?.blocked ?? []

  const [pendingIds, setPendingIds] = useState<readonly string[]>([])

  const mutateAsync = unblock.mutateAsync
  const onUnblock = useCallback(
    (id: string) => {
      setPendingIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
      void mutateAsync(id)
        .catch(() => toast.show(t("row.unblockError"), { variant: "error" }))
        .finally(() => setPendingIds((prev) => prev.filter((pendingId) => pendingId !== id)))
    },
    [mutateAsync, toast, t],
  )

  const renderItem = useCallback(
    ({ item }: { item: PersonDTO }) => (
      <BlockedRow person={item} onUnblock={onUnblock} pending={pendingIds.includes(item.id)} />
    ),
    [onUnblock, pendingIds],
  )

  return (
    <FlatList
      data={items}
      keyExtractor={idKeyExtractor}
      style={styles.list}
      contentContainerStyle={items.length === 0 ? styles.listEmpty : styles.listContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      renderItem={renderItem}
      ListEmptyComponent={
        query.isLoading ? (
          <LoadingState skeleton="person" rows={6} />
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
            icon={iconMap.Ban}
            title={t("empty.title")}
            body={t("empty.body")}
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
  listContent: {
    paddingHorizontal: t.space["4"],
    paddingTop: t.space["2"],
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
  rowMeta: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
  },
  meta: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 15,
    color: t.colors.text,
  },
  handle: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: 11.5,
    color: t.colors.textSubtle,
    marginTop: 1,
  },
  unblock: {
    flexShrink: 0,
    paddingHorizontal: t.space["3"] + 1,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.surface,
    borderWidth: 1.5,
    borderColor: t.colors.borderStrong,
  },
  unblockPressed: {
    opacity: 0.85,
  },
  unblockText: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 13,
    color: t.colors.text,
  },
}))
