import type { TFunction } from "i18next"
import type { PostCounts, PostDTO } from "@civfix/shared"


export const THREAD_HEADER_H = 52
export const MIN_THREAD_VISIBLE = 132
export const REPLY_SURFACE_MIN = 96
export const REPLY_CHROME_FALLBACK = 92
export const REPLY_THUMBS_H = 72
export const REPLY_INPUT_MIN = 40
export const REPLY_INPUT_MAX_CAP = 132
export const REPLY_TRAY_MIN = 96
export const REPLY_TRAY_MAX_CAP = 168
export const REPLY_SURFACE_FRACTION = 0.62

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export interface ReplyComposerHeightPlan {
  available: number
  surfaceMax: number
  inputMax: number
  trayMax: number
}

export function buildReplyComposerHeightPlan(input: {
  rootHeight: number
  keyboardInset: number
  expanded: boolean
  hasThumbs: boolean
  measuredChrome: number | null
}): ReplyComposerHeightPlan {
  const available = Math.max(240, input.rootHeight - THREAD_HEADER_H - input.keyboardInset)
  const surfaceMax = clamp(
    Math.round(available * REPLY_SURFACE_FRACTION),
    REPLY_SURFACE_MIN,
    Math.max(REPLY_SURFACE_MIN, available - MIN_THREAD_VISIBLE),
  )
  const chrome = input.measuredChrome
    ?? (REPLY_CHROME_FALLBACK + (input.hasThumbs ? REPLY_THUMBS_H : 0))
  const inputMax = input.expanded
    ? clamp(surfaceMax - chrome, REPLY_INPUT_MIN, REPLY_INPUT_MAX_CAP)
    : REPLY_INPUT_MIN
  const trayMax = clamp(available - surfaceMax - 8, REPLY_TRAY_MIN, REPLY_TRAY_MAX_CAP)
  return { available, surfaceMax, inputMax, trayMax }
}


export interface ThreadRailSegment {
  above: boolean
  below: boolean
}

export interface ThreadRailReply {
  readonly author: { readonly id: string }
}

const NO_RAIL: ThreadRailSegment = { above: false, below: false }
const RAIL_ABOVE: ThreadRailSegment = { above: true, below: false }
const RAIL_BELOW: ThreadRailSegment = { above: false, below: true }
const RAIL_BOTH: ThreadRailSegment = { above: true, below: true }

export function threadRailSegment(above: boolean, below: boolean): ThreadRailSegment {
  if (above) return below ? RAIL_BOTH : RAIL_ABOVE
  return below ? RAIL_BELOW : NO_RAIL
}

export function buildThreadRailPlan(
  replies: readonly ThreadRailReply[],
  focalAuthorId: string | null | undefined,
): readonly ThreadRailSegment[] {
  if (focalAuthorId == null || focalAuthorId === "") return replies.map(() => NO_RAIL)
  let run = 0
  while (run < replies.length && replies[run]?.author.id === focalAuthorId) run += 1
  return replies.map((_reply, index) =>
    index < run ? threadRailSegment(true, index < run - 1) : NO_RAIL,
  )
}


export function threadItems<T extends { id: string }>(
  fetched: readonly T[],
  sent: readonly T[],
): readonly T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const item of [...fetched, ...sent]) {
    if (seen.has(item.id)) continue
    seen.add(item.id)
    out.push(item)
  }
  return out
}


export type FocalPostStatKey = "replies" | "reposts" | "likes"

export interface FocalPostStat {
  key: FocalPostStatKey
  count: number
  label: string
}

export function buildFocalPostStats(counts: PostCounts, t: TFunction): readonly FocalPostStat[] {
  const order: readonly FocalPostStatKey[] = ["replies", "reposts", "likes"]
  const value = (key: FocalPostStatKey): number =>
    key === "replies" ? counts.replies : key === "reposts" ? counts.reposts : counts.likes
  return order.flatMap((key) => {
    const count = value(key)
    if (count <= 0) return []
    return [{ key, count, label: t(`thread.stats.${key}`, { count }) }]
  })
}

export function threadFocalExcerpt(
  post: Pick<PostDTO, "body" | "event" | "report" | "media">,
  t: TFunction,
): string {
  const body = (post.body ?? "").replace(/\s+/g, " ").trim()
  if (body) return body
  if (post.event) return post.event.title
  if (post.report) return post.report.title
  if ((post.media ?? []).length > 0) return t("post_card.media_a11y")
  return ""
}


export type ReplyComposerState = "signed-out" | "collapsed" | "expanded"

export function replyComposerState(input: {
  focused: boolean
  hasDraft: boolean
  hasAttachments: boolean
  signedIn: boolean
  hasError: boolean
}): ReplyComposerState {
  if (!input.signedIn) return "signed-out"
  if (input.focused || input.hasDraft || input.hasAttachments || input.hasError) return "expanded"
  return "collapsed"
}


export const THREAD_MAX_INLINE_DEPTH = 2

export const THREAD_AVATAR_SIZE = 36
export const THREAD_NESTED_AVATAR_SIZE = 28
export const THREAD_RAIL_COLUMN_W = THREAD_AVATAR_SIZE
export const THREAD_RAIL_GAP = 10
export const THREAD_RAIL_W = 2
export const THREAD_RAIL_STUB_H = 12
export const THREAD_NESTED_INDENT = THREAD_RAIL_COLUMN_W + THREAD_RAIL_GAP

export type ThreadRowDepth = 1 | 2

