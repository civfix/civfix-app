const ZWJ = 0x200d
const COMBINING = /^\p{M}$/u
// eslint-disable-next-line no-misleading-character-class
const EXTENDER = /^[\u200d\ufe00-\ufe0f\u{1f3fb}-\u{1f3ff}]$/u
const REGIONAL = /^[\u{1f1e6}-\u{1f1ff}]$/u

type Segmenter = { segment(input: string): Iterable<{ segment: string }> }

let cachedSegmenter: Segmenter | null | undefined

function segmenter(): Segmenter | null {
  if (cachedSegmenter !== undefined) return cachedSegmenter
  const intl = (globalThis as {
    Intl?: { Segmenter?: new (locale?: string, options?: unknown) => Segmenter }
  }).Intl
  cachedSegmenter =
    intl !== undefined && typeof intl.Segmenter === "function"
      ? new intl.Segmenter(undefined, { granularity: "grapheme" })
      : null
  return cachedSegmenter
}

function fallbackSegments(text: string): string[] {
  const clusters: string[] = []
  let joinNext = false
  let regionalRun = 0
  for (const codePoint of text) {
    const isRegional = REGIONAL.test(codePoint)
    const pairsWithPrevious = isRegional && regionalRun % 2 === 1
    const attaches = joinNext || COMBINING.test(codePoint) || EXTENDER.test(codePoint) || pairsWithPrevious
    if (attaches && clusters.length > 0) {
      clusters[clusters.length - 1] += codePoint
    } else {
      clusters.push(codePoint)
    }
    joinNext = codePoint.codePointAt(0) === ZWJ
    regionalRun = isRegional ? regionalRun + 1 : 0
  }
  return clusters
}

export function segmentGraphemes(text: string): string[] {
  if (text.length === 0) return []
  const intl = segmenter()
  if (intl === null) return fallbackSegments(text)
  const clusters: string[] = []
  for (const piece of intl.segment(text)) clusters.push(piece.segment)
  return clusters
}

export function graphemeLength(text: string): number {
  return segmentGraphemes(text).length
}

export function collapseWhitespace(text: string): string {
  return text.replace(/\s+/gu, " ").trim()
}

export function truncateGraphemes(text: string, max: number, ellipsis = "…"): string {
  if (!Number.isFinite(max) || max <= 0) return ""
  const clusters = segmentGraphemes(text)
  if (clusters.length <= max) return text
  const tailLength = segmentGraphemes(ellipsis).length
  const keep = Math.max(0, Math.floor(max) - tailLength)
  const head = clusters.slice(0, keep).join("").replace(/\s+$/u, "")
  return `${head}${ellipsis}`
}
