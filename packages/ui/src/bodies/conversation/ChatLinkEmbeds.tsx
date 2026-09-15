import React, { useCallback, useEffect, useMemo } from "react"
import { Pressable, StyleSheet, View } from "react-native"
import type { StyleProp, TextStyle } from "react-native"
import type { CleanupDTO, LinkedEventRef, OrganizationDTO, PostDTO, UserProfileDTO } from "@civfix/shared"
import { makeThemedStyles, useTheme, focusRingProps, webCursor, webHover, webTransition } from "../../theme"
import { Text } from "../../typography"
import { Avatar } from "../../primitives/Avatar"
import { OrgAffiliationBadge } from "../../primitives/OrgAffiliationBadge"
import { SkeletonBlock, SkeletonGroup } from "../../primitives/skeleton"
import { useCleanup, useOrganization, useProfile, useReport } from "../../data"
import { usePost } from "../../data/hooks/posts"
import { useT } from "../../i18n"
import { LinkedEventCard } from "../LinkedEventCard"
import { LinkedReportCard } from "../LinkedReportCard"
import { reportToCardData } from "../linkedReportCards"
import { PostMediaGrid } from "../PostMediaGrid"
import { buildPostIdentity } from "../postCardModel"
import { useListTimeAgo } from "../useListTimeAgo"
import { useEmbedGate } from "./chatEmbedScope"
import type { CivfixLinkKind, CivfixLinkRef } from "./civfixLinks"

export const EMBED_CARD_WIDTH = 260

export const EMBED_RESERVED_HEIGHT: Record<CivfixLinkKind, number> = {
  report: 64,
  event: 68,
  post: 88,
  person: 64,
  org: 64,
}

const POST_EMBED_MEDIA_MAX_HEIGHT = 160

export interface ChatLinkEmbedsProps {
  rowKey: string
  refs: readonly CivfixLinkRef[]
  linkOnly: boolean
  linkStyle: StyleProp<TextStyle>
  onOpen: (ref: CivfixLinkRef) => void
}

interface EmbedCardProps {
  link: CivfixLinkRef
  linkOnly: boolean
  linkStyle: StyleProp<TextStyle>
  onOpen: (ref: CivfixLinkRef) => void
}

interface EmbedProps extends EmbedCardProps {
  onSettled: (cached: boolean) => void
}

interface EmbedQueryState {
  isLoading: boolean
  isSuccess: boolean
}

function EmbedSkeleton({ kind }: { kind: CivfixLinkKind }) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("conversation")
  return (
    <View accessible accessibilityLabel={t("embed.loading")} style={styles.skeletonHost}>
      <SkeletonGroup>
        <SkeletonBlock height={EMBED_RESERVED_HEIGHT[kind]} radius={th.radius.lg} />
      </SkeletonGroup>
    </View>
  )
}

function EmbedFallback({ link, linkOnly, linkStyle, onOpen }: EmbedCardProps) {
  const styles = useStyles()
  if (!linkOnly) return null
  return (
    <Text style={[styles.fallbackLink, linkStyle]} accessibilityRole="link" onPress={() => onOpen(link)}>
      {link.url}
    </Text>
  )
}

function EmbedShell<T>({
  query,
  data,
  render,
  onSettled,
  ...props
}: EmbedProps & {
  query: EmbedQueryState
  data: T | undefined
  render: (data: T) => React.ReactNode
}) {
  const settled = !query.isLoading
  const cached = query.isSuccess
  useEffect(() => {
    if (settled) onSettled(cached)
  }, [settled, cached, onSettled])
  if (data !== undefined) return <>{render(data)}</>
  if (query.isLoading) return <EmbedSkeleton kind={props.link.kind} />
  return <EmbedFallback {...props} />
}

function ReportEmbed(props: EmbedProps) {
  const { link, onOpen } = props
  const query = useReport(link.id)
  const onPress = useCallback(() => onOpen(link), [onOpen, link])
  return (
    <EmbedShell
      {...props}
      query={query}
      data={query.data}
      render={(report) => (
        <LinkedReportCard report={reportToCardData(report)} layout="list" headline="title" onPress={onPress} />
      )}
    />
  )
}

export function eventRefFromCleanup(cleanup: CleanupDTO): LinkedEventRef {
  return {
    id: cleanup.id,
    title: cleanup.title,
    eventKind: cleanup.eventKind,
    status: cleanup.status,
    scheduledAt: cleanup.scheduledAt,
    endsAt: cleanup.endsAt ?? null,
    timezone: cleanup.timezone ?? null,
    lat: cleanup.lat,
    lng: cleanup.lng,
    going: cleanup.going,
    organizer: cleanup.organizer,
    linkedAt: cleanup.scheduledAt,
  }
}

