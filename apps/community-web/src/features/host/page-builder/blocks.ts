import { EventPageBlockSchema } from "@civfix/shared"
import type { EventPageBlock, EventPageBlockKind, ThemeAccent } from "@civfix/shared"

export const BLOCK_KINDS: readonly EventPageBlockKind[] = [
  "hero",
  "about",
  "agenda",
  "hosts",
  "faq",
  "location",
  "sponsors",
  "donate",
  "registration",
  "contact",
]

export const THEME_ACCENTS: readonly ThemeAccent[] = ["bloom", "moss", "sun", "sky", "lilac"]

let blockCounter = 0

export function newBlockId(kind: EventPageBlockKind): string {
  blockCounter += 1
  return `${kind}-${Date.now().toString(36)}-${blockCounter}`
}

export function emptyBlock(kind: EventPageBlockKind): EventPageBlock {
  const id = newBlockId(kind)
  switch (kind) {
    case "hero":
      return { id, kind: "hero" }
    case "about":
      return { id, kind: "about", body: "" }
    case "agenda":
      return { id, kind: "agenda", items: [] }
    case "hosts":
      return { id, kind: "hosts", entries: [] }
    case "faq":
      return { id, kind: "faq", items: [] }
    case "location":
      return { id, kind: "location", showMap: true }
    case "sponsors":
      return { id, kind: "sponsors", entries: [] }
    case "donate":
      return { id, kind: "donate" }
    case "registration":
      return { id, kind: "registration" }
    case "contact":
      return { id, kind: "contact" }
  }
}

export function replaceBlock(
  blocks: readonly EventPageBlock[],
  id: string,
  patch: Partial<EventPageBlock>,
): EventPageBlock[] {
  return blocks.map((block) =>
    block.id === id ? ({ ...block, ...patch } as EventPageBlock) : block,
  )
}

export function canAddBlock(
  blocks: readonly EventPageBlock[],
  kind: EventPageBlockKind,
): boolean {
  if (kind !== "hero" && kind !== "registration") return true
  return !blocks.some((block) => block.kind === kind)
}

type Row = Record<string, unknown>
type Draftable = Record<string, unknown>

const LIST_KEYS = ["items", "entries"] as const

/** Optional text fields the contract types as `string | null`: a cleared input means "unset". */
const OPTIONAL_TEXT = new Set([
  "headline",
  "subhead",
  "title",
  "blurb",
  "url",
  "note",
  "replyTo",
  "time",
  "description",
  "role",
  "bio",
])

function normalizeText(record: Draftable, requiredBody: boolean): Draftable {
  const out: Draftable = {}
  for (const [key, value] of Object.entries(record)) {
    if (typeof value !== "string" || (key === "body" && requiredBody)) {
      out[key] = value
      continue
    }
    const trimmed = value.trim()
    out[key] = trimmed === "" && (OPTIONAL_TEXT.has(key) || key === "body") ? null : trimmed
  }
  return out
}

function rowIsBlank(row: Row): boolean {
  return Object.values(row).every(
    (value) =>
      value === null || value === undefined || (typeof value === "string" && value.trim() === ""),
  )
}

function listKeyOf(block: Draftable): (typeof LIST_KEYS)[number] | null {
  return LIST_KEYS.find((key) => Array.isArray(block[key])) ?? null
}

/**
 * Client-only identity for an editable list row, so React keeps each row's DOM (focus, caret,
 * uncontrolled state) with the row itself when a middle row is removed. It is a symbol because
 * the row schemas are `.strict()` and carry no id: object spread copies it through every edit,
 * while `Object.entries` and `JSON.stringify` never see it, so `normalizeBlocksForSave` (which
 * rebuilds each row from its string keys) and the request body cannot carry it.
 */
const ROW_KEY = Symbol("pageBuilderRowKey")

type KeyedRow = { [ROW_KEY]?: string }

let rowCounter = 0

export function withRowKey<T extends object>(row: T): T {
  rowCounter += 1
  return { ...row, [ROW_KEY]: `row-${rowCounter}` }
}

export function rowKey(row: object): string | undefined {
  return (row as KeyedRow)[ROW_KEY]
}

/** Keys every list row of blocks loaded from the server, copying rather than touching the cache. */
export function withRowKeys(blocks: readonly EventPageBlock[]): EventPageBlock[] {
  return blocks.map((block) => {
    const source = block as unknown as Draftable
    const listKey = listKeyOf(source)
    if (!listKey) return block
    return {
      ...source,
      [listKey]: (source[listKey] as Row[]).map(withRowKey),
    } as unknown as EventPageBlock
  })
}

/**
 * Trims every text field, turns a cleared optional field into null (so a cleared donate link falls
 * back to the organization's page instead of failing validation) and drops list rows the host
 * added but never filled in. `rowIndex[i]` is the editor row the i-th kept row came from.
 */
function normalizeBlock(block: EventPageBlock): { block: EventPageBlock; rowIndex: number[] } {
  const source = block as unknown as Draftable
  const next = normalizeText(source, block.kind === "about")
  const listKey = listKeyOf(source)
  const rowIndex: number[] = []
  if (listKey) {
    const rows = source[listKey] as Row[]
    const kept: Row[] = []
    rows.forEach((row, index) => {
      if (rowIsBlank(row)) return
      kept.push(normalizeText(row, false))
      rowIndex.push(index)
    })
    next[listKey] = kept
  }
  return { block: next as unknown as EventPageBlock, rowIndex }
}

export function normalizeBlocksForSave(blocks: readonly EventPageBlock[]): EventPageBlock[] {
  return blocks.map((block) => normalizeBlock(block).block)
}

export type BlockIssue = "required" | "url" | "email" | "invalid"

/** Field errors per block id, keyed by the editor's own path (`url`, `items.2.title`). */
export type BlockErrors = Record<string, Record<string, BlockIssue>>

function issueKind(field: string | undefined, code: string): BlockIssue {
  if (field === "url") return "url"
  if (field === "replyTo") return "email"
  if (code === "too_small" || code === "invalid_type") return "required"
  return "invalid"
}

export function blockSaveErrors(blocks: readonly EventPageBlock[]): BlockErrors {
  const out: BlockErrors = {}
  for (const block of blocks) {
    const { block: normalized, rowIndex } = normalizeBlock(block)
    const parsed = EventPageBlockSchema.safeParse(normalized)
    if (parsed.success) continue
    const fields: Record<string, BlockIssue> = {}
    for (const issue of parsed.error.issues) {
      const path = issue.path.map(String)
      const [head, row, field] = path
      const listPath =
        head !== undefined && (LIST_KEYS as readonly string[]).includes(head) && row !== undefined
      const key = listPath
        ? [head, String(rowIndex[Number(row)] ?? row), ...path.slice(2)].join(".")
        : path.join(".")
      if (!fields[key]) fields[key] = issueKind(listPath ? field : head, issue.code)
    }
    out[block.id] = fields
  }
  return out
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical)
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Draftable)
        .filter(([, entry]) => entry !== null && entry !== undefined)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, entry]) => [key, canonical(entry)]),
    )
  }
  return value
}

/** Whether the editor's blocks would save as something other than what the server holds. */
export function blocksDiffer(
  local: readonly EventPageBlock[],
  saved: readonly EventPageBlock[],
): boolean {
  return (
    JSON.stringify(canonical(normalizeBlocksForSave(local))) !==
    JSON.stringify(canonical(normalizeBlocksForSave(saved)))
  )
}
