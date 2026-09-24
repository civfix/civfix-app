/**
 * NO BODY WRITES A ZUSTAND STORE FROM A RENDER-PHASE `useState` INITIALIZER.
 *
 * A lazy `useState(() => ...)` initializer runs during RENDER, and a zustand `set` notifies every
 * subscriber synchronously. Beginning/merging the persistent event draft there made the launching
 * report's body re-render mid-render, and React threw on every "Host an event" opened from a report:
 *
 *   Cannot update a component (`ReportDetailContent`) while rendering a different component (`HostForm`).
 *
 * `shell/PageStack.native` retains the report page mounted underneath the host page, so the subscriber
 * exists at the moment of the write. Every retained under-layer makes the next such write a crash, which
 * is why the rule is checked across ALL bodies rather than at one call site.
 *
 * WHY SOURCE GREPS: this package's vitest runs in a node environment and cannot load `react-native`, so no
 * test here mounts a component (see postScrollOwnership.test.ts / slotSurfaces.test.ts for the same
 * reason). "Is this store read or written?" is invisible in a diff and expensive in the field.
 *
 * A lazy initializer may still READ a store (`useX.getState().draft`) - a mount-time snapshot is the whole
 * point of the idiom. What it may not do is call a store OPERATION, or hand the whole store to something
 * that will (`beginOrMergeHostDraft(useCleanupDraft.getState(), ...)` - the exact shape of the bug).
 */
import { readdirSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import path from "node:path"
import { describe, expect, it } from "vitest"

const BODIES_DIR = fileURLToPath(new URL("..", import.meta.url))

/** Comments describe these rules, so strip them or the prose satisfies the grep instead of the code. */
const code = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

function sourceFiles(): string[] {
  return readdirSync(BODIES_DIR, { recursive: true, encoding: "utf8" })
    .filter((rel) => /\.tsx?$/.test(rel) && !rel.includes("__tests__"))
    .map((rel) => path.join(BODIES_DIR, rel))
    .sort()
}

/**
 * Every `useState(...)` argument list in a source, extracted by balancing parentheses (a regex cannot -
 * an initializer is an arbitrary function body). String literals are skipped so a `")"` inside copy does
 * not close the block early.
 */
function stateInitializerBlocks(source: string): string[] {
  const blocks: string[] = []
  const call = /\buseState\s*(?:<[^(]*?>)?\s*\(/g
  let match: RegExpExecArray | null
  while ((match = call.exec(source)) !== null) {
    let depth = 1
    let quote: string | null = null
    let i = match.index + match[0].length
    const start = i
    for (; i < source.length && depth > 0; i++) {
      const ch = source[i]
      if (quote) {
        if (ch === "\\") i++
        else if (ch === quote) quote = null
        continue
      }
      if (ch === '"' || ch === "'" || ch === "`") quote = ch
      else if (ch === "(") depth++
      else if (ch === ")") depth--
    }
    blocks.push(source.slice(start, i - 1))
  }
  return blocks
}

/** A store operation invoked straight off a snapshot: `useX.getState().patch(...)`. */
const STORE_OP =
  /\.getState\(\)\s*\.\s*(begin|patch|clear\w*|reset\w*|set[A-Z]\w*|toggle\w*|push|pop|replace\w*|open\w*|close\w*|start\w*|stop\w*|add\w*|remove\w*|mark\w*|apply\w*|seed\w*|link\w*)\s*\(/
/** The whole store handed to a helper that writes it: `beginOrMergeHostDraft(useX.getState(), ...)`. */
const STORE_HANDOFF = /\.getState\(\)\s*[,)]/

describe("no body writes a store during render", () => {
  const files = sourceFiles()

  it("finds the bodies to scan", () => {
    // A broken glob would make every assertion below vacuously pass.
    expect(files.length).toBeGreaterThan(30)
    expect(files.some((f) => f.endsWith("CreateCleanupBody.tsx"))).toBe(true)
  })

  for (const file of files) {
    const name = path.relative(BODIES_DIR, file)
    const blocks = stateInitializerBlocks(code(readFileSync(file, "utf8")))
    if (blocks.length === 0) continue
    it(`${name} keeps its useState initializers read-only`, () => {
      for (const block of blocks) {
        expect(block, `store operation called during render in ${name}`).not.toMatch(STORE_OP)
        expect(block, `store handed to a writer during render in ${name}`).not.toMatch(STORE_HANDOFF)
      }
    })
  }
})

/**
 * The host form specifically: its mount step is PLANNED in render and COMMITTED in an effect. Both halves
 * matter - planning in the effect too would let the first paint show the pre-merge draft (a blank-looking
 * form where the launching report's context should be), which is what the split exists to avoid.
 */
describe("the host form plans in render and commits in an effect", () => {
  const source = code(readFileSync(path.join(BODIES_DIR, "CreateCleanupBody.tsx"), "utf8"))

  it("computes the mount plan inside the lazy useState initializer", () => {
    const initializers = stateInitializerBlocks(source)
    expect(initializers.some((b) => b.includes("planHostDraftMount("))).toBe(true)
    expect(initializers.some((b) => b.includes("commitHostDraftMount("))).toBe(false)
  })

  it("commits it from a mount effect, keyed on the plan so it cannot re-fire", () => {
    // `mountPlan` is useState-stable, so this is a once-per-mount effect: a retained page layer that is
    // buried and later revealed must not re-merge a seed the host has since edited away.
    expect(source).toMatch(
      /useEffect\(\(\) => \{\s*commitHostDraftMount\(useCleanupDraft\.getState\(\), mountPlan\)[\s\S]*?\}, \[mountPlan\]\)/,
    )
  })

  it("keeps one blank fallback while no draft is live, so its slot key cannot remount the slot rows every render", () => {
    expect(source).not.toMatch(/\?\?\s*emptyCleanupForm\(/)
    expect(source).toMatch(
      /const blankForm = useMemo\(\s*\(\) => emptyCleanupForm\(seedReportId, seedOrganizationId\),\s*\[seedReportId, seedOrganizationId\],?\s*\)/,
    )
    expect(source).toMatch(/draftCommitted \? liveDraft : mountPlan\.value\) \?\? blankForm/)
  })

  it("renders the plan's value until the commit lands", () => {
    expect(source).toMatch(/draftCommitted \? liveDraft : mountPlan\.value/)
    // The report-location seed child mounts only after the draft exists - passive effects flush
    // child-first, so an ungated mount would burn its one-shot ref against a null draft.
    expect(source).toMatch(/startedFresh && draftCommitted \? \(\s*<SeedLocationFromReport/)
  })
})
