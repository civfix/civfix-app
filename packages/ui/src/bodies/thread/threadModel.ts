import type { TFunction } from "i18next"
import type { PostCounts, PostDTO } from "@civfix/shared"
import { clamp } from "../../math/clamp"


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

const NO_RAIL: ThreadRailSegment = { above: false, below: false }
const RAIL_ABOVE: ThreadRailSegment = { above: true, below: false }
const RAIL_BELOW: ThreadRailSegment = { above: false, below: true }
const RAIL_BOTH: ThreadRailSegment = { above: true, below: true }

export function threadRailSegment(above: boolean, below: boolean): ThreadRailSegment {
  if (above) return below ? RAIL_BOTH : RAIL_ABOVE
  return below ? RAIL_BELOW : NO_RAIL
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


export type ComposerSurface = "chat" | "thread-reply"

export type ComposerFocusAfterSend = "keep" | "release"

export function composerFocusAfterSend(surface: ComposerSurface): ComposerFocusAfterSend {
  return surface === "chat" ? "keep" : "release"
}


export const THREAD_AVATAR_SIZE = 36
export const THREAD_RAIL_GAP = 10
export const THREAD_RAIL_W = 2

const OPTIMISTIC_PREFIX = "optimistic-"

export function isOptimisticPostId(id: string): boolean {
  return id.startsWith(OPTIMISTIC_PREFIX)
}

export function optimisticPostId(now: number): string {
  return `${OPTIMISTIC_PREFIX}${now}`
}

export interface ThreadRowPost {
  readonly id: string
  readonly replyToId?: string | null
}

export interface ThreadRow<T extends ThreadRowPost> {
  key: string
  post: T
  optimistic: boolean
  rail: ThreadRailSegment
  hairline: boolean
}

export function buildThreadRows<T extends ThreadRowPost>(input: {
  focalId: string
  replies: readonly T[]
  sent?: readonly T[]
  nested?: readonly T[]
}): readonly ThreadRow<T>[] {
  const sent = input.sent ?? []
  const replies = threadItems(
    input.replies,
    sent.filter((post) => (post.replyToId ?? input.focalId) === input.focalId),
  )
  const parentIds = new Set(replies.map((post) => post.id))
  const child = new Map<string, T>()
  for (const post of input.nested ?? []) {
    const parentId = post.replyToId
    if (parentId == null || !parentIds.has(parentId) || child.has(parentId)) continue
    child.set(parentId, post)
  }

  return replies.flatMap((post): ThreadRow<T>[] => {
    const nested = child.get(post.id)
    const parent: ThreadRow<T> = {
      key: post.id,
      post,
      optimistic: isOptimisticPostId(post.id),
      rail: threadRailSegment(false, nested !== undefined),
      hairline: nested === undefined,
    }
    if (nested === undefined) return [parent]
    return [
      parent,
      {
        key: `${post.id}:${nested.id}`,
        post: nested,
        optimistic: isOptimisticPostId(nested.id),
        rail: threadRailSegment(true, false),
        hairline: true,
      },
    ]
  })
}
