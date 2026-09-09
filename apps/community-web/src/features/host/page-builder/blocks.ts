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

export function moveBlock(
  blocks: readonly EventPageBlock[],
  index: number,
  delta: number,
): EventPageBlock[] {
  const next = [...blocks]
  const target = index + delta
  if (target < 0 || target >= next.length) return next
  const [moved] = next.splice(index, 1)
  if (moved) next.splice(target, 0, moved)
  return next
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