function EventEmbed(props: EmbedProps) {
  const { link, onOpen } = props
  const query = useCleanup(link.id)
  const onPress = useCallback(() => onOpen(link), [onOpen, link])
  const event = useMemo(() => (query.data ? eventRefFromCleanup(query.data) : undefined), [query.data])
  return (
    <EmbedShell
      {...props}
      query={query}
      data={event}
      render={(ref) => (
        <LinkedEventCard
          event={ref}
          cleanup={query.data}
          layout="list"
          timeZone={ref.timezone ?? undefined}
          onPress={onPress}
        />
      )}
    />
  )
}

function PostEmbedCard({ post, onPress }: { post: PostDTO; onPress: () => void }) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("conversation")
  const { t: tf } = useT("home-feed")
  const timeAgo = useListTimeAgo()
  const identity = useMemo(
    () => buildPostIdentity(post.author, post.organization, tf, tf("post_card.deleted_account")),
    [post.author, post.organization, tf],
  )
  const body = post.body?.trim() || post.repostOf?.excerpt || ""
  const media = post.media ?? []
  const byline = identity.handleLabel ?? identity.viaLabel
  const time = timeAgo(post.createdAt)
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t("embed.post_a11y", { name: identity.name })}
      {...focusRingProps}
      style={(state) => [
        styles.card,
        webTransition,
        webCursor(false),
        webHover(state) ? styles.cardHovered : null,
        state.pressed ? styles.pressed : null,
      ]}
    >
      <View style={styles.identityRow}>
        <Avatar
          name={identity.avatarName}
          seed={identity.avatarSeed}
          photoUrl={identity.avatarUrl}
          gradient={identity.avatarGradient}
          size={40}
          {...(identity.organization ? { style: styles.orgAvatar } : {})}
          decorative
        />
        <View style={styles.identityCol}>
          <View style={styles.headerRow}>
            <Text variant="bodyStrong" numberOfLines={1} style={styles.name}>
              {identity.name}
            </Text>
            {identity.affiliation ? (
              <OrgAffiliationBadge organization={identity.affiliation} size="sm" interactive={false} />
            ) : null}
          </View>
          <View style={styles.headerRow}>
            {byline ? (
              <Text numberOfLines={1} style={styles.meta}>
                {byline}
              </Text>
            ) : null}
            <Text style={[styles.meta, styles.metaFixed]}>{byline ? `· ${time}` : time}</Text>
          </View>
        </View>
      </View>
      {body.length > 0 ? (
        <Text variant="body" numberOfLines={4} color={th.colors.text} style={styles.body}>
          {body}
        </Text>
      ) : null}
      {media.length > 0 ? (
        <PostMediaGrid media={media} radius={th.radius.md} maxHeight={POST_EMBED_MEDIA_MAX_HEIGHT} />
      ) : null}
    </Pressable>
  )
}

function PostEmbed(props: EmbedProps) {
  const { link, onOpen } = props
  const query = usePost(link.id)
  const onPress = useCallback(() => onOpen(link), [onOpen, link])
  return (
    <EmbedShell
      {...props}
      query={query}
      data={query.data}
      render={(post) => <PostEmbedCard post={post} onPress={onPress} />}
    />
  )
}

function PersonEmbedCard({ profile, onPress }: { profile: UserProfileDTO; onPress: () => void }) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("conversation")
  const handle = profile.handle?.replace(/^@/, "").trim() || null
  const bio = profile.bio?.trim() || null
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t("embed.person_a11y", { name: profile.name })}
      {...focusRingProps}
      style={(state) => [
        styles.card,
        webTransition,
        webCursor(false),
        webHover(state) ? styles.cardHovered : null,
        state.pressed ? styles.pressed : null,
      ]}
    >
      <View style={styles.identityRow}>
        <Avatar
          name={profile.name}
          seed={profile.id}
          photoUrl={profile.avatarUrl}
          gradient={profile.avatar}
          size={40}
          decorative
        />
        <View style={styles.identityCol}>
          <View style={styles.headerRow}>
            <Text variant="bodyStrong" numberOfLines={1} style={styles.name}>
              {profile.name}
            </Text>
            {profile.organization ? (
              <OrgAffiliationBadge organization={profile.organization} size="sm" interactive={false} />
            ) : null}
          </View>
          <Text variant="caption" color={th.colors.textMuted} numberOfLines={1}>
            {handle
              ? `@${handle} · ${t("embed.followers", { count: profile.followers })}`
              : t("embed.followers", { count: profile.followers })}
          </Text>
        </View>
      </View>
      {bio ? (
        <Text variant="caption" color={th.colors.text} numberOfLines={2} style={styles.body}>
          {bio}
        </Text>
      ) : null}
    </Pressable>
  )
}

