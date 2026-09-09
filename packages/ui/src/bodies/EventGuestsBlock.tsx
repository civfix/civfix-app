import React, { useCallback, useMemo, useState } from "react"
import { View, Pressable, StyleSheet, Platform, Linking } from "react-native"
import type { CleanupGuestDTO } from "@civfix/shared"
import { makeThemedStyles, useTheme, focusRingProps, webCursor, webHover, webTransition } from "../theme"
import { Text, TextLink, Icon, iconMap } from "../typography"
import { useT } from "../i18n"
import { useCleanupGuests } from "../data"

function GuestContact({ guest, canViewContact }: { guest: CleanupGuestDTO; canViewContact: boolean }) {
  const styles = useStyles()
  const { t } = useT("event-detail")
  const value = guest.channel === "email" ? guest.email : guest.phone

  if (!canViewContact) {
    return <Text style={styles.guestContact}>{t("guests.contact_hidden")}</Text>
  }
  if (value === null) {
    return <Text style={styles.guestContact}>{t("guests.contact_scrubbed")}</Text>
  }
  if (Platform.OS !== "web") {
    return (
      <Text style={styles.guestContact} numberOfLines={1}>
        {value}
      </Text>
    )
  }
  const href = guest.channel === "email" ? `mailto:${value}` : `tel:${value}`
  return (
    <TextLink
      variant="caption"
      numberOfLines={1}
      onPress={() => {
        void Linking.openURL(href).catch(() => {})
      }}
      accessibilityLabel={t("guests.contact_a11y", { name: guest.name })}
    >
      {value}
    </TextLink>
  )
}

function GuestRow({
  guest,
  divider,
  canViewContact,
}: {
  guest: CleanupGuestDTO
  divider: boolean
  canViewContact: boolean
}) {
  const styles = useStyles()
  const { t } = useT("event-detail")
  const cancelled = guest.cancelledAt !== null
  return (
    <View
      style={[
        styles.guestRow,
        divider ? styles.guestRowDivider : null,
        cancelled ? styles.guestRowCancelled : null,
      ]}
    >
      <View style={styles.guestMeta}>
        <Text style={styles.guestName} numberOfLines={1}>
          {guest.name}
        </Text>
        <GuestContact guest={guest} canViewContact={canViewContact} />
      </View>
      {cancelled ? <Text style={styles.guestTag}>{t("guests.cancelled")}</Text> : null}
    </View>
  )
}

export interface EventGuestsBlockProps {
  cleanupId: string
  guestCount?: number
  canViewContact?: boolean
}

export function EventGuestsBlock({
  cleanupId,
  guestCount,
  canViewContact = false,
}: EventGuestsBlockProps) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("event-detail")
  const [expanded, setExpanded] = useState(false)
  const query = useCleanupGuests(cleanupId, { enabled: expanded })

  const pages = query.data?.pages
  const guests = useMemo(() => (pages ?? []).flatMap((page) => page.guests), [pages])
  const total = guestCount ?? pages?.[0]?.count

  const { fetchNextPage, hasNextPage, isFetchingNextPage } = query
  const loadMore = useCallback(() => {
    if (!hasNextPage || isFetchingNextPage) return
    void fetchNextPage()
  }, [fetchNextPage, hasNextPage, isFetchingNextPage])

  return (
    <View>
      <Pressable
        onPress={() => setExpanded((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={expanded ? t("guests.collapse_a11y") : t("guests.expand_a11y")}
        {...focusRingProps}
        style={(state) => [
          styles.head,
          HEAD_CURSOR,
          webTransition,
          webHover(state) ? styles.headHovered : null,
          state.pressed ? styles.headPressed : null,
        ]}
      >
        <Icon icon={iconMap.Users} size={16} color={th.colors.textMuted} />
        <Text style={styles.headText}>{t("guests.heading")}</Text>
        {total === undefined ? null : (
          <Text style={styles.headCount}>{t("guests.count", { count: total })}</Text>
        )}
        <Icon
          icon={expanded ? iconMap.ChevronUp : iconMap.ChevronDown}
          size={16}
          color={th.colors.textSubtle}
        />
      </Pressable>

      {expanded ? (
        <View style={styles.list}>
          {query.isLoading ? (
            <Text style={styles.state}>{t("guests.loading")}</Text>
          ) : query.isError ? (
            <Text style={styles.state}>{t("guests.error")}</Text>
          ) : guests.length === 0 ? (
            <Text style={styles.state}>{t("guests.empty")}</Text>
          ) : (
            <>
              {guests.map((guest, index) => (
                <GuestRow
                  key={guest.id}
                  guest={guest}
                  divider={index < guests.length - 1}
                  canViewContact={canViewContact}
                />
              ))}
              {hasNextPage ? (
                <View style={styles.more}>
                  <TextLink
                    variant="label"
                    onPress={loadMore}
                    disabled={isFetchingNextPage}
                    standalone
                    accessibilityLabel={t("guests.load_more_a11y")}
                  >
                    {isFetchingNextPage ? t("guests.loading_more") : t("guests.load_more")}
                  </TextLink>
                </View>
              ) : null}
            </>
          )}
        </View>
      ) : null}
    </View>
  )
}

const HEAD_CURSOR = webCursor()

const useStyles = makeThemedStyles((t) => ({
  head: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
    paddingVertical: t.space["2"],
  },
  headHovered: {
    backgroundColor: t.colors.bgAlt,
  },
  headPressed: {
    opacity: 0.7,
  },
  headText: {
    flex: 1,
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["14"],
    color: t.colors.text,
  },
  headCount: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["13"],
    color: t.colors.textSubtle,
  },
  list: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: t.colors.border,
    paddingTop: t.space["2"],
  },
  state: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["13"],
    color: t.colors.textSubtle,
    paddingVertical: t.space["2"],
  },
  guestRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
    paddingVertical: t.space["2"],
  },
  guestRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.colors.border,
  },
  guestRowCancelled: {
    opacity: 0.55,
  },
  guestMeta: {
    flex: 1,
    minWidth: 0,
  },
  guestName: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["14"],
    color: t.colors.text,
  },
  guestContact: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["12"],
    color: t.colors.textSubtle,
  },
  guestTag: {
    flexShrink: 0,
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["12"],
    color: t.colors.textSubtle,
  },
  more: {
    alignSelf: "flex-start",
    paddingVertical: t.space["2"],
  },
}))
