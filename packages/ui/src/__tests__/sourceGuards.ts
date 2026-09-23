import { expect } from "vitest"

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
