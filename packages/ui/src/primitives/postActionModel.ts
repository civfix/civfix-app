import type { PostCounts, PostViewer } from "@civfix/shared"
import { space } from "@civfix/shared/tokens"
import type { MenuAnchorRect } from "./menuMotionModel"
import { resolveBandLeft } from "./messageContextMenuLayout"

export type PostActionKey = "like" | "repost" | "comment" | "save" | "share"

export interface PostActionModel {
  key: PostActionKey
  countLabel: string | null
  active: boolean
  onPress?: () => void
  sharePath?: string
}

export interface PostActionCallbacks {
  onLike?: (currentlyLiked: boolean) => void
  onRepost?: (currentlyReposted: boolean) => void
  onComment?: () => void
  onSave?: (currentlySaved: boolean) => void
  onShare?: (path: string) => void
}

export type PostActionVariant = "timeline" | "card" | "focal" | "reply"

export interface PostActionLayout {
  keys: readonly PostActionKey[]
  glyphSize: number
  gap: number
  justify: "space-between" | "flex-start"
  minHeight: number
  showCounts: boolean
  haloSize: number
  target: { minWidth: number; minHeight: number }
  trailing?: PostActionKey
}

const CARD_KEYS: readonly PostActionKey[] = ["like", "repost", "comment", "save", "share"]
const REPLY_KEYS: readonly PostActionKey[] = ["like", "repost", "comment", "share"]
const TIMELINE_KEYS: readonly PostActionKey[] = ["comment", "repost", "like", "save"]

export function postActionLayout(variant: PostActionVariant): PostActionLayout {
  switch (variant) {
    case "timeline":
      return {
        keys: TIMELINE_KEYS,
        glyphSize: 18,
        gap: space["1"],
        justify: "flex-start",
        minHeight: 44,
        showCounts: true,
        haloSize: 34,
        target: { minWidth: 44, minHeight: 44 },
        trailing: "share",
      }
    case "focal":
      return {
        keys: CARD_KEYS,
        glyphSize: 21,
        gap: 2,
        justify: "space-between",
        minHeight: 48,
        showCounts: false,
        haloSize: 38,
        target: { minWidth: 44, minHeight: 44 },
      }
    case "reply":
      return {
        keys: REPLY_KEYS,
        glyphSize: 17,
        gap: space["2"],
        justify: "flex-start",
        minHeight: 32,
        showCounts: true,
        haloSize: 28,
        target: { minWidth: 32, minHeight: 32 },
      }
    case "card":
      return {
        keys: CARD_KEYS,
        glyphSize: 19,
        gap: 2,
        justify: "space-between",
        minHeight: 44,
        showCounts: true,
        haloSize: 34,
        target: { minWidth: 44, minHeight: 44 },
      }
  }
}

export function postActionHaloInset(layout: PostActionLayout): number {
  return (layout.target.minWidth - layout.haloSize) / 2
}

export function postActionHaloOverhang(layout: PostActionLayout): number {
  return (layout.haloSize - layout.glyphSize) / 2
}

export function postActionGlyphInset(layout: PostActionLayout): number {
  return postActionHaloInset(layout) + postActionHaloOverhang(layout)
}

export function postActionCountGap(layout: PostActionLayout): number {
  return postActionHaloOverhang(layout)
}

export function postActionButtonWidth(layout: PostActionLayout, countWidth = 0): number {
  const counted = layout.showCounts && countWidth > 0
  const content =
    postActionGlyphInset(layout) +
    layout.glyphSize +
    (counted ? postActionCountGap(layout) + countWidth : 0)
  return Math.max(layout.target.minWidth, content)
}

export function postActionRowWidth(
  layout: PostActionLayout,
  countWidths: Partial<Record<PostActionKey, number>> = {},
): number {
  const leading = layout.keys.filter((key) => key !== layout.trailing)
  const buttons = layout.trailing ? [...leading, layout.trailing] : leading
  const childCount = layout.trailing ? leading.length + 2 : leading.length
  const boxes = buttons.reduce(
    (sum, key) => sum + postActionButtonWidth(layout, countWidths[key] ?? 0),
    0,
  )
  return boxes + layout.gap * Math.max(0, childCount - 1)
}

