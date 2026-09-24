import { readdirSync, readFileSync } from "node:fs"
import { expect } from "vitest"
import { MIN_TOUCH_TARGET, hitSlopToTarget } from "../theme/touchTarget"

/**
 * Helpers for source-level guards. A guard that slices the source between two anchors must fail
 * when an anchor disappears: `slice(-1)` or `slice(start, -1)` hands a negative check the wrong
 * region, where "does not contain" passes whatever the code does.
 */

export function sliceBetween(source: string, from: string, to: string): string {
  const start = source.indexOf(from)
  expect(start, `anchor ${JSON.stringify(from)} is gone - re-scope the guard, do not delete it`).toBeGreaterThan(-1)
  const end = source.indexOf(to, start + from.length)
  expect(end, `end anchor ${JSON.stringify(to)} no longer follows ${JSON.stringify(from)}`).toBeGreaterThan(start)
  return source.slice(start, end)
}

export function sliceFrom(source: string, from: string): string {
  const start = source.indexOf(from)
  expect(start, `anchor ${JSON.stringify(from)} is gone - re-scope the guard, do not delete it`).toBeGreaterThan(-1)
  return source.slice(start)
}

/** Each anchor must occur exactly once, so a second call site cannot satisfy the order by accident. */
export function expectInSourceOrder(source: string, anchors: readonly string[]): void {
  let previous = -1
  for (const anchor of anchors) {
    expect(source.split(anchor).length - 1, `${JSON.stringify(anchor)} must occur exactly once`).toBe(1)
    const at = source.indexOf(anchor)
    expect(at, `${JSON.stringify(anchor)} is out of order`).toBeGreaterThan(previous)
    previous = at
  }
}

export interface LayoutEffectSource {
  body: string
  deps: string | null
}

const LAYOUT_EFFECT_OPEN = "useLayoutEffect(() => {"

/** Brace counting ignores string contents, which is safe for the effect bodies these guards read. */
export function layoutEffectBodies(source: string): LayoutEffectSource[] {
  const effects: LayoutEffectSource[] = []
  let from = source.indexOf(LAYOUT_EFFECT_OPEN)
  while (from > -1) {
    const open = from + LAYOUT_EFFECT_OPEN.length - 1
    let depth = 0
    let close = -1
    for (let i = open; i < source.length; i += 1) {
      if (source[i] === "{") depth += 1
      else if (source[i] === "}") {
        depth -= 1
        if (depth === 0) {
          close = i
          break
        }
      }
    }
    if (close === -1) break
    const after = source.slice(close + 1)
    const deps = /^\s*\)/.test(after) ? null : after.slice(0, after.indexOf(")")).replace(/^\s*,\s*/, "").trim()
    effects.push({ body: source.slice(open + 1, close), deps })
    from = source.indexOf(LAYOUT_EFFECT_OPEN, close)
  }
  return effects
}

/**
 * A latest-value ref is written exactly once, inside a dependency-free layout effect, so it tracks
 * every committed render and never a render React later discards.
 */
export function expectWrittenInLayoutEffect(source: string, assignment: string): void {
  expect(source.split(assignment).length - 1, `${assignment} must be written exactly once`).toBe(1)
  const effect = layoutEffectBodies(source).find((candidate) => candidate.body.includes(assignment))
  expect(effect, `${assignment} is not inside a useLayoutEffect body`).toBeDefined()
  expect(effect?.deps ?? null, `the layout effect writing ${assignment} must run after every commit`).toBeNull()
}

const THEME_TOUCH_TARGET_IMPORT =
  /import \{[^}]*\bMIN_TOUCH_TARGET\b[^}]*\} from "[./]+\/theme(?:\/touchTarget)?"/

/**
 * The 44pt floor comes from the theme, never a re-typed local copy that could drift. Returns the floor so a
 * guard can do its slop arithmetic with the value the source actually renders.
 */
export function expectThemeTouchTarget(source: string): number {
  expect(source, "MIN_TOUCH_TARGET must be imported from the theme").toMatch(THEME_TOUCH_TARGET_IMPORT)
  expect(source, "a local MIN_TOUCH_TARGET copy shadows the theme floor").not.toMatch(/const MIN_TOUCH_TARGET =/)
  expect(MIN_TOUCH_TARGET).toBe(44)
  return MIN_TOUCH_TARGET
}

const THEME_HIT_SLOP_IMPORT =
  /import \{[^}]*\bhitSlopToTarget\b[^}]*\} from "[./]+\/theme(?:\/touchTarget)?"/

/**
 * A control that reaches the 44pt floor by slop takes the theme's `hitSlopToTarget`, never a re-typed
 * `(44 - size) / 2`. Returns the helper so a guard can do its arithmetic with the one the source calls.
 */
export function expectThemeHitSlop(source: string): (size: number) => number {
  expect(source, "hitSlopToTarget must be imported from the theme").toMatch(THEME_HIT_SLOP_IMPORT)
  expect(source, "a local MIN_TOUCH_TARGET copy shadows the theme floor").not.toMatch(/const MIN_TOUCH_TARGET =/)
  expect(source, "a re-typed slop formula bypasses the helper").not.toMatch(/\(MIN_TOUCH_TARGET - [A-Z_]+\) \/ 2/)
  return hitSlopToTarget
}

/**
 * Every source file a split surface renders from: the entry file first, so a first-occurrence anchor still
 * lands in its own JSX, then each .ts/.tsx directly in the parts folder, sorted. Scanning the folder means a
 * guard cannot miss a part split out later.
 */
export function folderSourceFiles(dir: URL, entry?: URL): URL[] {
  const parts = readdirSync(dir, { withFileTypes: true })
    .filter((file) => file.isFile() && /\.tsx?$/.test(file.name))
    .map((file) => file.name)
    .sort()
    .map((name) => new URL(name, dir))
  return entry ? [entry, ...parts] : parts
}

function folderSource(dir: URL, entry?: URL): string {
  return folderSourceFiles(dir, entry)
    .map((file) => readFileSync(file, "utf8"))
    .join("\n")
}

const SRC = new URL("../", import.meta.url)

const SPLIT_SURFACES = {
  personDetail: { entry: "bodies/PersonDetailBody.tsx", parts: "bodies/personDetail/" },
  search: { entry: "bodies/SearchBody.tsx", parts: "bodies/search/" },
  certificateCard: { entry: "bodies/profile/ServiceHoursCertificateCard.tsx", parts: "bodies/profile/certificate/" },
  eventAnalytics: { entry: "bodies/host/EventAnalyticsBody.tsx", parts: "bodies/host/analytics/" },
  postComposer: { entry: "bodies/PostComposer.tsx", parts: "bodies/postComposer/" },
} as const

export type SplitSurface = keyof typeof SPLIT_SURFACES

export function surfaceSource(surface: SplitSurface): string {
  const { entry, parts } = SPLIT_SURFACES[surface]
  return folderSource(new URL(parts, SRC), new URL(entry, SRC))
}

export function surfacePart(surface: SplitSurface, name: string): string {
  return readFileSync(new URL(name, new URL(SPLIT_SURFACES[surface].parts, SRC)), "utf8")
}