function PersonEmbed(props: EmbedProps) {
  const { link, onOpen } = props
  const query = useProfile(link.id)
  const onPress = useCallback(() => onOpen(link), [onOpen, link])
  return (
    <EmbedShell
      {...props}
      query={query}
      data={query.data?.profile}
      render={(profile) => <PersonEmbedCard profile={profile} onPress={onPress} />}
    />
  )
}

function OrgEmbedCard({ org, onPress }: { org: OrganizationDTO; onPress: () => void }) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("conversation")
  const description = org.description?.trim() || null
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t("embed.org_a11y", { name: org.name })}
      {...focusRingProps}
      style={(state) => [
        styles.card,
        webTransition,
        webCursor(false),
        webHover(state) ? styles.cardHovered : null,
        state.pressed ? styles.pressed : null,
      ]}
    >
      <View style={styles.identityRow}>
        <Avatar name={org.name} seed={org.id} photoUrl={org.logoUrl} size={40} style={styles.orgAvatar} decorative />
        <View style={styles.identityCol}>
          <Text variant="bodyStrong" numberOfLines={1} style={styles.name}>
            {org.name}
          </Text>
          {org.memberCount !== undefined ? (
            <Text variant="caption" color={th.colors.textMuted} numberOfLines={1}>
              {t("header.members", { count: org.memberCount })}
            </Text>
          ) : null}
        </View>
      </View>
      {description ? (
        <Text variant="caption" color={th.colors.text} numberOfLines={2} style={styles.body}>
          {description}
        </Text>
      ) : null}
    </Pressable>
  )
}

function OrgEmbed(props: EmbedProps) {
  const { link, onOpen } = props
  const query = useOrganization(link.id)
  const onPress = useCallback(() => onOpen(link), [onOpen, link])
  return (
    <EmbedShell
      {...props}
      query={query}
      data={query.data}
      render={(org) => <OrgEmbedCard org={org} onPress={onPress} />}
    />
  )
}

function ChatLinkEmbed({ rowKey, ...props }: EmbedCardProps & { rowKey: string }) {
  const { ready, onSettled } = useEmbedGate(rowKey, props.link.key)
  if (!ready) return <EmbedSkeleton kind={props.link.kind} />
  const gated: EmbedProps = { ...props, onSettled }
  switch (props.link.kind) {
    case "report":
      return <ReportEmbed {...gated} />
    case "event":
      return <EventEmbed {...gated} />
    case "post":
      return <PostEmbed {...gated} />
    case "person":
      return <PersonEmbed {...gated} />
    case "org":
      return <OrgEmbed {...gated} />
  }
}

export const ChatLinkEmbeds = React.memo(function ChatLinkEmbeds({
  rowKey,
  refs,
  linkOnly,
  linkStyle,
  onOpen,
}: ChatLinkEmbedsProps) {
  const styles = useStyles()
  if (refs.length === 0) return null
  return (
    <View style={[styles.host, linkOnly ? styles.hostLinkOnly : null]}>
      {refs.map((link) => (
        <ChatLinkEmbed
          key={link.key}
          rowKey={rowKey}
          link={link}
          linkOnly={linkOnly}
          linkStyle={linkStyle}
          onOpen={onOpen}
        />
      ))}
    </View>
  )
})

const useStyles = makeThemedStyles((t) => ({
  host: {
    width: EMBED_CARD_WIDTH,
    maxWidth: "100%",
    gap: t.space["2"],
    marginTop: t.space["2"],
  },
  hostLinkOnly: {
    marginTop: 0,
  },
  skeletonHost: {
    width: "100%",
  },
  fallbackLink: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 14,
    lineHeight: 19,
    textDecorationLine: "underline",
  },
  card: {
    gap: t.space["1"],
    padding: t.space["3"],
    borderRadius: t.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
    ...t.shadows.s1,
  },
  cardHovered: {
    borderColor: t.colors.borderStrong,
    backgroundColor: t.colors.surfaceTint,
  },
  pressed: {
    opacity: 0.92,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["1"],
    minWidth: 0,
  },
  identityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"] + 2,
  },
  identityCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  orgAvatar: {
    borderRadius: t.radius.sm,
  },
  name: {
    flexShrink: 1,
    fontSize: 14,
    lineHeight: 19,
    color: t.colors.text,
  },
  meta: {
    flexShrink: 1,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 13,
    lineHeight: 18,
    color: t.colors.textMuted,
  },
  metaFixed: {
    flexShrink: 0,
  },
  body: {
    fontSize: 14,
    lineHeight: 19,
  },
}))