export interface ThreadRowGeometry {
  readonly indent: number
  readonly avatarSize: number
}

const TOP_LEVEL_GEOMETRY: ThreadRowGeometry = { indent: 0, avatarSize: THREAD_AVATAR_SIZE }
const NESTED_GEOMETRY: ThreadRowGeometry = {
  indent: THREAD_NESTED_INDENT,
  avatarSize: THREAD_NESTED_AVATAR_SIZE,
}

export function threadRowGeometry(depth: ThreadRowDepth): ThreadRowGeometry {
  return depth >= THREAD_MAX_INLINE_DEPTH ? NESTED_GEOMETRY : TOP_LEVEL_GEOMETRY
}

export function threadGutterWidth(geometry: ThreadRowGeometry): number {
  return geometry.indent - THREAD_RAIL_GAP
}

const OPTIMISTIC_PREFIX = "optimistic-"

export function isOptimisticPostId(id: string): boolean {
  return id.startsWith(OPTIMISTIC_PREFIX)
}

export interface ThreadRowPost {
  readonly id: string
  readonly author: { readonly id: string }
  readonly counts: { readonly replies: number }
  readonly replyToId?: string | null
}

export type ThreadRowExpansion = "expand" | "collapse" | "navigate" | "none"

export interface ThreadChildState<T extends ThreadRowPost> {
  items: readonly T[]
  loading: boolean
  hasMore: boolean
}

export type ThreadRowVariant<T extends ThreadRowPost> =
  | { kind: "reply"; post: T; expansion: ThreadRowExpansion; optimistic: boolean }
  | { kind: "nested"; parentId: string; post: T; expansion: ThreadRowExpansion; optimistic: boolean }
  | { kind: "show-more"; parentId: string; remaining: number }
  | { kind: "loading"; parentId: string }

export type ThreadRow<T extends ThreadRowPost> = ThreadRowVariant<T> & {
  key: string
  depth: ThreadRowDepth
  rail: ThreadRailSegment
  hairline: boolean
}

const EMPTY_EXPANDED: ReadonlySet<string> = new Set<string>()

function rowExpansion(
  depth: ThreadRowDepth,
  replyCount: number,
  expanded: boolean,
  optimistic: boolean,
): ThreadRowExpansion {
  if (expanded) return "collapse"
  if (optimistic || replyCount <= 0) return "none"
  return depth >= THREAD_MAX_INLINE_DEPTH ? "navigate" : "expand"
}

export function buildThreadRows<T extends ThreadRowPost>(input: {
  focalId: string
  focalAuthorId: string | null | undefined
  replies: readonly T[]
  sent?: readonly T[]
  expandedIds?: ReadonlySet<string>
  children?: Readonly<Record<string, ThreadChildState<T> | undefined>>
}): readonly ThreadRow<T>[] {
  const sent = input.sent ?? []
  const expandedIds = input.expandedIds ?? EMPTY_EXPANDED
  const children = input.children ?? {}

  const top = threadItems(
    input.replies,
    sent.filter((post) => (post.replyToId ?? input.focalId) === input.focalId),
  )

  let run = 0
  if (input.focalAuthorId != null && input.focalAuthorId !== "") {
    while (run < top.length && top[run]?.author.id === input.focalAuthorId) run += 1
  }

  const drafts: { key: string; depth: ThreadRowDepth; variant: ThreadRowVariant<T>; below: boolean }[] = []

  top.forEach((post, index) => {
    const optimistic = isOptimisticPostId(post.id)
    const expanded = !optimistic && expandedIds.has(post.id)
    const state = expanded ? children[post.id] : undefined
    const kids = state
      ? threadItems(state.items, sent.filter((item) => item.replyToId === post.id))
      : []
    const pending = state?.loading === true && kids.length === 0
    const remaining =
      state?.hasMore === true ? Math.max(1, post.counts.replies - kids.length) : 0
    const blockRows = kids.length + (pending ? 1 : 0) + (remaining > 0 ? 1 : 0)

    drafts.push({
      key: post.id,
      depth: 1,
      variant: {
        kind: "reply",
        post,
        expansion: rowExpansion(1, post.counts.replies, expanded, optimistic),
        optimistic,
      },
      below: blockRows > 0 ? true : index < run - 1,
    })

    kids.forEach((child, at) => {
      const childOptimistic = isOptimisticPostId(child.id)
      drafts.push({
        key: `${post.id}:${child.id}`,
        depth: 2,
        variant: {
          kind: "nested",
          parentId: post.id,
          post: child,
          expansion: rowExpansion(2, child.counts.replies, false, childOptimistic),
          optimistic: childOptimistic,
        },
        below: at < kids.length - 1 || pending || remaining > 0,
      })
    })

    if (pending) {
      drafts.push({
        key: `loading:${post.id}`,
        depth: 2,
        variant: { kind: "loading", parentId: post.id },
        below: remaining > 0,
      })
    }

    if (remaining > 0) {
      drafts.push({
        key: `show-more:${post.id}`,
        depth: 2,
        variant: { kind: "show-more", parentId: post.id, remaining },
        below: false,
      })
    }
  })

  return drafts.map((draft, index): ThreadRow<T> => ({
    ...draft.variant,
    key: draft.key,
    depth: draft.depth,
    rail: threadRailSegment(
      index === 0 ? run > 0 : drafts[index - 1]?.below === true,
      draft.below,
    ),
    hairline: !draft.below,
  }))
}