export function postActionRowAvailableWidth(
  layout: PostActionLayout,
  row: { screenWidth: number; rowPaddingH: number; gutterWidth: number },
): number {
  return (
    row.screenWidth - 2 * row.rowPaddingH - row.gutterWidth + 2 * postActionGlyphInset(layout)
  )
}

export type PostActionHaloFamily = "bloom" | "moss" | "sky"

export function postActionHaloFamily(key: PostActionKey): PostActionHaloFamily {
  if (key === "like") return "bloom"
  if (key === "repost") return "moss"
  return "sky"
}

export interface PostActionMenuLabels {
  repost: string
  undoRepost: string
  quote: string
}

export function buildPostActionMenuModel(
  reposted: boolean,
  labels: PostActionMenuLabels,
): readonly [{ key: "repost"; label: string }, { key: "quote"; label: string }] {
  return [
    { key: "repost" as const, label: reposted ? labels.undoRepost : labels.repost },
    { key: "quote" as const, label: labels.quote },
  ]
}

export function positionPostActionMenu(
  anchor: MenuAnchorRect,
  viewport: { width: number; height: number },
  menu: { width: number; height: number },
  align: "left" | "right" = "right",
): { left: number; top: number } {
  const margin = space["2"]
  const gap = space["1"]
  const below = anchor.y + anchor.height + gap
  const preferredTop = below + menu.height <= viewport.height - margin
    ? below
    : anchor.y - menu.height - gap
  return {
    left: resolveBandLeft(anchor, viewport.width, menu.width, align === "right", { edgeMargin: margin }),
    top: Math.min(
      Math.max(preferredTop, margin),
      Math.max(margin, viewport.height - menu.height - margin),
    ),
  }
}

export const POST_ACTION_POP_MS = 280

export function formatPostActionCount(value: number): string {
  const count = Math.max(0, Math.trunc(value))
  if (count < 1_000) return String(count)
  const formatUnit = (divisor: number, suffix: string): string => {
    const scaled = count / divisor
    return `${Number(scaled.toFixed(scaled < 10 ? 1 : 0))}${suffix}`
  }
  if (count < 1_000_000) return formatUnit(1_000, "K")
  if (count < 1_000_000_000) return formatUnit(1_000_000, "M")
  return formatUnit(1_000_000_000, "B")
}

/** The post's own detail route: what Share links to and where a sign-in started here returns. */
export function postDetailPath(postId: string): string {
  return `/post/${postId}`
}

export function buildPostActionModel(
  input: { postId: string; counts: PostCounts; viewer: PostViewer },
  callbacks: PostActionCallbacks = {},
  options?: { omit?: readonly PostActionKey[] },
): PostActionModel[] {
  const sharePath = postDetailPath(input.postId)
  const countLabel = (value: number) => value > 0 ? formatPostActionCount(value) : null
  const all: PostActionModel[] = [
    { key: "like", countLabel: countLabel(input.counts.likes), active: input.viewer.liked,
      onPress: callbacks.onLike ? () => callbacks.onLike?.(input.viewer.liked) : undefined },
    { key: "repost", countLabel: countLabel(input.counts.reposts), active: input.viewer.reposted,
      onPress: callbacks.onRepost ? () => callbacks.onRepost?.(input.viewer.reposted) : undefined },
    { key: "comment", countLabel: countLabel(input.counts.replies), active: false,
      onPress: callbacks.onComment },
    { key: "save", countLabel: countLabel(input.counts.saves), active: input.viewer.saved,
      onPress: callbacks.onSave ? () => callbacks.onSave?.(input.viewer.saved) : undefined },
    { key: "share", countLabel: null, active: false, sharePath,
      onPress: callbacks.onShare ? () => callbacks.onShare?.(sharePath) : undefined },
  ]
  const omit = options?.omit
  if (omit == null || omit.length === 0) return all
  return all.filter((action) => !omit.includes(action.key))
}
