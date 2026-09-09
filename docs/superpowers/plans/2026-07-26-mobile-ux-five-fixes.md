# Mobile UX: Five Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship five independent mobile UX fixes — X-style inline reply expansion, a map camera that returns to where you were, a camera embedded in the Report tab with the navbar visible throughout, a smooth exit from Search, and reports-nearby rows that show the report's photo and location.

**Architecture:** Four of the five workstreams land entirely in `@civfix/ui` (`civfix-shared/packages/ui`); Workstream 3 also touches `civfix-mobile`. Each workstream is independent — no shared state, no ordering dependency between them — so they can be implemented in any order and land in one `@civfix/ui` minor. Nearly all test coverage sits on **pure** modules (`threadModel`, `dropPinCamera`, `wizardSteps`, `keyboardInsetModel`, `reportHitRowModel`); React components are gated on `pnpm typecheck` plus simulator verification, because neither repo has a React test harness.

**Tech Stack:** TypeScript (strict + `noUncheckedIndexedAccess`), React Native + react-native-web via a shared `@civfix/ui` package that ships raw TS, Expo / expo-router, zustand, TanStack Query, Reanimated + gorhom bottom-sheet + Skia (native only), MapLibre, react-native-vision-camera, vitest, react-i18next, changesets.

## Global Constraints

Every task's requirements implicitly include this section.

**Where commands run.** `@civfix/ui` commands run from `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui`. Mobile commands run from `/Users/theobong/Documents/GitHub/civfix/civfix-mobile`. Both `pnpm typecheck` and `pnpm lint` print two pnpm banner lines on success — "no output" means the two banner lines and nothing else.

**Test harness.** There is **no React test harness in either repo.** `find src -name "*.test.tsx"` in `packages/ui` returns nothing. `@civfix/ui` runs vitest over pure `.ts` modules only; `civfix-mobile`'s `test` script is `node --experimental-strip-types --test` scoped to `tests/` and `src/{components,lib,theme}/*.test.ts`. Do not invent a component-testing setup. Component work is gated on `pnpm typecheck` and on-simulator verification.

**Never assert a full-suite total.** Assert per-file counts only (`pnpm vitest run src/<path>/__tests__/<file>.test.ts`). Workstreams land in any order into the same suite, so any absolute package total is wrong the moment another workstream lands first.

**Never manufacture a red.** A failing test must fail because the feature genuinely does not exist yet. Do not write knowingly-broken assertions and repair them later, and never temporarily corrupt production source to force a failure. Where a new test passes at RED, it is labelled `GUARD` in the test source with the reason — it is a regression guard, not a TDD driver.

**Line numbers drift within a workstream.** Ranges quoted against HEAD are orientation. Where an earlier task in the same workstream inserts lines above a later task's target, the later task states the shifted range. Anchor on quoted text, not on the number, whenever both are given.

**TypeScript.** `strict` and `noUncheckedIndexedAccess` are both on. Every indexed read is written `xs[i]?.foo === true`, never `xs[i]!.foo`.

**Lint.** `packages/ui/eslint.config.js` sets `@typescript-eslint/no-unused-vars: ["error", ...]`, so a stale import fails the gate. It also bans `expo-*` imports outside `*.native.*` files, and confines `react-native-reanimated`, `@gorhom/bottom-sheet` and `react-native-video` to `*.native.*`.

**Motion.** Every duration, easing and spring comes from `src/theme/motion.ts` via the adapters in `src/shell/motionConfigs.native.ts`. Never invent a number. Every `*Config()` factory is **JS-thread only** — calling one inside a worklet is a release-build SIGABRT with no debug guard (commit `a89c3eb`). Hoist configs into `useMemo`. Every new animation needs a reduce-motion escape hatch that jumps straight to target.

**i18n.** Keys live in `src/i18n/locales/{en,es,de,ko}/<namespace>.json`. Any new key must be added to **all four** locales with real translations, and `pnpm i18n:check` must pass.

**Do not regress these, each of which cost a shipped bug:**
- Nothing in `SearchBody`'s layout may be gated on a keyboard signal, and its content container stays content-height — no `flex-grow`, no `justify-content`. Commit `a637875` (@civfix/ui 0.33.0) did exactly that and was reverted at the user's explicit request; `SearchBody.tsx:244-268` is the standing warning.
- Never animate a layout property off `reserved` (`useKeyboardAnchor.types.ts:12-13`). `lift` is per-frame/UI-thread; `reserved` is per-transition/JS-thread.
- `PostThreadBody`'s `PLAIN_SCROLL_HOST` and `minHeight: 0` are load-bearing. Never nest a `FlatList` inside a `FlatList`.
- Never add a second mounted copy of a body for a crossfade on native — native bodies register into gorhom's one shared active-scrollable registry.
- Never swap `ScrollHost` identity to achieve a transition — it swaps the ScrollView component *type* at the same position and remounts the whole subtree.
- The host `flyTo` in `civfix-mobile/apps/community-mobile/app/index.tsx` is `(lng, lat, zoom)`. `MapHandle.flyTo` in `packages/ui/src/map/types.ts` is `(lat, lng, zoom)`. Every call site says which it is using, in a comment.
- The shared package must never touch the map camera directly (`map/dropPinCamera.ts:64-68`, "THE HOST OWNS THE CAMERA").

**Commits.** Conventional (`feat(ui):`, `fix(ui):`, `test(ui):`, `chore:`). Every commit message ends with the line:

```
Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

**Branch.** All `civfix-shared` work is on `mobile-ux-five-fixes` (already created, spec committed at `c88a746`).

**Out of scope** — do not implement, even if it looks adjacent: report draft persistence to disk; a backend subtree/thread endpoint for replies; reply sorting; any change to `PostDetailBody` (unreachable on mobile); un-Modal'ing the host-an-event location picker (it needs a shell-level full-screen layer host — see the spec's amended Workstream 3 decisions).

---


## Workstream 1 — Inline "Show replies" (X parity)

Splices a reply's direct children into the **same** `FlatList`, directly beneath it, at the same left
gutter, joined by the existing 2pt threadline. All eight tasks land in `@civfix/ui`
(`/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui`). Nothing in `civfix-mobile`
changes; `/post/[id]` and the `MobileNavAdapter` bridge stay exactly as they are.

**Working directory for every command in this workstream:**
`/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui`

**House facts verified before writing this plan** (do not re-derive them):
- The package has **no React test harness** — `find src -name "*.test.tsx"` returns nothing (verified: 0
  files). Every unit test here is a `.ts` test over a pure module. Component tasks are gated on
  `pnpm typecheck`, which is green at HEAD (`a6b267f`).
- `pnpm vitest run src/bodies/thread/__tests__/threadModel.test.ts` is green at HEAD with **28 tests**
  (verified by execution).
- `pnpm i18n:check` is green at HEAD: "i18n key check OK: 76 namespaces key-complete across es, de, ko."
- `pnpm typecheck` and `pnpm lint` both exit 0 at HEAD. **`typecheck` is not silent** — it prints pnpm's
  two banner lines (`> @civfix/ui@0.36.1 typecheck …` / `> tsc --noEmit -p tsconfig.json`) and nothing
  else. `lint` prints only its own two banner lines. "Green" below means exactly that.
- `tsconfig.json` sets `strict` **and** `noUncheckedIndexedAccess`, so every indexed read below is
  written `xs[i]?.foo === true`, never `xs[i]!.foo`. The `rows[0]?.kind === "reply" && rows[0].optimistic`
  narrowing used throughout the tests compiles under those flags (verified against `tsc` standalone).
- `eslint.config.js` sets `"@typescript-eslint/no-unused-vars": ["error", …]`, so an import left behind
  after a refactor is a **lint failure**, not a warning. Task 1.8's import list is written accordingly.
- No `eslint-plugin-react-hooks` is configured, so dependency arrays are not linted; they are still
  written correctly.
- No motion token is used anywhere in this workstream. Per the spec, expansion is a plain list append:
  no scroll compensation, no auto-scroll, no highlight, no animation.
- **Line numbers.** Every line number quoted below is the number **at HEAD**. Tasks 1.5, 1.6 and 1.8 all
  edit `PostThreadBody.tsx`, so by the time you reach 1.6 and 1.8 that file has grown by ~50 lines. Those
  two tasks therefore anchor on **quoted text**, and their HEAD numbers are orientation only. Where a step
  says "replace lines X–Y", re-read X–Y before deleting anything.

---

### Task 1.1: `buildThreadRows` — flat rows, derived rails, hairline rule

**Files:**
- Modify: `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/bodies/thread/threadModel.ts` (append a new section after line 260, the end of the file)
- Test: `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/bodies/thread/__tests__/threadModel.test.ts` (append)

**Interfaces:**
- Consumes: `threadItems<T extends { id: string }>(fetched: readonly T[], sent: readonly T[]): readonly T[]` and `ThreadRailSegment { above: boolean; below: boolean }`, both already in `threadModel.ts`.
- Produces:
  - `const THREAD_MAX_INLINE_DEPTH = 2`
  - `const THREAD_RAIL_COLUMN_W = 36`, `THREAD_RAIL_GAP = 10`, `THREAD_RAIL_W = 2`, `THREAD_RAIL_STUB_H = 12`
  - `isOptimisticPostId(id: string): boolean`
  - `interface ThreadRowPost { readonly id: string; readonly author: { readonly id: string }; readonly counts: { readonly replies: number }; readonly replyToId?: string | null }`
  - `type ThreadRowExpansion = "expand" | "collapse" | "navigate" | "none"`
  - `interface ThreadChildState<T extends ThreadRowPost> { items: readonly T[]; loading: boolean; hasMore: boolean }`
  - `type ThreadRowVariant<T extends ThreadRowPost>` and `type ThreadRow<T extends ThreadRowPost> = ThreadRowVariant<T> & { key: string; depth: 1 | 2; rail: ThreadRailSegment; hairline: boolean }`
  - `buildThreadRows<T extends ThreadRowPost>(input: { focalId: string; focalAuthorId: string | null | undefined; replies: readonly T[]; sent?: readonly T[]; expandedIds?: ReadonlySet<string>; children?: Readonly<Record<string, ThreadChildState<T> | undefined>> }): readonly ThreadRow<T>[]`

- [ ] **Step 1: Write the failing test for the flat case.** Append to
`/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/bodies/thread/__tests__/threadModel.test.ts`,
and extend the existing import block at lines 4–16 (verified: line 4 is `import {`, line 16 is
`} from "../threadModel"`) so it also pulls the three new symbols this file needs — `buildThreadRows`,
`isOptimisticPostId` and `THREAD_MAX_INLINE_DEPTH`. Nothing here needs the `ThreadRow` type: every
assertion narrows off `entry.kind`.

```ts
// --- replaces the existing import from "../threadModel" (lines 4-16) ---
import {
  androidKeyboardInset,
  buildFocalPostStats,
  buildReplyComposerHeightPlan,
  buildThreadRailPlan,
  buildThreadRows,
  isOptimisticPostId,
  replyComposerState,
  threadFocalExcerpt,
  threadItems,
  MIN_THREAD_VISIBLE,
  REPLY_INPUT_MAX_CAP,
  REPLY_INPUT_MIN,
  REPLY_SURFACE_MIN,
  THREAD_MAX_INLINE_DEPTH,
} from "../threadModel"
```

```ts
/**
 * A reply as `buildThreadRows` sees it: an id, an author, a reply count, and who it answers.
 * Deliberately NOT a full PostDTO - the model is structural, so the test stays readable.
 */
const row = (
  id: string,
  authorId: string,
  replies = 0,
  replyToId: string | null = "focal",
) => ({ id, author: { id: authorId }, counts: { replies }, replyToId })

const flat = (replies: ReturnType<typeof row>[], focalAuthorId: string | null = "a") =>
  buildThreadRows({ focalId: "focal", focalAuthorId, replies })

describe("buildThreadRows (flat list)", () => {
  it("reproduces the self-thread rail plan when nothing is expanded", () => {
    const rows = flat([row("r1", "a"), row("r2", "a"), row("r3", "a"), row("r4", "b")])
    expect(rows.map((entry) => entry.rail)).toEqual([
      { above: true, below: true },
      { above: true, below: true },
      { above: true, below: false },
      { above: false, below: false },
    ])
  })

  it("drops the hairline on every chained row and keeps it where the chain ends", () => {
    // r1 and r2 are the focal author's leading self-run, so run === 2 and only r1 has a row below it
    // that it is chained TO. r2 ENDS the run, so it keeps its hairline; r3 is a stranger and keeps its
    // own. hairline === !rail.below, so this is [false, true, true] - NOT [false, false, true].
    const rows = flat([row("r1", "a"), row("r2", "a"), row("r3", "b")])
    expect(rows.map((entry) => entry.hairline)).toEqual([false, true, true])
  })

  it("draws no rail when nobody continues the thread", () => {
    const rows = flat([row("r1", "b"), row("r2", "c")])
    expect(rows.map((entry) => entry.rail)).toEqual([
      { above: false, below: false },
      { above: false, below: false },
    ])
  })

  it("gives a self-reply that lands AFTER a stranger no rail", () => {
    const rows = flat([row("r1", "b"), row("r2", "a"), row("r3", "a")])
    expect(rows.every((entry) => entry.rail.above === false && entry.rail.below === false)).toBe(true)
  })

  it("draws nothing when the focal author is unknown", () => {
    expect(flat([row("r1", "a")], null)[0]?.rail).toEqual({ above: false, below: false })
  })

  it("emits one depth-1 reply row per reply, keyed by post id, in fetched order", () => {
    const rows = flat([row("r1", "a"), row("r2", "b")])
    expect(rows.map((entry) => [entry.kind, entry.key, entry.depth])).toEqual([
      ["reply", "r1", 1],
      ["reply", "r2", 1],
    ])
  })

  it("offers `expand` only to a reply that has replies", () => {
    const rows = flat([row("r1", "a", 3), row("r2", "b", 0)])
    expect(rows.map((entry) => (entry.kind === "reply" ? entry.expansion : null)))
      .toEqual(["expand", "none"])
  })

  it("never offers an expand affordance on a row the server has not confirmed", () => {
    const rows = flat([row("optimistic-1712", "a", 4)])
    expect(rows[0]?.kind === "reply" && rows[0].optimistic).toBe(true)
    expect(rows[0]?.kind === "reply" && rows[0].expansion).toBe("none")
  })

  it("caps inline expansion two levels below the focal post", () => {
    expect(THREAD_MAX_INLINE_DEPTH).toBe(2)
  })
})

describe("isOptimisticPostId", () => {
  it("matches only the composer's temp-id prefix", () => {
    expect(isOptimisticPostId("optimistic-1712345678901")).toBe(true)
    expect(isOptimisticPostId("0f9a-real-uuid")).toBe(false)
    expect(isOptimisticPostId("")).toBe(false)
  })
})
```

That is **nine** `it` blocks in `buildThreadRows (flat list)` plus **one** in `isOptimisticPostId` — ten
new cases. Count them yourself before trusting the totals below.

- [ ] **Step 2: Run it and confirm RED.**
`cd /Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui && pnpm vitest run src/bodies/thread/__tests__/threadModel.test.ts`
Expected: the file fails to **collect** — `threadModel.ts` has no such exports yet — with
`SyntaxError: [vite] The requested module '/src/bodies/thread/threadModel.ts' does not provide an export named 'buildThreadRows'`.
Zero tests run (the 28 pre-existing ones do not execute either). Do not continue until you have seen this.

- [ ] **Step 3: Write the minimal implementation.** Append to
`/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/bodies/thread/threadModel.ts`
(after line 260, the end of `androidKeyboardInset`). Also add two new bullets to the file's header
contents list at lines 10–15 (`- the flattened thread row list (buildThreadRows)` and
`- the inline-expansion depth cap + rail gutter constants`).

```ts
/* ------------------------------------------------------------------------------------------------ *
 * Inline reply expansion (X parity)
 * ------------------------------------------------------------------------------------------------ */

/**
 * How deep inline expansion goes, counting the focal post as depth 0.
 *
 * Depth 1 is a direct reply; expanding one splices its children in at depth 2. A depth-2 row's
 * "Show replies" NAVIGATES to that reply's permalink instead of expanding - which is exactly how X
 * reaches depth, and what bounds the per-row `usePostReplies` fan-out.
 */
export const THREAD_MAX_INLINE_DEPTH = 2

/**
 * The reply row's avatar gutter, shared by `ThreadReplyRow` and `ThreadChainRow` so there is exactly ONE
 * rail system. The row's own vertical padding stays a theme token at the component level; only the
 * horizontal gutter and the rule itself are decided here. The values are the literals `ThreadReplyRow`
 * already hard-codes today (36 / 10 / 2 / 12), promoted so a second component cannot drift from them.
 */
export const THREAD_RAIL_COLUMN_W = 36
export const THREAD_RAIL_GAP = 10
export const THREAD_RAIL_W = 2
/** The stub the rail draws from the row's top edge down to the avatar. */
export const THREAD_RAIL_STUB_H = 12

/** The temp-id prefix `ReplyComposer.send` stamps on a client-built post. */
const OPTIMISTIC_PREFIX = "optimistic-"

/** Whether a row is a locally-created reply the server has not confirmed yet. */
export function isOptimisticPostId(id: string): boolean {
  return id.startsWith(OPTIMISTIC_PREFIX)
}

/** The minimum shape `buildThreadRows` needs off a reply (PostDTO satisfies it structurally). */
export interface ThreadRowPost {
  readonly id: string
  readonly author: { readonly id: string }
  readonly counts: { readonly replies: number }
  readonly replyToId?: string | null
}

/** What a row's "Show N replies" control does when tapped. */
export type ThreadRowExpansion = "expand" | "collapse" | "navigate" | "none"

/** The children currently loaded for ONE expanded reply (one `usePostReplies` per expanded row). */
export interface ThreadChildState<T extends ThreadRowPost> {
  items: readonly T[]
  loading: boolean
  hasMore: boolean
}

/** The kind-specific half of a row. Split out so the assembler can spread it under one contextual type. */
export type ThreadRowVariant<T extends ThreadRowPost> =
  | { kind: "reply"; post: T; expansion: ThreadRowExpansion; optimistic: boolean }
  | { kind: "nested"; parentId: string; post: T; expansion: ThreadRowExpansion; optimistic: boolean }
  | { kind: "show-more"; parentId: string; remaining: number }
  | { kind: "loading"; parentId: string }

/** One row of the flattened thread list. `key` is unique across the whole list; `depth` drives nothing
 *  visual (X indents nothing) - it decides expand-vs-navigate. */
export type ThreadRow<T extends ThreadRowPost> = ThreadRowVariant<T> & {
  key: string
  depth: 1 | 2
  rail: ThreadRailSegment
  hairline: boolean
}

const EMPTY_EXPANDED: ReadonlySet<string> = new Set<string>()

function rowExpansion(
  depth: 1 | 2,
  replyCount: number,
  expanded: boolean,
  optimistic: boolean,
): ThreadRowExpansion {
  if (expanded) return "collapse"
  if (optimistic || replyCount <= 0) return "none"
  return depth >= THREAD_MAX_INLINE_DEPTH ? "navigate" : "expand"
}

/**
 * The thread's flat row list - the ONE list `PostThreadBody` renders.
 *
 * REPLACES the index-positional `buildThreadRailPlan` at this call site. That plan was `rails[index]`
 * over a flat ASC list, and its correctness relied on that ordering being stable; splicing a reply's
 * children in silently misaligns every rail below the insertion. Here the rail travels WITH the row, and
 * `above` is DERIVED - `above[k] === below[k-1]` - so a rail segment can never be orphaned: if a nested
 * block is spliced between two members of a self-thread run, the run's rail simply breaks, which is the
 * truth (the row above is no longer the row it continues from). `buildThreadRailPlan` itself stays
 * exported and unit-tested; nothing in the thread calls it after this.
 *
 * The hairline is the same fact stated twice: `hairline === !rail.below`. A chained row draws no bottom
 * rule because the threadline IS the separator - that absence is what reads as "these belong together",
 * and hairlines are what separate modules.
 */
export function buildThreadRows<T extends ThreadRowPost>(input: {
  focalId: string
  focalAuthorId: string | null | undefined
  replies: readonly T[]
  sent?: readonly T[]
  expandedIds?: ReadonlySet<string>
  children?: Readonly<Record<string, ThreadChildState<T> | undefined>>
}): readonly ThreadRow<T>[] {
  const expandedIds = input.expandedIds ?? EMPTY_EXPANDED

  const top = input.replies

  let run = 0
  if (input.focalAuthorId != null && input.focalAuthorId !== "") {
    while (run < top.length && top[run]?.author.id === input.focalAuthorId) run += 1
  }

  // Pass 1 records only `below` (a forward-looking fact each row knows about itself).
  const drafts: { key: string; depth: 1 | 2; variant: ThreadRowVariant<T>; below: boolean }[] = []

  top.forEach((post, index) => {
    const optimistic = isOptimisticPostId(post.id)
    const expanded = !optimistic && expandedIds.has(post.id)
    drafts.push({
      key: post.id,
      depth: 1,
      variant: {
        kind: "reply",
        post,
        expansion: rowExpansion(1, post.counts.replies, expanded, optimistic),
        optimistic,
      },
      below: index < run - 1,
    })
  })

  // Pass 2 derives `above` from the row physically above, which is what keeps rails aligned under any
  // insertion. Row 0's `above` is the stub up to the focal post, drawn only for a real self-thread run.
  return drafts.map((draft, index): ThreadRow<T> => ({
    ...draft.variant,
    key: draft.key,
    depth: draft.depth,
    rail: {
      above: index === 0 ? run > 0 : drafts[index - 1]?.below === true,
      below: draft.below,
    },
    hairline: !draft.below,
  }))
}
```

- [ ] **Step 4: Run it and confirm GREEN.**
`cd /Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui && pnpm vitest run src/bodies/thread/__tests__/threadModel.test.ts`
Expected: `Test Files 1 passed (1)`, `Tests 38 passed (38)` — the 28 pre-existing plus the 9 new
`buildThreadRows (flat list)` cases plus the 1 `isOptimisticPostId` case.

- [ ] **Step 5: Commit.**
```bash
cd /Users/theobong/Documents/GitHub/civfix/civfix-shared && git add packages/ui/src/bodies/thread/threadModel.ts packages/ui/src/bodies/thread/__tests__/threadModel.test.ts && git commit -m "feat(ui): buildThreadRows - flat thread rows with derived, insertion-safe rails" -m "The thread's rail plan was index-positional over a flat ASC list, so splicing a reply's children in would misalign every rail below the insertion. buildThreadRows carries the rail with the row and derives above[k] from below[k-1], which makes an orphaned rail unrepresentable. The hairline becomes !below: a chained row draws no rule because the threadline is the separator." -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 1.2: Splice an expanded reply's children in place

**Files:**
- Modify: `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/bodies/thread/threadModel.ts` (replace the whole `buildThreadRows` body added in Task 1.1)
- Test: `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/bodies/thread/__tests__/threadModel.test.ts` (append a second describe block)

**Interfaces:**
- Consumes: `buildThreadRows`, `ThreadChildState<T>`, `ThreadRow<T>`, `rowExpansion`, `isOptimisticPostId`, `threadItems` — all from Task 1.1 / the pre-existing model.
- Produces: no new exported symbols. `buildThreadRows` now honours `expandedIds` + `children` and emits `kind: "nested"` rows keyed `` `${parentId}:${childId}` ``.

- [ ] **Step 1: Write the failing test.** Append to
`/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/bodies/thread/__tests__/threadModel.test.ts`.
Seven `it` blocks. **Three of them drive this task (they fail now); four are regression guards that
already hold against Task 1.1's implementation** — each is marked `GUARD` in a comment so Step 2's red
reads honestly. A guard is here because the splice must not break a fact Task 1.1 established, not
because it is a TDD driver.

```ts
describe("buildThreadRows (inline expansion)", () => {
  const expanded = (
    replies: ReturnType<typeof row>[],
    expandedIds: string[],
    children: Record<string, { items: ReturnType<typeof row>[]; loading: boolean; hasMore: boolean }>,
  ) =>
    buildThreadRows({
      focalId: "focal",
      focalAuthorId: "a",
      replies,
      expandedIds: new Set(expandedIds),
      children,
    })

  it("splices the children directly beneath their parent and nowhere else", () => {
    const rows = expanded(
      [row("r1", "b", 2), row("r2", "c")],
      ["r1"],
      { r1: { items: [row("c1", "d", 0, "r1"), row("c2", "e", 0, "r1")], loading: false, hasMore: false } },
    )
    expect(rows.map((entry) => [entry.kind, entry.key])).toEqual([
      ["reply", "r1"],
      ["nested", "r1:c1"],
      ["nested", "r1:c2"],
      ["reply", "r2"],
    ])
    expect(rows.map((entry) => entry.depth)).toEqual([1, 2, 2, 1])
  })

  it("threads the rail from the parent through every child and stops at the last one", () => {
    const rows = expanded(
      [row("r1", "b", 2)],
      ["r1"],
      { r1: { items: [row("c1", "d", 0, "r1"), row("c2", "e", 0, "r1")], loading: false, hasMore: false } },
    )
    expect(rows.map((entry) => entry.rail)).toEqual([
      { above: false, below: true },
      { above: true, below: true },
      { above: true, below: false },
    ])
    expect(rows.map((entry) => entry.hairline)).toEqual([false, false, true])
  })

  it("KEEPS THE RAILS ALIGNED under an insertion: the self-run breaks rather than lying", () => {
    // a1 and a2 are both the focal author, so without an expansion they would be one railed run.
    // Expanding a1 puts a stranger's child between them - a1 -> a2 is no longer a visual continuation.
    const rows = expanded(
      [row("a1", "a", 1), row("a2", "a"), row("b1", "b")],
      ["a1"],
      { a1: { items: [row("c1", "z", 0, "a1")], loading: false, hasMore: false } },
    )
    expect(rows.map((entry) => entry.key)).toEqual(["a1", "a1:c1", "a2", "b1"])
    expect(rows.map((entry) => entry.rail)).toEqual([
      { above: true, below: true },   // stub up to the focal post, then down into its child
      { above: true, below: false },  // the child ends the chain
      { above: false, below: false }, // a2 does NOT claim to continue from a stranger's child
      { above: false, below: false },
    ])
  })

  // GUARD (green before this task): an expanded-but-childless parent must keep falling back to the
  // self-run rail. Task 1.1 gets this right by accident (it ignores `children`); the splice must keep it.
  it("falls back to the self-run rail when an expanded reply turns out to have no children", () => {
    const rows = expanded(
      [row("a1", "a", 1), row("a2", "a")],
      ["a1"],
      { a1: { items: [], loading: false, hasMore: false } },
    )
    expect(rows.map((entry) => entry.rail)).toEqual([
      { above: true, below: true },
      { above: true, below: false },
    ])
  })

  // GUARD (green before this task): the derived-rail invariant is true by construction in Task 1.1 and
  // must STAY true once rows are spliced. This is the property that makes an orphaned rail impossible.
  it("holds `above[k] === below[k-1]` across every expansion permutation", () => {
    const replies = [row("a1", "a", 2), row("a2", "a", 1), row("b1", "b", 3)]
    const childMap = {
      a1: { items: [row("x1", "z", 0, "a1"), row("x2", "z", 0, "a1")], loading: false, hasMore: false },
      a2: { items: [row("y1", "z", 0, "a2")], loading: false, hasMore: false },
      b1: { items: [], loading: true, hasMore: false },
    }
    for (const ids of [[], ["a1"], ["a2"], ["b1"], ["a1", "a2"], ["a1", "b1"], ["a1", "a2", "b1"]]) {
      const rows = expanded(replies, ids, childMap)
      for (let index = 1; index < rows.length; index += 1) {
        expect(rows[index]?.rail.above, `${ids.join("+")} @${index}`)
          .toBe(rows[index - 1]?.rail.below)
      }
      expect(new Set(rows.map((entry) => entry.key)).size).toBe(rows.length)
    }
  })

  // GUARD (green before this task): an id in `expandedIds` that matches no visible row is a no-op.
  it("ignores an expansion aimed at a row nobody is showing", () => {
    const rows = expanded([row("r1", "b", 2)], ["ghost"], {})
    expect(rows.map((entry) => entry.key)).toEqual(["r1"])
    expect(rows[0]?.kind === "reply" && rows[0].expansion).toBe("expand")
  })

  // GUARD (green before this task): `rowExpansion` already flips to "collapse" on an expanded row.
  it("flips the parent's control to `collapse` while it is open", () => {
    const rows = expanded(
      [row("r1", "b", 1)],
      ["r1"],
      { r1: { items: [row("c1", "d", 0, "r1")], loading: false, hasMore: false } },
    )
    expect(rows[0]?.kind === "reply" && rows[0].expansion).toBe("collapse")
  })
})
```

- [ ] **Step 2: Run it and confirm RED.**
`cd /Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui && pnpm vitest run src/bodies/thread/__tests__/threadModel.test.ts`
Expected: **45 tests total — 42 pass, 3 fail.** The three failures are exactly the three non-GUARD cases:
`splices the children directly beneath their parent and nowhere else`,
`threads the rail from the parent through every child and stops at the last one`, and
`KEEPS THE RAILS ALIGNED under an insertion`. The first reads:
`AssertionError: expected [ [ 'reply', 'r1' ], [ 'reply', 'r2' ] ] to deeply equal [ [ 'reply', 'r1' ], [ 'nested', 'r1:c1' ], … ]`
— Task 1.1's implementation ignores `children` entirely. The four GUARD cases pass here **by design**;
that is not a sign you have already implemented this task.

- [ ] **Step 3: Implement the splice.** In
`/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/bodies/thread/threadModel.ts`,
replace the whole `buildThreadRows` function from Task 1.1 with this (the doc comment above it is
unchanged; everything from `export function buildThreadRows` to its closing brace is replaced):

```ts
export function buildThreadRows<T extends ThreadRowPost>(input: {
  focalId: string
  focalAuthorId: string | null | undefined
  replies: readonly T[]
  sent?: readonly T[]
  expandedIds?: ReadonlySet<string>
  children?: Readonly<Record<string, ThreadChildState<T> | undefined>>
}): readonly ThreadRow<T>[] {
  const expandedIds = input.expandedIds ?? EMPTY_EXPANDED
  const children = input.children ?? {}

  const top = input.replies

  let run = 0
  if (input.focalAuthorId != null && input.focalAuthorId !== "") {
    while (run < top.length && top[run]?.author.id === input.focalAuthorId) run += 1
  }

  // Pass 1 records only `below` (a forward-looking fact each row knows about itself).
  const drafts: { key: string; depth: 1 | 2; variant: ThreadRowVariant<T>; below: boolean }[] = []

  top.forEach((post, index) => {
    const optimistic = isOptimisticPostId(post.id)
    const expanded = !optimistic && expandedIds.has(post.id)
    const state = expanded ? children[post.id] : undefined
    const kids = state?.items ?? []

    drafts.push({
      key: post.id,
      depth: 1,
      variant: {
        kind: "reply",
        post,
        expansion: rowExpansion(1, post.counts.replies, expanded, optimistic),
        optimistic,
      },
      // An expanded parent links DOWN into its block. With no block to link to it falls back to the
      // self-thread run, which is what keeps an expand-then-empty row from drawing a rail into a hairline.
      below: kids.length > 0 ? true : index < run - 1,
    })

    kids.forEach((child, at) => {
      const childOptimistic = isOptimisticPostId(child.id)
      drafts.push({
        // Namespaced by parent: the key must be unique across the WHOLE flattened list, and a FlatList
        // silently drops rows on a duplicate.
        key: `${post.id}:${child.id}`,
        depth: 2,
        variant: {
          kind: "nested",
          parentId: post.id,
          post: child,
          expansion: rowExpansion(2, child.counts.replies, false, childOptimistic),
          optimistic: childOptimistic,
        },
        below: at < kids.length - 1,
      })
    })
  })

  // Pass 2 derives `above` from the row physically above, which is what keeps rails aligned under any
  // insertion. Row 0's `above` is the stub up to the focal post, drawn only for a real self-thread run.
  return drafts.map((draft, index): ThreadRow<T> => ({
    ...draft.variant,
    key: draft.key,
    depth: draft.depth,
    rail: {
      above: index === 0 ? run > 0 : drafts[index - 1]?.below === true,
      below: draft.below,
    },
    hairline: !draft.below,
  }))
}
```

Note: this loop reads `children` only for TOP-LEVEL rows and never recurses, so the depth cap is already
structural here. Task 1.3's `never splices a THIRD level` case is a guard on that, not a new behaviour.

- [ ] **Step 4: Run it and confirm GREEN.**
`cd /Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui && pnpm vitest run src/bodies/thread/__tests__/threadModel.test.ts`
Expected: `Tests 45 passed (45)`.

- [ ] **Step 5: Commit.**
```bash
cd /Users/theobong/Documents/GitHub/civfix/civfix-shared && git add packages/ui/src/bodies/thread/threadModel.ts packages/ui/src/bodies/thread/__tests__/threadModel.test.ts && git commit -m "feat(ui): splice an expanded reply's children into the same thread list" -m "Children land directly beneath their parent at the SAME left gutter (X killed indented threading in Dec 2020), joined by the threadline. Rails stay aligned by construction: a spliced block breaks the self-thread run above it instead of drawing a line out of a stranger's reply." -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 1.3: Depth cap, the `show-more` cursor, the `loading` row, optimistic placement

**Files:**
- Modify: `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/bodies/thread/threadModel.ts` (replace `buildThreadRows` again)
- Modify: `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/bodies/index.ts` (**value export block lines 66–84, type export block lines 85–91** — verified against the real file; see the warning in Step 3)
- Test: `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/bodies/thread/__tests__/threadModel.test.ts` (append a third describe block)

**Interfaces:**
- Consumes: everything from Tasks 1.1 and 1.2.
- Produces: `buildThreadRows` now emits `{ kind: "show-more"; parentId: string; remaining: number }` and
  `{ kind: "loading"; parentId: string }` rows, and places `sent` replies under their real target. All of
  `THREAD_MAX_INLINE_DEPTH`, `THREAD_RAIL_COLUMN_W`, `THREAD_RAIL_GAP`, `THREAD_RAIL_W`,
  `THREAD_RAIL_STUB_H`, `buildThreadRows`, `isOptimisticPostId`, `ThreadChildState`, `ThreadRow`,
  `ThreadRowExpansion`, `ThreadRowPost`, `ThreadRowVariant` become public from `@civfix/ui/bodies`.

- [ ] **Step 1: Write the failing test.** Append to
`/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/bodies/thread/__tests__/threadModel.test.ts`.
Ten `it` blocks. **Seven drive this task; three are regression guards** (marked `GUARD`) that already
hold against Task 1.2's implementation:

```ts
describe("buildThreadRows (depth cap, cursors, optimistic rows)", () => {
  // GUARD (green before this task): `rowExpansion` was written with the cap in Task 1.1.
  it("gives a depth-2 row a NAVIGATE affordance, never an expand one", () => {
    const rows = buildThreadRows({
      focalId: "focal",
      focalAuthorId: "a",
      replies: [row("r1", "b", 1)],
      expandedIds: new Set(["r1"]),
      children: { r1: { items: [row("c1", "d", 5, "r1")], loading: false, hasMore: false } },
    })
    expect(rows[1]?.kind).toBe("nested")
    expect(rows[1]?.kind === "nested" && rows[1].expansion).toBe("navigate")
  })

  // GUARD (green before this task): Task 1.2's loop never recurses, so the cap is already structural.
  // This pins it so a later "just make it recursive" edit fails loudly instead of fanning out queries.
  it("never splices a THIRD level, however the caller marks it expanded", () => {
    const rows = buildThreadRows({
      focalId: "focal",
      focalAuthorId: "a",
      replies: [row("r1", "b", 1)],
      expandedIds: new Set(["r1", "c1"]),
      children: {
        r1: { items: [row("c1", "d", 2, "r1")], loading: false, hasMore: false },
        c1: { items: [row("g1", "e", 0, "c1"), row("g2", "e", 0, "c1")], loading: false, hasMore: false },
      },
    })
    expect(rows.map((entry) => entry.key)).toEqual(["r1", "r1:c1"])
  })

  it("emits ONE loading row while an expanded reply's first page is in flight", () => {
    const rows = buildThreadRows({
      focalId: "focal",
      focalAuthorId: "a",
      replies: [row("r1", "b", 3), row("r2", "c")],
      expandedIds: new Set(["r1"]),
      children: { r1: { items: [], loading: true, hasMore: false } },
    })
    expect(rows.map((entry) => [entry.kind, entry.key])).toEqual([
      ["reply", "r1"],
      ["loading", "loading:r1"],
      ["reply", "r2"],
    ])
    expect(rows[0]?.rail).toEqual({ above: false, below: true })
    expect(rows[1]?.rail).toEqual({ above: true, below: false })
  })

  it("closes the chain with a show-more cursor carrying what is still unread", () => {
    const rows = buildThreadRows({
      focalId: "focal",
      focalAuthorId: "a",
      replies: [row("r1", "b", 9)],
      expandedIds: new Set(["r1"]),
      children: {
        r1: { items: [row("c1", "d", 0, "r1"), row("c2", "d", 0, "r1")], loading: false, hasMore: true },
      },
    })
    expect(rows.map((entry) => entry.kind)).toEqual(["reply", "nested", "nested", "show-more"])
    expect(rows[3]?.kind === "show-more" && rows[3].remaining).toBe(7)
    expect(rows[3]?.kind === "show-more" && rows[3].parentId).toBe("r1")
    expect(rows[2]?.rail.below).toBe(true)
    expect(rows[3]?.rail).toEqual({ above: true, below: false })
    expect(rows[3]?.hairline).toBe(true)
  })

  it("never advertises fewer than one remaining reply when the count is stale", () => {
    const rows = buildThreadRows({
      focalId: "focal",
      focalAuthorId: "a",
      replies: [row("r1", "b", 1)],
      expandedIds: new Set(["r1"]),
      children: {
        r1: { items: [row("c1", "d", 0, "r1"), row("c2", "d", 0, "r1")], loading: false, hasMore: true },
      },
    })
    expect(rows[3]?.kind === "show-more" && rows[3].remaining).toBe(1)
  })

  it("appends a reply sent to the FOCAL post at the tail of the top-level list", () => {
    const rows = buildThreadRows({
      focalId: "focal",
      focalAuthorId: "a",
      replies: [row("r1", "b")],
      sent: [row("optimistic-1", "me", 0, "focal")],
    })
    expect(rows.map((entry) => entry.key)).toEqual(["r1", "optimistic-1"])
  })

  it("puts a reply sent to an EXPANDED CHILD under that child, not at the tail", () => {
    const rows = buildThreadRows({
      focalId: "focal",
      focalAuthorId: "a",
      replies: [row("r1", "b", 1), row("r2", "c")],
      sent: [row("optimistic-1", "me", 0, "r1")],
      expandedIds: new Set(["r1"]),
      children: { r1: { items: [row("c1", "d", 0, "r1")], loading: false, hasMore: false } },
    })
    expect(rows.map((entry) => entry.key)).toEqual(["r1", "r1:c1", "r1:optimistic-1", "r2"])
  })

  it("drops a sent reply the moment the fetched list carries its id, at either level", () => {
    // s1 (focal-level) and s2 (child-level) are BOTH already in the fetched lists and must appear once
    // each; s3 is still local-only and must survive. Without s3 this case would pass vacuously against
    // Task 1.2, which ignores `sent` outright - so the vacuous half is deliberately not the whole test.
    const rows = buildThreadRows({
      focalId: "focal",
      focalAuthorId: "a",
      replies: [row("r1", "b", 1), row("s1", "me", 0, "focal")],
      sent: [row("s1", "me", 0, "focal"), row("s2", "me", 0, "r1"), row("s3", "me", 0, "focal")],
      expandedIds: new Set(["r1"]),
      children: { r1: { items: [row("s2", "me", 0, "r1")], loading: false, hasMore: false } },
    })
    expect(rows.map((entry) => entry.key)).toEqual(["r1", "r1:s2", "s1", "s3"])
    expect(new Set(rows.map((entry) => entry.key)).size).toBe(rows.length)
  })

  // GUARD (green before this task): a sent reply whose parent is collapsed must not surface at the top
  // level. Task 1.2 gets this right by ignoring `sent` entirely; the routing must not regress it.
  it("keeps a sent reply aimed at a COLLAPSED parent out of the top-level list", () => {
    const rows = buildThreadRows({
      focalId: "focal",
      focalAuthorId: "a",
      replies: [row("r1", "b", 1)],
      sent: [row("optimistic-1", "me", 0, "r1")],
    })
    expect(rows.map((entry) => entry.key)).toEqual(["r1"])
  })

  it("treats a sent reply with no replyToId as a reply to the focal post", () => {
    const rows = buildThreadRows({
      focalId: "focal",
      focalAuthorId: "a",
      replies: [],
      sent: [row("optimistic-1", "me", 0, null)],
    })
    expect(rows.map((entry) => entry.key)).toEqual(["optimistic-1"])
  })
})
```

- [ ] **Step 2: Run it and confirm RED.**
`cd /Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui && pnpm vitest run src/bodies/thread/__tests__/threadModel.test.ts`
Expected: **55 tests total — 48 pass, 7 fail.** The first failure is
`emits ONE loading row while an expanded reply's first page is in flight`, reporting
`AssertionError: expected [ [ 'reply', 'r1' ], [ 'reply', 'r2' ] ] to deeply equal [ [ 'reply', 'r1' ], [ 'loading', 'loading:r1' ], [ 'reply', 'r2' ] ]`
— Task 1.2's implementation reads neither `loading`/`hasMore` nor `sent`. The other six failures are the
show-more cursor, the stale-count floor, and the three sent-reply placement cases plus the dedupe case.
The three GUARD cases pass here by design.

- [ ] **Step 3: Implement the cap, the cursors and the sent-reply routing.** In
`/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/bodies/thread/threadModel.ts`,
replace the whole `buildThreadRows` function again with the final version:

```ts
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

  // A locally-sent reply belongs UNDER ITS TARGET, not at the bottom of one flat list: the composer can
  // now be re-aimed at an expanded child. `threadItems` dedupes by id with FETCHED winning, so each copy
  // disappears the instant the authoritative list at its own level contains it.
  const top = threadItems(
    input.replies,
    sent.filter((post) => (post.replyToId ?? input.focalId) === input.focalId),
  )

  let run = 0
  if (input.focalAuthorId != null && input.focalAuthorId !== "") {
    while (run < top.length && top[run]?.author.id === input.focalAuthorId) run += 1
  }

  // Pass 1 records only `below` (a forward-looking fact each row knows about itself).
  const drafts: { key: string; depth: 1 | 2; variant: ThreadRowVariant<T>; below: boolean }[] = []

  top.forEach((post, index) => {
    const optimistic = isOptimisticPostId(post.id)
    // ONLY depth-1 rows expand. `expandedIds` is never consulted for a nested row, which is what makes
    // THREAD_MAX_INLINE_DEPTH a structural cap rather than a convention the caller has to honour.
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
      // An expanded parent links DOWN into its block. With no block to link to it falls back to the
      // self-thread run, which is what keeps an expand-then-empty row from drawing a rail into a hairline.
      below: blockRows > 0 ? true : index < run - 1,
    })

    kids.forEach((child, at) => {
      const childOptimistic = isOptimisticPostId(child.id)
      drafts.push({
        // Namespaced by parent: the key must be unique across the WHOLE flattened list, and a FlatList
        // silently drops rows on a duplicate.
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

    // The chain's terminal cursor. It does NOT page inline - it navigates to the parent's permalink,
    // which is how X reaches depth and what keeps the per-row query fan-out at one page each.
    if (remaining > 0) {
      drafts.push({
        key: `show-more:${post.id}`,
        depth: 2,
        variant: { kind: "show-more", parentId: post.id, remaining },
        below: false,
      })
    }
  })

  // Pass 2 derives `above` from the row physically above, which is what keeps rails aligned under any
  // insertion. Row 0's `above` is the stub up to the focal post, drawn only for a real self-thread run.
  return drafts.map((draft, index): ThreadRow<T> => ({
    ...draft.variant,
    key: draft.key,
    depth: draft.depth,
    rail: {
      above: index === 0 ? run > 0 : drafts[index - 1]?.below === true,
      below: draft.below,
    },
    hairline: !draft.below,
  }))
}
```

Then extend the barrel at
`/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/bodies/index.ts`.

> **READ THE RANGE BEFORE DELETING.** In the real file the `threadModel` **value** export block is lines
> **66–84** (`export {` on 66, `} from "./thread/threadModel"` on 84) and the **type** export block is
> lines **85–91** (`export type {` on 85, `} from "./thread/threadModel"` on 91). Line 92 is blank.
> **Line 65 is `export type { ReplyDraft, ReplyDraftState } from "./thread/replyDraftStore"` — a
> different, live public export. Do NOT touch it.** Nothing outside `replyDraftStore.ts` imports those
> two types today, so deleting them would pass both `pnpm typecheck` and `pnpm lint` silently.

Replace lines **66–91** with:

```ts
export {
  MIN_THREAD_VISIBLE,
  REPLY_CHROME_FALLBACK,
  REPLY_INPUT_MAX_CAP,
  REPLY_INPUT_MIN,
  REPLY_SURFACE_FRACTION,
  REPLY_SURFACE_MIN,
  REPLY_THUMBS_H,
  REPLY_TRAY_MAX_CAP,
  REPLY_TRAY_MIN,
  THREAD_HEADER_H,
  THREAD_MAX_INLINE_DEPTH,
  THREAD_RAIL_COLUMN_W,
  THREAD_RAIL_GAP,
  THREAD_RAIL_STUB_H,
  THREAD_RAIL_W,
  androidKeyboardInset,
  buildFocalPostStats,
  buildReplyComposerHeightPlan,
  buildThreadRailPlan,
  buildThreadRows,
  isOptimisticPostId,
  replyComposerState,
  threadFocalExcerpt,
  threadItems,
} from "./thread/threadModel"
export type {
  FocalPostStat,
  FocalPostStatKey,
  ReplyComposerHeightPlan,
  ReplyComposerState,
  ThreadChildState,
  ThreadRailSegment,
  ThreadRow,
  ThreadRowExpansion,
  ThreadRowPost,
  ThreadRowVariant,
} from "./thread/threadModel"
```

(The 17 pre-existing value names and the 5 pre-existing type names are all still present; the additions
are the 7 new values and 5 new types. `ThreadRailReply` was never barrelled and still is not.)

- [ ] **Step 4: Run it and confirm GREEN.**
```bash
cd /Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui && pnpm vitest run src/bodies/thread/__tests__/threadModel.test.ts && pnpm typecheck
```
Expected: `Tests 55 passed (55)`, then `pnpm typecheck` exits 0 printing only its two pnpm banner lines.

- [ ] **Step 5: Commit.**
```bash
cd /Users/theobong/Documents/GitHub/civfix/civfix-shared && git add packages/ui/src/bodies/thread/threadModel.ts packages/ui/src/bodies/thread/__tests__/threadModel.test.ts packages/ui/src/bodies/index.ts && git commit -m "feat(ui): thread row union - depth cap, show-more cursor, loading row, optimistic placement" -m "Inline expansion stops two levels below the focal post; a depth-2 row's control navigates to its permalink instead. An expanded chain ends in a show-more cursor that also navigates, so each expanded row costs exactly one page. A reply composed against an expanded child is spliced under that child rather than appended to the bottom of the flat list." -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 1.4: The "Hide replies" key in all four locales

**Files:**
- Modify: `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/i18n/locales/en/home-feed.json` (after line 65)
- Modify: `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/i18n/locales/es/home-feed.json` (after line 65)
- Modify: `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/i18n/locales/de/home-feed.json` (after line 65)
- Modify: `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/i18n/locales/ko/home-feed.json` (after line 64 — ko has no `_one` form)

**Interfaces:**
- Consumes: nothing.
- Produces: the `home-feed` key `thread.hide_replies` (no interpolation, no plural — the collapse label
  is count-free on X and stays count-free here).
  `src/i18n/resources.ts` does NOT need regenerating: it statically imports each `<lng>/<ns>.json`, and
  `gen-i18n-resources.mjs` only has to re-run when a NEW NAMESPACE file appears.

- [ ] **Step 1: Write the failing check — add the key to `en` only.** In
`/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/i18n/locales/en/home-feed.json`,
lines 63–65 currently read (verified):

```json
    "no_replies_hint": "Be the first to reply.",
    "show_replies_one": "Show {{count}} reply",
    "show_replies_other": "Show {{count}} replies",
```

Insert one line after line 65, inside the same `"thread"` object:

```json
    "no_replies_hint": "Be the first to reply.",
    "show_replies_one": "Show {{count}} reply",
    "show_replies_other": "Show {{count}} replies",
    "hide_replies": "Hide replies",
```

- [ ] **Step 2: Run the check and confirm RED.**
`cd /Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui && pnpm i18n:check`
Expected: exit code 1, printing (this is the exact format `scripts/check-i18n-keys.mjs:86,93` emits)

```
MISSING KEYS in es/home-feed.json:
  thread.hide_replies
MISSING KEYS in de/home-feed.json:
  thread.hide_replies
MISSING KEYS in ko/home-feed.json:
  thread.hide_replies

i18n key check FAILED: 3 catalog(s) out of sync with en.
```

- [ ] **Step 3: Add the three real translations.** Insert `"hide_replies"` immediately after the
`show_replies_*` entries inside the `"thread"` object of each catalog.

`/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/i18n/locales/es/home-feed.json`
(lines 64–65 today):
```json
    "show_replies_one": "Ver {{count}} respuesta",
    "show_replies_other": "Ver {{count}} respuestas",
    "hide_replies": "Ocultar respuestas",
```

`/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/i18n/locales/de/home-feed.json`
(lines 64–65 today):
```json
    "show_replies_one": "{{count}} Antwort anzeigen",
    "show_replies_other": "{{count}} Antworten anzeigen",
    "hide_replies": "Antworten ausblenden",
```

`/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/i18n/locales/ko/home-feed.json`
(line 64 today — ko has no `_one` form, CLDR, and `check-i18n-keys.mjs` exempts it):
```json
    "show_replies_other": "답글 {{count}}개 보기",
    "hide_replies": "답글 숨기기",
```

- [ ] **Step 4: Run the check and confirm GREEN.**
`cd /Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui && pnpm i18n:check`
Expected: exit 0, `i18n key check OK: 76 namespaces key-complete across es, de, ko.`

- [ ] **Step 5: Commit.**
```bash
cd /Users/theobong/Documents/GitHub/civfix/civfix-shared && git add packages/ui/src/i18n/locales/en/home-feed.json packages/ui/src/i18n/locales/es/home-feed.json packages/ui/src/i18n/locales/de/home-feed.json packages/ui/src/i18n/locales/ko/home-feed.json && git commit -m "feat(ui): add thread.hide_replies to en/es/de/ko" -m "Inline expansion is reversible, so the reply row's link needs a collapse label. show_replies_one/_other already existed in all four catalogs; the collapse label is count-free, matching X." -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 1.5: `ThreadReplyRow` — toggle instead of push, re-aim on the comment glyph, continuous rail

**Files:**
- Modify: `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/bodies/PostThreadBody.tsx` (imports 34–50; `back` selector 88; `sentReplies` state 105; `renderItem` 216–225 — all HEAD numbers, and this task is the FIRST to touch the file, so they are exact)
- Modify: `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/bodies/thread/ThreadReplyRow.tsx` (threadModel import 36; props 38–47; component signature 49–55; `metaTail` 66; root `View` 69; `PostActionBar` 165–173; show-replies block 177–188; the eight style entries and their leading comment, 196–239)

**Interfaces:**
- Consumes: `ThreadRowExpansion`, `isOptimisticPostId`, `THREAD_RAIL_COLUMN_W`, `THREAD_RAIL_GAP`,
  `THREAD_RAIL_W`, `THREAD_RAIL_STUB_H` from `./threadModel` (Task 1.1/1.3);
  `t("thread.hide_replies")` from Task 1.4.
- Produces: `ThreadReplyRowProps` gains
  `hairline?: boolean`, `expansion?: ThreadRowExpansion`,
  `onToggleExpand?: (postId: string, expansion: ThreadRowExpansion) => void`,
  `onReply?: (post: PostDTO) => void`. All four are OPTIONAL so the barrel-exported component keeps
  working for any consumer that does not pass them.

> Note for the implementer: after this task the "Show N replies" link flips its own label to "Hide
> replies" but nothing is spliced yet — the row model is not wired into the list until Task 1.8. That is
> the intended intermediate state; the commit compiles and the suite is green.

- [ ] **Step 1: Introduce the red by wiring the call site.** In
`/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/bodies/PostThreadBody.tsx`:

(a) change the `threadModel` import at line 50 to:
```tsx
import {
  buildThreadRailPlan,
  isOptimisticPostId,
  threadItems,
  type ThreadRailSegment,
  type ThreadRowExpansion,
} from "./thread/threadModel"
```

(b) add `push` next to the existing `back` selector (line 88):
```tsx
  const back = useNavStore((state) => state.back)
  const push = useNavStore((state) => state.push)
```

(c) add the expansion state + handler immediately after the `sentReplies` state (line 105):
```tsx
  /**
   * Which depth-1 replies are expanded inline. LOCAL component state, reset when the thread unmounts:
   * nothing in the codebase persists per-row UI state, and X's expansion is one-way for the session
   * anyway. Android hardware back / iOS swipe-back leave the thread; they never collapse a row.
   */
  const [expandedIds, setExpandedIds] = React.useState<readonly string[]>([])

  /**
   * Stable so `ThreadReplyRow`'s React.memo keeps working - an arrow rebuilt per render would defeat it
   * on every row of a paged thread. The row hands back its own id + the affordance it rendered, so this
   * needs no lookup.
   */
  const onRowExpand = React.useCallback(
    (postId: string, expansion: ThreadRowExpansion) => {
      // At the depth cap the control is a LINK, not a cursor: it opens that reply's permalink.
      if (expansion === "navigate") {
        push({ kind: "post-thread", id: postId })
        return
      }
      if (expansion === "collapse") {
        setExpandedIds((current) => current.filter((entry) => entry !== postId))
        return
      }
      setExpandedIds((current) => (current.includes(postId) ? current : [...current, postId]))
    },
    [push],
  )
```

(d) replace `renderItem` at lines 216–225 with:
```tsx
          renderItem={({ item, index }: { item: unknown; index: number }) => {
            const reply = item as PostDTO
            const optimistic = isOptimisticPostId(reply.id)
            const expansion: ThreadRowExpansion =
              optimistic || reply.counts.replies <= 0
                ? "none"
                : expandedIds.includes(reply.id)
                  ? "collapse"
                  : "expand"
            return (
              <ThreadReplyRow
                post={reply}
                rail={rails[index] ?? NO_RAIL}
                isOptimistic={optimistic}
                expansion={expansion}
                onToggleExpand={onRowExpand}
              />
            )
          }}
```

- [ ] **Step 2: Run typecheck and confirm RED.**
`cd /Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui && pnpm typecheck`
Expected: exit 1 with
`src/bodies/PostThreadBody.tsx(…): error TS2322: Type '{ post: PostDTO; rail: ThreadRailSegment; isOptimistic: boolean; expansion: ThreadRowExpansion; onToggleExpand: (postId: string, expansion: ThreadRowExpansion) => void; }' is not assignable to type 'IntrinsicAttributes & ThreadReplyRowProps'.`
followed by the related line
`Property 'expansion' does not exist on type 'IntrinsicAttributes & ThreadReplyRowProps'.`

- [ ] **Step 3: Implement the row.** In
`/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/bodies/thread/ThreadReplyRow.tsx`:

(a) change the `threadModel` type import at line 36 (`import type { ThreadRailSegment } from "./threadModel"`) to:
```tsx
import {
  THREAD_RAIL_COLUMN_W,
  THREAD_RAIL_GAP,
  THREAD_RAIL_STUB_H,
  THREAD_RAIL_W,
  type ThreadRailSegment,
  type ThreadRowExpansion,
} from "./threadModel"
```

(b) replace the props interface at lines 38–47 with:
```tsx
export interface ThreadReplyRowProps {
  post: PostDTO
  /** Whether this row draws the connector above / below its avatar (see `buildThreadRows`). */
  rail: ThreadRailSegment
  /**
   * Whether this row draws its own bottom hairline. FALSE while it is chained to the row below it:
   * the threadline replaces the rule, and that absence is what reads as "these belong together".
   * Hairlines separate modules. Callers pass `!rail.below`.
   */
  hairline?: boolean
  /** The row is a locally-created reply the server has not confirmed yet. */
  isOptimistic?: boolean
  /** The send failed; the action row is replaced by a retry affordance. */
  failed?: boolean
  onRetry?: () => void
  /**
   * What the "Show N replies" control MEANS on this row: expand inline, collapse, or - at the inline
   * depth cap - navigate to this reply's permalink. Omitted defaults to `navigate`, which is exactly what
   * this row did before inline expansion existed, so an external consumer is unaffected.
   */
  expansion?: ThreadRowExpansion
  /**
   * Handle the control. Given the row's own id AND the affordance it rendered, so the handler can stay a
   * stable `useCallback` in the list - a per-row arrow would defeat this component's `React.memo`.
   * Omitted falls back to pushing the reply's thread.
   */
  onToggleExpand?: (postId: string, expansion: ThreadRowExpansion) => void
  /**
   * The comment glyph RE-AIMS the docked composer at this reply instead of pushing a new screen. Today
   * the glyph and "show replies" fire the same push, which makes them indistinguishable; inline expansion
   * forces them to mean different things. Omitted falls back to the push.
   */
  onReply?: (post: PostDTO) => void
}
```

(c) replace the component signature at lines 49–55 with:
```tsx
export const ThreadReplyRow = React.memo(function ThreadReplyRow({
  post,
  rail,
  hairline = true,
  isOptimistic = false,
  failed = false,
  onRetry,
  expansion,
  onToggleExpand,
  onReply,
}: ThreadReplyRowProps) {
```

(d) add, right after `const metaTail = ...` (line 66):
```tsx
  // Defaults to the pre-expansion behavior so nothing regresses for a caller that does not compute rows.
  const control: ThreadRowExpansion =
    expansion ?? (!isOptimistic && post.counts.replies > 0 ? "navigate" : "none")
```

(e) change the root `View` at line 69 to honour `hairline`:
```tsx
    <View
      style={[
        styles.outer,
        hairline ? styles.outerRule : null,
        failed ? styles.outerFailed : null,
        isOptimistic ? styles.outerOptimistic : null,
      ]}
    >
```

(f) change `PostActionBar`'s `onComment` at line 171 from
`onComment={() => push({ kind: "post-thread", id: post.id })}` to:
```tsx
                onComment={() =>
                  onReply ? onReply(post) : push({ kind: "post-thread", id: post.id })
                }
```

(g) replace the show-replies block at lines 177–188 with:
```tsx
          {control !== "none" ? (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: control === "collapse" }}
              onPress={() =>
                onToggleExpand
                  ? onToggleExpand(post.id, control)
                  : push({ kind: "post-thread", id: post.id })
              }
              {...focusRingProps}
              style={({ pressed }) => [styles.showReplies, pressed ? styles.pressed : null]}
            >
              <Text style={styles.showRepliesText}>
                {control === "collapse"
                  ? t("thread.hide_replies")
                  : t("thread.show_replies", { count: post.counts.replies })}
              </Text>
            </Pressable>
          ) : null}
```

(h) In the `StyleSheet.create` block, replace **lines 196–239** — that is the two-line comment above
`outer` (196–197) plus the **eight** entries `outer`, `outerOptimistic`, `outerFailed`, `row`,
`railColumn`, `railAbove`, `railBelow`, `content` (and the one-line comment at 226) — with these **nine**
entries. Everything from `metaRow:` (line 240) down is untouched. The rail now runs edge to edge so
consecutive segments form ONE continuous line; the negative margins are derived from the row's own
padding tokens, never literals (`theme.space["3"] === 12`, `theme.space["2"] === 8`):
```tsx
  // No horizontal padding here on purpose: the separator must be FULL-BLEED (0 -> screen width), which
  // is what makes the stream read as a list instead of a stack of inset cards. The rule itself is
  // conditional (`outerRule`): a chained row draws none - see the `hairline` prop.
  outer: {},
  outerRule: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  outerOptimistic: {
    opacity: 0.55,
  },
  outerFailed: {
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.bloom["600"],
  },
  row: {
    flexDirection: "row",
    paddingHorizontal: theme.space["4"],
    paddingTop: theme.space["3"],
    paddingBottom: theme.space["2"],
  },
  railColumn: {
    width: THREAD_RAIL_COLUMN_W,
    alignItems: "center",
  },
  // `marginTop` cancels the row's own paddingTop so the segment starts at the row's TRUE top edge - where
  // the previous row's `railBelow` ended. Without it the line broke for 12pt at every row boundary, which
  // is exactly the gap a THREADLINE may not have.
  railAbove: {
    width: THREAD_RAIL_W,
    marginTop: -theme.space["3"],
    height: theme.space["3"] + THREAD_RAIL_STUB_H,
    marginBottom: 2,
    borderRadius: THREAD_RAIL_W / 2,
    backgroundColor: theme.colors.border,
  },
  // flex:1 plus the cancelled paddingBottom: consecutive rows' rails now MEET at the row boundary instead
  // of stopping 8pt short of it.
  railBelow: {
    width: THREAD_RAIL_W,
    flex: 1,
    marginTop: 6,
    marginBottom: -theme.space["2"],
    borderRadius: THREAD_RAIL_W / 2,
    backgroundColor: theme.colors.border,
  },
  content: {
    flex: 1,
    minWidth: 0,
    marginLeft: THREAD_RAIL_GAP,
    gap: theme.space["1"],
  },
```

- [ ] **Step 4: Run typecheck + lint + the suite and confirm GREEN.**
```bash
cd /Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui && pnpm typecheck && pnpm lint && pnpm vitest run src/bodies/thread/__tests__/threadModel.test.ts
```
Expected: typecheck exits 0 (only its two pnpm banner lines), lint exits 0 (only its two banner lines),
`Tests 55 passed (55)`.

- [ ] **Step 5: Commit.**
```bash
cd /Users/theobong/Documents/GitHub/civfix/civfix-shared && git add packages/ui/src/bodies/thread/ThreadReplyRow.tsx packages/ui/src/bodies/PostThreadBody.tsx && git commit -m "feat(ui): reply row toggles inline instead of pushing, comment glyph re-aims the composer" -m "\"Show N replies\" was a push to a second full-screen thread; it is now an in-place cursor with a Hide replies counterpart, and at the depth cap it navigates. The comment glyph stops firing the identical push and re-aims the docked composer instead, so the two controls finally mean different things. The rail cancels the row's padding so consecutive segments meet, and the bottom hairline is conditional - the threadline is the separator inside a chain." -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 1.6: `ReplyComposer` — aim at a target that is not the focal post

**Files:**
- Modify: `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/bodies/PostThreadBody.tsx` (one new state hook next to Task 1.5's `expandedIds`, plus the `<ReplyComposer>` element — lines 245–255 **at HEAD**, pushed down ~45 lines by Task 1.5, so match the text)
- Modify: `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/bodies/thread/ReplyComposer.tsx` (props 96–103; destructure 125; `targetId` 141; `attachedReport` state 172; the draft-media mirror effect 187–189; `threadRootId` 330; `onPosted?.(post)` 340; signed-out `pathForEntry` 385; `focalHandle`/`replyingTo` 397–400; `ComposerModeBar` element 427–433. This task is the first to touch this file, so these are exact.)

**Interfaces:**
- Consumes: `ComposerModeBar { mode: "edit" | "reply"; title: string; excerpt: string; accentColor?: string; onCancel: () => void }` (unchanged);
  `threadFocalExcerpt(post: Pick<PostDTO, "body" | "event" | "report" | "media">, t: TFunction): string` (unchanged);
  `t("reply.context", { handle })` from the `post-composer` namespace — already present in en/es/de/ko, no new key.
- Produces: `ReplyComposerProps` gains `replyTarget?: PostDTO | null` and `onClearTarget?: () => void`;
  `onPosted` changes to `(post: PostDTO, targetId: string) => void`.

- [ ] **Step 1: Introduce the red by wiring the call site.** In
`/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/bodies/PostThreadBody.tsx`:

(a) add the target state directly under the `expandedIds` state added in Task 1.5:
```tsx
  /**
   * The reply the docked composer is aimed at, when it is NOT the focal post. Component state, dying with
   * the screen. The draft store is keyed by target id, so switching targets switches drafts for free.
   */
  const [replyTarget, setReplyTarget] = React.useState<PostDTO | null>(null)
```

(b) replace the `<ReplyComposer>` element — the `{post.data ? ( … ) : null}` block that is the last child
of the root `View`, lines 245–255 at HEAD — with:
```tsx
      {post.data ? (
        <ReplyComposer
          ref={composerRef}
          focalPost={post.data}
          replyTarget={replyTarget}
          onClearTarget={() => setReplyTarget(null)}
          rootHeight={rootHeight}
          onPosted={(created, targetId) => {
            setSentReplies((current) => [
              ...current,
              { ...created, replyToId: created.replyToId ?? targetId },
            ])
            // A reply to the FOCAL post lands at the bottom of the flat list, so scrolling there is right.
            // A reply composed against an expanded child is spliced under that child - scrolling to the end
            // would jump past it, and X does no scroll compensation on expansion anyway.
            if (targetId === id) listRef.current?.scrollToEnd?.({ animated: true })
          }}
        />
      ) : null}
```

- [ ] **Step 2: Run typecheck and confirm RED.**
`cd /Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui && pnpm typecheck`
Expected: exit 1 with two errors —
`src/bodies/PostThreadBody.tsx(…): error TS2322: … Property 'replyTarget' does not exist on type 'IntrinsicAttributes & ReplyComposerProps & RefAttributes<ReplyComposerHandle>'.`
and
`src/bodies/PostThreadBody.tsx(…): error TS7006: Parameter 'targetId' implicitly has an 'any' type.`
(`onPosted` still declares one parameter).

- [ ] **Step 3: Implement the re-aim.** In
`/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/bodies/thread/ReplyComposer.tsx`:

(a) replace the props interface at lines 96–103 with:
```tsx
export interface ReplyComposerProps {
  /**
   * The thread's focal post. Never null: a composer aimed at a null parent submits `replyToId: undefined`.
   * It is the DEFAULT target and the permalink the signed-out pill returns to after auth.
   */
  focalPost: PostDTO
  /**
   * The post the composer is currently aimed at, when it is NOT the focal post - a reply row's comment
   * glyph re-aims it here. Everything keyed by the target follows automatically: the draft store, the
   * "Replying to @x" mode bar, `replyToId`.
   */
  replyTarget?: PostDTO | null
  /** Drop the re-aim and return to the focal post (the mode bar's X, alongside the blur). */
  onClearTarget?: () => void
  /** The live height of the thread body root, from its `onLayout`. Drives every cap. */
  rootHeight: number
  /**
   * The SERVER-returned reply, for the screen's local `sentReplies` tail, plus the id it was aimed at -
   * the screen needs it to splice the reply under the right parent, and cannot assume the response
   * carries `replyToId`.
   */
  onPosted?: (post: PostDTO, targetId: string) => void
}
```

(b) line 125, destructure the new props:
```tsx
  function ReplyComposer({ focalPost, replyTarget, onClearTarget, rootHeight, onPosted }, ref) {
```

(c) replace line 141 (`const targetId = focalPost.id`) with:
```tsx
    const target = replyTarget ?? focalPost
    const targetId = target.id
```

(d) **The re-aim reset, and the ORDER it must be declared in.** Two edits, and the order is the whole
point: effects declared in one component run in DECLARATION ORDER within a commit, and on the commit that
re-aims the composer `targetId` is already the NEW target while `carried` / `attachments.attachments`
still hold the PREVIOUS target's media (`setCarried` / `attachments.reset()` only SCHEDULE their update).
If the reset is declared above the draft-media mirror effect, the mirror then writes A's media into B's
draft — `setDraftMedia(B, A's readyMedia)` — bumping B's `updatedAt` and therefore the draft store's LRU
eviction order. So: the ref goes up top, the mirror gets a guard, and the reset is declared BELOW it.

First, immediately after the `attachedReport` state (line 172), add ONLY the ref:
```tsx
    /**
     * The target the CURRENT `carried` / `attachments` belong to. It lags `targetId` by exactly the commit
     * that re-aimed the composer, which is what the draft-media mirror effect below keys off.
     */
    const aimedAt = React.useRef(targetId)
```

Then replace the existing draft-media mirror effect at lines 187–189 —
```tsx
    React.useEffect(() => {
      if (readyKey !== draftMediaKey) setDraftMedia(targetId, readyMedia)
    }, [readyKey, draftMediaKey, readyMedia, setDraftMedia, targetId])
```
— with the guarded mirror **followed by** the reset:
```tsx
    React.useEffect(() => {
      // SKIP THE RE-AIM COMMIT. `targetId` is already the NEW target, but `carried` / `attachments` still
      // hold the PREVIOUS one's media - the reset effect below only SCHEDULES their update. Mirroring here
      // would write A's media into B's draft and bump B's `updatedAt`, i.e. the store's eviction order.
      if (aimedAt.current !== targetId) return
      if (readyKey !== draftMediaKey) setDraftMedia(targetId, readyMedia)
    }, [readyKey, draftMediaKey, readyMedia, setDraftMedia, targetId])

    /**
     * Re-aiming switches the DRAFT (the store is keyed by target id), so the two pieces of component state
     * that MIRROR a draft have to switch with it. Without this, media staged against the focal post would
     * ride along into a reply aimed at someone else's comment, and the attached-report chip would show the
     * previous target's row.
     *
     * DECLARED AFTER THE MIRROR ON PURPOSE: on the re-aim commit the mirror above sees the stale `aimedAt`
     * and bails, and this one then adopts the new target; the next commit mirrors correctly. `reset` is a
     * stable `useCallback` (`src/primitives/useComposerAttachments.ts:153`).
     */
    React.useEffect(() => {
      if (aimedAt.current === targetId) return
      aimedAt.current = targetId
      attachments.reset()
      setCarried(useReplyDraftStore.getState().get(targetId).media)
      setAttachedReport(null)
    }, [targetId, attachments.reset])
```

(e) replace line 330 with (the thread ROOT is the focal post's root whatever the composer is aimed at —
`target.threadRootId ?? target.id` would wrongly root a depth-2 reply at its own parent):
```tsx
        threadRootId: target.threadRootId ?? focalPost.threadRootId ?? focalPost.id,
```

(f) line 340 — `onPosted?.(post)` inside `onSuccess` — pass the target back:
```tsx
            onPosted?.(post, targetId)
```

(g) line 385, the signed-out pill returns to the FOCAL post (a signed-out reader can never have re-aimed
the composer, and this must not become a permalink to a reply):
```tsx
              requireAuth(() => undefined, { next: pathForEntry({ kind: "post-thread", id: focalPost.id }) })
```

(h) replace lines 397–400 (`const focalHandle = …` through the second `t("reply.context", …)`) with:
```tsx
    const targetHandle = target.author.handle?.replace(/^@/, "") ?? null
    const replyingTo = targetHandle
      ? t("reply.context", { handle: `@${targetHandle}` })
      : t("reply.context", { handle: target.author.name })
```

(i) replace the `ComposerModeBar` element at lines 427–433 with:
```tsx
              <ComposerModeBar
                mode="reply"
                title={replyingTo}
                excerpt={threadFocalExcerpt(target, tFeed)}
                accentColor={theme.colors.accent}
                onCancel={() => {
                  onClearTarget?.()
                  grow.ref.current?.blur()
                }}
              />
```

- [ ] **Step 4: Run typecheck + lint + the suite and confirm GREEN.**
```bash
cd /Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui && pnpm typecheck && pnpm lint && pnpm vitest run src/bodies/thread/__tests__/threadModel.test.ts
```
Expected: typecheck exits 0 (only its two pnpm banner lines), lint exits 0 (only its two banner lines),
`Tests 55 passed (55)`.

- [ ] **Step 5: Commit.**
```bash
cd /Users/theobong/Documents/GitHub/civfix/civfix-shared && git add packages/ui/src/bodies/thread/ReplyComposer.tsx packages/ui/src/bodies/PostThreadBody.tsx && git commit -m "feat(ui): the docked composer can be aimed at a reply, not only the focal post" -m "replyTarget re-points the draft key, the Replying to @x mode bar and replyToId in one prop; onPosted now reports the id it was aimed at so the screen can splice the reply under the right parent instead of assuming the bottom of a flat list. threadRootId still resolves through the focal post, so a depth-2 reply is not rooted at its own parent. The draft-media mirror is guarded on the aim having settled, so a re-aim cannot write the previous target's media into the new target's draft." -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 1.7: `ThreadChainRow` — the non-post rows of an expanded chain

**Files:**
- Create: `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/bodies/thread/ThreadChainRow.tsx`
- Modify: `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/bodies/index.ts` (after line 49, the `ThreadEmptyReplies` export — Task 1.3's barrel edit is at lines 66+, so line 49 is unchanged)

**Interfaces:**
- Consumes: `THREAD_RAIL_COLUMN_W`, `THREAD_RAIL_GAP`, `THREAD_RAIL_W`, `type ThreadRailSegment` from
  `./threadModel`; `theme` from `../../theme`.
- Produces: `ThreadChainRow(props: ThreadChainRowProps): JSX.Element` and
  `interface ThreadChainRowProps { rail: ThreadRailSegment; hairline?: boolean; children: React.ReactNode }`,
  both re-exported from `@civfix/ui/bodies`.

- [ ] **Step 1: Introduce the red by exporting the module that does not exist.** In
`/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/bodies/index.ts`, insert after
line 49 (`export { ThreadEmptyReplies } from "./thread/ThreadEmptyReplies"`):
```ts
export { ThreadChainRow } from "./thread/ThreadChainRow"
export type { ThreadChainRowProps } from "./thread/ThreadChainRow"
```

- [ ] **Step 2: Run typecheck and confirm RED.**
`cd /Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui && pnpm typecheck`
Expected: exit 1 with
`src/bodies/index.ts(50,32): error TS2307: Cannot find module './thread/ThreadChainRow' or its corresponding type declarations.`
(and the same for line 51, at column 42).

- [ ] **Step 3: Create the component.** Write
`/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/bodies/thread/ThreadChainRow.tsx`:

```tsx
/**
 * ThreadChainRow - the two rows of an expanded reply chain that are not posts: the "show more" cursor at
 * the end of the chain, and the placeholder while a child page is in flight.
 *
 * It exists so those rows sit INSIDE the threadline rather than breaking it. There is exactly one rail
 * system in this surface: the gutter geometry comes from `threadModel` (the same constants
 * `ThreadReplyRow` uses), the caller passes the same `ThreadRailSegment` `buildThreadRows` produced, and
 * the same rule applies - a row chained to the row below draws NO bottom hairline, because the threadline
 * is the separator.
 *
 * Unlike a reply row there is no avatar splitting the column, so the rail is ONE continuous segment
 * instead of the reply row's above-stub / below-tail pair.
 */
import React from "react"
import { StyleSheet, View } from "react-native"
import { theme } from "../../theme"
import {
  THREAD_RAIL_COLUMN_W,
  THREAD_RAIL_GAP,
  THREAD_RAIL_W,
  type ThreadRailSegment,
} from "./threadModel"

export interface ThreadChainRowProps {
  /** The rail this row draws, straight off `buildThreadRows`. */
  rail: ThreadRailSegment
  /** Draw the bottom separator. False while this row is chained to the row below it. */
  hairline?: boolean
  /** The row's content, aligned to the same text column the reply rows use. */
  children: React.ReactNode
}

export function ThreadChainRow({ rail, hairline = true, children }: ThreadChainRowProps) {
  return (
    <View style={hairline ? styles.outerRule : null}>
      <View style={styles.row}>
        <View style={styles.railColumn}>
          {rail.above ? (
            <View style={[styles.rail, rail.below ? styles.railThrough : null]} />
          ) : null}
        </View>
        <View style={styles.content}>{children}</View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  outerRule: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  row: {
    flexDirection: "row",
    paddingHorizontal: theme.space["4"],
    paddingTop: theme.space["3"],
    paddingBottom: theme.space["2"],
  },
  railColumn: {
    width: THREAD_RAIL_COLUMN_W,
    alignItems: "center",
  },
  // The negative margin cancels the row's own paddingTop so the segment starts at the row's TRUE top
  // edge, where the row above ended - derived from the same token the padding uses, never a literal.
  rail: {
    width: THREAD_RAIL_W,
    flex: 1,
    marginTop: -theme.space["3"],
    borderRadius: THREAD_RAIL_W / 2,
    backgroundColor: theme.colors.border,
  },
  // Only a row that continues DOWN pushes through its own bottom padding to meet the next row's rail.
  railThrough: {
    marginBottom: -theme.space["2"],
  },
  content: {
    flex: 1,
    minWidth: 0,
    marginLeft: THREAD_RAIL_GAP,
  },
})
```

- [ ] **Step 4: Run typecheck + lint and confirm GREEN.**
```bash
cd /Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui && pnpm typecheck && pnpm lint
```
Expected: both exit 0, each printing only its two pnpm banner lines.

- [ ] **Step 5: Commit.**
```bash
cd /Users/theobong/Documents/GitHub/civfix/civfix-shared && git add packages/ui/src/bodies/thread/ThreadChainRow.tsx packages/ui/src/bodies/index.ts && git commit -m "feat(ui): ThreadChainRow - show-more and loading rows that sit inside the threadline" -m "Both rows share ThreadReplyRow's gutter constants and hairline rule from threadModel, so the chain reads as one module rather than a rail that stops at the last reply." -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 1.8: Wire `PostThreadBody` to the row union

**Files:**
- Modify: `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/bodies/PostThreadBody.tsx`

> **Line numbers in this task are HEAD numbers and are STALE by design.** Tasks 1.5 and 1.6 have already
> added ~50 lines to this file above every region below. **Anchor on the quoted text**, and re-read any
> range before deleting it. HEAD positions, for orientation only: file header 1–33 (unchanged by 1.5/1.6,
> so still exact); import block + `NO_RAIL` 39–52; `ThreadRepliesSkeleton` ends 84; the three `useMemo`s
> 109–117; the main `return`'s `{header}` 198; the `<ThreadList>` 200–243; `footerText` style ends 295.

**Interfaces:**
- Consumes: `buildThreadRows(...)`, `type ThreadRow`, `type ThreadChildState`, `type ThreadRowExpansion`
  from `./thread/threadModel` (Tasks 1.1–1.3);
  `ThreadChainRow` (Task 1.7); `ThreadReplyRow`'s `hairline` / `expansion` / `onToggleExpand` / `onReply`
  props (Task 1.5); `ReplyComposer`'s `replyTarget` / `onClearTarget` / two-argument `onPosted`
  (Task 1.6); `usePostReplies(id: string | undefined)` returning
  `{ data?: InfiniteData<FeedPageDTO>; isLoading: boolean; hasNextPage: boolean; isError: boolean; isFetchingNextPage: boolean; fetchNextPage(): …; refetch(): … }`
  from `../data/hooks/posts` (verified: `src/data/hooks/posts.ts:425`).
- Produces: nothing exported. `buildThreadRailPlan`, `threadItems` and `isOptimisticPostId` are no longer
  imported here (all three remain exported and unit-tested for external consumers).

- [ ] **Step 1: Introduce the red by switching the list over to rows.** In
`/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/bodies/PostThreadBody.tsx`,
replace the three consecutive `React.useMemo` declarations — `fetched`, `items` (`threadItems(...)`) and
`rails` (`buildThreadRailPlan(...)`), lines 109–117 at HEAD — with:

```tsx
  const fetched = React.useMemo(
    () => (replies.data?.pages ?? []).flatMap((page) => page.items),
    [replies.data],
  )
  const expandedSet = React.useMemo(() => new Set(expandedIds), [expandedIds])
  const rows = React.useMemo(
    () =>
      buildThreadRows<PostDTO>({
        focalId: id,
        focalAuthorId: post.data?.author.id,
        replies: fetched,
        sent: sentReplies,
        expandedIds: expandedSet,
        children: childStates,
      }),
    [id, post.data?.author.id, fetched, sentReplies, expandedSet, childStates],
  )
```

and on the `<ThreadList>`, replace the `data` and `keyExtractor` props:
```tsx
          data={rows}
          keyExtractor={(item: unknown) => (item as ThreadRow<PostDTO>).key}
```

- [ ] **Step 2: Run typecheck and confirm RED.**
`cd /Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui && pnpm typecheck`
Expected: exit 1, first error
`src/bodies/PostThreadBody.tsx(…): error TS2304: Cannot find name 'buildThreadRows'.`
plus `Cannot find name 'childStates'.`, `Cannot find name 'ThreadRow'.`, and
`Cannot find name 'rails'.` — Task 1.5's `renderItem` still reads the `rails` memo you just deleted;
Step 3(e) replaces that `renderItem`.

- [ ] **Step 3: Complete the wiring.** In
`/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/bodies/PostThreadBody.tsx`:

(a) Replace the whole import run from `import { usePost, usePostReplies } from "../data/hooks/posts"`
down to **and including** the module-level `const NO_RAIL: ThreadRailSegment = { above: false, below: false }`
(lines 39–52 at HEAD; after Task 1.5 turned the one-line `threadModel` import into a 7-line block this
run ends around line 58 — match the text, not the number) with:
```tsx
import { usePost, usePostReplies } from "../data/hooks/posts"
import { useAuthState, useRequireAuth } from "../data"
import { useT } from "../i18n"
import { useNavStore } from "../nav"
import { pathForEntry } from "../nav"
import { PLAIN_SCROLL_HOST, ScrollHostProvider, useScrollHost } from "../shell/ScrollHost"
import { SignInPrompt } from "../primitives/StateView"
import { ReplyComposer, type ReplyComposerHandle } from "./thread/ReplyComposer"
import { ThreadChainRow } from "./thread/ThreadChainRow"
import { ThreadEmptyReplies } from "./thread/ThreadEmptyReplies"
import { ThreadFocalPost, ThreadFocalSkeleton } from "./thread/ThreadFocalPost"
import { ThreadReplyRow } from "./thread/ThreadReplyRow"
import {
  buildThreadRows,
  type ThreadChildState,
  type ThreadRow,
  type ThreadRowExpansion,
} from "./thread/threadModel"
```
(`buildThreadRailPlan`, `threadItems`, `isOptimisticPostId`, `ThreadRailSegment` and the module-level
`NO_RAIL` const are ALL deleted — the rail travels with the row, and after Step 3(e) the row's
`listRow.optimistic` replaces every call to `isOptimisticPostId` in this file. `eslint.config.js` sets
`@typescript-eslint/no-unused-vars: "error"`, so leaving any of them imported fails Step 4's `pnpm lint`
with `'isOptimisticPostId' is defined but never used`.)

(b) add the per-expanded-row query subscriber directly above `export function PostThreadBody` (i.e.
after the closing brace of `ThreadRepliesSkeleton`, line 84 at HEAD):
```tsx
/**
 * ONE `usePostReplies` per expanded row, reported up to the screen.
 *
 * A hook cannot be called in a loop of varying length, and the flattened list has to live in ONE
 * FlatList (a nested list makes RN warn and breaks measurement), so the screen owns the data and each
 * expanded row gets a null-rendering subscriber whose hook order is stable for its own lifetime.
 * `queryKeys.postReplies(childId)` is per-parent under the `["posts"]` prefix, so the like/save patcher,
 * `useCreatePost`'s reply branch and the reply-count nudge all already reach these lists - no new cache
 * plumbing.
 *
 * It reports only the FIRST page's worth: the chain's `show-more` cursor navigates to the permalink
 * instead of paging inline, which is what bounds the fan-out.
 */
function ThreadChildQuery({
  parentId,
  onState,
}: {
  parentId: string
  onState: (parentId: string, state: ThreadChildState<PostDTO>) => void
}) {
  const replies = usePostReplies(parentId)
  const items = React.useMemo(
    () => (replies.data?.pages ?? []).flatMap((page) => page.items),
    [replies.data],
  )
  const loading = replies.isLoading
  const hasMore = replies.hasNextPage === true
  React.useEffect(() => {
    onState(parentId, { items, loading, hasMore })
  }, [onState, parentId, items, loading, hasMore])
  return null
}
```

(c) add the child-state store + handlers next to the `expandedIds` state (added in Task 1.5) and REPLACE
the `onRowExpand` callback written there with the version that also drops the collapsed row's data:
```tsx
  /** The loaded children per expanded row, fed by `ThreadChildQuery`. */
  const [childStates, setChildStates] = React.useState<
    Readonly<Record<string, ThreadChildState<PostDTO> | undefined>>
  >({})

  /** Stable, and returns the SAME object when nothing moved, so a subscriber's effect cannot loop. */
  const onChildState = React.useCallback(
    (parentId: string, next: ThreadChildState<PostDTO>) => {
      setChildStates((current) => {
        const prev = current[parentId]
        if (
          prev != null
          && prev.items === next.items
          && prev.loading === next.loading
          && prev.hasMore === next.hasMore
        ) {
          return current
        }
        return { ...current, [parentId]: next }
      })
    },
    [],
  )

  const expandRow = React.useCallback((postId: string) => {
    setExpandedIds((current) => (current.includes(postId) ? current : [...current, postId]))
  }, [])

  const onRowExpand = React.useCallback(
    (postId: string, expansion: ThreadRowExpansion) => {
      // At the depth cap the control is a LINK, not a cursor: it opens that reply's permalink.
      if (expansion === "navigate") {
        push({ kind: "post-thread", id: postId })
        return
      }
      if (expansion === "collapse") {
        setExpandedIds((current) => current.filter((entry) => entry !== postId))
        setChildStates((current) => {
          if (current[postId] === undefined) return current
          const next = { ...current }
          delete next[postId]
          return next
        })
        return
      }
      expandRow(postId)
    },
    [push, expandRow],
  )

  /**
   * The comment glyph on a reply row. Aiming the composer at a reply EXPANDS it too, so the reply you are
   * about to write has somewhere to appear. Only depth-1 rows get this handler; at the cap the row falls
   * back to pushing the permalink, where its own composer is already aimed correctly.
   */
  const onRowReply = React.useCallback(
    (target: PostDTO) => {
      setReplyTarget(target)
      expandRow(target.id)
      composerRef.current?.focus()
    },
    [expandRow],
  )
```

(d) mount the subscribers immediately after `{header}` **in the FINAL `return`** — the one whose root is
`<View style={styles.root} onLayout={…}>`, line 198 at HEAD. **Not** the `{header}` in the signed-out
early return (line 145 at HEAD) and **not** the one in the focal-error early return (line 162). They
render `null`, so their position inside that tree is irrelevant to layout:
```tsx
      {expandedIds.map((parentId) => (
        <ThreadChildQuery key={parentId} parentId={parentId} onState={onChildState} />
      ))}
```

(e) replace the `renderItem` and `ListEmptyComponent` props on the list:
```tsx
          renderItem={({ item }: { item: unknown }) => {
            const listRow = item as ThreadRow<PostDTO>
            if (listRow.kind === "show-more") {
              return (
                <ThreadChainRow rail={listRow.rail} hairline={listRow.hairline}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => push({ kind: "post-thread", id: listRow.parentId })}
                    {...focusRingProps}
                    style={({ pressed }) => [styles.chainAction, pressed ? styles.pressed : null]}
                  >
                    <Text style={styles.chainActionText}>
                      {t("thread.show_replies", { count: listRow.remaining })}
                    </Text>
                  </Pressable>
                </ThreadChainRow>
              )
            }
            if (listRow.kind === "loading") {
              return (
                <ThreadChainRow rail={listRow.rail} hairline={listRow.hairline}>
                  <Text style={styles.chainLoading}>{t("thread.loading")}</Text>
                </ThreadChainRow>
              )
            }
            return (
              <ThreadReplyRow
                post={listRow.post}
                rail={listRow.rail}
                hairline={listRow.hairline}
                isOptimistic={listRow.optimistic}
                expansion={listRow.expansion}
                onToggleExpand={onRowExpand}
                onReply={listRow.depth === 1 ? onRowReply : undefined}
              />
            )
          }}
          ListEmptyComponent={
            replies.isLoading ? (
              <ThreadRepliesSkeleton />
            ) : post.data && !replies.isError ? (
              <ThreadEmptyReplies />
            ) : null
          }
```

(f) add three styles to the `StyleSheet.create` block, directly after the `footerText` entry (which ends
at line 295 at HEAD) — the action mirrors `ThreadReplyRow.styles.showReplies` exactly so the chain's
cursor and a reply's link sit on the same optical left edge:
```tsx
  chainAction: {
    minHeight: 32,
    justifyContent: "center",
    marginLeft: -6,
    paddingHorizontal: 6,
    alignSelf: "flex-start",
  },
  chainActionText: {
    fontFamily: theme.fontFamily.bodyBold,
    fontSize: 13.5,
    lineHeight: 18,
    color: theme.colors.accentText,
  },
  chainLoading: {
    minHeight: 32,
    fontFamily: theme.fontFamily.bodyMedium,
    fontSize: 13.5,
    lineHeight: 32,
    color: theme.colors.textSubtle,
  },
```

(g) append to the file header (after line 32, `* <PostComposer mode="reply" compact/>` mount.`, and
before the closing `*/` on line 33 — the header is untouched by Tasks 1.5/1.6, so these numbers are
still exact):
```
 * INLINE EXPANSION. Tapping "Show N replies" on a reply expands it IN PLACE instead of pushing a second
 * PostThreadBody: `buildThreadRows` flattens replies + their expanded children + the chain's cursors into
 * ONE list (never a nested FlatList - RN warns and breaks measurement), with zero indentation and a
 * threadline through the avatar column, which is what X actually ships (it shipped indented branching
 * threading in Feb 2020 and killed it in Dec 2020). Expansion appends: no scroll compensation, no
 * auto-scroll, no highlight, so the focal post and the scroll offset never move. Tapping the reply ROW
 * still navigates, and `/post/[id]` stays - deep links and share links depend on it.
 *
 * `usePost(post.data?.replyToId)` below is REDUNDANT now: the backend populates `PostDTO.replyTo`. It is
 * left in place deliberately - it is warm in the cache and costs nothing - rather than removed inside a
 * feature change. Do not "fix" it by accident.
```

- [ ] **Step 4: Run typecheck + lint + the suite and confirm GREEN.**
```bash
cd /Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui && pnpm typecheck && pnpm lint && pnpm vitest run && pnpm i18n:check
```
Expected: typecheck exits 0 (only its two pnpm banner lines); lint exits 0 (only its two banner lines);
the full vitest run reports ZERO failures, with `src/bodies/thread/__tests__/threadModel.test.ts (55 tests)`
among the files; and `i18n key check OK: 76 namespaces key-complete across es, de, ko.`
Do NOT assert an absolute whole-suite total here — other workstreams add test files to this same package
and the running total depends on which of them have already landed.

- [ ] **Step 5: Commit.**
```bash
cd /Users/theobong/Documents/GitHub/civfix/civfix-shared && git add packages/ui/src/bodies/PostThreadBody.tsx && git commit -m "feat(ui): inline Show replies in the post thread (X parity)" -m "Replies, their expanded children and the chain's cursors flatten into ONE FlatList via buildThreadRows: zero indentation, a threadline through the avatar column, no hairline between chained rows, and a plain append with no scroll compensation. One usePostReplies per expanded row, mounted through a null-rendering subscriber so the hook order stays stable; collapsing drops its state. Tapping the row still navigates and /post/[id] is untouched." -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Workstream 1 — done when

- `pnpm typecheck`, `pnpm lint`, `pnpm vitest run` and `pnpm i18n:check` are all green in
  `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui`, with
  `src/bodies/thread/__tests__/threadModel.test.ts` reporting 55 tests.
- Device check on the iOS simulator (rsync `civfix-shared/packages/ui/src/` over
  `civfix-mobile/node_modules/@civfix/ui/src/` — verified: `@civfix/ui` is installed at the mobile repo
  ROOT, NOT under `apps/community-mobile/node_modules`; the new `thread.hide_replies` key needs an app
  **relaunch**, not just a reload): open a thread whose reply has replies, tap "Show N replies" — the
  children appear beneath it at the same left gutter, joined by the rail, the focal post does not move,
  and the label flips to "Hide replies". Tap a child's "Show N replies" — it navigates instead of
  expanding. Tap a reply's comment glyph — the composer opens with "Replying to @x" and the row expands;
  stage a photo on the focal composer first, then re-aim, and confirm the photo does NOT follow you.


---


## Workstream 2 — Restore the map camera when the drop-pin pull-up is dismissed

**Repos:** `civfix-shared` (`@civfix/ui`) + `civfix-mobile`.
**Branch:** `civfix-shared` is already on `mobile-ux-five-fixes`. `civfix-mobile` is on `main` — Task 2.4 Step 1 creates/switches to the matching branch there.

### Two decisions this workstream resolves, written down before any code

**1. The restore fires on the STORE EVENT, not on the sheet's `onClosed`.** The spec left this open (its "Timing" risk says "pick one deliberately"). It is settled by three things that were read, not assumed:

- **There is no `onClosed` reachable from the shared flow module.** `onSheetClosed` is a local closure inside `shell/PortraitShell.shared.tsx:149-152`; it is passed *down* into `CompactShell` (at `PortraitShell.shared.tsx:237`) and never published outward. Hanging the restore off it means threading a new callback through `AppShell → PortraitShellFrame → CompactShell` for the exclusive benefit of one map gesture — and the standing contract at `map/dropPinCamera.ts:64-68` ("THE HOST OWNS THE CAMERA") is precisely that the shell layer does not participate in camera decisions.
- **On native the `onClosed` path is not even guaranteed.** `PortraitShell.shared.tsx:134-148` documents `theme.motion.sheetTeardownGuardMs` (300ms) as a *safety net* "if the seam never reports `onClosed` (missed animation callback)". A restore hung off `onClosed` inherits that failure mode: 300ms late, or never. The store event has none.
- **Splitting the pin-clear from the camera-restore creates a visible dead beat.** `armDropPinCleanup` (`map/dropPinFlow.ts:54-61`) already calls `useDroppedPin.getState().clear()` **synchronously on the store event** (`dropPinFlow.ts:59`) — the coral teardrop vanishes on that frame. Waiting `theme.motion.sheetDismiss.duration` (180ms, quoted at `PortraitShell.shared.tsx:136`) to move the camera leaves the map parked on a drop-pin camera with no drop pin on it. Firing on the same notification keeps marker removal and camera restore on one frame, and MapLibre's own `flyTo` easing overlaps the card's 180ms slide so the two read as one gesture rather than two.

**2. The snapshot lives as a module-level `let` in `dropPinFlow.ts` — not a new zustand store, and not threaded through `droppedPinStore`.**

- **Not `droppedPinStore`.** Its header (`map/droppedPinStore.ts:1-17`) says it is the one marker-coordinate bus both map seams draw from, and that `drop` is identity-idempotent at 6dp so "a StrictMode double-invoke or a re-mount effect cannot churn the two map seams' marker subtrees". Adding a camera snapshot to it would re-render every seam's marker tree on a value no seam draws.
- **Not a new zustand store.** zustand is used here for values React subscribes to. The snapshot is written once by the host (outside React) and read once inside a store subscription (outside React). Zero subscribers, so `create()` buys a notify path nobody listens on, plus a barrel export and a reset ritual.
- **A module singleton is the house pattern for exactly this.** `setCameraNavigator` (`civfix-mobile/apps/community-mobile/src/lib/nativeCamera.ts:33-42`) and `setComposerEventFormPresenter` (`bodies/composerCreateFlow.ts:171-193`, whose comment at :173 says "A module singleton, not a prop and not a hook") are both this shape, and `dropPinFlow.ts:44` already holds one (`unsubscribeDropPin`). The snapshot has *exactly the subscription's lifetime* — armed by the same call, consumed by the same fire, dropped by `disarmDropPinCleanup` — so putting it anywhere else creates a second lifetime to keep in sync.

**Verified baselines (run at HEAD, before any of this lands):**

```
cd /Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui && pnpm vitest run src/map/__tests__/dropPinCamera.test.ts src/map/__tests__/dropPinFlow.test.ts
  -> src/map/__tests__/dropPinFlow.test.ts   (12 tests)
  -> src/map/__tests__/dropPinCamera.test.ts (40 tests)

cd /Users/theobong/Documents/GitHub/civfix/civfix-mobile/apps/community-mobile && pnpm test
  -> # tests 45 / # pass 45 / # fail 0
```

Every expected count below is stated PER FILE against those baselines. Do not assert a whole-suite total anywhere: the other four workstreams land in the same `packages/ui` vitest suite and move it.

---

### Task 2.1: `DropPinCameraSnapshot` + `shouldRestoreDropPinCamera` — the commitment branches

**Files:**
- Modify: `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/map/dropPinCamera.ts` (edit the import at line 71; append after line 221, which is the closing `}` of `dropPinCameraTarget` and the last line of the file)
- Test: `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/map/__tests__/dropPinCamera.test.ts` (edit the import at line 2; append after line 387, the last line of the file)

**Interfaces:**
- Consumes: `dropPinCameraTarget(input: DropPinCameraInput): DropPinCameraTarget`, `worldPx(zoom: number): number`, `DROP_PIN_ZOOM` — all already in `map/dropPinCamera.ts`. `View` from `../nav` (`nav/types.ts:10`).
- Produces:
  - `interface DropPinCameraSnapshot { from: DropPinCameraTarget; flownTo: DropPinCameraTarget; view: View }`
  - `interface DropPinDismissal { previousStack: readonly { kind: string }[]; view: View; viewport: { center: { lat: number; lng: number }; zoom: number } | null }`
  - `shouldRestoreDropPinCamera(snapshot: DropPinCameraSnapshot | null, dismissal: DropPinDismissal): boolean`

---

- [ ] **Step 1: Write the failing test for the commitment branches.**
  First change line 2 of `packages/ui/src/map/__tests__/dropPinCamera.test.ts` from
  ```ts
  import { DROP_PIN_ZOOM, dropPinCameraTarget, worldPx } from "../dropPinCamera"
  ```
  to
  ```ts
  import {
    DROP_PIN_ZOOM,
    dropPinCameraTarget,
    shouldRestoreDropPinCamera,
    worldPx,
    type DropPinCameraSnapshot,
    type DropPinCameraTarget,
    type DropPinDismissal,
  } from "../dropPinCamera"
  ```
  Then append this to the END of the file (after line 387):
  ```ts
  // --- THE RESTORE: putting the camera BACK when the pull-up is dismissed ----------------------------
  //
  // Everything above answers "where must the camera GO for a long press". These answer the mirror question:
  // "when the pull-up goes away, may the camera go BACK". The hard part is not the math - `snapshot.from` IS
  // the answer - it is telling a DISMISSAL from a COMMITMENT, because both of them take the drop-pin entry
  // off the nav stack by the same door.

  /** Where the user WAS before the long press: a wider view of a different part of town. */
  const FROM: DropPinCameraTarget = { lat: 37.7935, lng: -122.4399, zoom: 13 }

  /** The camera the sim device's MID-detent drop-pin fly is ASKED to land on for a long press at SF. */
  const FLOWN: DropPinCameraTarget = dropPinCameraTarget({
    ...SF,
    currentZoom: FROM.zoom,
    windowHeight: WINDOW_H,
    sheetTopReserve: TOP_RESERVE,
    topInset: SAFE_TOP,
    sheetDetent: 1,
    mode: "compact",
  })

  /** A viewport parked exactly on a camera - what `useMapViewport` publishes once a fly settles. */
  const parkedOn = (camera: DropPinCameraTarget) => ({
    center: { lat: camera.lat, lng: camera.lng },
    zoom: camera.zoom,
  })

  const snapshot = (over: Partial<DropPinCameraSnapshot> = {}): DropPinCameraSnapshot => ({
    from: FROM,
    flownTo: FLOWN,
    view: "map",
    ...over,
  })

  const dismissal = (over: Partial<DropPinDismissal> = {}): DropPinDismissal => ({
    previousStack: [{ kind: "drop-pin" }],
    view: "map",
    viewport: parkedOn(FLOWN),
    ...over,
  })

  describe("shouldRestoreDropPinCamera: a dismissal restores, a COMMITMENT does not", () => {
    it("restores on a plain dismissal - Cancel, sheet drag, map tap and Android back all land here", () => {
      expect(shouldRestoreDropPinCamera(snapshot(), dismissal())).toBe(true)
    })

    it("carries BOTH cameras: `from` is what to fly, `flownTo` is what the pan check compares against", () => {
      // The fixture is a genuine before/after PAIR, not two copies of one camera.
      expect(snapshot().from).toEqual(FROM)
      expect(snapshot().flownTo.zoom).toBe(DROP_PIN_ZOOM)
      // The drop-pin fly pushes the CENTRE south so the pin rises into the strip above the sheet.
      expect(snapshot().flownTo.lat).toBeLessThan(SF.lat)
      // And the predicate accepts a viewport parked on EITHER endpoint - both are places the APP put the
      // camera, so neither is a user pan. (Task 2.2 turns the second half into a real measurement; here it
      // only has to not be rejected.)
      expect(shouldRestoreDropPinCamera(snapshot(), dismissal({ viewport: parkedOn(FLOWN) }))).toBe(true)
      expect(shouldRestoreDropPinCamera(snapshot(), dismissal({ viewport: parkedOn(FROM) }))).toBe(true)
    })

    it("does nothing with no snapshot - a long press that armed none (no map had reported yet)", () => {
      expect(shouldRestoreDropPinCamera(null, dismissal())).toBe(false)
    })

    it("does NOT restore when the VIEW changed - 'Report an issue here' is a commitment", () => {
      // DropPinBody.onReport -> useDraftReportStore.setPrefilledLocation (DropPinBody.tsx:98) ->
      // useNavStore.selectView("report") (DropPinBody.tsx:101), and `selectView` EMPTIES the stack - so the
      // drop-pin entry leaves by the very same door Cancel uses. The only tell is that the user is now on
      // another surface, which is what the recorded view catches.
      expect(shouldRestoreDropPinCamera(snapshot(), dismissal({ view: "report" }))).toBe(false)
    })

    it("does NOT restore on the [drop-pin, cleanup] PUBLISH-THEN-DISMISS trap", () => {
      // Host-an-event from a drop pin: DropPinBody.onHost (DropPinBody.tsx:127) pushes ->
      // [drop-pin, create-cleanup]. On publish `stackAfterFlowPublished`
      // (bodies/composerCreateFlow.ts:125-134) truncates only up to the topmost FLOW kind, leaving
      // [drop-pin, cleanup] - which is exactly why CreateCleanupBody.tsx:357 clears the marker BY HAND
      // there. The drop-pin entry finally leaves the stack when that EVENT detail is dismissed, and
      // restoring then would yank the camera off the event the user just created.
      expect(
        shouldRestoreDropPinCamera(
          snapshot(),
          dismissal({ previousStack: [{ kind: "drop-pin" }, { kind: "cleanup" }] }),
        ),
      ).toBe(false)
    })

    it("does NOT restore while a create flow is still stacked over the pin", () => {
      expect(
        shouldRestoreDropPinCamera(
          snapshot(),
          dismissal({ previousStack: [{ kind: "drop-pin" }, { kind: "create-cleanup" }] }),
        ),
      ).toBe(false)
    })

    it("DOES restore from EXPANDED's appended stack, where the pin is not at index 0", () => {
      // `openDropPinMenu` uses `push` on expanded (dropPinFlow.ts:106 - the sidebar's panel stack), so the
      // entry lands on TOP of whatever panel was already open. The rule is POSITIONAL - is the drop pin the
      // top of the stack that is going away - not "is it the only entry".
      expect(
        shouldRestoreDropPinCamera(
          snapshot(),
          dismissal({ previousStack: [{ kind: "cleanups" }, { kind: "drop-pin" }] }),
        ),
      ).toBe(true)
    })

    it("does NOT restore when the previous stack held no drop-pin entry at all", () => {
      for (const previousStack of [[], [{ kind: "cleanup" }]]) {
        expect(shouldRestoreDropPinCamera(snapshot(), dismissal({ previousStack }))).toBe(false)
      }
    })

    it("does NOT restore with no live viewport - no map is mounted, so there is nothing to fly", () => {
      // Both seams call `useMapViewport.getState().clear()` on unmount (Map.native.tsx:113,
      // Map.web.tsx:376). A fly issued then would QUEUE and replay onto the NEXT mounted map - a camera
      // yank on a surface the user has already left.
      expect(shouldRestoreDropPinCamera(snapshot(), dismissal({ viewport: null }))).toBe(false)
    })
  })
  ```

- [ ] **Step 2: Run it and watch it fail.**
  ```
  cd /Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui && pnpm vitest run src/map/__tests__/dropPinCamera.test.ts
  ```
  Expected: `Tests 9 failed | 40 passed (49)`. All NINE `it`s in `shouldRestoreDropPinCamera: a dismissal
  restores, a COMMITMENT does not` fail, each reporting `TypeError: shouldRestoreDropPinCamera is not a
  function` (verified against vitest 2.1.9: vite's SSR transform resolves a missing named export to
  `undefined`, so the file COLLECTS fine and each test throws at the CALL). The 40 pre-existing tests in the
  file still pass. Every one of the nine calls the predicate — `carries BOTH cameras` deliberately ends with
  two `shouldRestoreDropPinCamera` assertions so it is a real red rather than a fixture-only test that would
  pass while the feature does not exist.

- [ ] **Step 3: Minimal implementation.**
  In `packages/ui/src/map/dropPinCamera.ts`, change line 71 from
  ```ts
  import type { Snap } from "../nav"
  ```
  to
  ```ts
  import type { Snap, View } from "../nav"
  ```
  Then append to the END of the file (after line 221, the closing `}` of `dropPinCameraTarget`):
  ```ts

  // --- THE RESTORE: putting the camera BACK when the pull-up is dismissed ----------------------------
  //
  // `dropPinCameraTarget` above answers "where must the camera GO". This half answers the mirror question:
  // when the pull-up goes away, MAY the camera go back to where the user was? The pre-press viewport was
  // never captured before this - the mobile handler read `useMapViewport.getState().viewport` for the zoom
  // FLOOR only (app/index.tsx:489) and threw the centre away, and by the time the fly settles
  // `acknowledgeMapSettlement` has overwritten `mapLifecycle.lastViewport` with the drop-pin camera and
  // `rememberMapViewport` has persisted it. So every dismissal used to leave the camera parked on the pin.
  //
  // THE HARD PART IS NOT THE MATH - `snapshot.from` IS the answer. It is telling a DISMISSAL apart from a
  // COMMITMENT, because both take the drop-pin entry off the nav stack by exactly the same door:
  //
  //   - Cancel / sheet drag-down / map tap / Android back  -> DISMISSAL. Restore.
  //   - "Report an issue here"                             -> `selectView("report")`, which also EMPTIES
  //     the stack. The tell is that the VIEW changed.
  //   - "Host an event here", then publish                 -> `stackAfterFlowPublished`
  //     (bodies/composerCreateFlow.ts:125-134) truncates only up to the topmost FLOW kind, so the stack
  //     lands as [drop-pin, cleanup] and the drop-pin entry survives - which is precisely why
  //     CreateCleanupBody.tsx:357 clears the marker by hand. It leaves the stack much later, as COLLATERAL
  //     of the event detail being dismissed. The tell is POSITIONAL: on a real dismissal the drop-pin entry
  //     is the TOP of the stack that is going away.
  //
  // Both tells are readable from zustand's `(state, prevState)` listener pair with no history tracking, so
  // this stays a pure predicate rather than a little state machine.
  //
  // THIS MODULE STILL NEVER TOUCHES THE CAMERA (see the header): it returns a boolean and the caller flies.

  /** The camera the map was on BEFORE a drop-pin long press, plus what is needed to judge the dismissal. */
  export interface DropPinCameraSnapshot {
    /** The PRE-PRESS camera - `useMapViewport.getState().viewport` centre + zoom, read before the fly. */
    from: DropPinCameraTarget
    /** The camera the drop-pin fly was ASKED for: `dropPinCameraTarget`'s own return value. */
    flownTo: DropPinCameraTarget
    /** The nav `view` the long press happened on. A different view at dismissal means the user committed. */
    view: View
  }

  /**
   * What the world looks like at the instant the drop-pin entry leaves the nav stack.
   *
   * `previousStack` is typed STRUCTURALLY (`{ kind: string }`) rather than as `readonly DetailEntry[]` so
   * this module keeps importing nothing from `../nav` but two type aliases - `readonly DetailEntry[]` is
   * assignable to it, so the seam passes zustand's `prevState.stack` straight in.
   */
  export interface DropPinDismissal {
    /** The nav stack IMMEDIATELY BEFORE the change that removed the drop-pin entry (zustand `prevState`). */
    previousStack: readonly { kind: string }[]
    /** The nav `view` AFTER that change. */
    view: View
    /** The map's live viewport centre + zoom, or null when no map is mounted / has reported. */
    viewport: { center: { lat: number; lng: number }; zoom: number } | null
  }

  /**
   * May the camera be flown back to `snapshot.from` now that the drop-pin entry has left the stack?
   *
   * Pure, and deliberately conservative: every uncertain input returns FALSE. A missing restore is a beat
   * the user does not notice; an unexplained camera move is the exact complaint `dropPinFlow.ts:9-14`
   * already records about flying with no pin ("a camera yank out of nowhere").
   */
  export function shouldRestoreDropPinCamera(
    snapshot: DropPinCameraSnapshot | null,
    dismissal: DropPinDismissal,
  ): boolean {
    if (!snapshot) return false
    // (1) A VIEW CHANGE IS A COMMITMENT, NOT A DISMISSAL. "Report an issue here" runs
    // `selectView("report")`, which empties the stack - the same observable event a Cancel produces.
    if (dismissal.view !== snapshot.view) return false
    // (2) THE PUBLISH-THEN-DISMISS TRAP. On a genuine dismissal the drop-pin entry is the TOP of the stack
    // that is going away. In the [drop-pin, cleanup] case it is buried UNDER the thing actually being
    // dismissed, and flying would yank the camera off the event the user just created. An empty
    // `previousStack` lands here too (`undefined !== "drop-pin"`), which is correct: nothing left the stack.
    if (dismissal.previousStack[dismissal.previousStack.length - 1]?.kind !== "drop-pin") return false
    // (3) NO MAP, NO RESTORE. Both seams clear the viewport on unmount, and a fly issued with no map queues
    // and replays onto the NEXT mount - a yank on a surface the user has already left.
    if (!dismissal.viewport) return false
    return true
  }
  ```

- [ ] **Step 4: Run it and watch it pass.**
  ```
  cd /Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui && pnpm vitest run src/map/__tests__/dropPinCamera.test.ts
  ```
  Expected: `src/map/__tests__/dropPinCamera.test.ts (49 tests)`, `Test Files 1 passed (1)` /
  `Tests 49 passed (49)` — the 40 pre-existing plus the 9 new ones.

- [ ] **Step 5: Commit.**
  ```
  git -C /Users/theobong/Documents/GitHub/civfix/civfix-shared add packages/ui/src/map/dropPinCamera.ts packages/ui/src/map/__tests__/dropPinCamera.test.ts
  git -C /Users/theobong/Documents/GitHub/civfix/civfix-shared commit -m "$(cat <<'EOF'
  feat(ui): drop-pin camera snapshot + the dismissal-vs-commitment predicate

  Adds DropPinCameraSnapshot / DropPinDismissal and shouldRestoreDropPinCamera to
  map/dropPinCamera.ts. It separates a real dismissal (Cancel, drag, map tap,
  Android back) from the two commitments that leave the stack by the same door:
  "Report an issue here" (selectView changes the view) and the [drop-pin, cleanup]
  publish trap, where stackAfterFlowPublished leaves the drop-pin entry buried
  under the event and it only departs as collateral much later.

  Still pure and still camera-free - the host owns the camera.

  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 2.2: the pan-and-zoom-cancels-restore rule, with a justified pixel tolerance

**Files:**
- Modify: `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/map/dropPinCamera.ts` (the `shouldRestoreDropPinCamera` body added in Task 2.1; add helpers + two constants above it)
- Test: `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/map/__tests__/dropPinCamera.test.ts` (edit the import; append after the Task 2.1 describe)

**Interfaces:**
- Consumes: `shouldRestoreDropPinCamera(snapshot: DropPinCameraSnapshot | null, dismissal: DropPinDismissal): boolean`, `DropPinCameraSnapshot`, `DropPinDismissal`, `worldPx(zoom: number): number` (Task 2.1 / existing).
- Produces: `DROP_PIN_PAN_TOLERANCE_PX: 12`, `DROP_PIN_PAN_ZOOM_TOLERANCE: 0.1` (both exported consts on `map/dropPinCamera.ts`). No signature change to the predicate.

**Why 12 px, and why pixels rather than degrees** (this is the justification the plan owes; it is also written into the module doc in Step 3). Every number below was computed, not estimated:

- **Floor — it is essentially free.** The only *legitimate* mismatch between the camera we asked for and the viewport the store reports is that `useMapViewport.center` is the arithmetic bbox midpoint (`mapViewportStore.ts:39-42`), not the Mercator camera centre. That is a second-order curvature term whose magnitude in screen pixels is `π · sin(lat) · H² / (4 · worldPx(z))`. On the 874 px-tall sim device at lat 37.77 that is **0.0055 px at z17** — measured, and matching the closed form to 7 significant figures. Across the whole existing `NOTCHED` table it is 0.0052–0.0062 px, and it stays under 0.011 px at any latitude on Earth at `z >= DROP_PIN_ZOOM`. So the floor does not constrain the choice at all; 12 px is a ~2,200x margin over it.
- **Ceiling — this is what actually sets the number.** A pan only begins after the platform's ~10 pt gesture slop, and a released drag then carries momentum, so the smallest camera translation a real pan can produce is ~10 pt and in practice tens. 12 px sits just above the slop: a finger that merely trembled does not cancel the restore, and any actual drag does.
- **The floor is only free at HIGH zoom, and one endpoint is not.** The curvature term scales as `1 / worldPx(z)`, i.e. it DOUBLES per zoom level out: 0.0055 px at z17, 0.18 px at z12, 2.8 px at z8, 11.2 px at z6, 22.2 px at z5. `flownTo` is always at `z >= DROP_PIN_ZOOM`, so it is never near the limit — but `from` is the PRE-PRESS camera and can be at any zoom. Below roughly **z6** the bbox-midpoint discrepancy alone can exceed 12 px, and a mid-fly dismissal from a continent-wide view would then be judged "panned" and the restore skipped. That is the CONSERVATIVE direction and the same direction the whole module commits to (a missing restore is a beat nobody notices; an unexplained camera move is the bug). It is called out here so nobody later reads a skipped restore at z4 as a defect.
- **Why not reuse `mapLifecycle`'s `SETTLED_COORDINATE_EPSILON = 0.0001` deg** (`civfix-mobile/apps/community-mobile/src/lib/mapLifecycle.ts:106`). That is a *zoom-blind degree* tolerance, sized for the worst case at LOW zoom where the same curvature term really is degrees-scale. At z17 it is 18.6 px of longitude and 23.6 px of latitude (measured at lat 37.77) — 6–7% of the 328 px strip a MID sheet leaves on the sim device (`874 - 487 - 59`), i.e. a visibly panned map. A pixel tolerance can be an order of magnitude tighter at the drop-pin zoom without becoming flaky. `DROP_PIN_PAN_ZOOM_TOLERANCE` **is** the same `0.1` as `mapLifecycle.ts:107`'s `SETTLED_ZOOM_EPSILON`, on the rule that anything the host calls "arrived" must never be called "panned"; a pinch trivially exceeds it. It is RESTATED as a literal, not imported: that constant lives in `civfix-mobile` (which `@civfix/ui` must not import) and is module-private there anyway.
- **Two endpoints, each gated on its own zoom.** `Map.native.tsx`'s `handleRegion` publishes to `useMapViewport` at :228 and is wired to `onRegionDidChange` — the SETTLE event — at :360; `onRegionIsChanging` (`handleRegionChanging`) deliberately does not write the store, and the only other publish is the one-shot `handleMapLoad` at :251. There is therefore no continuous publish, so a dismissal that lands *during* the drop-pin fly finds the store still holding the PRE-press camera — `snapshot.from` itself. Measuring only against `flownTo` would read that as a pan of at least the 214 px sheet offset (`(487 - 59) / 2` on the sim device, and more once the press is off-centre or the zoom changed) and silently drop the restore for the fastest, most common dismissal there is (long-press, change your mind, tap the map). So the viewport must be *explained* by either endpoint — but each endpoint must match on **zoom as well as position**, or a wide `from` (say z13) would launder a real pan: 160 px at z17 is only 10 px in z13's world.

---

- [ ] **Step 1: Write the failing test.**
  Extend the import at the top of `packages/ui/src/map/__tests__/dropPinCamera.test.ts` (the block edited in Task 2.1) to:
  ```ts
  import {
    DROP_PIN_PAN_TOLERANCE_PX,
    DROP_PIN_PAN_ZOOM_TOLERANCE,
    DROP_PIN_ZOOM,
    dropPinCameraTarget,
    shouldRestoreDropPinCamera,
    worldPx,
    type DropPinCameraSnapshot,
    type DropPinCameraTarget,
    type DropPinDismissal,
  } from "../dropPinCamera"
  ```
  Append this to the END of the file, after the Task 2.1 describe:
  ```ts
  /** The inverse of `mercY` (maplibre's `latFromMercatorY`), re-derived for the same reason `mercY` is. */
  const latFromMercY = (y: number) => {
    const y2 = 180 - y * 360
    return (360 / Math.PI) * Math.atan(Math.exp((y2 * Math.PI) / 180)) - 90
  }

  /** Move a camera EAST by `px` screen pixels at its own zoom. Mercator X is linear, so this is exact. */
  const nudgeEastPx = (camera: DropPinCameraTarget, px: number) => ({
    center: { lat: camera.lat, lng: camera.lng + (px / worldPx(camera.zoom)) * 360 },
    zoom: camera.zoom,
  })

  /** Move a camera SOUTH by `px` screen pixels at its own zoom (the inverse of the module's own shift). */
  const nudgeSouthPx = (camera: DropPinCameraTarget, px: number) => ({
    center: {
      lat: latFromMercY(mercY(camera.lat) + px / worldPx(camera.zoom)),
      lng: camera.lng,
    },
    zoom: camera.zoom,
  })

  describe("shouldRestoreDropPinCamera: a pan or zoom while the menu is open CANCELS the restore", () => {
    it("pins the tolerance at 12 SCREEN px - 6.4373e-5 deg of longitude at z17", () => {
      expect(DROP_PIN_PAN_TOLERANCE_PX).toBe(12)
      expect((DROP_PIN_PAN_TOLERANCE_PX / worldPx(17)) * 360).toBeCloseTo(6.4373e-5, 9)
    })

    it("tolerates a sub-threshold nudge in BOTH axes (settle noise, not intent)", () => {
      for (const viewport of [nudgeEastPx(FLOWN, 11), nudgeSouthPx(FLOWN, 11), nudgeEastPx(FLOWN, -11)]) {
        expect(shouldRestoreDropPinCamera(snapshot(), dismissal({ viewport }))).toBe(true)
      }
    })

    it("cancels on a deliberate pan in BOTH axes", () => {
      for (const viewport of [nudgeEastPx(FLOWN, 13), nudgeSouthPx(FLOWN, 13), nudgeEastPx(FLOWN, -40)]) {
        expect(shouldRestoreDropPinCamera(snapshot(), dismissal({ viewport }))).toBe(false)
      }
    })

    it("measures SCREEN PIXELS, not degrees: the same degree delta passes at z17 and fails at z20", () => {
      // 4 px at z17 ...
      const degrees = (4 / worldPx(17)) * 360
      const at17: DropPinCameraTarget = { ...FLOWN, zoom: 17 }
      expect(
        shouldRestoreDropPinCamera(
          snapshot({ flownTo: at17 }),
          dismissal({ viewport: { center: { lat: at17.lat, lng: at17.lng + degrees }, zoom: 17 } }),
        ),
      ).toBe(true)
      // ... is 32 px at z20, where the map is 8x more magnified: the SAME degrees are now a real pan.
      const at20: DropPinCameraTarget = { ...FLOWN, zoom: 20 }
      expect(
        shouldRestoreDropPinCamera(
          snapshot({ flownTo: at20 }),
          dismissal({ viewport: { center: { lat: at20.lat, lng: at20.lng + degrees }, zoom: 20 } }),
        ),
      ).toBe(false)
    })

    it("cancels on a pinch - a zoom delta past 0.1 is a deliberate camera move", () => {
      expect(
        shouldRestoreDropPinCamera(
          snapshot(),
          dismissal({ viewport: { ...parkedOn(FLOWN), zoom: FLOWN.zoom + 0.4 } }),
        ),
      ).toBe(false)
    })

    it("tolerates the host's own arrival slop - mapLifecycle's SETTLED_ZOOM_EPSILON is the same 0.1", () => {
      // Anything the host calls "arrived" must never be called "panned", or the restore silently vanishes.
      expect(DROP_PIN_PAN_ZOOM_TOLERANCE).toBe(0.1)
      expect(
        shouldRestoreDropPinCamera(
          snapshot(),
          dismissal({ viewport: { ...parkedOn(FLOWN), zoom: FLOWN.zoom - 0.09 } }),
        ),
      ).toBe(true)
    })

    it("restores when the viewport is still on the PRE-PRESS camera (dismissed MID-FLY)", () => {
      // Map.native publishes to useMapViewport only on settle (handleRegion at :228, wired to
      // onRegionDidChange at :360), so a long press followed immediately by a map tap finds the store still
      // holding the camera we are about to restore TO. Measuring only against `flownTo` would read that as a
      // 214px-or-worse pan and drop the restore for the fastest, most common dismissal there is.
      expect(shouldRestoreDropPinCamera(snapshot(), dismissal({ viewport: parkedOn(FROM) }))).toBe(true)
    })

    it("does NOT let a LOW-ZOOM pre-press camera launder a pan at the drop-pin zoom", () => {
      // The dangerous shape: `from` at z13 is 16x less magnified, so a 160px pan at z17 is only 10px in
      // z13's world - inside the tolerance. Each endpoint must therefore match on ZOOM as well as position.
      const nearbyWideFrom: DropPinCameraTarget = { lat: FLOWN.lat, lng: FLOWN.lng, zoom: 13 }
      expect(
        shouldRestoreDropPinCamera(
          snapshot({ from: nearbyWideFrom }),
          dismissal({ viewport: nudgeEastPx(FLOWN, 160) }),
        ),
      ).toBe(false)
    })

    it("measures the SHORTEST way round the antimeridian, not the long way", () => {
      // A camera on the dateline with the viewport reported 8px EAST of it, which maplibre wraps to a
      // NEGATIVE longitude. A naive subtraction reads that as ~360 deg and would cancel every restore there.
      const atDateline: DropPinCameraTarget = { lat: 0, lng: 179.99998, zoom: 17 }
      const wrapped = {
        center: { lat: 0, lng: atDateline.lng + (8 / worldPx(17)) * 360 - 360 },
        zoom: 17,
      }
      expect(wrapped.center.lng).toBeLessThan(-179.9)
      expect(
        shouldRestoreDropPinCamera(snapshot({ flownTo: atDateline }), dismissal({ viewport: wrapped })),
      ).toBe(true)
    })

    it("fails CLOSED on a non-finite viewport rather than flying somewhere undefined", () => {
      for (const viewport of [
        { center: { lat: Number.NaN, lng: FLOWN.lng }, zoom: FLOWN.zoom },
        { center: { lat: FLOWN.lat, lng: Number.POSITIVE_INFINITY }, zoom: FLOWN.zoom },
        { center: { lat: FLOWN.lat, lng: FLOWN.lng }, zoom: Number.NaN },
      ]) {
        expect(shouldRestoreDropPinCamera(snapshot(), dismissal({ viewport }))).toBe(false)
      }
    })

    it("THE TOLERANCE FLOOR: the bbox-midpoint source is a rounding error at the drop-pin zoom", () => {
      // `useMapViewport.center` is the ARITHMETIC bbox midpoint (mapViewportStore.ts:39-42), not the
      // Mercator camera centre. The gap is a second-order curvature term, pi*sin(lat)*H^2/(4*worldPx(z)) px,
      // which on the sim device (874px tall) at z17 is 0.0055px - so 12px is a ~2200x margin. THAT is why a
      // pixel tolerance can be an order of magnitude tighter than mapLifecycle's zoom-blind 1e-4-DEGREE
      // settle epsilon (18.6-23.6px at z17) without becoming flaky. The bound below is 0.02px, ~3.6x the
      // measured value: tight enough that a regression to a degrees-based or zoom-blind source fails here.
      const halfHeight = WINDOW_H / 2
      const north = latFromMercY(mercY(FLOWN.lat) - halfHeight / worldPx(17))
      const south = latFromMercY(mercY(FLOWN.lat) + halfHeight / worldPx(17))
      const midpoint = (north + south) / 2
      expect(Math.abs(mercY(midpoint) - mercY(FLOWN.lat)) * worldPx(17)).toBeLessThan(0.02)
      expect(
        shouldRestoreDropPinCamera(
          snapshot(),
          dismissal({ viewport: { center: { lat: midpoint, lng: FLOWN.lng }, zoom: 17 } }),
        ),
      ).toBe(true)
    })
  })
  ```

- [ ] **Step 2: Run it and watch it fail.**
  ```
  cd /Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui && pnpm vitest run src/map/__tests__/dropPinCamera.test.ts
  ```
  Expected: `Tests 7 failed | 53 passed (60)`. The SEVEN genuine reds — these are the TDD drivers:
  1. `pins the tolerance at 12 SCREEN px` → `AssertionError: expected undefined to be 12 // Object.is equality` (the constant does not exist yet)
  2. `cancels on a deliberate pan in BOTH axes` → `expected true to be false`
  3. `measures SCREEN PIXELS, not degrees` → `expected true to be false` (the z20 half)
  4. `cancels on a pinch` → `expected true to be false`
  5. `tolerates the host's own arrival slop` → `expected undefined to be 0.1`
  6. `does NOT let a LOW-ZOOM pre-press camera launder a pan` → `expected true to be false`
  7. `fails CLOSED on a non-finite viewport` → `expected true to be false`

  The other FOUR new cases — `tolerates a sub-threshold nudge`, `restores when the viewport is still on the
  PRE-PRESS camera`, `measures the SHORTEST way round the antimeridian`, `THE TOLERANCE FLOOR` — pass here,
  because Task 2.1's predicate returns `true` for any dismissal that has a viewport. **They are REGRESSION
  GUARDS for the tolerance's floor, not TDD drivers**, and they are stated as such on purpose: their job is
  to fail if Step 3's implementation makes the tolerance too tight, mishandles the antimeridian wrap, or
  measures against `flownTo` only. Do not treat their green at this step as a signal about the feature; the
  seven above are the signal.

- [ ] **Step 3: Minimal implementation.**
  In `packages/ui/src/map/dropPinCamera.ts`, insert these constants and helpers immediately **above** `shouldRestoreDropPinCamera` (i.e. after the `DropPinDismissal` interface added in Task 2.1):
  ```ts
  /**
   * How far the camera may sit from where the APP put it and still count as "unmoved", in SCREEN PIXELS.
   *
   * PIXELS, NOT DEGREES, and it is not a taste call:
   *
   *   FLOOR (essentially free). The only legitimate mismatch is that `useMapViewport.center` is the
   *   ARITHMETIC bbox midpoint (mapViewportStore.ts:39-42), not the Mercator camera centre. That gap is a
   *   second-order curvature term, `pi * sin(lat) * H^2 / (4 * worldPx(z))` px - which at the drop-pin's
   *   guaranteed `z >= DROP_PIN_ZOOM` is 0.0055px on an 874px-tall phone at lat 37.77, 0.0052-0.0062px
   *   across `dropPinCamera.test.ts`'s NOTCHED table, and under 0.011px at ANY latitude. 12 is a ~2200x
   *   margin over it, so the floor does not pick the number.
   *
   *   CEILING (this does pick it). A pan only begins past the platform's ~10pt gesture slop, and a released
   *   drag carries momentum, so the smallest camera translation a real pan produces is ~10pt and in practice
   *   tens. 12 sits just above the slop: a trembling finger does not cancel the restore, any actual drag
   *   does.
   *
   *   THE ONE PLACE THE FLOOR BITES. The curvature term DOUBLES per zoom level out (0.18px at z12, 2.8px at
   *   z8, 11.2px at z6, 22.2px at z5). `flownTo` is always at the drop-pin zoom, but `from` is the PRE-PRESS
   *   camera and may be anywhere - so below about z6 a mid-fly dismissal from a continent-wide view can be
   *   read as a pan and the restore skipped. That is the conservative direction and is intentional; see
   *   {@link shouldRestoreDropPinCamera}'s doc.
   *
   *   WHY NOT mapLifecycle's SETTLED_COORDINATE_EPSILON (1e-4 deg). That is a ZOOM-BLIND DEGREE tolerance
   *   sized for the worst case at LOW zoom, where the same curvature term really is degrees-scale; at z17 it
   *   is 18.6px of longitude and 23.6px of latitude, i.e. 6-7% of the 328px strip a MID sheet leaves on the
   *   sim device - a visibly panned map.
   */
  export const DROP_PIN_PAN_TOLERANCE_PX = 12

  /**
   * How far the zoom may drift and still count as "unmoved". Deliberately the SAME 0.1 as
   * `SETTLED_ZOOM_EPSILON` in civfix-mobile's `src/lib/mapLifecycle.ts:107`, on the rule that anything the
   * host is willing to call "the camera ARRIVED at the target" must never be called "the user PANNED". A
   * pinch trivially exceeds it. RESTATED as a literal rather than imported: that constant lives in the app
   * repo (which @civfix/ui must not import) and is module-private there.
   */
  export const DROP_PIN_PAN_ZOOM_TOLERANCE = 0.1

  /** Signed shortest longitude delta in degrees: a -179.9 -> +179.9 step is 0.2 deg, not 359.8. */
  function lngDelta(a: number, b: number): number {
    return ((a - b + 540) % 360) - 180
  }

  /**
   * Does `camera` still EXPLAIN the observed viewport - same zoom, and within
   * {@link DROP_PIN_PAN_TOLERANCE_PX} screen px at that zoom?
   *
   * The zoom test is not decoration. A wide `snapshot.from` (say z13) is 16x less magnified than the
   * drop-pin camera, so a 160px pan at z17 is only 10px in z13's world - inside the tolerance. Without the
   * zoom gate the wide snapshot would LAUNDER a real pan into "unmoved".
   */
  function explainsViewport(
    camera: DropPinCameraTarget,
    viewport: { center: { lat: number; lng: number }; zoom: number },
  ): boolean {
    const values = [
      camera.lat,
      camera.lng,
      camera.zoom,
      viewport.center.lat,
      viewport.center.lng,
      viewport.zoom,
    ]
    // Fail CLOSED: a non-finite input means we cannot tell, and an unexplained camera move is worse than a
    // missing one (see the `shouldRestoreDropPinCamera` doc).
    if (!values.every((value) => Number.isFinite(value))) return false
    if (Math.abs(viewport.zoom - camera.zoom) > DROP_PIN_PAN_ZOOM_TOLERANCE) return false
    const world = worldPx(camera.zoom)
    const dy = (mercatorYfromLat(viewport.center.lat) - mercatorYfromLat(camera.lat)) * world
    const dx = (lngDelta(viewport.center.lng, camera.lng) / 360) * world
    return Math.hypot(dx, dy) <= DROP_PIN_PAN_TOLERANCE_PX
  }
  ```
  Then replace the final `return true` of `shouldRestoreDropPinCamera` (added in Task 2.1) with:
  ```ts
    // (4) A PAN OR ZOOM WHILE THE MENU WAS OPEN CANCELS THE RESTORE. The strip of map above the MID sheet is
    // live and pannable; moving it is deliberate and must be respected. The test is "is the camera still
    // where the APP last put it" - and there are TWO such places, because `Map.native.tsx`'s `handleRegion`
    // (:228) is wired to `onRegionDidChange` (:360), the SETTLE event, and nothing publishes continuously:
    // a dismissal that lands DURING the drop-pin fly still finds the PRE-press camera in the store.
    // Comparing against `flownTo` alone would read that as a 214px-or-worse pan and silently drop the
    // restore for the fastest dismissal there is.
    return (
      explainsViewport(snapshot.flownTo, dismissal.viewport) ||
      explainsViewport(snapshot.from, dismissal.viewport)
    )
  ```
  (Note: `mercatorYfromLat` is already private in this module at line 86 — reuse it, do not re-derive.)

- [ ] **Step 4: Run it and watch it pass.**
  ```
  cd /Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui && pnpm vitest run src/map/__tests__/dropPinCamera.test.ts
  ```
  Expected: `src/map/__tests__/dropPinCamera.test.ts (60 tests)`, `Test Files 1 passed (1)` /
  `Tests 60 passed (60)` (40 pre-existing + 9 from Task 2.1 + 11 here).

- [ ] **Step 5: Commit.**
  ```
  git -C /Users/theobong/Documents/GitHub/civfix/civfix-shared add packages/ui/src/map/dropPinCamera.ts packages/ui/src/map/__tests__/dropPinCamera.test.ts
  git -C /Users/theobong/Documents/GitHub/civfix/civfix-shared commit -m "$(cat <<'EOF'
  feat(ui): a pan or zoom while the drop-pin menu is open cancels the camera restore

  The tolerance is 12 SCREEN PIXELS, not degrees. Floor: the bbox-midpoint source
  differs from the true Mercator centre by pi*sin(lat)*H^2/(4*worldPx(z)), which is
  0.0055px at the drop-pin's guaranteed z >= 17, so the floor is free and the
  ~10pt gesture slop is what actually sets 12. mapLifecycle's zoom-blind 1e-4-deg
  settle epsilon is 18.6-23.6px at z17 - 6-7% of the visible strip - so it is the
  wrong instrument here; its ZOOM epsilon (0.1) is matched, because "arrived" must
  never read as "panned".

  The viewport must be explained by EITHER endpoint of the fly, each gated on its
  own zoom: Map.native publishes only on settle, so a dismissal mid-fly still finds
  the pre-press camera in the store, and a wide `from` must not launder a real pan.

  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 2.3: arm the snapshot, register the host camera seam, fire from `armDropPinCleanup`

**Files:**
- Modify: `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/map/dropPinFlow.ts` (imports at lines 40-41; `unsubscribeDropPin` at lines 43-44; `armDropPinCleanup` + its doc at lines 46-61; `disarmDropPinCleanup` + its doc at lines 63-68 — the file is 119 lines and `openDropPinMenu` at 70-119 is untouched)
- Modify: `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/map/index.ts` (lines 49-53, the drop-pin export block; the file is 53 lines)
- Test: `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/map/__tests__/dropPinFlow.test.ts` (imports at lines 24-28; `beforeEach`/`afterEach` at lines 47-57; append after line 143, the last line of the file)

**Interfaces:**
- Consumes: `shouldRestoreDropPinCamera(snapshot: DropPinCameraSnapshot | null, dismissal: DropPinDismissal): boolean`, `DropPinCameraSnapshot`, `DropPinCameraTarget` (Tasks 2.1/2.2); `useMapViewport` (`map/mapViewportStore.ts:62`); `useNavStore`, `useDroppedPin`, `isFlowKind` (already imported by the module).
- Produces:
  - `type DropPinCameraRestorer = (target: DropPinCameraTarget) => void`
  - `setDropPinCameraRestorer(restore: DropPinCameraRestorer | null): void`
  - `captureDropPinCamera(snapshot: DropPinCameraSnapshot, menuAlreadyOpen: boolean): void`
  - `disarmDropPinCleanup(): void` — unchanged signature, now ALSO drops the armed snapshot.

---

- [ ] **Step 1: Write the failing test.**
  Replace the import block at lines 24-28 of `packages/ui/src/map/__tests__/dropPinFlow.test.ts` with:
  ```ts
  import { afterEach, beforeEach, describe, expect, it } from "vitest"
  import { useNavStore } from "../../nav"
  import type { DetailEntry } from "../../nav"
  import { stackAfterFlowPublished } from "../../bodies/composerCreateFlow"
  import { useDroppedPin, type DroppedPin } from "../droppedPinStore"
  import { useMapViewport } from "../mapViewportStore"
  import { dropPinCameraTarget, type DropPinCameraTarget } from "../dropPinCamera"
  import {
    armDropPinCleanup,
    captureDropPinCamera,
    disarmDropPinCleanup,
    openDropPinMenu,
    setDropPinCameraRestorer,
  } from "../dropPinFlow"
  ```
  Replace the `beforeEach`/`afterEach` at lines 47-57 with:
  ```ts
  beforeEach(() => {
    // The cleanup subscription is a MODULE-level singleton; leaving one armed would let a later test's nav
    // mutation clear the pin mid-assertion. `disarmDropPinCleanup` also drops the armed camera snapshot.
    disarmDropPinCleanup()
    setDropPinCameraRestorer(null)
    seedNav([])
    useDroppedPin.setState({ pin: null })
    useMapViewport.setState({ viewport: null })
  })

  afterEach(() => {
    disarmDropPinCleanup()
    setDropPinCameraRestorer(null)
  })
  ```
  Append to the END of the file (after line 143):
  ```ts

  // --- THE CAMERA RESTORE ---------------------------------------------------------------------------
  //
  // `armDropPinCleanup` is the ONE subscription that already fires exactly once when the drop-pin entry
  // leaves the stack, covering every dismissal route including the ones that never enter DropPinBody (sheet
  // drag, map tap, Android back). The restore rides it. THE HOST OWNS THE CAMERA (dropPinCamera.ts:64-68),
  // so the module calls a host-registered callback and never touches maplibre - which is also what makes
  // this testable with no renderer.

  /** The sim device's geometry - the same numbers `dropPinCamera.test.ts` measures against. */
  const SIM = { windowHeight: 874, sheetTopReserve: 91, topInset: 59 } as const

  /** Where the map was before any of this: a wide view of a different part of LA. */
  const ORIGIN: DropPinCameraTarget = { lat: 34.1, lng: -118.3, zoom: 12 }

  /** Publish a settled map camera exactly as both Map seams do via `useMapViewport.setRegion`. */
  function publishViewport(camera: DropPinCameraTarget): void {
    useMapViewport.setState({
      viewport: {
        center: { lat: camera.lat, lng: camera.lng },
        zoom: camera.zoom,
        bbox: {
          north: camera.lat + 0.01,
          south: camera.lat - 0.01,
          east: camera.lng + 0.01,
          west: camera.lng - 0.01,
        },
      },
    })
  }

  /**
   * Replay the mobile host's `onLongPressMap`: read the pre-press camera and the already-open guard BEFORE
   * `openDropPinMenu`, compute the target from the detent the sheet SETTLED at, arm the snapshot, then fly
   * (publishing the new camera the way a settle would). Returns the camera it flew to.
   */
  function longPress(lat: number, lng: number, from: DropPinCameraTarget): DropPinCameraTarget {
    const nav = useNavStore.getState()
    const menuAlreadyOpen = nav.stack.some((entry) => entry.kind === "drop-pin")
    const view = nav.view
    publishViewport(from)
    expect(openDropPinMenu(lat, lng)).toBe(true)
    const flownTo = dropPinCameraTarget({
      lat,
      lng,
      currentZoom: from.zoom,
      ...SIM,
      sheetDetent: useNavStore.getState().snap,
      mode: "compact",
    })
    captureDropPinCamera({ from, flownTo, view }, menuAlreadyOpen)
    publishViewport(flownTo)
    return flownTo
  }

  /** Collect every camera the flow asks the host to fly. */
  function recordRestores(): DropPinCameraTarget[] {
    const restored: DropPinCameraTarget[] = []
    setDropPinCameraRestorer((target) => restored.push(target))
    return restored
  }

  describe("armDropPinCleanup: the camera restore", () => {
    it("flies the host back to the PRE-PRESS camera on Cancel", () => {
      const restored = recordRestores()
      longPress(34.05, -118.25, ORIGIN)
      // DropPinBody.onCancel (DropPinBody.tsx:132): nav.back().
      useNavStore.getState().back()
      expect(restored).toEqual([ORIGIN])
    })

    it("clears the marker BEFORE it flies, so both land on one frame", () => {
      const seen: (DroppedPin | null)[] = []
      setDropPinCameraRestorer(() => seen.push(useDroppedPin.getState().pin))
      longPress(34.05, -118.25, ORIGIN)
      useNavStore.getState().back()
      expect(seen).toEqual([null])
    })

    it("fires EXACTLY ONCE - collapseToParent is reachable from four routes", () => {
      const restored = recordRestores()
      longPress(34.05, -118.25, ORIGIN)
      useNavStore.getState().back()
      useNavStore.getState().collapseToParent()
      useNavStore.getState().collapseToParent()
      expect(restored).toEqual([ORIGIN])
    })

    it("restores on a sheet drag-down too (collapseToParent, not back)", () => {
      const restored = recordRestores()
      longPress(34.05, -118.25, ORIGIN)
      useNavStore.getState().collapseToParent()
      expect(restored).toEqual([ORIGIN])
    })

    it("does NOT restore on 'Report an issue here' - selectView('report') is a commitment", () => {
      const restored = recordRestores()
      longPress(34.05, -118.25, ORIGIN)
      useNavStore.getState().selectView("report")
      expect(useDroppedPin.getState().pin).toBeNull()
      expect(restored).toEqual([])
    })

    it("does NOT restore on the [drop-pin, cleanup] publish-then-dismiss trap", () => {
      const restored = recordRestores()
      longPress(34.05, -118.25, ORIGIN)
      // "Host an event here": a drill-down ON TOP of the menu, so the pin and the snapshot stay armed.
      useNavStore.getState().push({ kind: "create-cleanup", lat: 34.05, lng: -118.25 })
      expect(useDroppedPin.getState().pin).not.toBeNull()
      // Publish: stackAfterFlowPublished replaces the FLOW entry with the created event and leaves the
      // drop-pin entry underneath - which is why CreateCleanupBody clears the marker by hand there.
      const published = stackAfterFlowPublished(useNavStore.getState().stack, {
        kind: "cleanup",
        id: "c1",
      })
      expect(published?.map((entry) => entry.kind)).toEqual(["drop-pin", "cleanup"])
      useNavStore.getState().setStack(published!)
      useDroppedPin.getState().clear()
      publishViewport({ lat: 34.05, lng: -118.25, zoom: 17 })
      // Minutes later the user drags the EVENT detail away; the drop-pin entry leaves as collateral.
      useNavStore.getState().collapseToParent()
      expect(useNavStore.getState().stack).toEqual([])
      expect(restored).toEqual([])
    })

    it("does NOT restore after a pan while the menu was open", () => {
      const restored = recordRestores()
      const flownTo = longPress(34.05, -118.25, ORIGIN)
      // The strip of map above the MID sheet is live: 0.002 deg of longitude is 373px at z17.
      publishViewport({ ...flownTo, lng: flownTo.lng + 0.002 })
      useNavStore.getState().back()
      expect(restored).toEqual([])
    })

    it("a SECOND long press keeps the FIRST pre-press camera and re-points the pan check", () => {
      // "drop-pin" is not a FLOW_KIND, so a second long press is ACCEPTED and openDetail replaces the entry.
      // The pre-press camera must not be overwritten with the first fly's - but `flownTo` MUST be, or the
      // pan check compares the live viewport against a camera the app has already left.
      const restored = recordRestores()
      const first = longPress(34.05, -118.25, ORIGIN)
      const second = longPress(34.07, -118.27, first)
      expect(second.lng).not.toBe(first.lng)
      expect(useNavStore.getState().stack).toHaveLength(1)
      useNavStore.getState().back()
      expect(restored).toEqual([ORIGIN])
    })

    it("does not throw when no host registered a restorer (web, today)", () => {
      setDropPinCameraRestorer(null)
      longPress(34.05, -118.25, ORIGIN)
      expect(() => useNavStore.getState().back()).not.toThrow()
      expect(useDroppedPin.getState().pin).toBeNull()
    })

    it("does not restore when nothing was captured (a press with no map viewport)", () => {
      const restored = recordRestores()
      expect(openDropPinMenu(34.05, -118.25)).toBe(true)
      useNavStore.getState().back()
      expect(restored).toEqual([])
    })

    it("disarmDropPinCleanup DROPS the snapshot, so a stale one cannot outlive the subscription", () => {
      const restored = recordRestores()
      longPress(34.05, -118.25, ORIGIN)
      disarmDropPinCleanup()
      armDropPinCleanup()
      useNavStore.getState().back()
      expect(restored).toEqual([])
    })
  })
  ```

- [ ] **Step 2: Run it and watch it fail.**
  ```
  cd /Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui && pnpm vitest run src/map/__tests__/dropPinFlow.test.ts
  ```
  Expected: `Tests 23 failed (23)` / `Test Files 1 failed (1)`. The file COLLECTS fine (a missing named
  export resolves to `undefined` under vite's SSR transform, it does not throw at import); every test then
  fails in the shared `beforeEach` with `TypeError: setDropPinCameraRestorer is not a function`, pointed at
  the `setDropPinCameraRestorer(null)` line of the hook. That includes the 12 pre-existing tests — the hook
  is file-level, so they go red too until Step 3 lands. That is expected, not a regression.

- [ ] **Step 3: Minimal implementation.**
  Replace lines 40-44 of `packages/ui/src/map/dropPinFlow.ts` — the two-line import block, the blank line, and the `unsubscribeDropPin` doc + declaration — with:
  ```ts
  import { useNavStore, isFlowKind, type DetailEntry } from "../nav"
  import { useDroppedPin } from "./droppedPinStore"
  import { useMapViewport } from "./mapViewportStore"
  import {
    shouldRestoreDropPinCamera,
    type DropPinCameraSnapshot,
    type DropPinCameraTarget,
  } from "./dropPinCamera"

  /** Live nav subscription while a drop-pin menu is on the stack; null when disarmed. */
  let unsubscribeDropPin: (() => void) | null = null

  // ----- THE HOST CAMERA SEAM -----
  //
  // A module singleton, not a prop and not a hook - the same shape mobile registers its capture surface with
  // (`setCameraNavigator`, civfix-mobile/apps/community-mobile/src/lib/nativeCamera.ts:40) and the same
  // shape the composer's event-form presenter uses (bodies/composerCreateFlow.ts:186). The reason is
  // identical: this module is reached from FOUR dismissal routes and two hosts, only the APP owns a
  // generation-guarded camera, and that fact is constant for the whole app lifetime rather than per-render.
  //
  // THE SHARED PACKAGE MUST NOT TOUCH THE CAMERA (dropPinCamera.ts:64-68). It hands the host a CENTRE and
  // the host flies it through its own guarded path - which for civfix-mobile means its screen-local
  // `flyTo(lng, lat, zoom)` (app/index.tsx:267-279 - LNG FIRST), NOT `MapHandle.flyTo(lat, lng, zoom)`
  // (map/types.ts:140 - LAT first). `null` (nobody registered) is the normal state on civfix-web today,
  // where the restore simply no-ops.

  /** How the host flies its own generation-guarded camera back to a centre. */
  export type DropPinCameraRestorer = (target: DropPinCameraTarget) => void

  let restoreCamera: DropPinCameraRestorer | null = null

  /** Register (or, with `null`, unregister) the host's camera. Call once from the screen that owns the map. */
  export function setDropPinCameraRestorer(restore: DropPinCameraRestorer | null): void {
    restoreCamera = restore
  }

  /**
   * The camera armed for the CURRENT drop-pin menu, or null when none is armed.
   *
   * It lives here, as a module `let`, rather than in `droppedPinStore` or a store of its own, because it has
   * EXACTLY the subscription's lifetime - armed by the same long press, consumed by the same fire, dropped
   * by `disarmDropPinCleanup` - so any other home would be a second lifetime to keep in sync. It is also not
   * a rendering value: nothing subscribes to it. (Putting it on `droppedPinStore` would additionally churn
   * both map seams' marker subtrees on a value neither seam draws - see that module's header.)
   */
  let cameraSnapshot: DropPinCameraSnapshot | null = null

  /**
   * Arm the pre-press camera for a drop-pin long press. The HOST calls this from `onLongPressMap`, AFTER
   * `openDropPinMenu` returned true (so `flownTo` is the target for the detent the sheet ACTUALLY settled
   * at) and BEFORE it flies.
   *
   * `menuAlreadyOpen` is the host's read of "was a drop-pin entry already on the stack", taken BEFORE
   * `openDropPinMenu` - afterwards there always is one. It matters because "drop-pin" is NOT a FLOW_KIND, so
   * a SECOND long press while the menu is open is accepted and `openDetail` simply REPLACES the entry,
   * re-running the whole handler. When that happens the pre-press camera must be KEPT (the first press is
   * still where the user was) while `flownTo` is RE-POINTED at the new fly - otherwise the pan check would
   * compare the live viewport against a camera the app has already flown away from and read its own second
   * fly as a user pan.
   */
  export function captureDropPinCamera(
    snapshot: DropPinCameraSnapshot,
    menuAlreadyOpen: boolean,
  ): void {
    cameraSnapshot =
      menuAlreadyOpen && cameraSnapshot
        ? { ...cameraSnapshot, flownTo: snapshot.flownTo }
        : snapshot
  }
  ```
  Then replace `armDropPinCleanup` and `disarmDropPinCleanup` — at HEAD these are lines 46-68, i.e.
  everything from the `/**` that begins `* Arm the ONE nav-store subscription that clears the dropped pin`
  through the closing `}` of `disarmDropPinCleanup` immediately above the `openDropPinMenu` doc block. (After
  the edit above those anchors have moved down; match on the text, not the numbers.) Replace with:
  ```ts
  /**
   * Arm the ONE nav-store subscription that clears the dropped pin - and, when the pull-up was genuinely
   * DISMISSED rather than acted on, restores the camera - as the drop-pin menu leaves the stack (Cancel, the
   * back chip, a sheet collapse to peek, a map tap, Android hardware back, or "Report an issue here"
   * selecting the report view). Idempotent: re-arming while already armed is a no-op, so a StrictMode
   * double-mount cannot double-clear.
   *
   * Pushing `create-cleanup` on TOP of the menu leaves the drop-pin entry on the stack, so the coral pin
   * stays painted under the host form - which is the point of the drill-down verb in DropPinBody.onHost.
   *
   * WHY THE RESTORE FIRES ON THE STORE EVENT AND NOT ON THE SHEET'S `onClosed`. Three reasons, in order:
   *   1. `onClosed` is not reachable from here. It is a local closure inside the shell's presence gate
   *      (shell/PortraitShell.shared.tsx:149-152, handed down to CompactShell at :237) and is never
   *      published outward; wiring it would thread a camera concern through AppShell -> PortraitShellFrame
   *      -> CompactShell, against the standing contract that the shell does not participate in camera
   *      decisions.
   *   2. On native it is not even guaranteed - `theme.motion.sheetTeardownGuardMs` (300ms) exists precisely
   *      as a safety net for a MISSED gorhom `onClose` (PortraitShell.shared.tsx:134-148). A restore hung
   *      off it inherits that failure mode; this one cannot.
   *   3. The marker is cleared synchronously HERE. Deferring the camera by theme.motion.sheetDismiss (180ms)
   *      would leave the map parked on a drop-pin camera with no drop pin on it - a visible dead beat. On the
   *      same notification, the marker leaving and the camera moving are one gesture, and maplibre's own
   *      eased fly overlaps the card's slide rather than following it.
   */
  export function armDropPinCleanup(): void {
    if (unsubscribeDropPin) return
    unsubscribeDropPin = useNavStore.subscribe((state, previous) => {
      if (state.stack.some((entry) => entry.kind === "drop-pin")) return
      // Decide BEFORE disarming: `disarmDropPinCleanup` drops the snapshot along with the subscription.
      const snapshot = cameraSnapshot
      const restore = shouldRestoreDropPinCamera(snapshot, {
        // zustand hands the PREVIOUS state to every listener, which is the only thing that separates a real
        // dismissal ([.., drop-pin] going away) from the [drop-pin, cleanup] publish trap, where the pin
        // entry is buried under the detail actually being dismissed.
        previousStack: previous.stack,
        view: state.view,
        viewport: useMapViewport.getState().viewport,
      })
      disarmDropPinCleanup()
      useDroppedPin.getState().clear()
      // THE HOST OWNS THE CAMERA (dropPinCamera.ts:64-68): never maplibre from here, only the callback the
      // host registered, which routes through ITS generation-guarded flyTo. Ordered after the pin clear so
      // the marker and the camera move on the same frame. No restorer registered (civfix-web today) simply
      // no-ops - the pin still clears.
      if (restore && snapshot) restoreCamera?.(snapshot.from)
    })
  }

  /**
   * Tear the subscription down without touching the pin (also used internally once it has fired), and DROP
   * the armed camera snapshot with it - the two have one lifetime, and a snapshot that outlived its
   * subscription would arm the NEXT dismissal with a camera from a menu the user already left.
   */
  export function disarmDropPinCleanup(): void {
    const unsubscribe = unsubscribeDropPin
    unsubscribeDropPin = null
    cameraSnapshot = null
    unsubscribe?.()
  }
  ```
  Finally, in `packages/ui/src/map/index.ts`, replace lines 49-53 (the five-line drop-pin export block that sits under the `// Map long-press -> drop pin -> create menu.` comment and runs to the end of the file):
  ```ts
  export { dropPinCameraTarget, DROP_PIN_ZOOM, worldPx } from "./dropPinCamera"
  export type { DropPinCameraInput, DropPinCameraTarget } from "./dropPinCamera"
  export { longPressHitsMarker, MARKER_HIT } from "./longPressGate"
  export type { LongPressMarker, LongPressBounds, LongPressViewportSize, MarkerAnchor } from "./longPressGate"
  export { openDropPinMenu, armDropPinCleanup, disarmDropPinCleanup } from "./dropPinFlow"
  ```
  with:
  ```ts
  export {
    dropPinCameraTarget,
    shouldRestoreDropPinCamera,
    DROP_PIN_ZOOM,
    DROP_PIN_PAN_TOLERANCE_PX,
    DROP_PIN_PAN_ZOOM_TOLERANCE,
    worldPx,
  } from "./dropPinCamera"
  export type {
    DropPinCameraInput,
    DropPinCameraTarget,
    DropPinCameraSnapshot,
    DropPinDismissal,
  } from "./dropPinCamera"
  export { longPressHitsMarker, MARKER_HIT } from "./longPressGate"
  export type { LongPressMarker, LongPressBounds, LongPressViewportSize, MarkerAnchor } from "./longPressGate"
  export {
    openDropPinMenu,
    armDropPinCleanup,
    disarmDropPinCleanup,
    captureDropPinCamera,
    setDropPinCameraRestorer,
  } from "./dropPinFlow"
  export type { DropPinCameraRestorer } from "./dropPinFlow"
  ```
  (`packages/ui/src/index.ts:22` is `export * from "./map"`, so this is all the root barrel needs — nothing to edit there.)

- [ ] **Step 4: Run it and watch it pass.**
  ```
  cd /Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui && pnpm vitest run src/map/__tests__/dropPinFlow.test.ts src/map/__tests__/dropPinCamera.test.ts && pnpm typecheck && pnpm lint
  ```
  Expected, PER FILE (do not assert a whole-suite total — the other workstreams land in this same suite):
  `src/map/__tests__/dropPinFlow.test.ts (23 tests)` — the 12 pre-existing plus the 11 new — and
  `src/map/__tests__/dropPinCamera.test.ts (60 tests)`, with zero failures. Then a clean `tsc --noEmit` and a
  clean `eslint .` (both exit 0 with no diagnostics).

- [ ] **Step 5: Commit.**
  ```
  git -C /Users/theobong/Documents/GitHub/civfix/civfix-shared add packages/ui/src/map/dropPinFlow.ts packages/ui/src/map/index.ts packages/ui/src/map/__tests__/dropPinFlow.test.ts
  git -C /Users/theobong/Documents/GitHub/civfix/civfix-shared commit -m "$(cat <<'EOF'
  feat(ui): restore the map camera when the drop-pin pull-up is dismissed

  armDropPinCleanup already fires exactly once when the drop-pin entry leaves the
  nav stack, covering every dismissal route including the ones that never enter
  DropPinBody. The restore rides that subscription: it reads zustand's prevState to
  tell a real dismissal from the [drop-pin, cleanup] publish trap, and hands the
  pre-press centre to a HOST-REGISTERED callback (setDropPinCameraRestorer, the
  same module-singleton shape as setCameraNavigator). The shared package still
  never touches the camera.

  Fires on the store event, not the sheet's onClosed: onClosed is a local closure
  in the shell's presence gate and is not reachable from here, its native path is
  a 300ms teardown SAFETY NET for a missed gorhom onClose, and deferring 180ms
  would leave the map on a drop-pin camera with no drop pin on it.

  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 2.4: the mobile host's argument-order adapter (`civfix-mobile`)

**Why this file exists rather than two inline expressions:** the spec names argument transposition as this workstream's first risk — the screen-local `flyTo` is `(lng, lat, zoom?, requestGeneration?)` (`app/index.tsx:267-279`) while `MapHandle.flyTo` is `(lat, lng, zoom?)` (`map/types.ts:140`), and `app/index.tsx:243` genuinely calls the latter **24 lines above** the former's declaration, inside `replayPendingMapTarget`. Getting it wrong flies to a **valid-but-wrong** coordinate with no error. `civfix-mobile` has no React test setup — `package.json:test` is `node --experimental-strip-types --test tests/*.test.ts src/components/*.test.ts src/lib/*.test.ts src/theme/*.test.ts`, i.e. pure modules only — so a tiny pure module is the only way to make the transposition a *tested fact* instead of a comment. Precedent: `src/lib/mapRegion.ts`, `src/components/hostMapPlan.ts`, `src/lib/mapLifecycle.ts` are all exactly this shape.

**Files:**
- Create: `/Users/theobong/Documents/GitHub/civfix/civfix-mobile/apps/community-mobile/src/lib/dropPinRestore.ts`
- Test: `/Users/theobong/Documents/GitHub/civfix/civfix-mobile/apps/community-mobile/src/lib/dropPinRestore.test.ts`

**Interfaces:**
- Consumes: `type DropPinCameraTarget` from `@civfix/ui` (`{ lat: number; lng: number; zoom: number }`, exported by Task 2.3's barrel edit). It is a TYPE-ONLY import, which `node --experimental-strip-types` erases — so the test never resolves `@civfix/ui` at runtime.
- Produces:
  - `dropPinRestoreFlyArgs(target: DropPinCameraTarget): [lng: number, lat: number, zoom: number]`
  - `dropPinMenuAlreadyOpen(stack: readonly { kind: string }[]): boolean`

---

- [ ] **Step 1: Branch the mobile repo, then write the failing test.**
  ```
  git -C /Users/theobong/Documents/GitHub/civfix/civfix-mobile switch -c mobile-ux-five-fixes 2>/dev/null || git -C /Users/theobong/Documents/GitHub/civfix/civfix-mobile switch mobile-ux-five-fixes
  ```
  Create `/Users/theobong/Documents/GitHub/civfix/civfix-mobile/apps/community-mobile/src/lib/dropPinRestore.test.ts`:
  ```ts
  import assert from "node:assert/strict"
  import { test } from "node:test"
  import { dropPinMenuAlreadyOpen, dropPinRestoreFlyArgs } from "./dropPinRestore.ts"

  test("dropPinRestoreFlyArgs transposes to THIS SCREEN'S flyTo(lng, lat, zoom)", () => {
    // The shared package speaks {lat, lng, zoom}. The screen-local flyTo (app/index.tsx:267-279) takes LNG
    // FIRST; MapHandle.flyTo (@civfix/ui map/types.ts:140), which app/index.tsx:243 calls inside
    // replayPendingMapTarget, takes LAT first. Getting this backwards flies to a valid-but-wrong coordinate
    // with no error at all - which is why it is tested.
    assert.deepEqual(dropPinRestoreFlyArgs({ lat: 34.05, lng: -118.25, zoom: 12.5 }), [
      -118.25,
      34.05,
      12.5,
    ])
  })

  test("dropPinRestoreFlyArgs is not symmetric - a transposed impl fails this", () => {
    const [lng, lat] = dropPinRestoreFlyArgs({ lat: 10, lng: 20, zoom: 17 })
    assert.equal(lng, 20)
    assert.equal(lat, 10)
    assert.notEqual(lng, lat)
  })

  test("dropPinMenuAlreadyOpen reads the guard a SECOND long press needs", () => {
    // "drop-pin" is not a FLOW_KIND, so a second long press while the menu is open is ACCEPTED and
    // openDetail simply replaces the entry. The host must read this BEFORE openDropPinMenu (afterwards
    // there is always a drop-pin entry) so captureDropPinCamera keeps the FIRST pre-press camera.
    assert.equal(dropPinMenuAlreadyOpen([]), false)
    assert.equal(dropPinMenuAlreadyOpen([{ kind: "cleanup" }]), false)
    assert.equal(dropPinMenuAlreadyOpen([{ kind: "drop-pin" }]), true)
    // Expanded APPENDS, so the entry is not always at index 0.
    assert.equal(dropPinMenuAlreadyOpen([{ kind: "cleanups" }, { kind: "drop-pin" }]), true)
    // And it is still "open" while a host form is drilled in on top of it.
    assert.equal(dropPinMenuAlreadyOpen([{ kind: "drop-pin" }, { kind: "create-cleanup" }]), true)
  })
  ```

- [ ] **Step 2: Run it and watch it fail.**
  ```
  cd /Users/theobong/Documents/GitHub/civfix/civfix-mobile/apps/community-mobile && pnpm test
  ```
  Expected (verified against node v22.15.0's `--test` runner): the unloadable file is reported as ONE failing
  subtest, `not ok N - src/lib/dropPinRestore.test.ts` with `failureType: 'testCodeFailure'` /
  `code: 'ERR_TEST_FAILURE'`, and its stderr carries
  `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/Users/theobong/Documents/GitHub/civfix/civfix-mobile/apps/community-mobile/src/lib/dropPinRestore.ts' imported from .../src/lib/dropPinRestore.test.ts`.
  The summary is `# tests 46` / `# pass 45` / `# fail 1` — the 45 pre-existing passes plus that one file-level
  failure. (The three `test()` blocks are not counted individually because the file never loads.)

- [ ] **Step 3: Minimal implementation.**
  Create `/Users/theobong/Documents/GitHub/civfix/civfix-mobile/apps/community-mobile/src/lib/dropPinRestore.ts`:
  ```ts
  /**
   * The two pure bits of the map home's drop-pin CAMERA RESTORE (app/index.tsx), kept out of the screen so
   * they are unit-testable with `node --test` - which cannot load a screen that imports expo-router and
   * react-native.
   *
   * Both exist because they are silently-wrong-able. There is no error, no crash and no log when either is
   * inverted; the app just flies somewhere plausible and slightly wrong, or forgets where the user was.
   */
  import type { DropPinCameraTarget } from "@civfix/ui"

  /**
   * Transpose a shared `{lat, lng, zoom}` camera into the argument order THIS SCREEN'S generation-guarded
   * `flyTo` takes, which is `(lng, lat, zoom?, requestGeneration?)` (app/index.tsx:267-279).
   *
   * THE TRAP: `MapHandle.flyTo` is `(lat, lng, zoom?)` (@civfix/ui map/types.ts:140) - the MIRROR order -
   * and app/index.tsx:243 calls that one inside `replayPendingMapTarget`, 24 lines above the declaration of
   * the one this feeds. Copying the wrong call site flies to the transposed coordinate with no error
   * whatsoever.
   */
  export function dropPinRestoreFlyArgs(
    target: DropPinCameraTarget,
  ): [lng: number, lat: number, zoom: number] {
    return [target.lng, target.lat, target.zoom]
  }

  /**
   * Is a drop-pin pull-up ALREADY on the nav stack?
   *
   * The host must read this BEFORE calling `openDropPinMenu`, which always leaves one there. "drop-pin" is
   * not a FLOW_KIND, so a SECOND long press while the menu is open is accepted and `openDetail` simply
   * REPLACES the entry - re-running the whole handler. `captureDropPinCamera` uses this flag to KEEP the
   * first press's pre-press camera (still where the user was) while re-pointing the pan check at the new fly.
   *
   * Whole stack, not just the top: expanded APPENDS the entry, and a host form can be drilled in above it.
   */
  export function dropPinMenuAlreadyOpen(stack: readonly { kind: string }[]): boolean {
    return stack.some((entry) => entry.kind === "drop-pin")
  }
  ```

- [ ] **Step 4: Run it and watch it pass.**
  ```
  cd /Users/theobong/Documents/GitHub/civfix/civfix-mobile/apps/community-mobile && pnpm test
  ```
  Expected `# tests 48` / `# pass 48` / `# fail 0` (45 pre-existing + 3 new).

- [ ] **Step 5: Commit.**
  ```
  git -C /Users/theobong/Documents/GitHub/civfix/civfix-mobile add apps/community-mobile/src/lib/dropPinRestore.ts apps/community-mobile/src/lib/dropPinRestore.test.ts
  git -C /Users/theobong/Documents/GitHub/civfix/civfix-mobile commit -m "$(cat <<'EOF'
  test(mobile): pure helpers for the drop-pin camera restore

  dropPinRestoreFlyArgs makes the (lng, lat, zoom) vs (lat, lng, zoom) transposition
  a tested fact rather than a comment: the screen-local flyTo takes lng first and
  MapHandle.flyTo takes lat first, and index.tsx calls both. Getting it backwards
  flies to a valid-but-wrong coordinate with no error.

  dropPinMenuAlreadyOpen is the second-long-press guard, which must be read BEFORE
  openDropPinMenu because that call always leaves a drop-pin entry on the stack.

  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 2.5: wire the mobile map home — capture before the fly, register the camera

**Files:**
- Modify: `/Users/theobong/Documents/GitHub/civfix/civfix-mobile/apps/community-mobile/app/index.tsx` (the `@civfix/ui` import block runs 38-58 and Step 1 edits lines 53-58 of it; a new import after line 68; a new effect after line 432; `onLongPressMap` at lines 470-513)

**Interfaces:**
- Consumes: `captureDropPinCamera(snapshot, menuAlreadyOpen)` and `setDropPinCameraRestorer(restore)` from `@civfix/ui` (Task 2.3 barrel); `dropPinRestoreFlyArgs(target): [lng, lat, zoom]` and `dropPinMenuAlreadyOpen(stack): boolean` (Task 2.4); the screen's existing `flyTo(lng, lat, zoom?, requestGeneration?)` (`app/index.tsx:267-279`) and `openDropPinMenu(lat, lng): boolean` / `dropPinCameraTarget(input)` (already imported at lines 54-55). `DropPinCameraTarget` is NOT imported by name — the restorer's parameter type is inferred from `DropPinCameraRestorer`.
- Produces: nothing importable — this is the host wiring.

**No unit test in this task, deliberately:** `app/index.tsx` is a React screen importing `expo-router`, `react-native` and `react-native-safe-area-context`. `civfix-mobile`'s test runner is `node --experimental-strip-types --test` over pure `.ts` modules (`package.json:test`); there is no RN renderer in the repo and inventing one is out of scope. Everything decidable was pushed into Task 2.4's pure module and Tasks 2.1-2.3's shared predicate; the verification here is typecheck + lint + the full mobile suite, plus the sim check in Step 4.

---

- [ ] **Step 1: Add the imports.**
  In `/Users/theobong/Documents/GitHub/civfix/civfix-mobile/apps/community-mobile/app/index.tsx`, replace lines **53-58** (the tail of the `@civfix/ui` import block) —
  ```ts
    // Map long-press -> drop a pin -> pull-up create menu (Area 3).
    openDropPinMenu,
    dropPinCameraTarget,
    type MapHandle,
    type MapProps,
  } from "@civfix/ui"
  ```
  — with:
  ```ts
    // Map long-press -> drop a pin -> pull-up create menu (Area 3), and its camera RESTORE on dismissal.
    // `captureDropPinCamera` arms the pre-press camera; `setDropPinCameraRestorer` hands the shared flow the
    // only camera it is allowed to move - THIS SCREEN'S generation-guarded one.
    openDropPinMenu,
    dropPinCameraTarget,
    captureDropPinCamera,
    setDropPinCameraRestorer,
    type MapHandle,
    type MapProps,
  } from "@civfix/ui"
  ```
  **Do not touch line 52 (`clampSidebarWidth,`) or the `useSidebarStore,` on line 51.** `clampSidebarWidth`
  is used at line 506, inside the very `onLongPressMap` Step 2 rewrites, and the block Step 2 substitutes
  still calls it — deleting it here would produce TS2304 plus an orphaned `} from "@civfix/ui"`.

  Then add, immediately after line 68 (`import { decideRegionFetch } from "@/lib/mapRegion"`):
  ```ts
  import { dropPinMenuAlreadyOpen, dropPinRestoreFlyArgs } from "@/lib/dropPinRestore"
  ```

- [ ] **Step 2: Rewrite `onLongPressMap` to snapshot BEFORE the fly.**
  Replace lines **470-513** of `app/index.tsx` — from `const lastLongPressRef = useRef(0)` (line 470) through the closing `)` of the `useCallback` (line 513); the explanatory comment block at 463-469 stays — with:
  ```tsx
    const lastLongPressRef = useRef(0)
    const onLongPressMap = useCallback(
      (lat: number, lng: number) => {
        if (Date.now() - lastControlTapRef.current < CONTROL_LONG_PRESS_GUARD_MS) return
        if (Date.now() - lastLongPressRef.current < 400) return
        lastLongPressRef.current = Date.now()
        // Dismiss the layers popover, exactly as a plain map press does.
        useReportFilterStore.getState().setLayersOpen(false)
        // READ THE PRE-PRESS CAMERA AND VIEW BEFORE ANYTHING MOVES THEM. This is the snapshot a dismissal
        // restores to, and there is exactly one moment it can be taken: once the fly settles,
        // `acknowledgeMapSettlement` has overwritten `mapLifecycleRef.lastViewport` with the DROP-PIN camera
        // and `rememberMapViewport` has persisted it, so afterwards there is no record of where the user was.
        // The zoom read that used to sit inline in `dropPinCameraTarget` below is the same value - it is just
        // hoisted here so "read before the fly" is structural rather than incidental. Safe to hoist:
        // `openDropPinMenu` touches only the nav and dropped-pin stores, never the map viewport.
        const viewportBefore = useMapViewport.getState().viewport
        const navBefore = useNavStore.getState()
        const viewBefore = navBefore.view
        // "drop-pin" is NOT a FLOW_KIND, so a SECOND long press while the menu is open is accepted and
        // `openDetail` simply REPLACES the entry - this whole handler re-runs. Read the guard NOW: after
        // `openDropPinMenu` there is ALWAYS a drop-pin entry on the stack. `captureDropPinCamera` uses it to
        // keep the FIRST press's pre-press camera while re-pointing the pan check at the second fly.
        const menuAlreadyOpen = dropPinMenuAlreadyOpen(navBefore.stack)
        // EVERYTHING BELOW IS GATED ON THE MENU ACTUALLY OPENING. `openDropPinMenu` DECLINES while a creation
        // flow owns the stack (host-an-event / edit / the composer), and that is reachable here: the
        // meet-location step collapses the sheet to peek precisely to expose the live map, and unlike web it
        // never sets `useLocationPick.active`, so Map.native's pick-mode guard does not swallow the press.
        // Flying unconditionally therefore zoomed to z17 and offset the centre with NO pin and NO menu, and
        // buzzed a medium haptic for that non-event.
        if (!openDropPinMenu(lat, lng)) return
        haptics?.impact("medium")
        const target = dropPinCameraTarget({
          lat,
          lng,
          currentZoom: viewportBefore?.zoom ?? null,
          windowHeight,
          // The same reserve CompactShell.native builds its detents from, via the shared token so the two
          // cannot drift (a literal 32 here silently became a wrong offset the day the token moved).
          sheetTopReserve: insets.top + theme.space["8"],
          // The map is FULL-BLEED behind the status bar (AppShell paints it at z0 under an absoluteFill), so
          // the top `insets.top` px of it are under the notch / Dynamic Island. The camera centres the pin in
          // the strip BETWEEN this and the sheet - without it, the FULL detent (whose whole strip IS the
          // reserve) put the pin at reserve/2, i.e. behind the Island.
          topInset: insets.top,
          // Read AFTER openDropPinMenu: it settles the compact sheet at MID (a 52pt pin cannot be seen in the
          // 32px a FULL sheet leaves) and bumps a PEEKED sheet up, so the camera must offset by whatever the
          // sheet actually settles at. Reading it before this call would give the pre-open detent.
          sheetDetent: useNavStore.getState().snap,
          mode: layoutMode,
          // Landscape (iPad): the ExpandedShell card OVERLAYS the map's left edge, so the occlusion there is
          // HORIZONTAL. The card is user-resizable, so take its LIVE width - never a literal.
          sidebarWidth: clampSidebarWidth(useSidebarStore.getState().width, windowWidth),
        })
        // Arm the restore BEFORE the fly. `from` is the camera we are about to leave (what a dismissal flies
        // back to); `flownTo` is the camera we are about to ASK for, which is what the shared pan check
        // compares the live viewport against at dismissal time. No pre-press viewport (no map has reported
        // yet, a true cold start) means no snapshot and therefore no restore - the honest degradation.
        if (viewportBefore) {
          captureDropPinCamera(
            {
              from: {
                lat: viewportBefore.center.lat,
                lng: viewportBefore.center.lng,
                zoom: viewportBefore.zoom,
              },
              flownTo: target,
              view: viewBefore,
            },
            menuAlreadyOpen,
          )
        }
        // NOTE the (lng, lat) argument order: this is THIS SCREEN'S generation-guarded queued flyTo, which
        // takes lng first - NOT MapHandle.flyTo(lat, lng), which replayPendingMapTarget calls at :243.
        flyTo(target.lng, target.lat, target.zoom)
      },
      [flyTo, windowHeight, windowWidth, insets.top, layoutMode, haptics],
    )
  ```
  (The dependency array is byte-identical to the one at line 512 today: `useMapViewport` / `useNavStore` /
  `dropPinMenuAlreadyOpen` / `captureDropPinCamera` are all read or called imperatively, not captured.)

- [ ] **Step 3: Register the host camera seam.**
  In `app/index.tsx`, insert immediately **after** the `useMobileNavAdapter({ ... })` call (its closing `})` is line 432) and **before** `const mapPlan = mobileHostMapPlan(layoutMode, view)` (line 433):
  ```tsx
    // THE HOST OWNS THE CAMERA (@civfix/ui map/dropPinCamera.ts:64-68): the shared drop-pin flow never
    // touches maplibre, so it calls back HERE when the pull-up is dismissed without a commitment. Registered
    // as a module singleton exactly the way the app root registers the capture surface (`setCameraNavigator`,
    // src/lib/nativeCamera.ts:40) - set on mount, nulled on unmount, so a torn-down map screen can never be
    // flown. Registered on THIS screen rather than app/_layout.tsx because `flyTo` is this screen's.
    useEffect(() => {
      setDropPinCameraRestorer((restoreTarget) => {
        // The shared flow speaks {lat, lng, zoom}; this screen's flyTo takes (lng, lat, zoom) - the MIRROR
        // of MapHandle.flyTo(lat, lng, zoom), which replayPendingMapTarget calls at app/index.tsx:243.
        // The transposition is a tested pure function (src/lib/dropPinRestore.ts) precisely because getting
        // it wrong flies to a valid-but-wrong coordinate with no error.
        const [lng, lat, zoom] = dropPinRestoreFlyArgs(restoreTarget)
        // No `requestGeneration`: flyTo mints a fresh one via beginCameraRequest, so a Locate / pin-detail
        // request issued AFTER this supersedes it, and this supersedes an older stale one. Going through
        // MapHandle.flyTo directly instead would sidestep that guard entirely.
        flyTo(lng, lat, zoom)
      })
      return () => setDropPinCameraRestorer(null)
    }, [flyTo])
  ```
  (`useEffect` is already imported at `app/index.tsx:33`; no import change is needed for it.)

- [ ] **Step 4: Verify.**
  ```
  cd /Users/theobong/Documents/GitHub/civfix/civfix-mobile/apps/community-mobile && pnpm typecheck && pnpm lint && pnpm test
  ```
  Expect a clean `tsc --noEmit`, a clean `eslint .`, and `# tests 48` / `# pass 48` / `# fail 0`.
  Then the sim check (recipe from the spec's Testing section):
  ```
  rsync -a --delete /Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/ /Users/theobong/Documents/GitHub/civfix/civfix-mobile/node_modules/@civfix/ui/src/
  cd /Users/theobong/Documents/GitHub/civfix/civfix-mobile/apps/community-mobile && npx expo start --clear
  ```
  (`@civfix/ui` is installed at the mobile repo ROOT — `civfix-mobile/node_modules/@civfix/ui` — not under
  `apps/community-mobile/node_modules`. Syncing to the wrong path creates a directory Metro never reads and
  the app shows none of the change.)
  1. Pan to a recognisable spot, long-press the map → the menu opens and the camera flies to the pin. Tap **Cancel** → the camera flies back to where you were.
  2. Repeat, but drag the sheet down instead of tapping Cancel → same restore.
  3. Repeat, but tap the bare map above the sheet → same restore.
  4. Long-press, then **pan the strip of map above the sheet**, then Cancel → the camera stays where you panned to.
  5. Long-press, then **pinch-zoom** the strip above the sheet, then Cancel → the camera stays where you zoomed to (this is the `DROP_PIN_PAN_ZOOM_TOLERANCE` half, which the pan gesture in step 4 does not exercise).
  6. Long-press → **"Report an issue here"** → the wizard opens and the camera stays on the pin.
  7. Long-press → **"Host an event here"** → publish the event → dismiss the event detail → the camera stays on the event, does **not** jump back.
  8. Long-press, then long-press somewhere else **without dismissing** → Cancel → the camera returns to the camera you were on before the FIRST long press, not the first pin's camera.

- [ ] **Step 5: Commit.**
  ```
  git -C /Users/theobong/Documents/GitHub/civfix/civfix-mobile add apps/community-mobile/app/index.tsx
  git -C /Users/theobong/Documents/GitHub/civfix/civfix-mobile commit -m "$(cat <<'EOF'
  feat(mobile): restore the map camera when the drop-pin pull-up is dismissed

  onLongPressMap now snapshots the pre-press camera and view BEFORE the fly - the
  only moment it can, since acknowledgeMapSettlement overwrites lastViewport with
  the drop-pin camera as soon as the fly settles - guarded on dropPinMenuAlreadyOpen
  so a second long press cannot overwrite it with the first fly's camera.

  MapHomeScreen registers itself as the shared flow's camera via
  setDropPinCameraRestorer, routing through this screen's generation-guarded
  flyTo(lng, lat, zoom) rather than MapHandle.flyTo(lat, lng, zoom), so a
  concurrent Locate or pin-detail request cannot be clobbered by the restore or
  vice versa.

  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  EOF
  )"
  ```


---


## Workstream 3 — Embed the camera in the Report tab; un-Modal the location map picker

Two full-screen native surfaces currently cover the liquid-glass dock during the report flow: the
`/report/camera` vision-camera screen and `PortraitMapPickStep.native`'s RN `<Modal>`. This workstream
turns both into in-body layers of the Report tab's base surface, which is already inset by the tab-bar
footprint (`PortraitShell.shared.tsx:106`, `const baseInsets = { paddingTop: topInset, paddingBottom:
frame.base.bottomInset }`) — so "inset above the dock" comes for free once the surfaces stop being
Modals/routes.

**COMPACT/PORTRAIT ONLY.** Every geometric premise above is portrait-shell code. `ExpandedShell`
(iPad landscape) renders **no dock and no such base inset**, and its report body lives inside the
user-resizable sidebar card clamped to 300–560pt (`shell/sidebarStore.ts:19-21`,
`SIDEBAR_MIN_WIDTH = 300` / `SIDEBAR_MAX_WIDTH = 560`). The spec calls that branch out explicitly
("Landscape/expanded has no dock at all (`wizardSteps.ts:110-113`); the wizard's own back chip is the
only exit there. Anything gated on 'the dock is the way out' must keep that branch intact"). Both new
surfaces are therefore gated on `mode === "compact"`, and landscape keeps the imperative
`camera.capture()` route it has today. This is not defensive padding: `STEP_ORDER_EXPANDED` also starts
at `"capture"` (`wizardSteps.ts:14`) and `resumeStep(emptyDraft, "expanded")` also returns `"capture"`
(`wizardSteps.ts:59`), so an ungated predicate WOULD mount a live vision-camera preview inside that
sidebar card.

Repos: `civfix-shared` (`packages/ui`) and `civfix-mobile` (`apps/community-mobile`). **No third repo.**
The spec's header declares "Repos touched: `civfix-shared` (`@civfix/ui`), `civfix-mobile`"; nothing in
this workstream edits `civfix-web` source.

**Test commands used throughout**

- Shared (vitest, no config file — vitest's default include):
  `cd /Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui && pnpm vitest run <path>`
- Mobile (node's built-in runner; there is **no** React test harness in either repo — the mobile
  `test` script is `node --experimental-strip-types --test tests/*.test.ts src/components/*.test.ts src/lib/*.test.ts src/theme/*.test.ts`):
  `cd /Users/theobong/Documents/GitHub/civfix/civfix-mobile/apps/community-mobile && node --experimental-strip-types --test src/lib/cameraSession.test.ts`

Assert **per-file** counts only. Never assert a whole-suite total: Workstreams 1, 2, 4 and 5 land in
this same `packages/ui` vitest suite and the running total depends on how many of them have already
landed.

**Simulator recipe (used by Tasks 3.6–3.8)** — `@civfix/ui` is installed in civfix-mobile as a published
package (0.36.1) at `/Users/theobong/Documents/GitHub/civfix/civfix-mobile/node_modules/@civfix/ui`
(the mobile repo ROOT, **not** `apps/community-mobile/node_modules`, which has no `@civfix` at all), and
its `exports` map points at `./src/...`. So the mobile app both BUNDLES and TYPECHECKS against that
installed copy, and shared edits must be rsync'd in before they are visible to Metro **or to `tsc`**:

```bash
rsync -a --delete \
  /Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/ \
  /Users/theobong/Documents/GitHub/civfix/civfix-mobile/node_modules/@civfix/ui/src/
```

New i18n keys need an app **relaunch**, not just a Metro reload.

---

### Task 3.1: Fix the capture strip's media identity (`m.uri` → `m.id`)

**Files:**
- Modify: `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/bodies/ReportFlowBody.tsx:266-270`
- Test: `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/report/__tests__/wizardSteps.test.ts`

**Interfaces:**
- Consumes: `useDraftReportStore().removeMedia(idOrUri: string): void` (`report/draftStore.ts:162`, impl `322-330`), `DraftMedia.id: string` (`report/draftStore.ts:26-33`).
- Produces: nothing new.

- [ ] **Step 1: Write the failing source-pin test.** This package has no RN renderer, so the wiring is
  pinned by source — the pattern `wizardSteps.test.ts` already uses (`wizardSource`, declared at line 16).
  Append this describe block to the END of
  `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/report/__tests__/wizardSteps.test.ts`:

  ```ts
  describe("the capture strip's media identity", () => {
    it("keys and removes by the stable DraftMedia.id, never by the uri", () => {
      // draftStore.ts:26-33 states the contract: the uri is NOT unique - picking the same library asset
      // twice yields two independent items carrying one `ph://`/`content://` uri. So `key={m.uri}`
      // duplicates React keys, and `removeMedia(m.uri)` falls into the store's LEGACY uri branch
      // (draftStore.ts:327), which drops the FIRST match - the wrong thumbnail whenever the reporter
      // removes the second copy.
      expect(wizardSource).toContain("key={m.id}")
      expect(wizardSource).toContain("onPress={() => removeMedia(m.id)}")
      expect(wizardSource).not.toContain("key={m.uri}")
      expect(wizardSource).not.toContain("removeMedia(m.uri)")
    })
  })
  ```

- [ ] **Step 2: Run it and watch it fail.**
  `cd /Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui && pnpm vitest run src/report/__tests__/wizardSteps.test.ts`
  Expected failure: `AssertionError: expected '/**\n * ReportFlowBody (the "report" …' to contain 'key={m.id}'`
  Counts: `Tests 1 failed | 27 passed (28)` (the file is 27 tests at HEAD — verified by execution).

- [ ] **Step 3: Make the two edits.** In
  `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/bodies/ReportFlowBody.tsx`,
  replace lines **266-270** (verified: line 266 is `{media.map((m) => (`, line 270 is
  `onPress={() => removeMedia(m.uri)}`):

  ```tsx
          {media.map((m) => (
            <View key={m.uri} style={styles.captureThumbWrap}>
              <MediaPreview uri={m.uri} kind={m.kind} aspectRatio={1} style={styles.captureThumb} />
              <Pressable
                onPress={() => removeMedia(m.uri)}
  ```

  with:

  ```tsx
          {media.map((m) => (
            // `m.id`, NOT `m.uri`: the uri is not unique (draftStore.ts:26-33 - two picks of the same
            // library asset share one uri), so keying by it duplicated React keys and removing one thumb
            // dropped the wrong match through the store's legacy uri fallback.
            <View key={m.id} style={styles.captureThumbWrap}>
              <MediaPreview uri={m.uri} kind={m.kind} aspectRatio={1} style={styles.captureThumb} />
              <Pressable
                onPress={() => removeMedia(m.id)}
  ```

- [ ] **Step 4: Run it and watch it pass.**
  `cd /Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui && pnpm vitest run src/report/__tests__/wizardSteps.test.ts`
  Expected: `Test Files 1 passed (1) / Tests 28 passed (28)`.

- [ ] **Step 5: Commit.**

  ```bash
  git -C /Users/theobong/Documents/GitHub/civfix/civfix-shared add packages/ui/src/bodies/ReportFlowBody.tsx packages/ui/src/report/__tests__/wizardSteps.test.ts
  git -C /Users/theobong/Documents/GitHub/civfix/civfix-shared commit -m "$(cat <<'EOF'
  fix(ui): key the report capture strip by DraftMedia.id, not the non-unique uri

  Two picks of the same library asset share one uri, so key={m.uri} duplicated
  React keys and removeMedia(m.uri) dropped the first match instead of the tapped
  thumbnail. Both now use the store's stable per-item id.

  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 3.2: Add the pure embedded-viewfinder predicates to `wizardSteps`

**Files:**
- Modify: `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/report/wizardSteps.ts`
- Test: `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/report/__tests__/wizardSteps.test.ts`

**Interfaces:**
- Consumes: `type Step = "capture" | "location" | "category" | "details" | "review"` (`report/wizardSteps.ts:12`); `type LayoutMode` — already imported at `report/wizardSteps.ts:9` (`import type { LayoutMode } from "../theme"`), so no new import is needed.
- Produces:
  - `opensEmbeddedViewfinderOnEnter(step: Step, hasMedia: boolean, hasViewfinder: boolean, mode: LayoutMode): boolean`
  - `viewfinderSessionActive(step: Step, viewfinderOpen: boolean, coveredByDetail: boolean): boolean`

- [ ] **Step 1: Write the failing tests.** Add the two new names to the import block at the top of
  `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/report/__tests__/wizardSteps.test.ts:3-13`
  so it reads:

  ```ts
  import {
    STEP_ORDER_COMPACT,
    STEP_ORDER_EXPANDED,
    STEP_PHASE,
    stepOrderFor,
    resumeStep,
    showsWizardFooter,
    wizardHeaderMode,
    autoOpensCameraOnEnter,
    stepCameraAutoOpen,
    opensEmbeddedViewfinderOnEnter,
    viewfinderSessionActive,
  } from "../wizardSteps"
  ```

  (That grows the import block from 11 lines to 13, so every line number below 13 in this file shifts by
  +2 for the rest of this workstream. Task 3.4 Step 1 accounts for it explicitly.)

  ...then append these two describe blocks to the end of the file:

  ```ts
  describe("opensEmbeddedViewfinderOnEnter", () => {
    it("mounts the viewfinder when a host injected one and the reporter arrived with an empty draft", () => {
      expect(opensEmbeddedViewfinderOnEnter("capture", false, true, "compact")).toBe(true)
    })

    it("never mounts one on a host that injected none - which is the WEB answer", () => {
      // `hasViewfinder` REPLACES the old `platform` argument, and it is the honest input: only a host that
      // supplied CameraCapability.Viewfinder can embed a live preview. The web host supplies none (a
      // browser has no embeddable camera; it keeps the tap-to-open <input capture> path verbatim), so the
      // platform seam no longer has to be restated here.
      expect(opensEmbeddedViewfinderOnEnter("capture", false, false, "compact")).toBe(false)
      expect(opensEmbeddedViewfinderOnEnter("capture", true, false, "compact")).toBe(false)
    })

    it("leaves a draft that already has media alone", () => {
      // Walking BACK to capture must never throw a live camera over the reporter's own thumbnails.
      expect(opensEmbeddedViewfinderOnEnter("capture", true, true, "compact")).toBe(false)
    })

    it("never embeds in EXPANDED - the iPad sidebar card has no dock and no tab-bar base inset", () => {
      // THE LANDSCAPE BRANCH THE SPEC ORDERS KEPT INTACT. `Viewfinder` is the SAME injected mobile
      // component in both orientations, and expanded also starts at "capture" (STEP_ORDER_EXPANDED,
      // wizardSteps.ts:14) with resumeStep(emptyDraft, "expanded") === "capture" (:59) - so without this
      // gate an iPad in landscape would replace the wizard's scroll region with a live vision-camera
      // preview inside the ExpandedShell sidebar card, a user-resizable 300-560pt panel
      // (shell/sidebarStore.ts:19-21). ExpandedShell also renders NO dock, so the whole "inset above the
      // dock is already free" premise (PortraitShell.shared.tsx:106) does not hold there.
      expect(opensEmbeddedViewfinderOnEnter("capture", false, true, "expanded")).toBe(false)
      expect(opensEmbeddedViewfinderOnEnter("capture", false, true, "compact")).toBe(true)
    })

    it("only ever fires on the capture step, in both step orders", () => {
      for (const [order, mode] of [
        [STEP_ORDER_COMPACT, "compact"],
        [STEP_ORDER_EXPANDED, "expanded"],
      ] as const) {
        for (const step of order) {
          if (step === "capture") continue
          expect(opensEmbeddedViewfinderOnEnter(step, false, true, mode)).toBe(false)
          expect(opensEmbeddedViewfinderOnEnter(step, true, true, mode)).toBe(false)
        }
      }
    })
  })

  describe("viewfinderSessionActive", () => {
    it("runs the capture session while the viewfinder is up on the capture step and nothing covers it", () => {
      expect(viewfinderSessionActive("capture", true, false)).toBe(true)
    })

    it("releases the session the moment the wizard leaves capture", () => {
      // On the old route `router.back()` unmounted the <Camera> for free. Inline the surface can outlive
      // the step, so this is the shared half of the release rule.
      expect(viewfinderSessionActive("category", true, false)).toBe(false)
      expect(viewfinderSessionActive("location", true, false)).toBe(false)
      expect(viewfinderSessionActive("review", true, false)).toBe(false)
    })

    it("releases the session when a detail sheet is pushed OVER the Report tab", () => {
      // THE CASE THAT IS NOT AN UNMOUNT. Tabbing away unmounts ReportFlowBody (BodyTransition.native is a
      // single-layer entrance - the outgoing child unmounts instantly), but a pushed "scroll" detail
      // presents as a sheet ABOVE a still-mounted base body (bodyLayout.ts:294 hides the dock for exactly
      // that reason), so the viewfinder would otherwise keep the camera hot underneath a full-screen card.
      expect(viewfinderSessionActive("capture", true, true)).toBe(false)
    })

    it("is false whenever the viewfinder is not up at all", () => {
      expect(viewfinderSessionActive("capture", false, false)).toBe(false)
      expect(viewfinderSessionActive("capture", false, true)).toBe(false)
    })
  })
  ```

- [ ] **Step 2: Run it and watch it fail.**
  `cd /Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui && pnpm vitest run src/report/__tests__/wizardSteps.test.ts`
  The file COLLECTS fine — vitest's vite-node SSR transform resolves a missing named export to
  `undefined` rather than throwing at import time (verified by probe), so each new case fails at the CALL:
  `TypeError: opensEmbeddedViewfinderOnEnter is not a function` (and
  `TypeError: viewfinderSessionActive is not a function` for the second block).
  Counts: `Tests 9 failed | 28 passed (37)`.

- [ ] **Step 3: Add the two predicates.** Append to the END of
  `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/report/wizardSteps.ts` (leave
  `autoOpensCameraOnEnter` / `CameraAutoOpenTick` / `stepCameraAutoOpen` in place for now — Task 3.4
  deletes them together with their call site):

  ```ts
  /**
   * Should ENTERING the capture step mount the host's EMBEDDED viewfinder?
   *
   * THE RULE, and what changed: "Report an issue" on a phone means "point the camera at it", and it used to
   * mean that by pushing a full-screen vision-camera ROUTE over the whole shell - dock included. The
   * viewfinder is now a renderable slot on the camera capability (`CameraCapability.Viewfinder`), rendered
   * INLINE on this step, so the liquid-glass dock and the wizard's own header stay on screen for the entire
   * flow.
   *
   * `hasViewfinder` REPLACES the old `platform` argument and is the honest input: only a host that injected
   * a Viewfinder can embed a live preview. The mobile host injects one; the WEB host deliberately does not
   * (a browser has no embeddable camera surface here and keeps its tap-to-open `<input type=file capture>`
   * path verbatim), so the platform question answers itself through the seam instead of being restated.
   *
   * COMPACT ONLY, and this argument is NOT decoration. The embedded surface's whole justification is that
   * the PORTRAIT base surface is already padded by the tab-bar footprint (PortraitShell.shared.tsx:106), so
   * a flex:1 slot bottoms out exactly at the top of the liquid-glass dock. ExpandedShell renders no dock and
   * no such inset, and the report body there lives inside the sidebar card - a user-resizable 300-560pt
   * panel (shell/sidebarStore.ts:19-21). `Viewfinder` is the same injected component in both orientations
   * and expanded ALSO starts at "capture" (STEP_ORDER_EXPANDED) with `resumeStep(emptyDraft, "expanded")`
   * === "capture", so without this gate an iPad in landscape would mount a live camera preview in that card.
   * Landscape keeps the imperative `capture()` route, whose exit is the wizard's own back chip - the branch
   * the spec requires stay intact.
   *
   * ONLY WITH AN EMPTY DRAFT: walking BACK to capture with thumbnails already on the draft must never throw
   * a live camera over them.
   *
   * THIS IS A MOUNT-TIME QUESTION. The caller reads it ONCE, from a lazy `useState` initializer - never from
   * an effect. That is what retires the old `stepCameraAutoOpen` latch along with the trap it existed for:
   * an effect could be re-entered when the draft went 1 -> 0 media (the reporter deleting their own last
   * photo to swap it for a library pick) and would summon the camera mid-edit. A lazy initializer cannot be
   * re-entered at all, so the bug is structurally gone rather than latched away.
   */
  export function opensEmbeddedViewfinderOnEnter(
    step: Step,
    hasMedia: boolean,
    hasViewfinder: boolean,
    mode: LayoutMode,
  ): boolean {
    return mode === "compact" && hasViewfinder && step === "capture" && !hasMedia
  }

  /**
   * May the embedded viewfinder's capture SESSION run right now? (The shared half of the release rule; the
   * host ANDs this with its own app-foreground / permission / device checks - see mobile's
   * `@/lib/cameraSession.cameraSessionRunning`.)
   *
   * WHY THIS EXISTS AT ALL. On the old full-screen route `router.back()` unmounted the `<Camera>` for free.
   * Embedded, the surface outlives every transition that is not a full unmount, and iOS will happily hold a
   * running capture session - battery, heat, and a hard conflict with any other camera consumer (the post
   * composer's own "Camera" attachment row still drives the imperative `capture()` route).
   *
   * `coveredByDetail` is the case that is NOT an unmount. Switching tabs unmounts ReportFlowBody outright
   * (BodyTransition.native is a single-layer entrance: the outgoing child unmounts instantly), but a pushed
   * "scroll" detail presents as a SHEET above a still-mounted base body (`bodyLayout.ts:294` hides the dock
   * for exactly that reason), so the wizard - and its viewfinder - stay mounted underneath a full-screen
   * card. The caller passes `stack.length > 0`.
   *
   * NO `mode` ARGUMENT ON PURPOSE: the layout question is answered once, at mount, by
   * {@link opensEmbeddedViewfinderOnEnter}, and the caller ALSO gates the render on `mode === "compact"` so
   * a rotate mid-viewfinder unmounts the surface (which releases the session for free).
   */
  export function viewfinderSessionActive(
    step: Step,
    viewfinderOpen: boolean,
    coveredByDetail: boolean,
  ): boolean {
    return viewfinderOpen && step === "capture" && !coveredByDetail
  }
  ```

- [ ] **Step 4: Run it and watch it pass.**
  `cd /Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui && pnpm vitest run src/report/__tests__/wizardSteps.test.ts`
  Expected: `Test Files 1 passed (1) / Tests 37 passed (37)` — the 28 from Task 3.1 plus 5
  `opensEmbeddedViewfinderOnEnter` cases plus 4 `viewfinderSessionActive` cases.

- [ ] **Step 5: Commit.**

  ```bash
  git -C /Users/theobong/Documents/GitHub/civfix/civfix-shared add packages/ui/src/report/wizardSteps.ts packages/ui/src/report/__tests__/wizardSteps.test.ts
  git -C /Users/theobong/Documents/GitHub/civfix/civfix-shared commit -m "$(cat <<'EOF'
  feat(ui): add the embedded-viewfinder mount + session predicates to wizardSteps

  opensEmbeddedViewfinderOnEnter replaces the platform seam with "did the host
  inject a Viewfinder", gated on COMPACT so landscape's sidebar card never mounts a
  live preview, and viewfinderSessionActive states the shared half of the
  camera-release rule - including the pushed-sheet case, which is not an unmount.

  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 3.3: Add the renderable `Viewfinder` slot to `CameraCapability`

Modelled on the `LocationPicker.{native,web}.tsx` seam — a renderable native surface the shared body draws
without importing the native module. Here the seam is a capability FIELD rather than a file split, because
`@civfix/ui` must not gain a `react-native-vision-camera` peer dep.

**Files:**
- Modify: `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/capabilities/types.ts`
- Modify: `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/capabilities/index.ts`
- Modify: `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/capabilities/fakes/index.ts:23-28` (doc only)
- Create (test): `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/capabilities/__tests__/cameraSeam.test.ts`

**NO `civfix-web` COMMIT.** An earlier draft added a doc-only comment to
`civfix-web/apps/community-web/src/lib/web-camera.ts`. That is a THIRD repo, beyond the spec's declared
`civfix-shared` + `civfix-mobile`, with no branch created for it anywhere in this plan (it would land on
whatever is checked out, likely `main`). The same sentence is folded into the `CameraViewfinderProps` doc
block below instead — which is the file a web developer reading the seam actually opens.

**Interfaces:**
- Consumes: `CapturedMedia` (`capabilities/types.ts:25-41`), `CameraCapability` (`capabilities/types.ts:71-93`), `PlatformCapabilities` (`capabilities/types.ts:194-206`), `makeFakeCapabilities(): PlatformCapabilities` (`capabilities/fakes/index.ts:157`).
- Produces:
  - `interface CameraViewfinderProps { active: boolean; mode?: "photo" | "video"; onCaptured(media: CapturedMedia): void; onCancel(): void }`
  - `CameraCapability.Viewfinder?: ComponentType<CameraViewfinderProps>`

- [ ] **Step 1: Write the failing test.** Create
  `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/capabilities/__tests__/cameraSeam.test.ts`:

  ```ts
  import { readFileSync } from "node:fs"
  import { describe, expect, it } from "vitest"
  import { makeFakeCapabilities } from "../fakes"

  /** The seam's source, for the shape claims this package has no renderer to assert. */
  const typesSource = readFileSync(new URL("../types.ts", import.meta.url), "utf8")

  describe("the camera capability's renderable viewfinder slot", () => {
    it("is OPTIONAL, so hosts with no embeddable camera still satisfy the seam", () => {
      // Web has no embeddable camera surface (it keeps the tap-to-open <input type=file capture>), and the
      // fakes have none either. Making the slot REQUIRED would break both hosts' bundles at compile time -
      // this assertion is the standing reason it is a `?`.
      expect(typesSource).toContain("Viewfinder?: ComponentType<CameraViewfinderProps>")
    })

    it("is absent from the fake bundle - which is what every shared consumer must null-check against", () => {
      expect(makeFakeCapabilities().camera.Viewfinder).toBeUndefined()
    })

    it("hands the host both lifecycle inputs the embedded surface needs", () => {
      // `active` is the session gate: false must PAUSE/RELEASE the capture session WITHOUT unmounting, or
      // iOS holds the camera on the Report tab. `onCaptured`/`onCancel` are the surface's two exits.
      expect(typesSource).toContain("active: boolean")
      expect(typesSource).toContain("onCaptured(media: CapturedMedia): void")
      expect(typesSource).toContain("onCancel(): void")
    })
  })
  ```

- [ ] **Step 2: Run it and watch it fail.**
  `cd /Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui && pnpm vitest run src/capabilities/__tests__/cameraSeam.test.ts`
  Expected failures (verified by grepping `src/capabilities/types.ts`, which today contains none of
  `Viewfinder?:`, `active: boolean`, `onCaptured(media: CapturedMedia): void` or `onCancel(): void` —
  note `available: boolean` at :178 does NOT contain the substring `active: boolean`):
  `AssertionError: expected '/**\n * Platform capability seam.\n …' to contain 'Viewfinder?: ComponentType<CameraViewfinderProps>'`
  and the same shape for `'active: boolean'`.
  Counts: **`Tests 2 failed | 1 passed (3)`** — only the `toBeUndefined()` case passes vacuously today
  (vitest strips types, so reading a not-yet-declared optional field is a runtime `undefined`, not an error).

- [ ] **Step 3: Add the type + the slot + the barrel export + the fake doc.**

  (a) At the TOP of `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/capabilities/types.ts`,
  before the file's first `/**` block (i.e. as the new line 1), add the one import this file needs. `react`
  is an ALLOWED dependency everywhere in the shared source — `eslint.config.js`'s import-guard bans only
  expo-*/maplibre/next/@expo/vector-icons everywhere and reanimated/gorhom/react-native-video outside
  `*.native.*` seams; its header states "react / react-native / react-native-* (except reanimated) /
  lucide-react-native stay ALLOWED everywhere":

  ```ts
  import type { ComponentType } from "react"
  ```

  (b) Immediately BEFORE `export interface CameraCapability {` (verified at `types.ts:71`), insert:

  ```ts
  /**
   * The props the host's EMBEDDED viewfinder component receives (the camera capability's renderable slot).
   *
   * WHY A RENDERABLE SLOT AT ALL. `CameraCapability` was imperative-only - `isAvailable` / `capture` /
   * `pickFromLibrary` / `prepareUpload` - which is the structural reason the mobile viewfinder had to be a
   * separate full-screen ROUTE pushed over the whole app shell, dock included. The precedent for a
   * renderable native surface behind a seam is `map/LocationPicker.{native,web}.tsx`; the difference here is
   * that the surface cannot be a FILE seam, because that would put `react-native-vision-camera` in
   * @civfix/ui's peer deps. So the HOST supplies the component and the shared capture step renders it.
   *
   * THE WEB HOST DELIBERATELY SUPPLIES NONE, and that is not an omission to be "fixed": a browser has no
   * embeddable capture surface here (and blocks a gesture-less file-input click), so web keeps its
   * tap-to-open `<input type=file capture>` path verbatim and the shared capture step renders its coral
   * capture card. The fakes supply none for the same reason. `capabilities/__tests__/cameraSeam.test.ts`
   * pins both the optionality and the fake's absence.
   */
  export interface CameraViewfinderProps {
    /**
     * Whether the capture SESSION may run. `false` must PAUSE/RELEASE the camera without unmounting the
     * component - on the old full-screen route `router.back()` did that for free, but embedded on the Report
     * tab the surface outlives every transition that is not a full unmount, and iOS will hold a running
     * session (battery, heat, and a conflict with any other camera consumer). The host is expected to AND
     * this with its own app-foreground / permission / device checks.
     */
    active: boolean
    /** Which mode the surface should OPEN in; the surface still owns its own PHOTO/VIDEO toggle. */
    mode?: "photo" | "video"
    /**
     * A photo/video the surface captured, with the platform's GPS-at-the-shutter attached as
     * {@link CapturedMedia.location} (source "device") when one was available.
     */
    onCaptured(media: CapturedMedia): void
    /** The reporter backed out of the viewfinder without capturing. */
    onCancel(): void
  }
  ```

  (c) Inside `CameraCapability`, immediately after the opening brace (before `isAvailable(): boolean`), add:

  ```ts
    /**
     * OPTIONAL renderable viewfinder. Present on hosts that can embed a live camera preview (mobile wires
     * `ReportViewfinder`, a react-native-vision-camera surface); ABSENT on web and on the fakes, which keep
     * the imperative `capture()` path. Shared consumers MUST treat it as optional - `capabilities/__tests__/
     * cameraSeam.test.ts` pins that.
     */
    Viewfinder?: ComponentType<CameraViewfinderProps>
  ```

  (d) In `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/capabilities/index.ts`,
  add `CameraViewfinderProps` to the `export type { … } from "./types"` list (currently lines 16-31),
  directly after `CameraCapability,` (line 18):

  ```ts
    CameraCapability,
    CameraViewfinderProps,
  ```

  (e) In `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/capabilities/fakes/index.ts`,
  extend the `FakeCamera` doc block (verified at lines 23-28) by appending one sentence before the closing
  `*/` on line 28:

  ```ts
   * It deliberately supplies NO `Viewfinder`: a fake has no live preview to embed, so the report wizard's
   * capture step falls back to its tap-to-capture card (the same branch web takes).
  ```

- [ ] **Step 4: Run it and watch it pass.**
  `cd /Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui && pnpm vitest run src/capabilities/__tests__/cameraSeam.test.ts`
  Expected: `Test Files 1 passed (1) / Tests 3 passed (3)`.
  Then `pnpm typecheck` in the same directory — expected: exit 0 with no diagnostics (pnpm always prints
  its own two banner lines, `> @civfix/ui@0.36.1 typecheck …` and the command; those are not output from
  `tsc`).

- [ ] **Step 5: Commit (one repo).**

  ```bash
  git -C /Users/theobong/Documents/GitHub/civfix/civfix-shared add packages/ui/src/capabilities
  git -C /Users/theobong/Documents/GitHub/civfix/civfix-shared commit -m "$(cat <<'EOF'
  feat(ui): add an optional renderable Viewfinder slot to CameraCapability

  The capability was imperative-only, which is why the mobile viewfinder had to be
  a full-screen route above the shell. Hosts that can embed a live preview now
  supply a component; web and the fakes omit it and keep the imperative capture().

  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 3.4: Render the viewfinder inline in `CaptureStep`, outside the wizard's ScrollView

**Files:**
- Modify: `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/bodies/ReportFlowBody.tsx`
- Modify: `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/report/wizardSteps.ts` (delete the retired predicates)
- Test: `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/report/__tests__/wizardSteps.test.ts`

**Interfaces:**
- Consumes: `opensEmbeddedViewfinderOnEnter(step, hasMedia, hasViewfinder, mode)` and `viewfinderSessionActive(step, viewfinderOpen, coveredByDetail)` (Task 3.2); `CameraViewfinderProps`, `CapturedMedia` (Task 3.3); `useCamera(): CameraCapability` (`capabilities/hooks.ts:21`); `useDraftReportStore` `startFromCapture` / `addCapture` (`report/draftStore.ts:149,155`).
- Produces: `CaptureStep` gains the prop `onOpenViewfinder: (() => void) | null`. `autoOpensCameraOnEnter`, `CameraAutoOpenTick` and `stepCameraAutoOpen` are **removed** from `report/wizardSteps.ts` (they were never in the `report/index.ts` barrel — the only consumers are this body and the test file).

- [ ] **Step 1: Write the failing tests.** In
  `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/report/__tests__/wizardSteps.test.ts`:

  1. Delete `autoOpensCameraOnEnter,` and `stepCameraAutoOpen,` from the import block.
  2. Delete the whole `describe("stepCameraAutoOpen", …)` block (6 `it`s) and the whole
     `describe("autoOpensCameraOnEnter", …)` block (4 `it`s). **Match them by their `describe(` header
     lines, not by a line range**: at HEAD they are lines 165-221 and 223-246, but Task 3.2 Step 1 added
     two names to the import block, so before this edit they sit two lines lower — 167-223 and 225-248.
     Deleting the import lines first (step 1 above) moves them back to 165-221 / 223-246. Do steps 1 and 2
     in that order and the HEAD ranges are correct again.
  3. Add this in their place:

  ```ts
  describe("the capture step's embedded viewfinder wiring", () => {
    it("takes the mount-time decision ONCE, in a lazy useState initializer - not in an effect", () => {
      // The retired `stepCameraAutoOpen` latch existed only because the decision lived in a useEffect that
      // could be RE-ENTERED when the draft went 1 -> 0 media: the reporter tapping the X on their own last
      // thumbnail (to swap it for a library pick) used to get a full-screen camera thrown over them
      // mid-edit. A lazy initializer cannot be re-entered at all, so the trap is gone with the latch.
      expect(wizardSource).toContain("const [viewfinderOpen, setViewfinderOpen] = useState(() => {")
      expect(wizardSource).toContain(
        "opensEmbeddedViewfinderOnEnter(resumeStep(d, mode), d.media.length > 0, Viewfinder != null, mode)",
      )
      // ...and LANDSCAPE still awaits the imperative capture() route: the Capture button gets a null
      // handler there, so it falls through to `camera.capture()` exactly as it does on web.
      expect(wizardSource).toContain(
        'onOpenViewfinder={Viewfinder && mode === "compact" ? openViewfinder : null}',
      )
      expect(wizardSource).not.toContain("stepCameraAutoOpen")
      expect(wizardSource).not.toContain("autoOpened.current")
    })

    it("gates the camera SESSION on the shared predicate, not merely on being mounted", () => {
      expect(wizardSource).toContain(
        "viewfinderSessionActive(activeStep, viewfinderOpen, stack.length > 0)",
      )
      expect(wizardSource).toContain("active={sessionActive}")
    })

    it("renders the viewfinder OUTSIDE the shared vertical ScrollView, and never in expanded", () => {
      // A live camera preview inside a vertical scroller fights the scroller's pan recognizer, so the
      // viewfinder is the OTHER branch of the ternary that owns the scroll region - it must appear before
      // the scroller's contentContainerStyle in the source, never inside it.
      const viewfinder = wizardSource.indexOf("style={styles.viewfinderLayer}")
      const scrollBody = wizardSource.indexOf("contentContainerStyle={styles.content}")
      expect(viewfinder).toBeGreaterThan(0)
      expect(viewfinder).toBeLessThan(scrollBody)
      // The RENDER carries the compact gate too, not just the mount-time initializer: rotating an iPad to
      // landscape mid-viewfinder must UNMOUNT the surface (which releases the session for free) rather than
      // leave a live preview inside the 300-560pt ExpandedShell sidebar card.
      expect(wizardSource).toContain(
        '{mode === "compact" && activeStep === "capture" && viewfinderOpen && Viewfinder ? (',
      )
    })
  })
  ```

- [ ] **Step 2: Run it and watch it fail.**
  `cd /Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui && pnpm vitest run src/report/__tests__/wizardSteps.test.ts`
  Expected failure:
  `AssertionError: expected '/**\n * ReportFlowBody (the "report" …' to contain 'const [viewfinderOpen, setViewfinderOpen] = useState(() => {'`
  Counts: `Tests 3 failed | 27 passed (30)` (37 from Task 3.2, minus the 6 `stepCameraAutoOpen` cases and
  the 4 `autoOpensCameraOnEnter` cases, plus these 3).

- [ ] **Step 3: Rewire the body.** All edits in
  `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/bodies/ReportFlowBody.tsx` unless
  stated otherwise. Line numbers are HEAD line numbers; Task 3.1 changed no line COUNT in this file, so
  they still hold.

  (a) Line 32 — drop the now-unused `Platform` (its only use was the retired auto-open effect;
  `@typescript-eslint/no-unused-vars` is `"error"` in `packages/ui/eslint.config.js`):

  ```tsx
  import { View, Pressable, ScrollView, StyleSheet, ActivityIndicator } from "react-native"
  ```

  (b) Line 60 — add the `CapturedMedia` type import beside the capability hooks:

  ```tsx
  import { useCamera, useGeolocation } from "../capabilities"
  import type { CapturedMedia } from "../capabilities"
  ```

  (c) Lines 68-76 — swap the retired predicates for the new ones in the `wizardSteps` import:

  ```tsx
  import {
    type Step,
    STEP_PHASE,
    stepOrderFor,
    resumeStep,
    showsWizardFooter,
    wizardHeaderMode,
    opensEmbeddedViewfinderOnEnter,
    viewfinderSessionActive,
  } from "../report/wizardSteps"
  ```

  (d) Replace `CaptureStep`'s signature (line 178) and its `run` callback (lines 197-228), and DELETE the
  auto-open effect (lines 230-254, i.e. the `// CAMERA-FIRST (native)` comment through the effect's
  `}, [run])`) entirely. The new head of `CaptureStep`:

  ```tsx
  function CaptureStep({
    onFirstCapture,
    onOpenViewfinder,
  }: {
    onFirstCapture: () => void
    /**
     * Mount the host's EMBEDDED viewfinder on this step, or `null` where there is none to mount - web and
     * the fakes (no injected Viewfinder) AND landscape/expanded (no dock, no tab-bar base inset, and a
     * 300-560pt sidebar card). In all three, "capture" stays the imperative `camera.capture()` await it
     * always was.
     */
    onOpenViewfinder: (() => void) | null
  }) {
  ```

  ...and the new `run`:

  ```tsx
    const run = useCallback(
      async (kind: "capture" | "library") => {
        if (busy) return
        // EMBEDDED VIEWFINDER (compact + a host that injected one): "capture" is no longer an
        // await-a-full-screen-modal call - it MOUNTS the viewfinder inline on this step, so the dock never
        // leaves the screen. The LIBRARY pick keeps its imperative path everywhere (the OS picker is a modal
        // by nature and always was), and so does "capture" wherever `onOpenViewfinder` is null.
        if (kind === "capture" && onOpenViewfinder) {
          onOpenViewfinder()
          return
        }
        setBusy(true)
        setHint(null)
        try {
          const captured =
            kind === "capture"
              ? // Force the output to the portrait-locked viewfinder orientation so a captured photo/video
                // is upright (matches the portrait preview); a library pick keeps its own orientation.
                await camera.capture({ orientation: "portrait" })
              : await camera.pickFromLibrary()
          if (captured) {
            // The FIRST item seeds the draft (mints the idempotency key + the pin from EXIF/GPS); every
            // later item APPENDS, so adding a second photo/video no longer drops the first.
            if (useDraftReportStore.getState().draft.media.length === 0) {
              startFromCapture(captured)
              onFirstCapture()
            } else addCapture(captured)
          }
        } catch {
          setHint(t("capture.camera_error"))
        } finally {
          setBusy(false)
        }
      },
      [busy, camera, startFromCapture, addCapture, onFirstCapture, onOpenViewfinder, t],
    )
  ```

  (e) In `ReportFlowBody`, immediately AFTER `const mode = useLayoutMode()` (line 990), add:

  ```tsx
    // WS3: the host's EMBEDDED viewfinder, when it injected one. Mobile wires a react-native-vision-camera
    // surface through the capability seam; web injects none and keeps its tap-to-open file input, so this is
    // null there and every branch below degrades to the pre-existing imperative path.
    const Viewfinder = useCamera().Viewfinder ?? null
  ```

  (f) Immediately AFTER the `const [step, setStep] = useState<Step>(…)` line (line 1018), add:

  ```tsx
    // Is the embedded viewfinder up? READ ONCE ON MOUNT from the state the reporter ARRIVED with - the same
    // contract the retired `stepCameraAutoOpen` latch enforced, now structural: a lazy useState initializer
    // cannot be re-entered, so deleting your own last photo can never summon the camera mid-edit (the trap
    // that made the old latch load-bearing). It is `false` on web (no `Viewfinder`) and `false` in
    // landscape/expanded, which has no dock and keeps the imperative capture() route.
    const [viewfinderOpen, setViewfinderOpen] = useState(() => {
      const d = useDraftReportStore.getState().draft
      return opensEmbeddedViewfinderOnEnter(resumeStep(d, mode), d.media.length > 0, Viewfinder != null, mode)
    })
  ```

  (g) Immediately AFTER `const showBack = showBackAffordance({ stack, mode, stepIndex })` (line 1077), add:

  ```tsx
    // May the capture session RUN? `stack.length > 0` is the case that is NOT an unmount: a pushed "scroll"
    // detail presents as a SHEET over this still-mounted base body, so without this the camera would stay
    // hot underneath a full-screen card. Tabbing away unmounts the body outright and needs no gate.
    const sessionActive = viewfinderSessionActive(activeStep, viewfinderOpen, stack.length > 0)
  ```

  (h) Immediately AFTER the `advanceFromCapture` callback (which ends at line 1178), add the two viewfinder
  callbacks:

  ```tsx
    const openViewfinder = useCallback(() => setViewfinderOpen(true), [])
    const closeViewfinder = useCallback(() => setViewfinderOpen(false), [])
    // The embedded viewfinder's shutter. Same two-branch rule as the imperative path: the FIRST item seeds
    // the draft and ADVANCES (the root draws no Continue CTA - see `showsWizardFooter`); a later item only
    // APPENDS and drops back to the media strip, because being thrown forward after adding a 2nd photo
    // would be a trap.
    const onViewfinderCaptured = useCallback(
      (media: CapturedMedia) => {
        const store = useDraftReportStore.getState()
        setViewfinderOpen(false)
        if (store.draft.media.length === 0) {
          store.startFromCapture(media)
          advanceFromCapture()
          return
        }
        store.addCapture(media)
      },
      [advanceFromCapture],
    )
  ```

  (i) Replace the whole `<ScrollView …>…</ScrollView>` block (lines 1248-1262) with the ternary — the
  viewfinder branch is the OTHER occupant of the scroll region, so it is structurally outside the scroller:

  ```tsx
        {/* WS3: the capture step's EMBEDDED viewfinder OWNS the scroll region while it is up, rather than
            living inside the shared vertical ScrollView below - a live camera preview inside a vertical
            scroller fights the scroller's pan recognizer. It needs no explicit dock inset: the portrait base
            surface is ALREADY padded by the tab-bar footprint (PortraitShell.shared's `baseInsets`), so this
            flex:1 slot bottoms out exactly at the top of the dock instead of behind a translucent one.
            `mode === "compact"` is repeated here on purpose even though the mount-time initializer already
            answered it: a ROTATE to landscape mid-viewfinder must unmount the surface (ExpandedShell has no
            dock and its sidebar card is 300-560pt wide), and unmounting is also what releases the session. */}
        {mode === "compact" && activeStep === "capture" && viewfinderOpen && Viewfinder ? (
          <View style={styles.viewfinderLayer}>
            <Viewfinder
              active={sessionActive}
              onCaptured={onViewfinderCaptured}
              onCancel={closeViewfinder}
            />
          </View>
        ) : (
          <ScrollView
            ref={scrollRef}
            style={styles.scroll}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {activeStep === "capture" ? (
              <CaptureStep
                onFirstCapture={advanceFromCapture}
                onOpenViewfinder={Viewfinder && mode === "compact" ? openViewfinder : null}
              />
            ) : null}
            {activeStep === "location" ? (
              <LocationStep onConfirmed={advanceFromLocation} onCancelled={cancelLocation} />
            ) : null}
            {activeStep === "category" ? <CategoryStep /> : null}
            {activeStep === "details" ? <DetailsStep /> : null}
            {activeStep === "review" ? <ReviewStep onRequestReveal={revealShareBlock} /> : null}
          </ScrollView>
        )}
  ```

  (j) Add the style, directly after `scroll: { flex: 1 },` (line 1421):

  ```tsx
    // The embedded viewfinder's slot: it fills the region between the progress rail and the dock, with the
    // body's own gutter so the preview lines up with every other step's content. NO bottom inset of its own
    // (the base surface already carries the tab-bar footprint - adding one here would inset twice).
    // `neutral.ink` is the letterbox while the camera warms up - the surface itself paints black over it.
    viewfinderLayer: {
      flex: 1,
      marginHorizontal: theme.space["4"],
      marginTop: theme.space["2"],
      marginBottom: theme.space["4"],
      borderRadius: theme.radius.lg,
      overflow: "hidden",
      backgroundColor: theme.colors.neutral.ink,
    },
  ```

  (k) Update the three stale doc references to the retired predicate — the source test asserts
  `not.toContain("stepCameraAutoOpen")`, so ALL of them must go:
  - the file header, line 12 (`` `stepCameraAutoOpen` / `showsWizardFooter` `` →
    `` `opensEmbeddedViewfinderOnEnter` / `showsWizardFooter` ``);
  - `CaptureStep`'s own doc block, lines 171-177 (line 175 says "On NATIVE this step also OPENS the camera
    itself on entry with an empty draft (`stepCameraAutoOpen`)" → rewrite as "In COMPACT, on a host that
    injected a `Viewfinder`, this step's slot is FILLED by that embedded surface on entry with an empty
    draft; web and landscape keep the tap-to-open imperative `capture()` path");
  - line 1441 inside the `photoDrop` style comment (`` `stepCameraAutoOpen` opens the viewfinder over it ``
    → `` the host's embedded `Viewfinder` fills this step instead ``).

  (l) Delete `autoOpensCameraOnEnter` (lines 121-156, doc block included), `CameraAutoOpenTick`
  (lines 158-164) and `stepCameraAutoOpen` (lines 166-197) from
  `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/report/wizardSteps.ts`. (Task 3.2
  appended its two predicates AFTER line 197, so these HEAD ranges are still correct.)

- [ ] **Step 4: Run it and watch it pass.**
  `cd /Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui && pnpm vitest run src/report/__tests__/wizardSteps.test.ts && pnpm typecheck && pnpm lint`
  Expected: `Test Files 1 passed (1) / Tests 30 passed (30)`, then `typecheck` exit 0 and `lint` exit 0,
  each emitting nothing beyond pnpm's own two banner lines (`> @civfix/ui@0.36.1 lint …` + the command). A
  clean `lint` is what confirms the dropped `Platform` import left nothing unused —
  `@typescript-eslint/no-unused-vars` is `"error"` here.

- [ ] **Step 5: Commit.**

  ```bash
  git -C /Users/theobong/Documents/GitHub/civfix/civfix-shared add packages/ui/src/bodies/ReportFlowBody.tsx packages/ui/src/report/wizardSteps.ts packages/ui/src/report/__tests__/wizardSteps.test.ts
  git -C /Users/theobong/Documents/GitHub/civfix/civfix-shared commit -m "$(cat <<'EOF'
  feat(ui): render the report camera inline on the capture step, above the dock

  The viewfinder is now the host-injected CameraCapability.Viewfinder, mounted as
  the capture step's scroll-region occupant rather than pushed as a full-screen
  route - so the dock and the wizard header stay on screen for the whole flow. It
  sits OUTSIDE the shared vertical ScrollView (a live preview fights pan) and its
  session is gated on viewfinderSessionActive, which also covers the pushed-sheet
  case. COMPACT only: landscape has no dock and a 300-560pt sidebar card, so it
  keeps the imperative capture() route. The stepCameraAutoOpen latch retires: the
  decision is a lazy useState initializer now, so the delete-last-photo trap is
  structurally gone.

  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 3.5: Extract the camera-session + mic-deferral policy into a pure mobile module

**Files:**
- Create: `/Users/theobong/Documents/GitHub/civfix/civfix-mobile/apps/community-mobile/src/lib/cameraSession.ts`
- Create (test): `/Users/theobong/Documents/GitHub/civfix/civfix-mobile/apps/community-mobile/src/lib/cameraSession.test.ts`

**Interfaces:**
- Consumes: nothing (the module is import-free by design, mirroring `src/lib/wsAppState.ts`).
- Produces:
  - `type AppLifecycleState = "active" | "background" | "inactive" | "unknown" | "extension"`
  - `const MAX_VIDEO_SECONDS = 10`
  - `interface CameraSessionInputs { hostActive: boolean; appState: AppLifecycleState; hasPermission: boolean; hasDevice: boolean }`
  - `cameraSessionRunning(i: CameraSessionInputs): boolean`
  - `type MicDeferralAction = "record-now" | "defer-until-audio-commits" | "record-without-audio"`
  - `interface MicDeferralInputs { audioEnabled: boolean; granted: boolean }`
  - `micDeferralAction(i: MicDeferralInputs): MicDeferralAction`
  - `startsDeferredRecording(pending: boolean, sessionRunning: boolean): boolean`

- [ ] **Step 1: Write the failing test.** Create
  `/Users/theobong/Documents/GitHub/civfix/civfix-mobile/apps/community-mobile/src/lib/cameraSession.test.ts`
  (node:test + explicit `.ts` specifier, exactly like `src/lib/wsAppState.test.ts`):

  ```ts
  import { test } from "node:test"
  import assert from "node:assert/strict"
  import {
    cameraSessionRunning,
    micDeferralAction,
    startsDeferredRecording,
    type CameraSessionInputs,
  } from "./cameraSession.ts"

  const ready: CameraSessionInputs = {
    hostActive: true,
    appState: "active",
    hasPermission: true,
    hasDevice: true,
  }

  test("the session runs only when the host, the app, the permission AND a device all say yes", () => {
    assert.equal(cameraSessionRunning(ready), true)
    assert.equal(cameraSessionRunning({ ...ready, hostActive: false }), false)
    assert.equal(cameraSessionRunning({ ...ready, hasPermission: false }), false)
    assert.equal(cameraSessionRunning({ ...ready, hasDevice: false }), false)
  })

  test("the session releases on EVERY non-active app state, not just background", () => {
    // iOS fires 'inactive' for the app switcher, Control Center, an incoming call AND while an OS
    // permission alert is up; the capture session must be released there too, or the preview comes back to
    // a half-torn-down session.
    for (const appState of ["background", "inactive", "unknown", "extension"] as const) {
      assert.equal(cameraSessionRunning({ ...ready, appState }), false, appState)
    }
  })

  test("a shutter tap with audio already committed records immediately", () => {
    assert.equal(micDeferralAction({ audioEnabled: true, granted: false }), "record-now")
    assert.equal(micDeferralAction({ audioEnabled: true, granted: true }), "record-now")
  })

  test("a FRESH mic grant DEFERS the clip until the audio prop has committed", () => {
    // THE LOAD-BEARING RULE. vision-camera configures the audio session from the <Camera audio> PROP, so a
    // grant obtained inside the shutter handler is only reflected on the NEXT commit. Recording in the same
    // tick captures the first clip SILENTLY - the exact defect this hop exists to prevent.
    assert.equal(micDeferralAction({ audioEnabled: false, granted: true }), "defer-until-audio-commits")
  })

  test("a DECLINED mic permission still records - just without audio", () => {
    assert.equal(micDeferralAction({ audioEnabled: false, granted: false }), "record-without-audio")
  })

  test("a parked clip WAITS for the session instead of being thrown away", () => {
    // THE HAZARD THE EMBED ADDS, and the reason FALSE here means WAIT and never DROP. On iOS, presenting
    // the microphone permission alert drives AppState to "inactive", so `cameraSessionRunning` is FALSE on
    // the very commit that flips `audioEnabled` - the "active" change lands a tick later. A caller that
    // consumed the park before this check threw the clip away and the record tap silently did nothing.
    assert.equal(startsDeferredRecording(true, true), true)
    assert.equal(startsDeferredRecording(true, false), false)
    assert.equal(startsDeferredRecording(false, true), false)
  })
  ```

- [ ] **Step 2: Run it and watch it fail.**
  `cd /Users/theobong/Documents/GitHub/civfix/civfix-mobile/apps/community-mobile && node --experimental-strip-types --test src/lib/cameraSession.test.ts`
  Expected: the file fails to LOAD, so node reports the whole file as one failing subtest —
  `not ok 1 - src/lib/cameraSession.test.ts` with
  `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/Users/theobong/Documents/GitHub/civfix/civfix-mobile/apps/community-mobile/src/lib/cameraSession.ts' imported from …/src/lib/cameraSession.test.ts`,
  and the summary `# tests 1 / # pass 0 / # fail 1`.

- [ ] **Step 3: Write the module.** Create
  `/Users/theobong/Documents/GitHub/civfix/civfix-mobile/apps/community-mobile/src/lib/cameraSession.ts`:

  ```ts
  /**
   * The report VIEWFINDER's pure policy (no react-native / vision-camera / expo import, so it is unit
   * testable under `node --test`, exactly like ./wsAppState.ts). Two rules live here, both pulled out of
   * app/report/camera.tsx when the viewfinder became EMBEDDABLE on the Report tab:
   *
   *   1. `cameraSessionRunning` - the NEW rule. On the old full-screen route `router.back()` unmounted the
   *      <Camera> for free. Inline it stays mounted while the reporter is on the tab, so something has to
   *      say when the capture session may run. iOS otherwise holds it: battery, heat, and a hard conflict
   *      with any other camera consumer (the post composer's "Camera" attachment row still drives the
   *      imperative capture() route).
   *   2. `micDeferralAction` + `startsDeferredRecording` - the OLD rule, restated so an extract-and-embed
   *      refactor cannot quietly lose it. See `micDeferralAction` for why it is load-bearing.
   */

  /** RN's AppStateStatus, restated locally so this module stays free of react-native imports. */
  export type AppLifecycleState = "active" | "background" | "inactive" | "unknown" | "extension"

  /** The max captured video length (the design's "VIDEO . 10s" cap on the capture surface). */
  export const MAX_VIDEO_SECONDS = 10

  export interface CameraSessionInputs {
    /** The HOST says this surface is what the user is looking at (the CameraViewfinderProps `active` prop). */
    hostActive: boolean
    /** The app's foreground state. Only "active" may run a capture session. */
    appState: AppLifecycleState
    /** Camera permission is granted (vision-camera's `useCameraPermission().hasPermission`). */
    hasPermission: boolean
    /** A back camera device resolved (`useCameraDevice("back") != null`; null on a bare simulator). */
    hasDevice: boolean
  }

  /**
   * May the vision-camera capture session run right now?
   *
   * Every input is a veto, and `appState !== "active"` covers more than backgrounding: iOS fires "inactive"
   * for the app switcher, Control Center, an incoming call AND while an OS permission alert is presented,
   * and the OS tears the session down in those too - leaving `isActive` true just means vision-camera
   * re-arms a session the host may no longer want.
   */
  export function cameraSessionRunning(i: CameraSessionInputs): boolean {
    return i.hostActive && i.appState === "active" && i.hasPermission && i.hasDevice
  }

  /** What a video shutter tap should do about the microphone. */
  export type MicDeferralAction = "record-now" | "defer-until-audio-commits" | "record-without-audio"

  export interface MicDeferralInputs {
    /** The value currently COMMITTED to the <Camera audio> prop - component STATE, not `mic.hasPermission`. */
    audioEnabled: boolean
    /** Did the lazy `mic.requestPermission()` just resolve GRANTED on this tap? */
    granted: boolean
  }

  /**
   * THE MIC-PERMISSION DEFERRAL, stated as a function so it survives refactors.
   *
   * vision-camera configures the audio session from the `<Camera audio>` PROP. A grant obtained INSIDE the
   * shutter handler is only reflected on the NEXT commit, so calling `startRecording` in the same tick
   * captures that first clip SILENTLY. On a fresh grant the caller must therefore PARK the start, flip the
   * `audioEnabled` state, and let an effect fire the recording after the re-render lands. A declined
   * permission is not an error - the clip records without audio, exactly as before.
   */
  export function micDeferralAction({ audioEnabled, granted }: MicDeferralInputs): MicDeferralAction {
    if (audioEnabled) return "record-now"
    return granted ? "defer-until-audio-commits" : "record-without-audio"
  }

  /**
   * May the PARKED (deferred) recording start on THIS commit?
   *
   * FALSE MEANS WAIT, NEVER DROP - and that distinction is the whole reason this is a named function. The
   * caller must NOT clear its `pendingRecordRef` until this returns true. On iOS, presenting the microphone
   * permission alert drives AppState to "inactive", so `cameraSessionRunning` is routinely FALSE on the very
   * commit that flips `audioEnabled` (the alert is dismissing as `requestPermission()` resolves, and RN's
   * AppState "active" change lands on a later tick). A caller that consumed the park before checking the
   * session threw the clip away, the effect could never recover it, and the user's record tap did NOTHING -
   * strictly worse than the silent clip the deferral exists to prevent. With `sessionRunning` in the effect's
   * deps, returning false simply means "try again on the commit where the session comes back"; only a real
   * unmount clears the park.
   */
  export function startsDeferredRecording(pending: boolean, sessionRunning: boolean): boolean {
    return pending && sessionRunning
  }
  ```

- [ ] **Step 4: Run it and watch it pass.**
  `cd /Users/theobong/Documents/GitHub/civfix/civfix-mobile/apps/community-mobile && node --experimental-strip-types --test src/lib/cameraSession.test.ts`
  Expected: `# tests 6 / # pass 6 / # fail 0`.

- [ ] **Step 5: Commit.**

  ```bash
  git -C /Users/theobong/Documents/GitHub/civfix/civfix-mobile add apps/community-mobile/src/lib/cameraSession.ts apps/community-mobile/src/lib/cameraSession.test.ts
  git -C /Users/theobong/Documents/GitHub/civfix/civfix-mobile commit -m "$(cat <<'EOF'
  feat(mobile): extract the camera session + mic-deferral policy as a pure module

  cameraSessionRunning is the new release rule the embedded viewfinder needs (the
  old route got it free from router.back()); micDeferralAction restates the
  vision-camera audio-prop hop so the extract-and-embed refactor cannot lose it,
  and startsDeferredRecording says when a parked clip may start - false means WAIT,
  because the iOS mic alert drives AppState inactive on the very commit that flips
  the audio prop.

  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 3.6: Extract `ReportViewfinder` from the route and register it on `nativeCamera`

**Files:**
- Create: `/Users/theobong/Documents/GitHub/civfix/civfix-mobile/apps/community-mobile/src/components/report/ReportViewfinder.tsx`
- Modify: `/Users/theobong/Documents/GitHub/civfix/civfix-mobile/apps/community-mobile/app/report/camera.tsx` (becomes a thin wrapper)
- Modify: `/Users/theobong/Documents/GitHub/civfix/civfix-mobile/apps/community-mobile/src/lib/nativeCamera.ts:26-27, 100-103`
- Modify (doc only): `/Users/theobong/Documents/GitHub/civfix/civfix-mobile/apps/community-mobile/app/_layout.tsx:70-72, 104-109`

**Interfaces:**
- Consumes: `CameraViewfinderProps`, `CapturedMedia` from `@civfix/ui/capabilities` (Task 3.3); `cameraSessionRunning`, `micDeferralAction`, `startsDeferredRecording`, `MAX_VIDEO_SECONDS`, `AppLifecycleState` from `@/lib/cameraSession` (Task 3.5); `resolveCameraCapture(media: CapturedMedia | null): void` (`src/lib/nativeCamera.ts:49`); `reverseLabel(lat, lng)` (`src/hooks/useReports`).
- Produces: `export function ReportViewfinder(props: CameraViewfinderProps): JSX.Element`; `nativeCamera.Viewfinder = ReportViewfinder`.

**WHAT MUST BE PRESERVED, PRECISELY — THE MIC-PERMISSION DEFERRAL (`app/report/camera.tsx:83`, `:270-277`,
`:301-312`).** Read those lines before writing anything. The mechanism, exactly:

1. `const [audioEnabled, setAudioEnabled] = useState(mic.hasPermission)` (`:83`). `audioEnabled` is
   component STATE seeded from `mic.hasPermission` — it is **never** read straight off `mic.hasPermission`
   at render, because vision-camera configures its audio session from the `<Camera audio>` PROP
   (`:438`, `audio={mode === "video" && audioEnabled}`). A grant obtained inside the shutter handler is
   only visible to the native session on the NEXT commit.
2. `onToggleRecord` (`:301-312`): when `!audioEnabled` and `mic.requestPermission()` resolves granted, it
   sets `pendingRecordRef.current = true`, calls `setAudioEnabled(true)` and **returns without recording**.
3. The effect at `:273-277` — `if (!pendingRecordRef.current) return; pendingRecordRef.current = false;
   beginRecording()`, deps `[audioEnabled, beginRecording]` — starts the parked clip on the commit that
   carried `audio={true}`.

Drop that hop and the first video after granting the mic permission records **silently**.
`pendingRecordRef` must stay a REF (a state flag would add a commit and re-enter the effect), and
`beginRecording` must never be called synchronously in the same tick as `setAudioEnabled(true)`.

**THE ONE THING THE EMBED CHANGES, AND THE TRAP IT SETS.** On the route `isActive` was the literal `true`
(`:435`), so step 3 could consume the park unconditionally. Embedded, `isActive` is
`cameraSessionRunning(...)`, which vetoes on `appState !== "active"` — **and on iOS, presenting the OS
microphone permission alert drives AppState to `"inactive"`.** `await mic.requestPermission()` resolves as
that alert dismisses, and RN's AppState `"active"` change routinely lands on a *later* tick than the
`setAudioEnabled(true)` commit. So the effect's first run after the park very often sees
`sessionRunning === false`.

Therefore: **consume the park only when it can actually start.** Clearing `pendingRecordRef` before the
session check drops the clip permanently — the effect re-runs (it has `sessionRunning` in its deps) but
bails at `if (!pending) return`, so the user taps record right after granting the mic permission and
NOTHING happens. That is strictly worse than the silent clip the deferral exists to prevent. `false` from
`startsDeferredRecording` means WAIT; only a genuine unmount clears the park.

- [ ] **Step 1: Establish the baseline and stage the honest typecheck failure.** There is no React test
  harness in civfix-mobile (the `test` script only runs `node --test` over `tests/`,
  `src/components/*.test.ts`, `src/lib/*.test.ts`, `src/theme/*.test.ts`), so this task's gate is the
  typechecker plus simulator verification.

  **Rsync FIRST — this is a prerequisite, not a convenience.** `@civfix/ui` is installed in civfix-mobile
  as a published package whose `exports` point at `./src/...`, so mobile's `tsc` typechecks against
  `/Users/theobong/Documents/GitHub/civfix/civfix-mobile/node_modules/@civfix/ui/src`. Without this, Task
  3.3's `CameraViewfinderProps` / `Viewfinder` simply do not exist as far as mobile is concerned and the
  step below fails for the wrong reason:

  ```bash
  rsync -a --delete \
    /Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/ \
    /Users/theobong/Documents/GitHub/civfix/civfix-mobile/node_modules/@civfix/ui/src/
  cd /Users/theobong/Documents/GitHub/civfix/civfix-mobile/apps/community-mobile && npx tsc --noEmit
  ```

  Expected right now: clean (exit 0) — this is the baseline the refactor must return to.

  Then create the module the refactor needs, empty, and wire the registration that will consume it:

  ```bash
  mkdir -p /Users/theobong/Documents/GitHub/civfix/civfix-mobile/apps/community-mobile/src/components/report
  printf 'export {}\n' > /Users/theobong/Documents/GitHub/civfix/civfix-mobile/apps/community-mobile/src/components/report/ReportViewfinder.tsx
  ```

  ...and in `src/lib/nativeCamera.ts` add
  `import { ReportViewfinder } from "@/components/report/ReportViewfinder"` plus `Viewfinder: ReportViewfinder,`
  as the first member of the `nativeCamera` object literal. (This is real work, not a manufactured red: the
  registration is step 3(c)'s content, written first.)

- [ ] **Step 2: Run the typecheck and watch it fail.**
  `cd /Users/theobong/Documents/GitHub/civfix/civfix-mobile/apps/community-mobile && npx tsc --noEmit`
  Expected failure:
  `src/lib/nativeCamera.ts:…: error TS2305: Module '"@/components/report/ReportViewfinder"' has no exported member 'ReportViewfinder'.`

- [ ] **Step 3: Write the component and thin the route.**

  (a) `/Users/theobong/Documents/GitHub/civfix/civfix-mobile/apps/community-mobile/src/components/report/ReportViewfinder.tsx`:

  ```tsx
  /**
   * ReportViewfinder - the reusable react-native-vision-camera capture SURFACE, lifted out of the old
   * app/report/camera.tsx screen so it can be rendered in TWO places:
   *
   *   1. INLINE on the Report tab's capture step (COMPACT only), injected through the @civfix/ui camera
   *      capability's renderable `Viewfinder` slot (src/lib/nativeCamera.ts). The liquid-glass dock and the
   *      wizard's own header stay on screen around it - that is the whole point of the embed.
   *   2. As the full-screen /report/camera route, which the IMPERATIVE `camera.capture()` path still pushes
   *      for the post composer's "Camera" attachment row, the profile avatar picker, and the wizard in
   *      landscape/expanded (no dock there, so no embed).
   *
   * Everything the old screen did is preserved: the viewfinder + dashed framing inset, the in-viewfinder
   * live-GPS chip, the PHOTO / "VIDEO . 10s" toggle, the 78px shutter + live timer, the 10s hard stop, the
   * library fallback, and the device GPS captured at the shutter (which rides back on
   * CapturedMedia.location as source "device").
   *
   * ============================ THE MIC-PERMISSION DEFERRAL - DO NOT SIMPLIFY ============================
   * vision-camera configures its audio session from the <Camera audio> PROP, so a mic grant obtained inside
   * the shutter handler is only reflected on the NEXT commit. Three pieces, all load-bearing:
   *
   *   (1) `audioEnabled` is STATE (seeded from mic.hasPermission), never read straight off
   *       `mic.hasPermission` at render - it is what drives the `audio` prop.
   *   (2) On a FRESH grant, `onToggleRecord` PARKS the start in `pendingRecordRef` (a REF: a state flag
   *       would add a commit and re-enter the effect) and returns without recording.
   *   (3) The effect below starts the parked clip only after the commit that put `audio={true}` on the
   *       <Camera> has landed.
   *
   * Without that hop the FIRST clip after granting the permission records silently.
   *
   * WHAT THE EMBED ADDS, AND THE HOLE IT IS EASY TO CUT. On the route `isActive` was the literal `true`, so
   * (3) could consume the park unconditionally. Here `isActive` is `cameraSessionRunning(...)`, which vetoes
   * on `appState !== "active"` - and on iOS the OS microphone alert ITSELF drives AppState to "inactive".
   * `requestPermission()` resolves as that alert dismisses, and the "active" change routinely lands a tick
   * AFTER the `setAudioEnabled(true)` commit, so the effect's first run usually sees a DOWN session.
   * Consuming the park there (clear-then-check) drops the clip forever: the effect re-runs when the session
   * returns but bails on the already-cleared ref, and the user's record tap silently does nothing. So the
   * park is checked BEFORE it is consumed, `sessionRunning` is in the deps precisely so the retry happens,
   * and only a genuine unmount clears it. `startsDeferredRecording` is that rule, unit-tested in
   * @/lib/cameraSession.
   * =======================================================================================================
   *
   * THE OTHER NEW HAZARD - THE SESSION LIFECYCLE. On the route `router.back()` unmounted the <Camera> for
   * free. Inline it stays mounted while the reporter is on the tab, so `isActive` is driven by
   * `cameraSessionRunning`: the host's `active` prop AND the app being foregrounded AND a granted permission
   * AND a real device. A pause while recording stops the clip first (so vision-camera is not writing into a
   * session the OS is tearing down).
   */
  import React, { useCallback, useEffect, useRef, useState } from "react"
  import { AppState, View, Pressable, StyleSheet, ActivityIndicator } from "react-native"
  import { Ionicons } from "@expo/vector-icons"
  import {
    Camera,
    useCameraDevice,
    useCameraPermission,
    useMicrophonePermission,
    type VideoFile,
    type PhotoFile,
  } from "react-native-vision-camera"
  import * as ImagePicker from "expo-image-picker"
  import * as Location from "expo-location"
  import { theme } from "@/theme"
  import { Text } from "@civfix/ui"
  import type { CameraViewfinderProps, CapturedMedia } from "@civfix/ui/capabilities"
  import { useT } from "@civfix/ui/i18n"
  import {
    MAX_VIDEO_SECONDS,
    cameraSessionRunning,
    micDeferralAction,
    startsDeferredRecording,
    type AppLifecycleState,
  } from "@/lib/cameraSession"
  import { reverseLabel } from "@/hooks/useReports"

  type CaptureMode = "photo" | "video"

  // Saturated "recording" red for the live-record affordances (the rec-badge dot + the shutter's recording
  // state). Deliberately the Apple-HIG record red, NOT the brand coral - there is no matching red in the
  // theme palette and the recording cue must stay a saturated red, so it is one named constant here.
  const RECORDING_RED = "#FF3B30"

  export function ReportViewfinder({
    active,
    mode: initialMode = "photo",
    onCaptured,
    onCancel,
  }: CameraViewfinderProps) {
    const { t } = useT("mobile-report-camera")

    const cameraPermission = useCameraPermission()
    const mic = useMicrophonePermission()
    const device = useCameraDevice("back")

    const cameraRef = useRef<Camera>(null)
    const [mode, setMode] = useState<CaptureMode>(initialMode)
    const [recording, setRecording] = useState(false)
    const [busy, setBusy] = useState(false)
    // Display-only elapsed seconds while recording (drives the "x.xs / 10s" badge). Separate from the
    // hard-stop timer below so the UI ticker can never affect when recording actually ends.
    const [elapsed, setElapsed] = useState(0)
    // Live location label for the in-viewfinder GPS chip (best effort; falls back to coords / a hint).
    const [locLabel, setLocLabel] = useState<string | null>(null)
    // (1) of the mic deferral: drives the <Camera> `audio` prop. Kept as STATE (not read straight off
    // `mic.hasPermission`) because vision-camera configures the audio session from that prop - a grant
    // obtained inside the shutter handler is only reflected on the NEXT commit, so a recording started in
    // the same tick would be captured silently.
    const [audioEnabled, setAudioEnabled] = useState(mic.hasPermission)
    // (2) of the mic deferral: the PARKED shutter. A ref, not state - a state flag would add a commit and
    // re-enter the effect below. Cleared ONLY by the effect (once it can actually start) or by unmount.
    const pendingRecordRef = useRef(false)
    // Live recording flag for callbacks/timers that must read the current value (not a stale closure).
    const recordingRef = useRef(false)
    const hardStopRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)

    // The app's foreground state. iOS tears the capture session down on background AND on the 'inactive'
    // transitions (app switcher, Control Center, an incoming call, and an OS permission alert); embedded,
    // this surface is still mounted through all of them, so it has to say so rather than relying on an
    // unmount.
    const [appState, setAppState] = useState<AppLifecycleState>(
      AppState.currentState as AppLifecycleState,
    )
    useEffect(() => {
      const sub = AppState.addEventListener("change", (next) =>
        setAppState(next as AppLifecycleState),
      )
      return () => sub.remove()
    }, [])

    const sessionRunning = cameraSessionRunning({
      hostActive: active,
      appState,
      hasPermission: cameraPermission.hasPermission,
      hasDevice: device != null,
    })

    const clearHardStop = useCallback(() => {
      if (hardStopRef.current) {
        clearTimeout(hardStopRef.current)
        hardStopRef.current = null
      }
    }, [])
    const clearTick = useCallback(() => {
      if (tickRef.current) {
        clearInterval(tickRef.current)
        tickRef.current = null
      }
    }, [])
    const setRecordingState = useCallback(
      (next: boolean) => {
        recordingRef.current = next
        setRecording(next)
        if (!next) {
          clearHardStop()
          clearTick()
        }
      },
      [clearHardStop, clearTick],
    )

    // TEARDOWN. Clears any pending timers so they cannot fire on a torn-down camera, AND drops the parked
    // recording - the ONLY place the park is discarded without starting. (The deferral effect below must
    // never discard it: a DOWN session means "wait", not "give up".)
    useEffect(() => {
      return () => {
        pendingRecordRef.current = false
        clearHardStop()
        clearTick()
      }
    }, [clearHardStop, clearTick])

    // Best-effort live GPS label for the viewfinder chip: read the current fix and reverse-label it. Purely
    // cosmetic - the canonical fix is captured at shutter time in `emitCapture` below.
    useEffect(() => {
      let alive = true
      void (async () => {
        try {
          const current = await Location.getForegroundPermissionsAsync()
          if (current.status !== Location.PermissionStatus.GRANTED) return
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
          if (!alive) return
          const coords = `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`
          setLocLabel(coords)
          try {
            const res = await reverseLabel(pos.coords.latitude, pos.coords.longitude)
            if (alive && res.cityStateLabel) setLocLabel(res.cityStateLabel)
          } catch {
            // Reverse-label is best effort; keep the raw coords.
          }
        } catch {
          // No fix available (denied / simulator): the chip shows the locating hint.
        }
      })()
      return () => {
        alive = false
      }
    }, [])

    /**
     * Hand the captured media to the host, with the best-effort device GPS at the shutter attached as
     * CapturedMedia.location source "device". An instant last-known fix (<= 60s) is preferred so the return
     * is snappy; only with no cached fix do we fall back to a single balanced read. The wizard still has a
     * location step where the user confirms/adjusts the pin, so a missing fix is fine.
     */
    const emitCapture = useCallback(
      (media: CapturedMedia) => {
        void (async () => {
          let located: CapturedMedia = media
          try {
            let granted =
              (await Location.getForegroundPermissionsAsync()).status ===
              Location.PermissionStatus.GRANTED
            if (!granted) {
              granted =
                (await Location.requestForegroundPermissionsAsync()).status ===
                Location.PermissionStatus.GRANTED
            }
            if (granted) {
              const last = await Location.getLastKnownPositionAsync({ maxAge: 60_000 })
              const pos =
                last ??
                (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }))
              if (pos) {
                located = {
                  ...media,
                  location: { lat: pos.coords.latitude, lng: pos.coords.longitude, source: "device" },
                }
              }
            }
          } catch {
            // Location unavailable (denied / simulator without a fix): hand back the media with no location.
          }
          onCaptured(located)
        })()
      },
      [onCaptured],
    )

    const onTakePhoto = useCallback(async () => {
      if (!cameraRef.current || busy) return
      setBusy(true)
      try {
        const photo: PhotoFile = await cameraRef.current.takePhoto({ flash: "off" })
        emitCapture({
          uri: photo.path.startsWith("file://") ? photo.path : `file://${photo.path}`,
          kind: "image",
          mime: "image/jpeg",
          width: photo.width,
          height: photo.height,
        })
      } catch {
        setBusy(false)
      }
    }, [busy, emitCapture])

    /** Start the clip. Only called once the <Camera> is rendered with the intended `audio` setting. */
    const beginRecording = useCallback(() => {
      if (!cameraRef.current) return
      setElapsed(0)
      setRecordingState(true)
      clearTick()
      tickRef.current = setInterval(() => {
        setElapsed((e) => Math.min(MAX_VIDEO_SECONDS, Math.round((e + 0.1) * 10) / 10))
      }, 100)
      cameraRef.current.startRecording({
        fileType: "mp4",
        videoCodec: "h264",
        onRecordingFinished: (video: VideoFile) => {
          setRecordingState(false)
          emitCapture({
            uri: video.path.startsWith("file://") ? video.path : `file://${video.path}`,
            kind: "video",
            mime: "video/mp4",
            width: video.width,
            height: video.height,
            durationSec: video.duration,
          })
        },
        onRecordingError: () => {
          setRecordingState(false)
          setBusy(false)
        },
      })

      // Hard stop at the max duration so clips stay short. Track the id so an early stop / finish / error
      // (or unmount) cancels it; otherwise a stale timer could stop a *later* recording prematurely.
      clearHardStop()
      hardStopRef.current = setTimeout(() => {
        hardStopRef.current = null
        if (cameraRef.current && recordingRef.current) {
          cameraRef.current.stopRecording().catch(() => {})
        }
      }, MAX_VIDEO_SECONDS * 1000)
    }, [clearHardStop, clearTick, emitCapture, setRecordingState])

    // (3) of the mic deferral. The grant obtained inside onToggleRecord parks the shutter here: once the
    // commit that flipped `audioEnabled` (and with it the <Camera> `audio` prop) has landed, start the
    // deferred clip - so the FIRST video after granting the permission records WITH audio rather than
    // silently.
    //
    // THE PARK IS CHECKED BEFORE IT IS CONSUMED, AND THAT ORDER IS THE WHOLE POINT. On iOS the OS microphone
    // alert drives AppState to "inactive", so `sessionRunning` is routinely FALSE on the very commit that
    // flips `audioEnabled`, with the "active" change landing a tick later. Clearing the ref first (the
    // shape the route could get away with, because its isActive was the literal `true`) would throw the clip
    // away: this effect re-runs when the session returns, but on an already-cleared ref it bails and the
    // user's record tap silently does nothing. `sessionRunning` is in the deps precisely so this RETRIES;
    // only the teardown effect above ever discards the park.
    useEffect(() => {
      if (!startsDeferredRecording(pendingRecordRef.current, sessionRunning)) return
      pendingRecordRef.current = false
      beginRecording()
    }, [audioEnabled, beginRecording, sessionRunning])

    // Keep the audio prop in step with a grant that arrived outside the shutter (e.g. already granted from a
    // previous session and resolving after the first render).
    useEffect(() => {
      if (mic.hasPermission) setAudioEnabled(true)
    }, [mic.hasPermission])

    // PAUSE STOPS THE CLIP. Flipping `isActive` to false with a recording in flight leaves vision-camera
    // writing into a session the OS is about to tear down, so stop first and let onRecordingFinished hand the
    // clip back normally.
    useEffect(() => {
      if (sessionRunning || !recordingRef.current) return
      clearHardStop()
      cameraRef.current?.stopRecording().catch(() => {})
    }, [sessionRunning, clearHardStop])

    const onToggleRecord = useCallback(async () => {
      if (!cameraRef.current || busy) return

      if (recordingRef.current) {
        // User tapped stop before the cap: cancel the hard-stop timer so it cannot fire on a later clip.
        clearHardStop()
        setBusy(true)
        try {
          await cameraRef.current.stopRecording()
        } catch {
          setRecordingState(false)
          setBusy(false)
        }
        return
      }

      // (2) of the mic deferral. Request mic permission lazily for video; proceed without audio if declined.
      // On a FRESH grant the <Camera> still has `audio={false}` committed, so PARK the start and let the
      // effect above fire it after the re-render instead of recording this clip without sound. The
      // short-circuit mirrors the route's `if (!audioEnabled) { const granted = await ... }`: when audio is
      // already committed the permission is never re-requested.
      const granted = audioEnabled ? false : await mic.requestPermission()
      if (micDeferralAction({ audioEnabled, granted }) === "defer-until-audio-commits") {
        pendingRecordRef.current = true
        setAudioEnabled(true)
        return
      }
      beginRecording()
    }, [audioEnabled, beginRecording, busy, clearHardStop, mic, setRecordingState])

    const onPickFromLibrary = useCallback(async () => {
      if (busy) return
      setBusy(true)
      try {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images", "videos"],
          quality: 1,
          videoMaxDuration: MAX_VIDEO_SECONDS,
        })
        if (result.canceled || result.assets.length === 0) {
          setBusy(false)
          return
        }
        const asset = result.assets[0]!
        const isVideo = asset.type === "video"
        emitCapture({
          uri: asset.uri,
          kind: isVideo ? "video" : "image",
          mime: asset.mimeType ?? (isVideo ? "video/mp4" : "image/jpeg"),
          ...(asset.width ? { width: asset.width } : {}),
          ...(asset.height ? { height: asset.height } : {}),
          ...(isVideo && asset.duration ? { durationSec: asset.duration / 1000 } : {}),
        })
      } catch {
        setBusy(false)
      }
    }, [busy, emitCapture])

    // ----- Live camera (design `.pi-report-overlay` dark chrome) -----
    return (
      <View style={styles.cameraRoot}>
        {/* Viewfinder */}
        <View style={styles.viewfinder}>
          <Camera
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            device={device!}
            // THE SESSION GATE. False releases the capture session without unmounting - see
            // @/lib/cameraSession.cameraSessionRunning for every veto that feeds it.
            isActive={sessionRunning}
            photo={mode === "photo"}
            video={mode === "video"}
            audio={mode === "video" && audioEnabled}
            // The app is hard-locked to portrait (app.config.js), so "preview" makes every captured
            // photo/video come out in the portrait preview orientation - upright, matching the viewfinder.
            outputOrientation="preview"
          />

          {/* Close chip: the surface's own exit. Embedded it returns the reporter to the capture card (with
              its "Choose from library" link); on the /report/camera route the host pops the screen. */}
          <Pressable
            onPress={onCancel}
            accessibilityRole="button"
            accessibilityLabel={t("header.close")}
            hitSlop={10}
            style={({ pressed }) => [styles.closeChip, pressed ? styles.pressed : null]}
          >
            <Ionicons name="close" size={20} color={theme.colors.neutral.card} />
          </Pressable>

          {/* In-viewfinder GPS chip (live device location). */}
          <View style={styles.gpsChip}>
            <Ionicons name="location" size={14} color={theme.colors.brand.bloom} />
            <Text style={styles.gpsText} numberOfLines={1}>
              {locLabel ?? t("gps.locating")}
            </Text>
          </View>

          {/* Dashed framing inset. */}
          <View style={styles.frame} pointerEvents="none" />

          {/* Recording badge with the live timer. */}
          {recording ? (
            <View style={styles.recBadge}>
              <View style={styles.recDot} />
              <Text style={styles.recText}>{t("timer.elapsed", { elapsed: elapsed.toFixed(1) })}</Text>
            </View>
          ) : null}
        </View>

        {/* Controls: mode toggle + shutter. */}
        <View style={styles.controls}>
          <View style={styles.modes}>
            <Pressable onPress={() => !recording && setMode("photo")} hitSlop={8}>
              <Text style={[styles.modeText, mode === "photo" ? styles.modeOn : null]}>
                {t("mode.photo")}
              </Text>
            </Pressable>
            <Pressable onPress={() => !recording && setMode("video")} hitSlop={8}>
              <Text style={[styles.modeText, mode === "video" ? styles.modeOn : null]}>
                {t("mode.video")}
              </Text>
            </Pressable>
          </View>

          <View style={styles.shutterRow}>
            {/* Library fallback (kept; the design hides it, but it is our no-camera affordance). */}
            <Pressable
              onPress={onPickFromLibrary}
              disabled={busy || recording}
              accessibilityRole="button"
              accessibilityLabel={t("gate.choose_library")}
              style={styles.sideBtn}
            >
              <Ionicons name="images" size={22} color={theme.colors.neutral.card} />
            </Pressable>

            {/* Shutter: 78px white; red with a stop square while recording. */}
            <Pressable
              onPress={mode === "photo" ? onTakePhoto : onToggleRecord}
              disabled={busy && !recording}
              accessibilityRole="button"
              accessibilityLabel={
                mode === "photo"
                  ? t("shutter.take_photo")
                  : recording
                    ? t("shutter.stop_recording")
                    : t("shutter.start_recording")
              }
              style={({ pressed }) => [
                styles.shutter,
                recording ? styles.shutterRec : null,
                pressed && !(busy && !recording) ? styles.shutterPressed : null,
              ]}
            >
              {busy && !recording ? (
                <ActivityIndicator color={theme.colors.text} />
              ) : recording ? (
                <View style={styles.stopSquare} />
              ) : null}
            </Pressable>

            {/* Spacer to balance the row. */}
            <View style={styles.sideBtn} />
          </View>
        </View>
      </View>
    )
  }

  const styles = StyleSheet.create({
    cameraRoot: { flex: 1, backgroundColor: "#000" },
    pressed: { opacity: 0.6 },

    // ----- Viewfinder -----
    // No marginHorizontal / borderRadius any more (the route had `marginHorizontal: 12, borderRadius: 24`):
    // embedded, the HOST's `viewfinderLayer` already supplies the body gutter and the corner radius, so a
    // second inset here would double it.
    viewfinder: {
      flex: 1,
      overflow: "hidden",
      backgroundColor: "#1a1a1a",
    },
    closeChip: {
      position: "absolute",
      top: 16,
      right: 16,
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(255,255,255,0.14)",
    },
    // `right: 66` (not 16) leaves room for the close chip, which the route drew in its own header row.
    gpsChip: {
      position: "absolute",
      top: 16,
      left: 16,
      right: 66,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: "rgba(0,0,0,0.45)",
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
    },
    gpsText: {
      flex: 1,
      fontFamily: theme.fontFamily.bodySemiBold,
      fontSize: theme.fontSize["12"],
      color: theme.colors.neutral.card,
    },
    frame: {
      position: "absolute",
      top: 60,
      left: 60,
      right: 60,
      bottom: 60,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.18)",
      borderStyle: "dashed",
      borderRadius: 8,
    },
    recBadge: {
      position: "absolute",
      top: 60,
      alignSelf: "center",
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: "rgba(0,0,0,0.65)",
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: theme.radius.pill,
    },
    recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: RECORDING_RED },
    recText: {
      fontFamily: theme.fontFamily.bodySemiBold,
      fontSize: theme.fontSize["12"],
      color: theme.colors.neutral.card,
    },

    // ----- Controls -----
    // The safe-area padding is GONE (it was `Math.max(insets.bottom, space5) + 6` on the full-screen route):
    // embedded, the host's base surface is already inset by the tab-bar footprint, so re-adding the home
    // indicator here would push the shutter a second inset up the screen. The /report/camera wrapper below
    // re-applies `insets.bottom` at ITS root, which is the only place that still owns a safe area.
    controls: {
      paddingTop: 18,
      paddingBottom: theme.space["4"],
      alignItems: "center",
      backgroundColor: "#000",
    },
    modes: { flexDirection: "row", justifyContent: "center", gap: 30, marginBottom: 18 },
    modeText: {
      fontFamily: theme.fontFamily.bodyBold,
      fontSize: theme.fontSize["12"],
      letterSpacing: 1,
      color: "rgba(255,255,255,0.6)",
    },
    modeOn: { color: theme.colors.sun["300"] },
    shutterRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      width: "100%",
      maxWidth: 320,
    },
    sideBtn: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
    shutter: {
      width: 78,
      height: 78,
      borderRadius: 39,
      backgroundColor: theme.colors.neutral.card,
      borderWidth: 4,
      borderColor: "rgba(255,255,255,0.5)",
      alignItems: "center",
      justifyContent: "center",
    },
    shutterRec: { backgroundColor: RECORDING_RED },
    shutterPressed: { transform: [{ scale: 0.94 }] },
    stopSquare: { width: 24, height: 24, borderRadius: 5, backgroundColor: theme.colors.neutral.card },
  })
  ```

  (Note: `device!` is safe because Task 3.7 adds the gate branch that returns early when
  `device == null`; write Task 3.7 immediately after this one so the non-null assertion never ships alone.
  Until then, `cameraSessionRunning` already keeps `isActive` false in that state.)

  (b) Replace the ENTIRE contents of
  `/Users/theobong/Documents/GitHub/civfix/civfix-mobile/apps/community-mobile/app/report/camera.tsx` with
  the thin wrapper:

  ```tsx
  /**
   * REPORT CAPTURE SURFACE ROUTE - a thin wrapper around <ReportViewfinder/>.
   *
   * The viewfinder itself now lives in src/components/report/ReportViewfinder so it can ALSO be rendered
   * inline on the Report tab through the camera capability's renderable `Viewfinder` slot. This route
   * survives because the IMPERATIVE `nativeCamera.capture()` path still uses it: the post composer's
   * "Camera" attachment row (@civfix/ui `useComposerAttachments`), the profile avatar picker, and the report
   * wizard in LANDSCAPE (where there is no dock to keep visible, so no embed) all await a CapturedMedia from
   * a pushed surface. The compact report wizard no longer routes through here at all.
   */
  import React, { useCallback, useEffect, useState } from "react"
  import { View, StyleSheet } from "react-native"
  import { useRouter } from "expo-router"
  import { useSafeAreaInsets } from "react-native-safe-area-context"
  import type { CapturedMedia } from "@civfix/ui/capabilities"
  import { theme } from "@/theme"
  import { resolveCameraCapture } from "@/lib/nativeCamera"
  import { ReportViewfinder } from "@/components/report/ReportViewfinder"

  export default function ReportCameraScreen() {
    const router = useRouter()
    const insets = useSafeAreaInsets()
    // Release the session the moment we start leaving, so the <Camera> is not still live through the pop.
    const [active, setActive] = useState(true)

    // Bridge safety net: if the surface unmounts WITHOUT having resolved a capture (a hardware-back swipe, a
    // gesture dismiss), resolve the awaiting `capture()` promise with null so the caller never hangs. If a
    // capture already resolved it, `resolveCameraCapture` is a no-op (the pending resolver was consumed).
    useEffect(() => () => resolveCameraCapture(null), [])

    const onCaptured = useCallback(
      (media: CapturedMedia) => {
        setActive(false)
        resolveCameraCapture(media)
        router.back()
      },
      [router],
    )
    const onCancel = useCallback(() => {
      setActive(false)
      router.back()
    }, [router])

    return (
      <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <ReportViewfinder active={active} onCaptured={onCaptured} onCancel={onCancel} />
      </View>
    )
  }

  const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.colors.bg },
  })
  ```

  (c) In `/Users/theobong/Documents/GitHub/civfix/civfix-mobile/apps/community-mobile/src/lib/nativeCamera.ts`:
  replace `export const MAX_VIDEO_SECONDS = 10` (line 27) and its doc comment (line 26) with a re-export
  from the pure module (so the constant has ONE home and `nativeCamera.ts` -> `ReportViewfinder` ->
  `cameraSession` stays acyclic — `ReportViewfinder` never imports `nativeCamera`), and register the
  component:

  ```ts
  import { MAX_VIDEO_SECONDS } from "@/lib/cameraSession"
  import { ReportViewfinder } from "@/components/report/ReportViewfinder"

  /** Re-exported so existing importers keep working; the value lives in @/lib/cameraSession. */
  export { MAX_VIDEO_SECONDS }
  ```

  ...and inside the `nativeCamera` object literal (line 100), as its FIRST member (before
  `isAvailable(): boolean` on line 101):

  ```ts
  export const nativeCamera: CameraCapability = {
    /**
     * The RENDERABLE capture surface (@civfix/ui's CameraCapability.Viewfinder slot). The shared report
     * wizard mounts this INLINE on its capture step in COMPACT, so the dock never leaves the screen. The
     * imperative `capture()` below still pushes /report/camera for callers that need an awaited modal (the
     * post composer's "Camera" row, the avatar picker, and the wizard in landscape).
     */
    Viewfinder: ReportViewfinder,

    isAvailable(): boolean {
  ```

  (d) In `/Users/theobong/Documents/GitHub/civfix/civfix-mobile/apps/community-mobile/app/_layout.tsx`,
  update the `camera:` bullet in the `mobileCapabilities` doc (verified at lines 70-72) to:

  ```
   *   - camera: the native CameraCapability - the RENDERABLE vision-camera viewfinder (rendered INLINE on
   *     the Report tab's capture step in compact) + the device GPS at shutter + the library fallback + the
   *     compressor/expo-crypto byte prep the shared upload pipeline runs on. Its imperative `capture()`
   *     still opens the /report/camera surface for the post composer's "Camera" row (registered below).
  ```

  ...and the `CameraNavigatorBridge` doc (verified at lines 104-109 — the function itself begins at line
  110) to say it now serves only the imperative path:

  ```
   * Register how the native camera capability opens its IMPERATIVE capture surface (the /report/camera
   * screen). Renders nothing; mounted once so `nativeCamera.capture()` can navigate to the surface and await
   * the captured media. The COMPACT report wizard no longer uses it - it renders the same viewfinder inline
   * through the capability's `Viewfinder` slot - but the post composer's "Camera" attachment row, the avatar
   * picker and the landscape wizard still await a pushed surface, so this stays. Lives inside the router
   * tree so it holds a live `router`.
  ```

- [ ] **Step 4: Run the typecheck + the simulator.**
  `cd /Users/theobong/Documents/GitHub/civfix/civfix-mobile/apps/community-mobile && npx tsc --noEmit && npx eslint app/report/camera.tsx src/components/report/ReportViewfinder.tsx src/lib/nativeCamera.ts`
  Expected: no output (exit 0) from both. (If `tsc` reports unknown property `Viewfinder` on
  `CameraCapability`, the Step 1 rsync did not run — re-run it.)

  Then verify on the iOS simulator (there is no RN test harness in this repo, so this IS the verification):
  1. `rsync -a --delete /Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/ /Users/theobong/Documents/GitHub/civfix/civfix-mobile/node_modules/@civfix/ui/src/`
  2. Attach the simulator panel FIRST (`mcp__Claude_Code_iOS_Simulator__control` with `action: "attach"`),
     then build + launch the dev client.
  3. Tap the **Report** dock tab. EXPECT: the 32pt "Report an issue" title, the coral progress rail, a live
     viewfinder filling the region below them with rounded corners, **and the liquid-glass dock still
     visible at the bottom** — nothing full-screen, no route push.
  4. Tap the shutter. EXPECT: the wizard advances to step 2 ("What is it?") in place, the dock never
     flickers, and the media strip on a Back shows exactly one thumbnail.
  5. Switch to **VIDEO · 10s**, tap record, tap stop before 10s. EXPECT: the rec badge counts up, the clip
     lands, the wizard advances. (On a simulator with no camera device this step falls through to the
     Task 3.7 gate — run it on a device or a simulator with a virtual camera.)
  6. **Mic deferral check (device only) — the regression the whole `pendingRecordRef` hop exists for:**
     delete the app, reinstall, go straight to Report → VIDEO → record. Grant the mic permission in the OS
     dialog. EXPECT: recording starts *after* the dialog closes (one commit later, not instantly) and the
     resulting clip **has audio**. If recording does not begin within about a second, background the app
     once and reopen it — it must start then. That second case is the park surviving the `"inactive"` window
     the OS alert put the app into, i.e. exactly what `startsDeferredRecording` returning false must mean.
     If neither happens, the park was consumed before the session check; re-read the effect.
  7. **Session-release check:** with the viewfinder up, background the app (`action: "button", name: "HOME"`)
     and reopen it. EXPECT: the preview resumes, no "camera in use" warning in the Metro log. Then, with the
     viewfinder up, tap a **Home**-tab post that opens a sheet over the tab — EXPECT the preview stops
     (`isActive` false) and resumes on dismissal.
  8. **Landscape check (iPad or a rotated simulator):** with the viewfinder up in portrait, rotate to
     landscape. EXPECT the live preview to DISAPPEAR (the sidebar card shows the coral capture card
     instead), and tapping Capture there to push the full-screen /report/camera route as it always did.

- [ ] **Step 5: Commit.**

  ```bash
  git -C /Users/theobong/Documents/GitHub/civfix/civfix-mobile add apps/community-mobile/src/components/report apps/community-mobile/app/report/camera.tsx apps/community-mobile/src/lib/nativeCamera.ts apps/community-mobile/app/_layout.tsx
  git -C /Users/theobong/Documents/GitHub/civfix/civfix-mobile commit -m "$(cat <<'EOF'
  feat(mobile): extract ReportViewfinder and inject it through the camera seam

  The viewfinder is now a reusable component the report wizard renders INLINE on
  its capture step, so the dock stays visible for the whole flow; /report/camera
  is a thin wrapper kept for the imperative capture() path (composer camera row,
  avatar picker, landscape). The mic-permission deferral is preserved verbatim -
  audioEnabled stays state, pendingRecordRef still parks the clip until the audio
  prop commits - and the park is now CHECKED before it is consumed, because the
  iOS mic alert drives AppState inactive on that very commit and clearing it first
  would drop the clip for good. isActive is driven by cameraSessionRunning so the
  session is released on background, on a pushed sheet, and whenever the host says.

  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 3.7: Turn the permission-denied full screen into an inline state

**Files:**
- Modify: `/Users/theobong/Documents/GitHub/civfix/civfix-mobile/apps/community-mobile/src/components/report/ReportViewfinder.tsx`
- Modify: `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/i18n/locales/en/mobile-report-camera.json`
- Modify: `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/i18n/locales/es/mobile-report-camera.json`
- Modify: `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/i18n/locales/de/mobile-report-camera.json`
- Modify: `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/i18n/locales/ko/mobile-report-camera.json`

**Interfaces:**
- Consumes: existing `mobile-report-camera` keys `gate.camera.title` / `gate.camera.body` / `gate.camera.continue` / `gate.no_camera.title` / `gate.no_camera.body` / `gate.choose_library` / `header.close`; `PrimaryButton` from `@civfix/ui`.
- Produces: one new key `gate.camera.open_settings` in all four locales. No manifest change — `NSCameraUsageDescription`, `NSMicrophoneUsageDescription`, `NSLocationWhenInUseUsageDescription` and `NSPhotoLibraryUsageDescription` are all already declared in `app.config.js`.

- [ ] **Step 1: Write the failing key-completeness check.** Add the key to **en only** first, so the repo's
  own gate proves the other three are missing. In
  `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/i18n/locales/en/mobile-report-camera.json`,
  change the `gate.camera` object to:

  ```json
      "camera": {
        "title": "Camera access",
        "body": "civfix uses your camera to capture the civic issue you are reporting. You can also attach an existing photo or video instead.",
        "continue": "Continue",
        "open_settings": "Open Settings"
      },
  ```

- [ ] **Step 2: Run the check and watch it fail.**
  `cd /Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui && pnpm i18n:check`
  Expected: exit code 1. `scripts/check-i18n-keys.mjs:86,93` prints
  `MISSING KEYS in <lng>/<ns>.json:` followed by one two-space-indented key per line, then a blank line and
  the `FAILED` summary — it never emits a `<ns>: missing in <lng>: <key>` form:

  ```
  MISSING KEYS in es/mobile-report-camera.json:
    gate.camera.open_settings
  MISSING KEYS in de/mobile-report-camera.json:
    gate.camera.open_settings
  MISSING KEYS in ko/mobile-report-camera.json:
    gate.camera.open_settings

  i18n key check FAILED: 3 catalog(s) out of sync with en.
  ```

- [ ] **Step 3: Add the other three translations and the inline branch.**

  (a) `.../locales/es/mobile-report-camera.json` — add `"open_settings": "Abrir Ajustes"` after `"continue": "Continuar"` (verified present).

  (b) `.../locales/de/mobile-report-camera.json` — add `"open_settings": "Einstellungen öffnen"` after `"continue": "Weiter"` (verified present).

  (c) `.../locales/ko/mobile-report-camera.json` — add `"open_settings": "설정 열기"` after `"continue": "계속"` (verified present).

  (d) In `ReportViewfinder.tsx`, add `Linking` to the react-native import and `PrimaryButton` to the
  `@civfix/ui` import, and insert this branch immediately BEFORE the `// ----- Live camera` return (which
  is also what makes the `device!` assertion in the `<Camera device>` prop safe):

  ```tsx
    // ----- INLINE gate: no camera permission yet, or no back device (a bare simulator). -----
    // This used to be TWO full-screen states on a route the reporter had opted into (camera.tsx:344-406,
    // each with its own ScreenHeader). Embedded, it is a plain card in the capture step's slot - the dock
    // and the wizard header stay put around it, and the two ways forward (grant, or attach from the library)
    // sit where the viewfinder would have been.
    if (!cameraPermission.hasPermission || device == null) {
      const denied = !cameraPermission.hasPermission
      return (
        <View style={styles.inlineGate}>
          <View style={styles.gateIcon}>
            <Ionicons
              name={denied ? "camera-outline" : "alert-circle-outline"}
              size={30}
              color={theme.colors.brand.bloom}
            />
          </View>
          <Text variant="title" style={styles.gateTitle}>
            {denied ? t("gate.camera.title") : t("gate.no_camera.title")}
          </Text>
          <Text variant="body" color={theme.colors.textMuted} style={styles.gateBody}>
            {denied ? t("gate.camera.body") : t("gate.no_camera.body")}
          </Text>
          {denied ? (
            <PrimaryButton
              label={t("gate.camera.continue")}
              onPress={() => {
                void cameraPermission.requestPermission()
              }}
              style={styles.gateBtn}
            />
          ) : null}
          <PrimaryButton
            label={t("gate.choose_library")}
            variant="outline"
            onPress={onPickFromLibrary}
            style={styles.gateBtnSecondary}
          />
          {denied ? (
            // A PERMANENT denial makes requestPermission() resolve false forever, so the deep link is its own
            // affordance rather than a hidden side effect of the Continue button (which is what it was on the
            // full-screen gate: camera.tsx:361-367 called Linking.openSettings() only when the request came
            // back false, which reads as "the button did nothing" the second time).
            <Pressable
              onPress={() => void Linking.openSettings()}
              accessibilityRole="button"
              hitSlop={8}
              style={({ pressed }) => [styles.settingsLink, pressed ? styles.pressed : null]}
            >
              <Text style={styles.settingsLinkText}>{t("gate.camera.open_settings")}</Text>
            </Pressable>
          ) : null}
        </View>
      )
    }
  ```

  (e) Add the gate styles to the same file's `StyleSheet.create`, after `pressed`:

  ```tsx
    // ----- Inline gate (was a full screen on the /report/camera route) -----
    // Light, not the camera's black: it sits inside the wizard's cream body now, where a black card would
    // read as a broken viewfinder rather than as a state.
    inlineGate: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: theme.space["6"],
      backgroundColor: theme.colors.bg,
    },
    gateIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: theme.colors.bloom["50"],
      alignItems: "center",
      justifyContent: "center",
      marginBottom: theme.space["4"],
    },
    gateTitle: { marginBottom: theme.space["2"], textAlign: "center" },
    gateBody: { textAlign: "center", lineHeight: 20, marginBottom: theme.space["5"] },
    gateBtn: { width: "100%" },
    gateBtnSecondary: { width: "100%", marginTop: theme.space["3"] },
    settingsLink: { marginTop: theme.space["4"], paddingVertical: theme.space["2"] },
    settingsLinkText: {
      fontFamily: theme.fontFamily.bodySemiBold,
      fontSize: theme.fontSize["13"],
      color: theme.colors.textMuted,
    },
  ```

- [ ] **Step 4: Run the checks and watch them pass.**
  `cd /Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui && pnpm i18n:check`
  Expected: exit 0, printing `i18n key check OK: 76 namespaces key-complete across es, de, ko.`
  (76 is the count of `src/i18n/locales/en/*.json` — verified, and it is unchanged because this task adds
  a key to an existing namespace rather than a new namespace file. No `i18n:gen` run is needed for the same
  reason: `resources.ts` statically imports each `<lng>/<ns>.json`.)
  Then rsync the shared `src/` per the recipe at the top and run
  `cd /Users/theobong/Documents/GitHub/civfix/civfix-mobile/apps/community-mobile && npx tsc --noEmit`
  — expected: no output.

  Simulator verification (a plain simulator has no back camera, so it lands on this state naturally):
  rsync the shared `src/`, **relaunch** the app (new i18n keys need a relaunch, not a
  reload), tap the **Report** tab. EXPECT: the inline "No camera found" card with a "Choose from library"
  button, the 32pt header + progress rail above it, and the dock still visible below. Reset the camera
  permission (`xcrun simctl privacy booted reset camera org.civfix.community`), relaunch, and EXPECT the
  "Camera access" variant with Continue / Choose from library / **Open Settings**.

- [ ] **Step 5: Commit (two repos).**

  ```bash
  git -C /Users/theobong/Documents/GitHub/civfix/civfix-shared add packages/ui/src/i18n/locales
  git -C /Users/theobong/Documents/GitHub/civfix/civfix-shared commit -m "$(cat <<'EOF'
  feat(ui): add gate.camera.open_settings to all four report-camera catalogs

  The embedded viewfinder's permission state surfaces the Settings deep link as
  its own affordance instead of hiding it behind the Continue button.

  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  EOF
  )"

  git -C /Users/theobong/Documents/GitHub/civfix/civfix-mobile add apps/community-mobile/src/components/report/ReportViewfinder.tsx
  git -C /Users/theobong/Documents/GitHub/civfix/civfix-mobile commit -m "$(cat <<'EOF'
  feat(mobile): make the viewfinder's permission gate an inline state

  Camera-denied and no-device are cards in the capture step's slot now, with the
  library fallback and an explicit Open Settings link, instead of a full screen on
  a route the reporter had opted into.

  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 3.8: Un-Modal `PortraitMapPickStep.native` into an in-body layer

**Files:**
- Modify: `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/map/PortraitMapPickStep.types.ts`
- Modify: `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/map/PortraitMapPickStep.native.tsx`
- Modify: `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/bodies/ReportFlowBody.tsx` (hoist the picker out of `CompactLocationField`)
- Test: `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/shell/__tests__/portrait-shell.test.ts`

**DEVIATION FROM THE SPEC'S ORIGINAL WORDING, DELIBERATE AND ALREADY ACCEPTED.** The spec's Decisions now
read "The map picker is un-Modal'd for the **report wizard**. Host-an-event keeps its `<Modal>`", with the
amendment recording why. Restating it here so it is in front of the engineer rather than in a design doc:
`CleanupForm`'s `MeetLocationCompact` (`bodies/CleanupForm.tsx:227-301`) lives inside `CreateCleanupBody`,
a `"scroll"` detail — i.e. inside the gorhom bottom sheet, which `usePickStepSheetSnap` deliberately
**collapses to peek** while picking. An in-body absolute-fill layer there is clipped to a peeked card, so
the `<Modal>` is still the only way to cover the screen from that surface. Covering it properly needs a
shell-level full-screen layer host mounted below the dock's z (the `MediaLightboxProvider` shape) — separate
work. `presentation` therefore defaults to `"modal"` and **`CleanupForm` is byte-identical after this task**;
only the report wizard opts into `"layer"`. Do not "finish the job" by switching `CleanupForm` over.

**Interfaces:**
- Consumes: `usePickStepSheetSnap(visible: boolean): void` (`map/PortraitMapPickStep.shared.tsx:32`), `PickStepBottomBar`, `usePickStepAddressQuery` (same file), `LocationPicker` with `interactive` + `fullBleed` + `attributionBottomInset` (`map/LocationPicker.native.tsx:56-65`).
- Produces: `PortraitMapPickStepProps.presentation?: "modal" | "layer"` (default `"modal"`). `CompactLocationField` loses `initialCenter` / `autoOpen` / `onConfirm` / `onCancel` and gains `onOpenPicker: () => void`. `LocationStep` and `ReviewStep` each gain `onOpenPicker: () => void`.

**`usePickStepSheetSnap` recheck (required by the spec):** the hook captures `useNavStore.getState().snap`
on open, forces `setSnap(0)`, and restores on the cleanup keyed to `visible`
(`PortraitMapPickStep.shared.tsx:32-45`). That exists so nothing peeks under a full-screen Modal presented
over the map sheet. In `"layer"` presentation there is no sheet at all — `portraitShellPlan("report", null)`
returns `detailPresentation: "none"`, so `CompactShell` is never mounted — and clobbering `snap` is actively
harmful: `selectView` KEEPS the current `snap` on a tab switch (`nav/useNavStore.ts:236` only forces `2` on
the map→home case), so a stray `setSnap(0)` would follow the user back to the Map tab as a collapsed sheet.
The hook is therefore called as `usePickStepSheetSnap(visible && presentation === "modal")` — the argument
is constant per call site, so the capture/restore pairing is unchanged for host-an-event and simply never
arms for the layer.

- [ ] **Step 1: Write the failing test.** Add this describe to the END of
  `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/shell/__tests__/portrait-shell.test.ts`,
  and add `import { readFileSync } from "node:fs"` as the file's FIRST import (it currently starts with
  `import { describe, expect, it } from "vitest"` on line 1):

  ```ts
  describe("the report tab's un-Modal'd map pick layer (WS3 3b)", () => {
    const pickStepSource = readFileSync(
      new URL("../../map/PortraitMapPickStep.native.tsx", import.meta.url),
      "utf8",
    )
    const reportSource = readFileSync(
      new URL("../../bodies/ReportFlowBody.tsx", import.meta.url),
      "utf8",
    )

    it("presents as an absolute-fill LAYER when the caller asks for one, and keeps the Modal otherwise", () => {
      // "modal" stays the DEFAULT so CleanupForm (host an event) is byte-identical: that flow's body is a
      // "scroll" detail inside the collapsed gorhom sheet, where an in-body layer would be clipped to a
      // peeked card - the Modal is still the only way to cover the screen from there.
      expect(pickStepSource).toContain('presentation = "modal"')
      expect(pickStepSource).toContain('presentation === "layer"')
    })

    it("arms the sheet-detent capture/restore ONLY for the modal presentation", () => {
      // The hook collapses useNavStore.snap to 0 and restores it on close. There is no sheet behind the
      // layer (portraitShellPlan("report", null).detailPresentation === "none"), and selectView KEEPS snap
      // across a tab switch (useNavStore.ts:236) - so arming it there would follow the user back to the Map
      // tab as a collapsed sheet.
      expect(pickStepSource).toContain(
        'usePickStepSheetSnap(visible && presentation === "modal")',
      )
    })

    it("renders the report wizard's pick layer OUTSIDE its shared vertical ScrollView", () => {
      // A moveable map inside a vertical scroller fights pan, and the scroller clips absolute children -
      // so the layer is hoisted to the body root, after the scroller closes.
      const scrollClose = reportSource.lastIndexOf("</ScrollView>")
      const pickLayer = reportSource.indexOf("<PortraitMapPickStep")
      expect(scrollClose).toBeGreaterThan(0)
      expect(pickLayer).toBeGreaterThan(scrollClose)
      expect(reportSource).toContain('presentation="layer"')
    })
  })
  ```

- [ ] **Step 2: Run it and watch it fail.**
  `cd /Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui && pnpm vitest run src/shell/__tests__/portrait-shell.test.ts`
  Expected failure:
  `AssertionError: expected '/**\n * PortraitMapPickStep (NATIVE se…' to contain 'presentation = "modal"'`
  Counts: `Tests 3 failed | 22 passed (25)` (the file is 22 tests at HEAD — verified by execution).

- [ ] **Step 3: Implement.**

  (a) In `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/map/PortraitMapPickStep.types.ts`,
  add to `PortraitMapPickStepProps` (after `markerCategory`, which ends at line 30):

  ```ts
    /**
     * HOW the NATIVE seam presents itself. (The web seam already renders a pointer-events-through portal
     * rather than a Modal, so it ignores this.)
     *
     *   - "modal"  (DEFAULT): an RN <Modal> over everything, plus the sheet-detent capture/collapse/restore.
     *     Required by host-an-event: CreateCleanupBody is a "scroll" detail inside the gorhom sheet, so an
     *     in-body layer there would be clipped to a peeked card.
     *   - "layer": an absolute-fill layer INSIDE the caller's body, with NO sheet-detent side effects. The
     *     report wizard is a top-level tab base body whose surface is already inset by the tab-bar
     *     footprint, so the layer bottoms out exactly at the top of the liquid-glass dock - which stays
     *     visible and tappable for the whole flow. Its own safe-area offsets are dropped in this mode: the
     *     base surface already carries them, and re-adding them would double the inset.
     */
    presentation?: "modal" | "layer"
  ```

  (b) In `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/map/PortraitMapPickStep.native.tsx`,
  change the signature (lines 34-43), the snap call (lines 50-51) and the return (lines 74-109):

  ```tsx
  export function PortraitMapPickStep({
    visible,
    value,
    initialCenter,
    onConfirm,
    onCancel,
    markerCategory,
    presentation = "modal",
  }: PortraitMapPickStepProps) {
    const insets = useSafeAreaInsets()
    const [localPoint, setLocalPoint] = useState<LatLng | null>(value)
    const layered = presentation === "layer"
  ```

  ```tsx
    // Collapse the sheet to peek while the MODAL is up, restore the prior detent on close (shared hook).
    // NOT armed for the layer: there is no sheet behind it (portraitShellPlan("report", null) mounts none),
    // and selectView keeps `snap` across a tab switch, so a stray setSnap(0) would follow the user back to
    // the Map tab as a collapsed sheet.
    usePickStepSheetSnap(visible && presentation === "modal")
  ```

  ...then replace lines **74-109** (verified: line 74 is `if (!visible) return null`, line 109 is the `)`
  that closes the `return (`; line 110 is the function's closing `}`) with:

  ```tsx
    if (!visible) return null

    // In LAYER mode the host surface already carries the safe-area top inset and the tab-bar footprint
    // (PortraitShell.shared's `baseInsets`), so the floating bars use the plain spacing tokens; re-adding
    // `insets` there would push the search field under the status bar's own padding and lift the confirm bar
    // a second home-indicator height off the bottom.
    const topOffset = (layered ? 0 : insets.top) + theme.space["2"]
    const bottomOffset = (layered ? 0 : insets.bottom) + theme.space["3"]
    const creditInset = (layered ? 0 : insets.bottom) + BOTTOM_BAR_CLEARANCE

    const content = (
      <View style={styles.fill}>
        {/* FULL-SCREEN moveable map: the home map core (same basemap, pan / zoom on). Tap drops/moves the
            pin; an AddressSearch pick (seeded into `value`) flies the camera there. */}
        <LocationPicker
          value={localPoint}
          onChange={onMapDrop}
          initialCenter={initialCenter ?? undefined}
          mode="standalone"
          interactive
          fullBleed
          attributionBottomInset={creditInset}
          markerCategory={markerCategory}
        />

        {/* TOP: floating address search, in-line with the home brand / locate / layers row. box-none lets
            map pans pass through the empty side margins; the field + its results dropdown catch their own
            touches. */}
        <View style={[styles.topBar, { top: topOffset }]} pointerEvents="box-none">
          <AddressSearch value={addrQuery} onChangeText={setAddrQuery} onPick={onPickPlace} />
        </View>

        {/* BOTTOM: floating confirm / cancel bar (shared with the web seam; only the absolute positioning
            is native's). */}
        <PickStepBottomBar
          point={localPoint}
          onConfirm={confirm}
          onCancel={cancel}
          style={[styles.bottomBar, { bottom: bottomOffset }]}
        />
      </View>
    )

    // LAYER: an absolute fill inside the caller's body, beneath the dock. The explicit z is not decoration -
    // it is the tie-break against the wizard's own footer, which is a LATER sibling in the tree on Android,
    // where elevation (not declaration order) decides.
    if (layered) return <View style={styles.layer}>{content}</View>

    return (
      <Modal visible transparent statusBarTranslucent animationType="fade" onRequestClose={cancel}>
        {content}
      </Modal>
    )
  }
  ```

  ...and add the layer style to the `StyleSheet.create` block (after `bottomBar`):

  ```tsx
    // The un-Modal'd presentation: fills the caller's body (already inset above the dock) rather than the
    // whole screen. NO padding of its own - see topOffset/bottomOffset above for why.
    layer: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 20,
      elevation: 20,
      backgroundColor: theme.colors.bg,
    },
  ```

  (c) In `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/bodies/ReportFlowBody.tsx`,
  hoist the picker out of `CompactLocationField`. Replace `CompactLocationField` — its doc block AND the
  function, HEAD lines **477-554** (verified: 477 is `/**`, 484 is `function CompactLocationField({`, 554 is
  the closing `}`) — with:

  ```tsx
  /**
   * The COMPACT report-location field (#61 sub-2/3/4). Where the map is hidden behind the sheet, it shows a
   * tappable row that opens the shared big-map pick step. The chosen coord is reverse-geocoded to its
   * ADDRESS (sub-4; exact coords fallback) and shown on the row.
   *
   * IT NO LONGER OWNS THE PICKER. The pick step is an in-body absolute LAYER now rather than an RN Modal
   * (so the liquid-glass dock stays visible), and this field is rendered INSIDE the wizard's shared vertical
   * ScrollView - which clips absolute children and would fight the map's pan. So the layer lives at the body
   * root and this field only ASKS for it.
   */
  function CompactLocationField({
    point,
    onOpenPicker,
    onClear,
  }: {
    point: LatLng | null
    onOpenPicker: () => void
    onClear?: () => void
  }) {
    const { t } = useT("map-ui")
    const label = useReverseLabel(point)
    const display = point ? reverseLabelText(label.data, point) : null

    return (
      <View style={styles.compactLoc}>
        <Pressable
          onPress={onOpenPicker}
          accessibilityRole="button"
          accessibilityLabel={t("pickStep.openA11y")}
          style={({ pressed }) => [styles.compactLocBtn, pressed ? styles.pressed : null]}
        >
          <Icon icon={iconMap.MapPin} size={18} color={theme.colors.brand.bloom} />
          <View style={styles.compactLocMeta}>
            {display ? (
              <Text style={styles.compactLocValue} numberOfLines={2}>
                {display}
              </Text>
            ) : (
              <Text style={styles.compactLocPlaceholder} numberOfLines={1}>
                {t("pickStep.open")}
              </Text>
            )}
          </View>
          <Icon icon={point ? iconMap.ChevronRight : iconMap.Plus} size={16} color={theme.colors.textMuted} />
        </Pressable>
        {point && onClear ? (
          <Pressable
            onPress={onClear}
            accessibilityRole="button"
            accessibilityLabel={t("actions.reset")}
            hitSlop={6}
            style={({ pressed }) => [styles.compactLocClear, pressed ? styles.pressed : null]}
          >
            <Icon icon={iconMap.Close} size={13} color={theme.colors.textMuted} />
            <Text style={styles.compactLocClearText}>{t("actions.reset")}</Text>
          </Pressable>
        ) : null}
      </View>
    )
  }
  ```

  ...replace `LocationStep` — doc block AND function, HEAD lines **556-587** — with:

  ```tsx
  /**
   * The COMPACT-only dedicated LOCATION step (#61 sub-3). The big-map pick LAYER is owned by the wizard body
   * (it must escape this step's scroll container), so this step only draws the field and asks for it; the
   * body auto-opens the layer on entering this step and drives confirm -> advance / cancel -> step back.
   */
  function LocationStep({ onOpenPicker }: { onOpenPicker: () => void }) {
    const { t } = useT("report-wizard")
    const draft = useDraftReportStore((s) => s.draft)
    const point = draft.lat != null && draft.lng != null ? { lat: draft.lat, lng: draft.lng } : null
    const clearLocation = useDraftReportStore((s) => s.clearLocation)

    return (
      <View style={styles.stepBlock}>
        <Text style={styles.fieldLabel}>{t("review.where_label")}</Text>
        <CompactLocationField point={point} onOpenPicker={onOpenPicker} onClear={clearLocation} />
      </View>
    )
  }
  ```

  (`setLocation` and `useApproxCenter()` leave this component with the picker — `useApproxCenter` is still
  used by `ReviewStep` at HEAD line 614 and by the body block below, so nothing goes unused.)

  ...change `ReviewStep`'s signature (HEAD line 592) to
  `function ReviewStep({ onRequestReveal, onOpenPicker }: { onRequestReveal?: (y: number) => void; onOpenPicker: () => void })`
  and its compact branch — HEAD lines **668-675** (verified: 668 is `{compact ? (`, 674 is the
  `/>` that closes `<CompactLocationField`, 675 is `) : (`) — to:

  ```tsx
          {compact ? (
            <CompactLocationField point={point} onOpenPicker={onOpenPicker} onClear={clearLocation} />
          ) : (
  ```

  (`onDropPin`, `setLocation` and `initialCenter` stay used by the EXPANDED branch's `<LocationPicker>` at
  HEAD line 678, so removing them from the compact branch leaves nothing unused.)

  ...and in `ReportFlowBody`, immediately AFTER the three viewfinder callbacks Task 3.4 step (h) added
  (i.e. after `onViewfinderCaptured`, which itself sits after `advanceFromCapture`), add the picker's
  hoisted state and callbacks. That position satisfies every dependency: `activeStep`,
  `advanceFromLocation` (HEAD :1155-1160) and `cancelLocation` (HEAD :1161-1166) are all already defined
  above it, and it is still before the `submitPhase !== "idle"` early return (HEAD :1181):

  ```tsx
    // ----- The big-map pick LAYER (WS3 3b), hoisted out of the step bodies. -----
    // It has to live at the body root for two independent reasons: the wizard's shared vertical ScrollView
    // CLIPS absolute children, and a moveable map inside a vertical scroller fights its pan recognizer.
    const draftLat = useDraftReportStore((s) => s.draft.lat)
    const draftLng = useDraftReportStore((s) => s.draft.lng)
    const pickPoint = draftLat != null && draftLng != null ? { lat: draftLat, lng: draftLng } : null
    const pickCenter = useApproxCenter()
    const [picking, setPicking] = useState(false)
    const openPicker = useCallback(() => setPicking(true), [])
    // The dedicated compact LOCATION step presents the big map immediately on enter - the `autoOpen` the
    // field used to own. `activeStep` is the dep, so this fires on each ENTRY to that step (arriving from
    // capture, walking back from category, or resuming there on a remount) and nowhere else. The step only
    // exists in COMPACT, so this never arms in landscape.
    useEffect(() => {
      if (activeStep === "location") setPicking(true)
    }, [activeStep])
    const onPickConfirm = useCallback(
      (lat: number, lng: number) => {
        // `setLocation`, NOT `setPrefilledLocation`: only the map long-press "Report an issue here" may set
        // `locationPrefilled`, which permanently drops this very step (draftStore.ts:87-95). This is the
        // same call ReviewStep's `onDropPin` makes.
        useDraftReportStore.getState().setLocation(lat, lng, "manual")
        setPicking(false)
        if (activeStep === "location") advanceFromLocation()
      },
      [activeStep, advanceFromLocation],
    )
    const onPickCancel = useCallback(() => {
      setPicking(false)
      if (activeStep === "location") cancelLocation()
    }, [activeStep, cancelLocation])
  ```

  ...update the two step call sites inside the `<ScrollView>`:

  ```tsx
            {activeStep === "location" ? <LocationStep onOpenPicker={openPicker} /> : null}
  ```

  ```tsx
            {activeStep === "review" ? (
              <ReviewStep onRequestReveal={revealShareBlock} onOpenPicker={openPicker} />
            ) : null}
  ```

  ...and add the layer as the LAST child of `styles.root`, after the footer block (which closes with
  `) : null}` at HEAD line 1296) and before the `</View>` on HEAD line 1297:

  ```tsx
        {/* WS3 3b: the big-map pick step is an IN-BODY LAYER now, not an RN Modal - so the liquid-glass dock
            stays visible and tappable for the whole flow. Last child of the body root: outside the shared
            vertical ScrollView (which clips absolute children and whose pan the map would fight) and above
            the footer. The base surface already carries the tab-bar footprint, so this absolute fill bottoms
            out exactly at the top of the dock. In LANDSCAPE `picking` is never set (there is no compact
            location step and ReviewStep's expanded branch drives the persistent map instead), so this
            renders null there. */}
        <PortraitMapPickStep
          visible={picking}
          presentation="layer"
          value={pickPoint}
          initialCenter={pickCenter}
          onConfirm={onPickConfirm}
          onCancel={onPickCancel}
        />
  ```

- [ ] **Step 4: Run it and watch it pass.**
  `cd /Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui && pnpm vitest run src/shell/__tests__/portrait-shell.test.ts && pnpm vitest run src/report/__tests__/wizardSteps.test.ts && pnpm typecheck && pnpm lint`
  Expected: `Test Files 1 passed (1) / Tests 25 passed (25)` for portrait-shell (22 pre-existing + the 3
  new), then `Tests 30 passed (30)` for wizardSteps (unchanged by this task — it is re-run because this
  task edits `ReportFlowBody.tsx`, which those source-pin tests read), then `typecheck` exit 0 and `lint`
  exit 0, each emitting nothing beyond pnpm's own two banner lines.

  Simulator verification: rsync the shared `src/`, reload, tap **Report**, capture a photo. EXPECT the
  location step to open the big map **with the dock still visible at the bottom** (previously the Modal
  covered it). Drag the sheet-less map, tap to drop a pin, tap Confirm — the wizard advances to "What is
  it?". Tap **Cancel** instead — it steps back to capture. Then switch to the **Map** tab and confirm the
  home sheet is at its normal detent (proving the snap was never clobbered). Finally open **Host an event**
  → "Choose location on map" and confirm it is UNCHANGED (still a full-screen Modal over the sheet).

- [ ] **Step 5: Commit.**

  ```bash
  git -C /Users/theobong/Documents/GitHub/civfix/civfix-shared add packages/ui/src/map/PortraitMapPickStep.types.ts packages/ui/src/map/PortraitMapPickStep.native.tsx packages/ui/src/bodies/ReportFlowBody.tsx packages/ui/src/shell/__tests__/portrait-shell.test.ts
  git -C /Users/theobong/Documents/GitHub/civfix/civfix-shared commit -m "$(cat <<'EOF'
  feat(ui): present the report map picker as an in-body layer, not an RN Modal

  The report wizard hoists the pick step to its body root and asks for the new
  "layer" presentation, so the liquid-glass dock stays visible for the whole flow.
  The layer drops its own safe-area offsets (the base surface carries them) and
  does NOT arm usePickStepSheetSnap - there is no sheet behind it, and selectView
  keeps snap across a tab switch, so collapsing it would follow the user to Map.
  Host-an-event keeps the Modal default: its body lives inside the gorhom sheet,
  where an in-body layer would be clipped to a peeked card.

  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 3.9: Lock the shell contract — both new surfaces are in-body, not shell state

`bodyLayout.ts:273` says the plan's SHAPE is locked by this test, and the spec flagged it as needing an
update. The actual outcome of the change is that `portraitShellPlan` needs **no** modification — which is
itself the claim worth pinning, because the tempting "fix" for either surface (make the viewfinder a
`full` detail entry, or the picker a `drop-pin`-style stack entry) would flip `bottomChromeVisible` to
`false` (`bodyLayout.ts:294`) and re-hide the dock this whole workstream exists to keep.

> **THIS TASK IS A REGRESSION GUARD, NOT A TDD DRIVER — and it is labelled that way on purpose.** There is
> no production behaviour left to add: Tasks 3.4 and 3.8 already landed it. Its assertions are red on the
> pre-3.4/3.8 tree (the `viewfinderLayer` style and the pick layer's `layered ? 0 : insets…` offsets simply
> do not exist yet) and green after, which is where their evidence comes from. Run Step 2 expecting GREEN.
> **Do NOT rename `viewfinderLayer`, or edit any other production source, to manufacture a failure** — a
> rename-and-revert dance is not a red/green gate, and a half-applied revert silently drops the
> viewfinder's background and radius (a stale `viewfinderSlot` key still compiles).
>
> An earlier draft of this task also re-asserted the exact shape of `plan("report", null)`. That assertion
> **already exists verbatim** at `src/shell/__tests__/portrait-shell.test.ts:51-58` (and
> `plan("report", null).bottomChromeVisible` is pinned again at :113), so it is dropped here; its intent is
> carried by the one-line cross-reference Step 3 adds to `portraitShellPlan`'s doc block, which points at
> those existing assertions.

**Files:**
- Modify: `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/shell/__tests__/portrait-shell.test.ts`
- Modify: `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/shell/bodyLayout.ts` (doc only)

**Interfaces:**
- Consumes: `portraitShellPlan(view: View, active: DetailEntry | null): PortraitShellPlan` (`shell/bodyLayout.ts:275`).
- Produces: nothing.

- [ ] **Step 1: Write the guard.** Add this describe immediately after the one added in Task 3.8 in
  `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/shell/__tests__/portrait-shell.test.ts`
  (`readFileSync` is already imported by Task 3.8):

  ```ts
  describe("the Report tab keeps the dock for the WHOLE flow (WS3)", () => {
    const reportSource = readFileSync(
      new URL("../../bodies/ReportFlowBody.tsx", import.meta.url),
      "utf8",
    )
    const pickStepSource = readFileSync(
      new URL("../../map/PortraitMapPickStep.native.tsx", import.meta.url),
      "utf8",
    )

    it("relies on the base surface's tab-bar footprint rather than insetting either layer itself", () => {
      // WHY THIS IS THE GUARD THAT MATTERS. PortraitShell.shared pads the base surface by
      // frame.base.bottomInset (the tab-bar footprint) unconditionally for a base body
      // (PortraitShell.shared.tsx:106), so a flex:1 slot and an absolute fill INSIDE the report body both
      // stop exactly at the top of the dock. Neither layer may add a bottom inset of its own, or the inset
      // applies TWICE - the shutter floats a home-indicator height up the screen and the confirm bar sits
      // above a gap. `plan("report", null)` itself is deliberately NOT re-asserted here: portrait-shell's
      // own exact-shape assertion at :51-58 already owns that, and duplicating it would just mean two
      // places to update. What is new is that BOTH new surfaces are BODY children with no shell state and
      // no self-inset.
      const viewfinder = /viewfinderLayer: \{[^}]*\}/.exec(reportSource)?.[0] ?? ""
      expect(viewfinder).toContain("flex: 1")
      expect(viewfinder).not.toContain("padding")

      // Anchored on the two-space StyleSheet indent so it cannot match a prop or a longer key.
      const layer = /\n {2}layer: \{[^}]*\}/.exec(pickStepSource)?.[0] ?? ""
      expect(layer).toContain("StyleSheet.absoluteFillObject")
      expect(layer).not.toContain("padding")
      // ...and the floating bars zero their own safe-area offsets in layer mode for the same reason.
      expect(pickStepSource).toContain('const topOffset = (layered ? 0 : insets.top) + theme.space["2"]')
      expect(pickStepSource).toContain(
        'const bottomOffset = (layered ? 0 : insets.bottom) + theme.space["3"]',
      )
    })
  })
  ```

- [ ] **Step 2: Run it and watch it PASS — this is the regression-guard run, and green is the expected
  result.**
  `cd /Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui && pnpm vitest run src/shell/__tests__/portrait-shell.test.ts`
  Expected: `Test Files 1 passed (1) / Tests 26 passed (26)` — 22 pre-existing + Task 3.8's 3 + this 1.
  If it is RED here, the failure is real: either Task 3.4's `viewfinderLayer` style or Task 3.8's
  `topOffset`/`bottomOffset`/`layer` edits are missing or were written with a padding of their own. Fix the
  production code; do not relax the assertion.

- [ ] **Step 3: Add the doc cross-reference.** No production behaviour changes. Confirm the two invariants
  by reading them off the source — `shell/bodyLayout.ts:275-302` (`portraitShellPlan` is untouched by this
  workstream) and `shell/PortraitShell.shared.tsx:106`
  (`const baseInsets = { paddingTop: topInset, paddingBottom: frame.base.bottomInset }`) — then extend
  `portraitShellPlan`'s doc block at `shell/bodyLayout.ts:273` (currently the single line "Keep this plan's
  SHAPE stable - portrait-shell.test.ts locks it with exact-shape assertions.") to:

  ```ts
   * Keep this plan's SHAPE stable - portrait-shell.test.ts locks it with exact-shape assertions (the Report
   * tab's is at :51-58). That assertion is also the WS3 guard: the Report tab's embedded viewfinder and its
   * map-pick layer are BODY children, so they must not appear here at all - neither as a plan field nor as a
   * detail entry, since either would flip `bottomChromeVisible` false below and re-hide the dock.
  ```

- [ ] **Step 4: Run the package's full checks.**
  `cd /Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui && pnpm vitest run src/shell/__tests__/portrait-shell.test.ts && pnpm typecheck && pnpm lint && pnpm vitest run`
  Expected: `Tests 26 passed (26)` for the guard file, then `typecheck` exit 0 and `lint` exit 0 (nothing
  beyond pnpm's own two banner lines each), and the whole-package `vitest run` reporting **zero failures**
  with
  `src/report/__tests__/wizardSteps.test.ts (30 tests)`,
  `src/capabilities/__tests__/cameraSeam.test.ts (3 tests)` and
  `src/shell/__tests__/portrait-shell.test.ts (26 tests)` among the files. Do NOT assert an absolute suite
  total: Workstreams 1, 2, 4 and 5 add tests to this same package, so the running total depends on how many
  of them have already landed. "No failures, plus these three files at these counts" is the invariant.

- [ ] **Step 5: Commit.**

  ```bash
  git -C /Users/theobong/Documents/GitHub/civfix/civfix-shared add packages/ui/src/shell/__tests__/portrait-shell.test.ts packages/ui/src/shell/bodyLayout.ts
  git -C /Users/theobong/Documents/GitHub/civfix/civfix-shared commit -m "$(cat <<'EOF'
  test(ui): guard that the Report tab's camera + pick layers stay in-body

  portraitShellPlan needed no change for either surface, which is exactly what has
  to be pinned: promoting either to a detail entry would flip bottomChromeVisible
  and re-hide the dock this workstream exists to keep. The guard asserts the thing
  that is NOT already covered - neither layer carries a bottom inset of its own,
  because the portrait base surface already applies the tab-bar footprint.

  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  EOF
  )"
  ```


---


## Workstream 4 — Smooth the transition when LEAVING Search

**Scope, restated so no task drifts:** this workstream changes only the **exit** — the leading glass circle (`TabBar.native.tsx:610-616`, `onExitSearch`). The trailing ✕ (`TabBar.native.tsx:663-679`, `onClearSearch`) **keeps its exact current meaning**: clear the query + blur, stay in Search. No task below touches `onClearSearch`, `dockedSearch.onClear`, or the ✕'s a11y label.

**HARD CONSTRAINTS — restated in full from the spec; every task must satisfy all seven.**

1. **Nothing in `SearchBody`'s layout may be gated on a keyboard signal**, and the content container stays content-height (no `flex-grow`, no `justify-content`). Commit `a637875` (@civfix/ui 0.33.0) did exactly that and was reverted at the user's explicit request. `SearchBody.tsx:244-268` is the standing prohibition and `bodies/__tests__/SearchBody.test.ts:26-58` is its tripwire. Task 4.6 restructures that file and MUST leave every one of those guards green.
2. **Never animate a layout property off `reserved`** (`useKeyboardAnchor.types.ts:11-13`: `lift` is per-frame/UI-thread, `reserved` is per-transition/JS-thread). Task 4.1 makes the ~289pt reserve step *invisible* (it lands behind the keyboard's own travel, at `did-settle`), it does **not** animate it.
3. **Never call a `*Config()` factory inside a worklet** — release-build SIGABRT with no debug guard (commit `a89c3eb`; the rule is written out at `TabBar.native.tsx:326-347` and `motionConfigs.native.ts:18-34`). Task 4.6 adds a `withTiming` completion **worklet**; it may contain only `runOnJS(...)`, never `dockMorphOutConfig()`.
4. **Do NOT add a second mounted copy of a body for a crossfade on native** (spec, hard constraints). No task below mounts a second `SearchBody`. `SearchBodyReveal.native.tsx:20-24` is MOUNT-ONCE: the search body is mounted on the first open and then kept resident forever, so the exit needs a *content freeze*, not a second copy.
5. **Do NOT swap `ScrollHost` identity** — it swaps the ScrollView component TYPE at the same position and remounts the whole subtree. Task 4.6 leaves `useScrollHost()` in `SearchResting` exactly as it is; the only thing that changes is which CHILDREN it renders.
6. **Reduce-motion escape hatches are preserved.** Task 4.3's animated branch keeps `reduceMotion: ReduceMotion.System`; its non-animated branch *is* the reduce-motion-safe jump. Task 4.6's freeze is skipped entirely when `reduceMotion` is on (there is no fade to protect).
7. **No new i18n keys, and no new motion token.** This workstream adds no copy, so `packages/ui/src/i18n/locales/{en,es,de,ko}/*.json` are untouched and `pnpm i18n:check` is unaffected. It also adds no CONTENT crossfade, so the spec's "add a `bodyExitConfig()` adapter over `bodyExit` (140ms) rather than inventing a number" escape hatch is deliberately not taken — a freeze needs no curve of its own.

**Test runner (verified by running it):** vitest 2.1.9, no config file, default globs. Working directory `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui`; single file = `pnpm vitest run <path>`, whole package = `pnpm test`. Pure logic goes in a non-React module with a colocated `__tests__` sibling; **the package ships no RN renderer, so no React component or hook is unit-tested** — every task below puts its coverage on pure functions and, where the wiring itself is the contract, on the same source-text guards `shell/__tests__/tabBar.test.ts` and `bodies/__tests__/SearchBody.test.ts` already use.

**Two runner facts every RED step below depends on (both verified by execution, do not re-derive them):**
- A test importing a name that the module does **not** export does NOT fail at collect time. vitest's vite-node SSR transform resolves the missing binding to `undefined`, so the file loads, every unrelated test in it still runs and passes, and only the tests that CALL the name fail — with `TypeError: <name> is not a function`.
- A test importing a module that does not EXIST fails at collect time, with `Error: Failed to load url ../<module> (resolved id: ../<module>) in <abs path to the test file>. Does the file exist?` and `Tests  no tests`.

**Measured per-file baselines at HEAD (verified by running each file; per-file counts only — never assert a whole-suite total, because Workstreams 1-3 land in this same vitest suite):**

| file | tests at HEAD |
| --- | --- |
| `src/shell/__tests__/keyboardInsetModel.test.ts` | 27 |
| `src/shell/__tests__/tabBar.test.ts` | 59 |
| `src/shell/__tests__/searchBarStore.test.ts` | 4 |
| `src/bodies/__tests__/SearchBody.test.ts` | 5 |

`pnpm typecheck` at HEAD prints only its two `>` banner lines and exits 0. `pnpm lint` at HEAD prints only its two `>` banner lines and exits 0. Those are the "clean" outputs every green step below refers to.

---

### Task 4.1: The reserve is CARRIED through a blur-driven close (pure reducer)

**Files:**
- Modify: `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/shell/keyboardInsetModel.ts:86` (the `ownership` signal member) and `:106-124` (`case "ownership"`)
- Test: `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/shell/__tests__/keyboardInsetModel.test.ts` (extend the existing `describe("reduceKeyboard — the ownership matrix")` at `:104-182`)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `KeyboardSignal` gains `{ type: "ownership"; enabled: boolean; liveOverlap: number; handoffMs: number; closing?: boolean; reserveHint?: number }` (both new fields OPTIONAL — `useKeyboardAnchor.web.ts` never calls `reduceKeyboard`, verified by grep, but optionality keeps the frozen contract additive).
  - `reduceKeyboard(phase: KeyboardPhase, s: KeyboardSignal): KeyboardCommand` — unchanged signature, new behaviour on the `ownership`/`enabled:false`/`phase:"engaged"`/`closing:true` cell.

**Why (from the spec, defect 1):** `Keyboard.dismiss()` → iOS posts `keyboardWillHide` → `case "will-hide"` (`:98-102`) deliberately **holds** `reserveOverlap`. One tick later the field's blur fires, `enabled` flips false, and `case "ownership"`'s tail (`:123-124`) returns `reserveOverlap: 0` **unconditionally**, overriding that hold while the keyboard is still travelling. `SearchBodyReveal.native.tsx:90` consumes it as `paddingBottom: bottomInset + keyboardReserve` and re-lays-out the whole overlay in one frame (the spec's measurement: 411→94 on an iPhone 17 Pro).

- [ ] **Step 1: Write the failing tests.** Append these five `it` blocks INSIDE the existing `describe("reduceKeyboard — the ownership matrix", …)` in `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/shell/__tests__/keyboardInsetModel.test.ts`, immediately after the existing `it("losing ownership we never had is inert", …)` at `:177-181` and before that describe's closing `})` at `:182`:

```ts
  it("losing ownership MID-CLOSE CARRIES the reservation instead of collapsing it in one frame", () => {
    // THE defect. iOS posts keyboardWillHide FIRST (the will-hide branch above HOLDS the reserve) and the
    // field's blur lands one tick LATER. Zeroing the reserve on that blur re-laid-out SearchBodyReveal
    // (411 -> 94, iPhone 17 Pro) in a single un-animated frame, mid-descent.
    expect(
      reduceKeyboard(ENGAGED, {
        type: "ownership",
        enabled: false,
        liveOverlap: 345,
        handoffMs: 220,
        closing: true,
        reserveHint: 345,
      }),
    ).toEqual({ phase: "engaged", target: 0, duration: 220, reserveOverlap: 345 })
  })
  it("releases the CARRIED reservation at did-settle, never at the blur", () => {
    // The landing is the ONLY release. By then the keyboard is down, so the layout step is invisible.
    expect(reduceKeyboard(ENGAGED, { type: "did-settle", overlap: 0, enabled: false })).toEqual({
      phase: "idle",
      target: 0,
      duration: 0,
      reserveOverlap: 0,
    })
  })
  it("carries nothing when no hint is supplied rather than inventing a reservation", () => {
    expect(
      reduceKeyboard(ENGAGED, { type: "ownership", enabled: false, liveOverlap: 345, handoffMs: 220, closing: true }),
    ).toEqual({ phase: "engaged", target: 0, duration: 220, reserveOverlap: 0 })
  })
  it("still releases immediately when the ownership loss is NOT a close (the foreign-keyboard handoff)", () => {
    // Another surface's field took the keyboard while it stays UP: we own nothing, so we reserve nothing.
    expect(
      reduceKeyboard(ENGAGED, { type: "ownership", enabled: false, liveOverlap: 345, handoffMs: 220, closing: false }),
    ).toEqual({ phase: "idle", target: 0, duration: 220, reserveOverlap: 0 })
  })
  it("a mid-close ownership loss we never owned is still inert", () => {
    expect(
      reduceKeyboard(IDLE, {
        type: "ownership",
        enabled: false,
        liveOverlap: 345,
        handoffMs: 220,
        closing: true,
        reserveHint: 345,
      }),
    ).toEqual({ phase: "idle", target: 0, duration: 0, reserveOverlap: 0 })
  })
```

  Three of the five (`releases the CARRIED reservation at did-settle`, `still releases immediately when the ownership loss is NOT a close`, `a mid-close ownership loss we never owned is still inert`) pass at RED. They are deliberate REGRESSION GUARDS, not TDD drivers: they pin the three ownership cells this task must leave byte-identical, so the fix in Step 3 cannot be written as a blanket "always carry". Only the other two drive the change.

- [ ] **Step 2: Run it and watch it fail.**
  `cd /Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui && pnpm vitest run src/shell/__tests__/keyboardInsetModel.test.ts`
  Expect `Tests  2 failed | 30 passed (32)` — the 27 pre-existing cases plus the 5 new ones. vitest transpiles with esbuild and does **not** typecheck, so the excess `closing` / `reserveHint` properties do not error at run time; the assertions fail instead:
  - `losing ownership MID-CLOSE CARRIES the reservation…` → `AssertionError: expected { phase: 'idle', target: 0, duration: 220, reserveOverlap: 0 } to deeply equal { phase: 'engaged', target: 0, duration: 220, reserveOverlap: 345 }`
  - `carries nothing when no hint is supplied…` → `AssertionError: expected { phase: 'idle', target: 0, duration: 220, reserveOverlap: 0 } to deeply equal { phase: 'engaged', target: 0, duration: 220, reserveOverlap: 0 }`

- [ ] **Step 3: Minimal implementation.** In `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/shell/keyboardInsetModel.ts`, replace the single-line `ownership` member of `KeyboardSignal` at `:86`:

```ts
  | { type: "ownership"; enabled: boolean; liveOverlap: number; handoffMs: number }
```

with:

```ts
  /**
   * Ownership changed while a keyboard may be up.
   *
   * `closing` says a close THIS surface owns is ALREADY travelling — `keyboardWillHide` has fired and
   * `did-settle` has not. On iOS a dock exit posts willHide FIRST and the field's blur lands one tick
   * later, so this signal routinely arrives mid-descent; the caller derives the flag from the same
   * in-flight record it uses to skip the redundant animation (`isRedundantClose`).
   *
   * `reserveHint` is the OVERLAP currently reserved — the same units as every other `overlap` /
   * `reserveOverlap` in this module, NOT the derived lift (see the note on `will-hide`).
   */
  | {
      type: "ownership"
      enabled: boolean
      liveOverlap: number
      handoffMs: number
      closing?: boolean
      reserveHint?: number
    }
```

Then, in `case "ownership"`, replace the two-line tail at `:123-124`:

```ts
      if (phase !== "engaged") return { phase: "idle", target: 0, duration: 0, reserveOverlap: 0 }
      return { phase: "idle", target: 0, duration: s.handoffMs, reserveOverlap: 0 }
```

with:

```ts
      if (phase !== "engaged") return { phase: "idle", target: 0, duration: 0, reserveOverlap: 0 }
      // A close WE own is already travelling: this is the blur that follows keyboardWillHide by one tick.
      // Returning reserveOverlap: 0 here is what collapsed the reservation in ONE un-animated frame while
      // the keyboard was still descending (SearchBodyReveal.native.tsx:90 consumes it as paddingBottom, so
      // it re-lays-out the whole search overlay: 411 -> 94 on an iPhone 17 Pro). CARRY it, exactly as the
      // will-hide branch does, and stay "engaged" so `did-settle` still routes through this surface and
      // releases it once the keyboard has actually landed — by which point the step is invisible.
      if (s.closing) {
        return { phase: "engaged", target: 0, duration: s.handoffMs, reserveOverlap: s.reserveHint ?? 0 }
      }
      return { phase: "idle", target: 0, duration: s.handoffMs, reserveOverlap: 0 }
```

- [ ] **Step 4: Run it and watch it pass.**
  `cd /Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui && pnpm vitest run src/shell/__tests__/keyboardInsetModel.test.ts`
  Expect `Test Files  1 passed (1)` / `Tests  32 passed (32)`.
  Then `pnpm typecheck` — expect only the two `>` banner lines and exit 0 (the new fields are optional, so no existing call site breaks).

- [ ] **Step 5: Commit.**
```bash
cd /Users/theobong/Documents/GitHub/civfix/civfix-shared && git add packages/ui/src/shell/keyboardInsetModel.ts packages/ui/src/shell/__tests__/keyboardInsetModel.test.ts && git commit -m "$(cat <<'EOF'
fix(ui): carry the keyboard reserve through a blur-driven close

The ownership branch returned reserveOverlap: 0 unconditionally, overriding
will-hide's deliberate hold one tick after blur — SearchBodyReveal re-laid-out
the whole overlay (411 -> 94) in a single un-animated frame while the keyboard
was still travelling. The reserve is now carried until did-settle when a close
is already in flight.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4.2: One close, one curve — no-op the ownership command when an identical close is in flight

**Files:**
- Modify: `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/shell/keyboardInsetModel.ts` (append `isRedundantClose` after `reduceKeyboard`'s closing `}` at `:126`)
- Modify: `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/shell/useKeyboardAnchor.native.ts:38-48` (imports), `:81-85` (refs), `:113-129` (`apply`), `:214-223` (the ownership `apply` call)
- Test: `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/shell/__tests__/keyboardInsetModel.test.ts` (new top-level `describe`)

**Interfaces:**
- Consumes: `reduceKeyboard(phase: KeyboardPhase, s: KeyboardSignal): KeyboardCommand` with the `closing?: boolean; reserveHint?: number` ownership fields **from Task 4.1**; `interface KeyboardCommand { phase: KeyboardPhase; target: number; duration: number; reserveOverlap: number }`.
- Produces: `isRedundantClose(cmd: KeyboardCommand, inFlightTarget: number | null): boolean`, exported from `shell/keyboardInsetModel.ts`.

**Why (from the spec, defect 2):** the ownership effect (`useKeyboardAnchor.native.ts:198-225`) re-issues `overlap.value = withTiming(0, { duration: 220 })` on top of the will-hide's still-running `withTiming(0, { duration: OSdur })`. Reanimated does not *continue* a timing — it starts a NEW ease-out from the current value, so the dock re-accelerates while the real keyboard keeps decelerating on the OS curve.

- [ ] **Step 1: Write the failing test.** Append this new top-level `describe` at the END of `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/shell/__tests__/keyboardInsetModel.test.ts`, and add `isRedundantClose` plus `type KeyboardCommand` to the existing import block at `:10-19`, so the block reads:

```ts
import {
  KEYBOARD_SURFACE_GAP,
  iosKeyboardCloseEasing,
  iosKeyboardOpenEasing,
  isRedundantClose,
  keyboardAnimationDuration,
  keyboardLift,
  keyboardOverlapFrom,
  reduceKeyboard,
  type KeyboardCommand,
  type KeyboardPhase,
} from "../keyboardInsetModel"
```

```ts
describe("isRedundantClose — one close, ONE curve", () => {
  // The will-hide close (target 0) is already running on the OS's own reported duration when the blur's
  // ownership command arrives with the same target on keyboardHandoffMs. Applying it restarts an ease-out
  // mid-flight: the dock re-accelerates while the real keyboard keeps decelerating.
  const BLUR_CLOSE: KeyboardCommand = { phase: "engaged", target: 0, duration: 220, reserveOverlap: 345 }

  it("skips the blur command that lands on a still-running will-hide close", () => {
    expect(isRedundantClose(BLUR_CLOSE, 0)).toBe(true)
  })
  it("applies the command when nothing is in flight", () => {
    expect(isRedundantClose(BLUR_CLOSE, null)).toBe(false)
  })
  it("NEVER skips the landing — a zero-duration command is what releases the carried reserve", () => {
    expect(isRedundantClose({ phase: "idle", target: 0, duration: 0, reserveOverlap: 0 }, 0)).toBe(false)
  })
  it("applies a command with a DIFFERENT target — a will-show retargeting mid-close must win", () => {
    expect(isRedundantClose({ phase: "engaged", target: 345, duration: 250, reserveOverlap: 345 }, 0)).toBe(false)
  })
  it("treats a 0 in-flight target as a real record, not as absent", () => {
    // The close everyone cares about targets exactly 0; a falsy check here would disable the whole fix.
    expect(isRedundantClose(BLUR_CLOSE, 0)).toBe(true)
    expect(isRedundantClose({ ...BLUR_CLOSE, target: 345 }, 345)).toBe(true)
  })
})
```

- [ ] **Step 2: Run it and watch it fail.**
  `cd /Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui && pnpm vitest run src/shell/__tests__/keyboardInsetModel.test.ts`
  Expect `Tests  5 failed | 32 passed (37)`. The file DOES collect: vite-node resolves the missing named export to `undefined`, so every one of the five new cases fails at its call site with `TypeError: isRedundantClose is not a function`, and the 32 tests from Task 4.1 still pass. (Do NOT expect a module-level "does not provide an export named" error here — that is not how this runner behaves.)

- [ ] **Step 3: Minimal implementation.** (3a) Append to `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/shell/keyboardInsetModel.ts`, after the closing `}` of `reduceKeyboard` (`:126`):

```ts
/**
 * Would `cmd` RESTART a close that is already travelling to the same target?
 *
 * `inFlightTarget` is the target of the close currently animating, or null when nothing is. Reanimated
 * does not "continue" a running timing: assigning a second `withTiming` starts a NEW ease-out from the
 * current value, so re-issuing the will-hide's close on the blur that follows it one tick later
 * re-accelerates the dock while the real keyboard keeps decelerating on the OS curve.
 *
 * A duration<=0 command is NEVER redundant: that is the LANDING (`did-settle`), and it is what clears the
 * in-flight record and releases the reservation Task 4.1 carries.
 */
export function isRedundantClose(cmd: KeyboardCommand, inFlightTarget: number | null): boolean {
  return inFlightTarget !== null && cmd.duration > 0 && cmd.target === inFlightTarget
}
```

  (3b) In `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/shell/useKeyboardAnchor.native.ts`, add `isRedundantClose` to the import block at `:38-48` (alphabetical, between `iosKeyboardOpenEasing` and `keyboardAnimationDuration`), so the block reads:

```ts
import {
  KEYBOARD_SURFACE_GAP,
  iosKeyboardCloseEasing,
  iosKeyboardOpenEasing,
  isRedundantClose,
  keyboardAnimationDuration,
  keyboardLift,
  keyboardOverlapFrom,
  reduceKeyboard,
  type KeyboardCommand,
  type KeyboardPhase,
} from "./keyboardInsetModel"
```

  (3c) Add the in-flight record immediately after `reserveOverlapRef` (`:83`), i.e. between it and the `lastWillShow` comment at `:84`:

```ts
  const reserveOverlapRef = useRef(0)
  /** The TARGET of the close currently travelling, or null when nothing is. TWO jobs, one record:
   *  it is the `closing` flag `reduceKeyboard` needs to CARRY the reservation through the blur, and it is
   *  the dedupe key that stops that same blur restarting the will-hide's timing. Set when `apply` starts a
   *  CLOSING animation; cleared on every landing (duration <= 0) and by any non-closing animation. */
  const inFlightCloseRef = useRef<number | null>(null)
```

  (3d) Replace `apply` (`:113-129`) with:

```ts
  const apply = (cmd: KeyboardCommand, closing: boolean) => {
    phase.current = cmd.phase
    setEngaged(cmd.phase === "engaged")
    reserveOverlapRef.current = cmd.reserveOverlap
    setReserved(keyboardLift(cmd.reserveOverlap, restOffset, gap))
    // ONE CLOSE, ONE CURVE. The phase + reservation above STILL apply — that is exactly how the mid-close
    // blur carries the reservation (reduceKeyboard's `closing` branch). Only the ANIMATION command is
    // dropped, because reanimated would restart the ease-out from the current value and re-accelerate the
    // dock while the real keyboard is still decelerating on the OS curve.
    if (isRedundantClose(cmd, inFlightCloseRef.current)) return
    if (cmd.duration <= 0) {
      inFlightCloseRef.current = null
      owned.value = 0
      overlap.value = cmd.target
      return
    }
    inFlightCloseRef.current = closing ? cmd.target : null
    owned.value = 1
    overlap.value = withTiming(cmd.target, {
      duration: cmd.duration,
      easing: closing ? iosKeyboardCloseEasing : iosKeyboardOpenEasing,
      reduceMotion: ReduceMotion.System,
    })
  }
```

  (3e) Replace the ownership `apply` call at `:214-223` with:

```ts
    const live = keyboardOverlapFrom(Keyboard.metrics(), winRef.current, PLATFORM)
    apply(
      reduceKeyboard(phase.current, {
        type: "ownership",
        enabled,
        liveOverlap: live,
        handoffMs: theme.motion.keyboardHandoffMs,
        // Derived from the SAME record the dedupe uses, so "carry the reserve" and "do not restart the
        // travel" can never disagree. Order of record: iOS posts keyboardWillHide (which starts the close
        // and sets this ref) BEFORE the field's blur re-runs this effect.
        closing: inFlightCloseRef.current !== null,
        reserveHint: reserveOverlapRef.current,
      }),
      !enabled,
    )
```

  Trace the four paths once before moving on, because the record has two jobs and a wrong clear breaks both:
  - **dock exit:** willHide → `apply(cmd{target 0, dur OS}, closing=true)` sets the ref to 0 → blur → ownership with `closing:true, reserveHint:345` → `{phase:"engaged", reserveOverlap:345}` → `apply` holds the phase + reserve and RETURNS before touching `overlap` → didHide → `did-settle` duration 0 → ref cleared, reserve released.
  - **foreign handoff (keyboard stays up):** no willHide, so the ref is null → `closing:false` → the existing `{phase:"idle", duration:220}` release runs exactly as today.
  - **will-show retargeting mid-close:** target 345 ≠ in-flight 0 → applied, and `closing=false` nulls the ref.
  - **re-focus after a foreign handoff:** the ownership/`enabled:true` branch runs with `closing=false`, which nulls the ref, so no stale 0 survives.

- [ ] **Step 4: Run it and watch it pass.**
  `cd /Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui && pnpm vitest run src/shell/__tests__/keyboardInsetModel.test.ts` → `Test Files  1 passed (1)` / `Tests  37 passed (37)`.
  Then `pnpm typecheck` (two banner lines, exit 0) and `pnpm lint` (two banner lines, exit 0 — `useKeyboardAnchor.native.ts` is a `.native.` seam, so its reanimated import stays legal under `NATIVE_ONLY_PATTERNS` in `eslint.config.js`).

- [ ] **Step 5: Commit.**
```bash
cd /Users/theobong/Documents/GitHub/civfix/civfix-shared && git add packages/ui/src/shell/keyboardInsetModel.ts packages/ui/src/shell/useKeyboardAnchor.native.ts packages/ui/src/shell/__tests__/keyboardInsetModel.test.ts && git commit -m "$(cat <<'EOF'
fix(ui): stop the blur restarting the keyboard's in-flight close

The ownership effect re-issued withTiming(0, 220ms) on top of the will-hide's
still-running close, restarting an ease-out mid-flight so the dock
re-accelerated while the real keyboard kept decelerating. apply() now skips a
command that targets a close already travelling; the landing still applies.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4.3: The exit is carried by a SINGLE curve — settle `focusProgress` at exit-start

**Files:**
- Create: `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/shell/searchExitModel.ts`
- Create: `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/shell/__tests__/searchExitModel.test.ts`
- Modify: `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/shell/SearchHeader.native.tsx:33` (import), `:104-108` (hook signature), `:137-143` (the `pos` effect)
- Modify: `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/shell/TabBar.native.tsx:414-415` (the `useDockedSearchRise` call)
- Modify: `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/shell/__tests__/tabBar.test.ts:144-146` (the source guard that pins the call site)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `interface FocusSettleCommand { target: 0 | 1; animated: boolean }` (exported from `shell/searchExitModel.ts`)
  - `focusSettleCommand(pinned: boolean, searchActive: boolean): FocusSettleCommand`
  - `useDockedSearchRise(riseRef: RefObject<Measurable | null>, value: string, restOffset: number, searchActive: boolean)` — **the signature gains a 4th parameter**; return shape is unchanged (`{ riseStyle, onLayout, onFieldFocus, onFieldBlur, pinned, focusProgress, keyboardEngaged }`). Its only caller is `TabBar.native.tsx:415` (verified by grep across `packages/ui/src`: the only other hits are the declaration at `SearchHeader.native.tsx:104`, two prose comments, and two assertions in `shell/__tests__/tabBar.test.ts`). `searchActive` is already in scope at that call site — it is destructured from `useTabBarModel()` at `TabBar.native.tsx:219`.

**Why (from the spec, defect 3), stated precisely against the real math in `surface/liquidGlass/liquidGlassModel.ts:121-173`.** `dockShapes(progress, regionW, focus, minimize, h = 64, gap = 12)` takes BOTH curves and multiplies them into one width:

```ts
const u        = lerp(p, h, h - 16)          // 64 at rest -> 48 docked
const wide     = Math.max(regionW - u - gap, 0)
const rightWp  = lerp(p, u, wide)            // p-driven: orb -> full field
const fieldFocusW = Math.max(wide - u - gap, 0)
const rightW   = lerp(f, rightWp, fieldFocusW)   // <-- BOTH p AND f
const rightX   = lerp(f, regionW - rightWp, u + gap)
const clearX   = lerp(f, regionW + gap, regionW - u)  // the trailing ✕ circle
```

On exit today, `p` times 1→0 on `dockMorphOut` (200ms) **while** `f` times 1→0 on `dockFocus` (200ms), so `rightW` is a product of two easings. Settling `f` to its exit value on frame 1 leaves `p` as the only animating input.

At `p = 1` the settle is geometrically tiny and lands under the morph: `rightWp = wide` and `wide = regionW - u - gap`, so `regionW - rightWp == u + gap` and `rightX` is **identical** at `f = 1` and `f = 0` — nothing translates. Only `rightW` steps by `u + gap` (48 + 12 = 60pt at p=1), and the ✕ circle's glass (`clearX`) plus its glyph (`clearStyle.opacity = focusProgress.value`, `TabBar.native.tsx:518-524`) leave together in that same frame — and `dockMorphOut` is `EASE_STANDARD` `cubic-bezier(0.22,1,0.36,1)`, documented at `theme/motion.ts:57` as `p <= 0.85 at 9ms`, so frame 1 of the exit has already collapsed most of the geometry anyway.

**This must NOT change the ✕ path.** `onClearSearch` stays in Search (`searchActive` stays true), so `focusSettleCommand` returns `{ target: 0, animated: true }` there and the ✕ keeps its existing `dockFocus` collapse.

- [ ] **Step 1: Write the failing test.** Create `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/shell/__tests__/searchExitModel.test.ts` with exactly this content — every literal is the contract, nothing here is to be adjusted afterwards:

```ts
/**
 * PURE decisions for LEAVING Search (shell/searchExitModel.ts). The seams only wire reanimated around
 * these, so this file is where the exit's semantics are pinned.
 */
import { describe, expect, it } from "vitest"
import { focusSettleCommand } from "../searchExitModel"

describe("focusSettleCommand — the exit is carried by ONE curve", () => {
  it("animates the focus RISE when the docked field pins", () => {
    expect(focusSettleCommand(true, true)).toEqual({ target: 1, animated: true })
  })

  it("animates the focus COLLAPSE while STAYING in Search — the ✕ keeps its own dockFocus curve", () => {
    // onClearSearch clears the query + blurs but does NOT leave Search, so searchActive is still true.
    // Its meaning is unchanged by this workstream: `animated` MUST be true here. If this line is ever
    // relaxed to `animated: false`, the trailing ✕'s dockFocus collapse silently becomes a hard jump.
    expect(focusSettleCommand(false, true)).toEqual({ target: 0, animated: true })
  })

  it("SETTLES focus at exit-start so only `p` animates dockShapes", () => {
    // dockShapes composes both: rightW = lerp(f, rightWp(p), fieldFocusW). Timing f 1->0 on dockFocus at
    // the same moment p times 1->0 on dockMorphOut multiplies two easings into one glass width.
    expect(focusSettleCommand(true, false)).toEqual({ target: 0, animated: false })
    expect(focusSettleCommand(false, false)).toEqual({ target: 0, animated: false })
  })

  it("is total over the four inputs (no undefined cell)", () => {
    for (const pinned of [true, false]) {
      for (const searchActive of [true, false]) {
        const cmd = focusSettleCommand(pinned, searchActive)
        expect([0, 1]).toContain(cmd.target)
        expect(typeof cmd.animated).toBe("boolean")
      }
    }
  })
})
```

- [ ] **Step 2: Run it and watch it fail.**
  `cd /Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui && pnpm vitest run src/shell/__tests__/searchExitModel.test.ts`
  Expect a collect-time failure, because the module does not exist yet:
  `Error: Failed to load url ../searchExitModel (resolved id: ../searchExitModel) in /Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/shell/__tests__/searchExitModel.test.ts. Does the file exist?`
  → `Test Files  1 failed (1)` / `Tests  no tests`.

- [ ] **Step 3: Minimal implementation.** (3a) Create `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/shell/searchExitModel.ts`:

```ts
/**
 * PURE decisions for LEAVING Search. No react, no react-native, no reanimated — the platform seams
 * (SearchHeader.native's useDockedSearchRise, TabBar.native's morph effect) wire animations AROUND these,
 * so the semantics of the exit are unit-testable with zero native deps.
 *
 * SCOPE: the LEADING glass circle only (TabBar.native's `onExitSearch`). The trailing ✕ (`onClearSearch`)
 * clears the query + blurs and STAYS in Search — `searchActive` is still true for it, so it keeps its
 * existing animated dockFocus collapse.
 */

export interface FocusSettleCommand {
  /** Where `focusProgress` must end up. */
  target: 0 | 1
  /** Animate on `dockFocus` (200ms), or settle THIS FRAME so no second curve runs. */
  animated: boolean
}

/**
 * How `focusProgress` must move.
 *
 * WHY THE SETTLE: `dockShapes(p, regionW, f, …)` (surface/liquidGlass/liquidGlassModel.ts:121-173) takes
 * BOTH progresses and multiplies them into one glass width —
 *   rightW = lerp(f, rightWp(p), fieldFocusW)
 * — so timing `f` 1->0 on dockFocus at the same moment `p` times 1->0 on dockMorphOut makes the field's
 * width a product of two easings. Settling `f` on the exit's first frame leaves `p` as the sole animating
 * input, which is the whole point: ONE curve carries the dismissal.
 *
 * The settle is geometrically cheap: at p=1, `rightX` is identical at f=1 and f=0 (regionW - rightWp ==
 * u + gap), so nothing translates — only the field's right edge steps out by (u + gap) = 60pt as the
 * trailing ✕ circle leaves, on the same frame dockMorphOut has already taken p past 0.85
 * (theme/motion.ts:57).
 *
 * REDUCE MOTION: `animated: false` IS the reduce-motion-safe path (a straight assignment). The caller
 * keeps `ReduceMotion.System` on the animated branch.
 */
export function focusSettleCommand(pinned: boolean, searchActive: boolean): FocusSettleCommand {
  if (!searchActive) return { target: 0, animated: false }
  return { target: pinned ? 1 : 0, animated: true }
}
```

  (3b) In `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/shell/SearchHeader.native.tsx`, add the import immediately after `:33` (`import { dockFocusConfig } from "./motionConfigs.native"`), so the two lines read:

```ts
import { dockFocusConfig } from "./motionConfigs.native"
import { focusSettleCommand } from "./searchExitModel"
```

  (3c) Replace the hook signature at `:104-108`:

```ts
export function useDockedSearchRise(
  riseRef: RefObject<Measurable | null>,
  value: string,
  restOffset: number,
  /** Is Search the CURRENT view? False from the first frame of an exit (the leading circle's
   *  `selectView(prevView)`), which is what settles `pos` instead of timing it. The ✕ clear keeps this
   *  true, so its collapse still animates. */
  searchActive: boolean,
) {
```

  (3d) Replace the `pos` effect at `:137-143`:

```ts
  const pos = useSharedValue(0)
  useEffect(() => {
    // Deterministic 200ms timing (theme.motion.dockFocus) while Search is LIVE. The previous
    // DURATION-spring ({duration: 500, dampingRatio: 0.8}) is solved by reanimated against `duration *
    // 1.5`, so the field shrink and the ✕ circle were still creeping 750ms after the tap.
    //
    // ON EXIT the command SETTLES instead: `dockShapes` composes p AND f into one glass width
    // (rightW = lerp(f, rightWp(p), fieldFocusW)), so animating both at once multiplies two easings.
    // See focusSettleCommand for the geometry.
    const cmd = focusSettleCommand(pinned, searchActive)
    if (!cmd.animated) {
      pos.value = cmd.target
      return
    }
    pos.value = withTiming(cmd.target, { ...dockFocusConfig(), reduceMotion: ReduceMotion.System })
  }, [pinned, searchActive, pos])
```

  (3e) In `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/shell/TabBar.native.tsx`, replace `:414-415` (the two-line destructure + call; leave `const riseRef = useRef<Animated.View>(null)` at `:413` alone):

```ts
  const { riseStyle, onLayout: onRiseLayout, onFieldFocus, onFieldBlur, focusProgress, pinned } =
    useDockedSearchRise(riseRef, dockedSearch.value, dockKeyboardRestOffset(insets.bottom), searchActive)
```

  (3f) Update the source guard in `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/shell/__tests__/tabBar.test.ts` — replace `:144-146` (the `// The TabBar passes the DERIVED rest offset, never a literal.` comment, the `const native = readFileSync(...)` line, and the `expect(native).toMatch(...)` line) with:

```ts
    // The TabBar passes the DERIVED rest offset, never a literal — plus `searchActive`, which is what
    // SETTLES focusProgress on the exit's first frame so dockShapes is driven by ONE curve (`p`) instead
    // of the product of two. The ✕ clear stays IN Search, so it keeps the animated dockFocus collapse.
    const native = readFileSync(new URL("../TabBar.native.tsx", import.meta.url), "utf8")
    expect(native).toMatch(
      /useDockedSearchRise\(riseRef, dockedSearch\.value, dockKeyboardRestOffset\(insets\.bottom\), searchActive\)/,
    )
    expect(header).toMatch(/focusSettleCommand\(pinned, searchActive\)/)
```

  (`header` is already in scope in that `it` — it is read at `:133`. The lines below `:146` in the same `it` — the web-seam assertions — are untouched.)

- [ ] **Step 4: Run it and watch it pass.**
  `cd /Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui && pnpm vitest run src/shell/__tests__/searchExitModel.test.ts src/shell/__tests__/tabBar.test.ts`
  Expect `Test Files  2 passed (2)` / `Tests  63 passed (63)`, reported per file as `src/shell/__tests__/searchExitModel.test.ts (4 tests)` and `src/shell/__tests__/tabBar.test.ts (59 tests)` — tabBar gains no case in this task, it only has one assertion block rewritten, and `drives the docked bar's keyboard rise through the canonical anchor, not a raw keyboard height` must be among the green.
  Then `pnpm typecheck` (two banner lines, exit 0) and `pnpm lint` (two banner lines, exit 0 — `searchExitModel.ts` imports nothing at all, so it is legal in a platform-neutral file).

- [ ] **Step 5: Commit.**
```bash
cd /Users/theobong/Documents/GitHub/civfix/civfix-shared && git add packages/ui/src/shell/searchExitModel.ts packages/ui/src/shell/__tests__/searchExitModel.test.ts packages/ui/src/shell/SearchHeader.native.tsx packages/ui/src/shell/TabBar.native.tsx packages/ui/src/shell/__tests__/tabBar.test.ts && git commit -m "$(cat <<'EOF'
fix(ui): carry the Search exit on a single curve

dockShapes composes p and focus into one glass width
(rightW = lerp(f, rightWp(p), fieldFocusW)), so timing both 1->0 at once made
the field a product of two easings. focusProgress now SETTLES at exit-start and
only p animates. The ✕ clear stays in Search and keeps its dockFocus collapse.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4.4: The search surface + its exit freeze (pure model)

**Files:**
- Create: `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/bodies/searchSurfaceModel.ts`
- Create: `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/bodies/__tests__/searchSurfaceModel.test.ts`

**Interfaces:**
- Consumes: `getSearchBodyMode(query: string): SearchBodyMode` from `bodies/searchRecentStore.ts:15-17`; `type View` from `nav/types.ts:10`, re-exported by the `nav` barrel (`nav/index.ts` does `export * from "./types"`), imported here as `import type` so nothing is added to the runtime graph.
- Produces (all exported from `bodies/searchSurfaceModel.ts`):
  - `type SearchSurface = "results" | "recents" | "discovery"`
  - `interface SearchSurfaceState { surface: SearchSurface; query: string }`
  - `searchSurfaceState(query: string, pinned: boolean): SearchSurfaceState`
  - `resolveSearchSurfaceState(live: SearchSurfaceState, held: SearchSurfaceState, frozen: boolean): SearchSurfaceState`
  - `isSearchBodyFrozen(view: View, exitSettled: boolean): boolean`

**Why (from the spec, defect 4):** `selectView` clears `query` **in the same store update that changes `view`** (`nav/useNavStore.ts:220-255`; `view` is written at `:241` and `query: ""` at `:244` of the one returned object), so `SearchBody.tsx:54` swaps `SearchResults` → `SearchResting`, then `pinned` flips and `:278` swaps `RecentlySearched` → `Discovery` ~1 frame later — mounting three react-query-backed sections plus a horizontal `ScrollView` of avatar cards and `FollowButton`s on the exact frames the overlay is fading and the glass is morphing.

**The shape is `bodyFadeStyle`'s freeze-while-closing** (`shell/CompactShell.native.tsx:557-568`): a live value is written into a holding cell **only while not closing**, and the closing branch returns the held cell. Same rule here, with the surface + its query as the held cell. This is a FREEZE, not a crossfade — no second body is mounted and no `ScrollHost` identity changes, which is what keeps hard constraints 4 and 5 satisfied.

**The freeze condition is DERIVED, never published by an effect.** An effect-published flag commits one render *after* the query clear, so the swap it exists to prevent has already happened. `view !== "search"` is available in the *same* render.

- [ ] **Step 1: Write the failing test.** Create `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/bodies/__tests__/searchSurfaceModel.test.ts`:

```ts
/**
 * The search body's surface selection + the EXIT FREEZE.
 *
 * Modelled on `bodyFadeStyle`'s freeze-while-closing (shell/CompactShell.native.tsx:557-568): the live
 * value is written into a holding cell only while NOT closing, and the closing branch returns the cell.
 * Here the cell is the SURFACE plus the query it was built for, because `selectView` clears the query in
 * the same store update that changes the view — holding the surface without the query would re-render
 * SearchResults with an empty query, which is a content change on the fade frames all the same.
 */
import { describe, expect, it } from "vitest"
import {
  isSearchBodyFrozen,
  resolveSearchSurfaceState,
  searchSurfaceState,
  type SearchSurfaceState,
} from "../searchSurfaceModel"

describe("searchSurfaceState", () => {
  it("is results for a typed query, carrying the trimmed query", () => {
    expect(searchSurfaceState("  Echo Park  ", false)).toEqual({ surface: "results", query: "Echo Park" })
  })
  it("is results even while the bar is pinned — typing wins over focus", () => {
    expect(searchSurfaceState("Echo Park", true)).toEqual({ surface: "results", query: "Echo Park" })
  })
  it("is recents when the docked bar is pinned with no query", () => {
    expect(searchSurfaceState("   ", true)).toEqual({ surface: "recents", query: "" })
  })
  it("is discovery at rest", () => {
    expect(searchSurfaceState("", false)).toEqual({ surface: "discovery", query: "" })
  })
})

describe("resolveSearchSurfaceState — freeze-while-exiting", () => {
  const RESULTS: SearchSurfaceState = { surface: "results", query: "echo park" }
  // What SearchBody computes on the FIRST frame of an exit: selectView cleared the query in the same
  // store update that changed the view, and the blur drops `pinned` a frame later.
  const AFTER_EXIT: SearchSurfaceState = { surface: "discovery", query: "" }

  it("renders live content while Search is live", () => {
    expect(resolveSearchSurfaceState(RESULTS, AFTER_EXIT, false)).toBe(RESULTS)
  })
  it("holds the surface AND its query through the exit, so ZERO remounts land on the fade frames", () => {
    expect(resolveSearchSurfaceState(AFTER_EXIT, RESULTS, true)).toBe(RESULTS)
  })
  it("returns to live content once the exit has settled", () => {
    expect(resolveSearchSurfaceState(AFTER_EXIT, RESULTS, false)).toBe(AFTER_EXIT)
  })
  it("also holds the recents -> discovery swap, not just results -> resting", () => {
    const RECENTS: SearchSurfaceState = { surface: "recents", query: "" }
    expect(resolveSearchSurfaceState(AFTER_EXIT, RECENTS, true)).toBe(RECENTS)
  })
})

describe("isSearchBodyFrozen", () => {
  it("freezes from the FIRST frame of an exit", () => {
    // Derived from the nav view, so it is true in the SAME render selectView clears the query in. A flag
    // published from an effect would arrive one commit late and the swap would already have happened.
    expect(isSearchBodyFrozen("home", false)).toBe(true)
    expect(isSearchBodyFrozen("map", false)).toBe(true)
  })
  it("never freezes while Search is the current view", () => {
    expect(isSearchBodyFrozen("search", false)).toBe(false)
    expect(isSearchBodyFrozen("search", true)).toBe(false)
  })
  it("releases once the dock morph has settled, so the remount lands on a quiet, invisible overlay", () => {
    expect(isSearchBodyFrozen("home", true)).toBe(false)
  })
})
```

- [ ] **Step 2: Run it and watch it fail.**
  `cd /Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui && pnpm vitest run src/bodies/__tests__/searchSurfaceModel.test.ts`
  Expect a collect-time failure, because the module does not exist yet:
  `Error: Failed to load url ../searchSurfaceModel (resolved id: ../searchSurfaceModel) in /Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/bodies/__tests__/searchSurfaceModel.test.ts. Does the file exist?`
  → `Test Files  1 failed (1)` / `Tests  no tests`.

- [ ] **Step 3: Minimal implementation.** Create `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/bodies/searchSurfaceModel.ts`:

```ts
/**
 * PURE surface selection for the Search page, plus THE EXIT FREEZE. No react, no react-native — SearchBody
 * only renders what these return.
 *
 * WHY IT EXISTS. Leaving Search fires TWO hard content remounts on the fade frames: `selectView` clears
 * `query` (nav/useNavStore.ts:220-255), so the results surface swaps to the resting one, and one frame
 * later the field's blur drops `searchBarStore.pinned`, swapping RecentlySearched to Discovery — three
 * react-query-backed sections plus a horizontal ScrollView of avatar cards and FollowButtons, mounting on
 * exactly the frames the overlay is fading and the glass is morphing.
 *
 * THE SHAPE is `bodyFadeStyle`'s freeze-while-closing (shell/CompactShell.native.tsx:557-568): write the
 * live value into a holding cell ONLY while not closing, and return the cell while closing. The cell here
 * carries the query as well as the surface, because holding "results" while the query is already "" would
 * still re-render SearchResults with different props — a content change on the fade frames all the same.
 *
 * IT IS A FREEZE, NOT A CROSSFADE. No second copy of the body is mounted (the spec forbids that on native:
 * bodies register into gorhom's one shared active-scrollable registry) and no ScrollHost identity changes
 * (that would swap the ScrollView component TYPE and remount the whole subtree). Only WHICH children the
 * one resident body renders is held.
 *
 * THE FREEZE CONDITION IS DERIVED, NOT PUBLISHED. `isSearchBodyFrozen` reads the nav view, so it is true in
 * the SAME render that clears the query. A flag published from an effect commits one render later, by
 * which point the swap this exists to prevent has already happened.
 *
 * NOTE FOR THE NEXT READER: this changes WHICH content renders, never HOW IT IS LAID OUT, and it is gated
 * on the dock morph, never on a keyboard signal. See THE RULE at SearchBody.tsx (`SearchResting`) —
 * commit a637875 (@civfix/ui 0.33.0) gated this surface's layout on the keyboard and was reverted at the
 * user's explicit request.
 */
import type { View } from "../nav"
import { getSearchBodyMode } from "./searchRecentStore"

/** Which of the three search surfaces renders. */
export type SearchSurface = "results" | "recents" | "discovery"

/** Everything SearchBody needs to render one surface: the surface AND the query it was built for. */
export interface SearchSurfaceState {
  surface: SearchSurface
  query: string
}

/**
 * The LIVE surface for a navigation query + the docked bar's pinned state (Apple-Music model):
 * typing -> results, focused-with-no-query -> recents, resting -> discovery.
 *
 * The non-results surfaces carry an empty query: they take none, and a frozen resting surface must never
 * be able to resurrect a stale one.
 */
export function searchSurfaceState(query: string, pinned: boolean): SearchSurfaceState {
  const trimmed = query.trim()
  if (getSearchBodyMode(trimmed) === "results") return { surface: "results", query: trimmed }
  return { surface: pinned ? "recents" : "discovery", query: "" }
}

/**
 * THE FREEZE. `held` is the last state rendered while Search was live; `frozen` is true from the first
 * frame of an exit until the dock morph settles. Returns the SAME object it was handed, so a frozen render
 * changes no prop identity downstream.
 */
export function resolveSearchSurfaceState(
  live: SearchSurfaceState,
  held: SearchSurfaceState,
  frozen: boolean,
): SearchSurfaceState {
  return frozen ? held : live
}

/**
 * Is the search body riding a fade OUT right now?
 *
 * `view !== "search"` is derived (see the module header) so the freeze is live on the very frame the query
 * clears. `exitSettled` is published by the dock morph's exit timing once the overlay has finished fading
 * (searchBarStore.searchExitSettled) — releasing there, rather than at the next Search ENTER, keeps the
 * held surface's teardown off both the fade-out frames AND the enter spring's opening frames. It matters
 * that the release happens at all: SearchBodyReveal.native is MOUNT-ONCE (it keeps the search body
 * resident forever after the first open), so a freeze that never released would strand a stale surface.
 */
export function isSearchBodyFrozen(view: View, exitSettled: boolean): boolean {
  return view !== "search" && !exitSettled
}
```

- [ ] **Step 4: Run it and watch it pass.**
  `cd /Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui && pnpm vitest run src/bodies/__tests__/searchSurfaceModel.test.ts`
  Expect `Test Files  1 passed (1)` / `Tests  11 passed (11)`. Then `pnpm typecheck` (two banner lines, exit 0).

- [ ] **Step 5: Commit.**
```bash
cd /Users/theobong/Documents/GitHub/civfix/civfix-shared && git add packages/ui/src/bodies/searchSurfaceModel.ts packages/ui/src/bodies/__tests__/searchSurfaceModel.test.ts && git commit -m "$(cat <<'EOF'
test(ui): pure search-surface model with a freeze-while-exiting cell

searchSurfaceState/resolveSearchSurfaceState/isSearchBodyFrozen, modelled on
bodyFadeStyle's freeze-while-closing. The freeze condition is derived from the
nav view so it is live in the same render selectView clears the query in.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4.5: The exit-settle publish + its store field

**Files:**
- Modify: `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/shell/searchExitModel.ts` (append `SearchExitPublish` + `searchExitPublish`)
- Modify: `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/shell/searchBarStore.ts:30-69` (new `searchExitSettled` field + setter)
- Test: `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/shell/__tests__/searchExitModel.test.ts` (append a `describe`)
- Test: `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/shell/__tests__/searchBarStore.test.ts:13-15` (extend `reset()`) and append two `it` blocks

**Interfaces:**
- Consumes: `focusSettleCommand` / `FocusSettleCommand` from Task 4.3 (same module, no import needed); `isSearchBodyFrozen(view: View, exitSettled: boolean): boolean` from Task 4.4 (documented dependency only — this task does not import it).
- Produces:
  - `type SearchExitPublish = "reset" | "hold" | "settle"`
  - `searchExitPublish(morphTarget: 0 | 1, animated: boolean): SearchExitPublish` — `morphTarget` is exactly the `0 | 1` that `searchMorphTarget(view: View): 0 | 1` (`shell/tabBarLogic.ts:220-222`) already returns, so the Task 4.6 call site needs no cast.
  - `SearchBarState` gains `searchExitSettled: boolean` and `setSearchExitSettled: (settled: boolean) => void`.

- [ ] **Step 1: Write the failing tests.** (1a) Append to `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/shell/__tests__/searchExitModel.test.ts`, and extend its import to `import { focusSettleCommand, searchExitPublish } from "../searchExitModel"`:

```ts
describe("searchExitPublish — when the search body's exit freeze is armed and released", () => {
  it("RE-ARMS the freeze on every Search ENTER", () => {
    // The freeze must be live on the first frame of the NEXT exit — the frame selectView clears the query
    // in — so it is armed on entry, never at exit time.
    expect(searchExitPublish(1, true)).toBe("reset")
    expect(searchExitPublish(1, false)).toBe("reset")
  })
  it("HOLDS the freeze across an animated exit, to be released when the timing lands", () => {
    expect(searchExitPublish(0, true)).toBe("hold")
  })
  it("SETTLES immediately when there is no fade to protect (reduce-motion, or pre-measurement)", () => {
    // Reduce-motion jumps p straight to the target: there are no fade frames, so freezing content would
    // only strand a stale surface.
    expect(searchExitPublish(0, false)).toBe("settle")
  })
})
```

  (1b) In `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/shell/__tests__/searchBarStore.test.ts`, replace the `reset()` helper at `:13-15` and append two `it` blocks inside the existing `describe("searchBarStore")` (after the last `it`, before the closing `})` at `:51`):

```ts
function reset(): void {
  useSearchBarStore.setState({ pinned: false, barHeight: 60, keyboardReserve: 0, searchExitSettled: false })
}
```

```ts
  it("declares searchExitSettled FALSE in the store's OWN initial state", () => {
    // Read `getInitialState()`, NOT `getState()`. zustand's `setState` MERGES, so the `reset()` helper
    // above would inject `searchExitSettled: false` into a store that never declared it and this
    // assertion would pass against a missing field. `getInitialState()` returns the creator's object, so
    // it reports `undefined` until the field genuinely exists. (zustand 5.0.14 — verified present.)
    expect(useSearchBarStore.getInitialState().searchExitSettled).toBe(false)
  })

  it("publishes the exit settle and re-arms it on the next enter", () => {
    useSearchBarStore.getState().setSearchExitSettled(true)
    expect(useSearchBarStore.getState().searchExitSettled).toBe(true)
    useSearchBarStore.getState().setSearchExitSettled(false)
    expect(useSearchBarStore.getState().searchExitSettled).toBe(false)
  })
```

- [ ] **Step 2: Run them and watch them fail.**
  `cd /Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui && pnpm vitest run src/shell/__tests__/searchExitModel.test.ts src/shell/__tests__/searchBarStore.test.ts`
  Expect `Test Files  2 failed (2)` / `Tests  5 failed | 8 passed (13)`. Both files COLLECT (vite-node resolves the missing exports to `undefined`); the failures are:
  - `searchExitModel.test.ts` → all three new cases fail with `TypeError: searchExitPublish is not a function`; the 4 cases from Task 4.3 still pass.
  - `searchBarStore.test.ts` → `declares searchExitSettled FALSE in the store's OWN initial state`: `AssertionError: expected undefined to be false`; `publishes the exit settle and re-arms it on the next enter`: `TypeError: useSearchBarStore.getState(...).setSearchExitSettled is not a function`. The 4 pre-existing cases still pass.

- [ ] **Step 3: Minimal implementation.** (3a) Append to `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/shell/searchExitModel.ts`:

```ts
/**
 * What the dock morph must publish about the search body's EXIT FREEZE when `view` changes.
 *
 *  - "reset"  : Search is being ENTERED — arm the freeze for the NEXT exit (publish settled = false).
 *  - "hold"   : an ANIMATED exit is under way — publish nothing now; release when the dockMorphOut timing
 *               lands, so the two remounts fall on a quiet, fully-transparent overlay instead of on the
 *               fade frames.
 *  - "settle" : there is no fade to protect (OS reduce-motion, or the dock has not measured yet and `p`
 *               jumps straight to the target) — publish settled = true immediately.
 *
 * Note "hold" deliberately publishes NOTHING at exit-start: the freeze is already live, because
 * `isSearchBodyFrozen` derives it from the nav view in the very render that clears the query. Publishing
 * "frozen = true" from an effect here would always be one commit too late.
 */
export type SearchExitPublish = "reset" | "hold" | "settle"

export function searchExitPublish(morphTarget: 0 | 1, animated: boolean): SearchExitPublish {
  if (morphTarget === 1) return "reset"
  return animated ? "hold" : "settle"
}
```

  (3b) In `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/shell/searchBarStore.ts`, replace `:49-55` — the `keyboardReserve: number` member through the `setKeyboardReserve` member — with:

```ts
  keyboardReserve: number
  /**
   * NATIVE-DRIVEN. True once a Search EXIT's dock morph has SETTLED at rest — i.e. the search overlay has
   * finished fading out. `SearchBody` reads it together with the nav view
   * (`isSearchBodyFrozen(view, searchExitSettled)`) to decide whether to render FROZEN content, so the two
   * hard remounts of the exit (SearchResults -> SearchResting, RecentlySearched -> Discovery) land on a
   * quiet, invisible overlay instead of on the fade frames.
   *
   * It starts FALSE and is re-armed to false on every Search ENTER, so the freeze is live on the first
   * frame of the next exit — the frame `selectView` clears the query in.
   *
   * The web seam publishes nothing, which is inert: `isSearchBodyFrozen` is false whenever the view IS
   * search, and on web SearchBody only exists while it is (or briefly, as the outgoing body of its own
   * BodyTransition, where the same freeze is a bonus).
   */
  searchExitSettled: boolean
  /** Publish the pinned state (docked bar focus/blur transitions; both seams). */
  setPinned: (pinned: boolean) => void
  /** Publish the docked bar's measured height (rounded, floored at 0). */
  setBarHeight: (height: number) => void
  /** Publish the keyboard reserve (rounded, floored at 0). NATIVE docked bar only. */
  setKeyboardReserve: (reserve: number) => void
  /** Publish the search exit's settle. NATIVE dock morph only (TabBar.native's dockMorphOut timing). */
  setSearchExitSettled: (settled: boolean) => void
```

  and replace the store body at `:61-69` with:

```ts
export const useSearchBarStore = create<SearchBarState>((set) => ({
  pinned: false,
  barHeight: NOMINAL_BAR_HEIGHT,
  keyboardReserve: 0,
  searchExitSettled: false,
  setPinned: (pinned) => set({ pinned }),
  setBarHeight: (height) => set({ barHeight: Math.max(0, Math.round(height)) }),
  setKeyboardReserve: (reserve) =>
    set({ keyboardReserve: Number.isFinite(reserve) ? Math.max(0, Math.round(reserve)) : 0 }),
  setSearchExitSettled: (settled) => set({ searchExitSettled: settled }),
}))
```

- [ ] **Step 4: Run them and watch them pass.**
  `cd /Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui && pnpm vitest run src/shell/__tests__/searchExitModel.test.ts src/shell/__tests__/searchBarStore.test.ts`
  Expect `Test Files  2 passed (2)` / `Tests  13 passed (13)` — `src/shell/__tests__/searchExitModel.test.ts (7 tests)`, `src/shell/__tests__/searchBarStore.test.ts (6 tests)`. Then `pnpm typecheck` (two banner lines, exit 0).

- [ ] **Step 5: Commit.**
```bash
cd /Users/theobong/Documents/GitHub/civfix/civfix-shared && git add packages/ui/src/shell/searchExitModel.ts packages/ui/src/shell/searchBarStore.ts packages/ui/src/shell/__tests__/searchExitModel.test.ts packages/ui/src/shell/__tests__/searchBarStore.test.ts && git commit -m "$(cat <<'EOF'
feat(ui): publish when the Search exit's dock morph has settled

searchExitPublish decides reset/hold/settle from the morph target and whether
the exit is animated; searchBarStore carries the resulting searchExitSettled
flag across the shell/body boundary, like keyboardReserve already does.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4.6: Wire the freeze — publish it from the dock morph, consume it in SearchBody

**Files:**
- Modify: `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/shell/TabBar.native.tsx:63` (import), `:270-281` (the `p` morph effect), `:433-439` (the `onExitSearch` comment)
- Modify: `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/bodies/SearchBody.tsx:18` (react import), `:36-38` (body imports), `:42-55` (`SearchBody`), `:241-287` (`SearchResting`)
- Test: `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/bodies/__tests__/SearchBody.test.ts` (append three `it` blocks to the existing `describe("SearchBody top-anchored recents")` source-guard block at `:26-58`)
- Test: `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/shell/__tests__/tabBar.test.ts` (append one `it` to `describe("feed-first tab bar model")`, which spans `:49-189`)

**Interfaces:**
- Consumes: `searchExitPublish(morphTarget: 0 | 1, animated: boolean): SearchExitPublish` and `SearchBarState.setSearchExitSettled(settled: boolean): void` (Task 4.5); `searchSurfaceState(query, pinned)`, `resolveSearchSurfaceState(live, held, frozen)`, `isSearchBodyFrozen(view, exitSettled)`, `type SearchSurfaceState` (Task 4.4); existing `searchMorphTarget(view: View): 0 | 1` (`shell/tabBarLogic.ts`), `useSearchBarStore` (`shell/searchBarStore.ts`).
- Produces: `SearchResting` becomes `function SearchResting({ surface }: { surface: "recents" | "discovery" })` (module-private to `bodies/SearchBody.tsx`; nothing outside the file references it). No other exported signature changes.

- [ ] **Step 1: Write the failing tests.** (1a) Append these three `it` blocks to `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/bodies/__tests__/SearchBody.test.ts`, INSIDE the existing `describe("SearchBody top-anchored recents", …)` block — after the last existing `it` (which ends at `:57`) and before that describe's closing `})` at `:58`. `const source = readFileSync(new URL("../SearchBody.tsx", …), "utf8")` is already declared at `:27`, so it is in scope:

```ts
  it("freezes the rendered surface during a Search EXIT so no remount lands on the fade frames", () => {
    // DERIVED, not published: `selectView` clears `query` in the SAME store update that changes `view`, so
    // a flag published from an effect would commit one render after the swap it exists to prevent.
    expect(source).toMatch(/isSearchBodyFrozen\(view, exitSettled\)/)
    expect(source).toMatch(/resolveSearchSurfaceState\(live, heldRef\.current, frozen\)/)
  })

  it("makes ONE surface decision, so the recents<->discovery swap cannot fire underneath the freeze", () => {
    // SearchResting used to read `pinned` itself and pick its own child; that second swap fired ~1 frame
    // after the results->resting one, mounting Discovery's three react-query sections plus a horizontal
    // ScrollView of avatar cards on the fade frames.
    expect(source).not.toMatch(/\{pinned \? <RecentlySearched/)
    expect(source).toMatch(/surface === "recents" \? <RecentlySearched \/> : <Discovery \/>/)
  })

  it("gates the freeze on the DOCK MORPH's settle, never on a keyboard signal", () => {
    // Guards THE RULE from the other direction, and it is the POSITIVE half that makes this a real test
    // rather than a restatement of the `reads no keyboard signal` case above: the freeze's release must
    // come from the morph's own settle flag. The moment its condition reads a keyboard value instead,
    // some layout here is keyboard-conditional again — which is exactly what a637875 (@civfix/ui 0.33.0)
    // shipped and this file exists to prevent.
    expect(source).toMatch(/state\.searchExitSettled/)
    expect(source).not.toMatch(/state\.keyboardReserve/)
    expect(source).not.toMatch(/useKeyboardInset\(\)/)
  })
```

  (1b) Append this `it` to `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/shell/__tests__/tabBar.test.ts`, inside `describe("feed-first tab bar model", …)` — after the last existing `it` in that block (which ends at `:188`) and before its closing `})` at `:189`. `readFileSync` is already imported at `:1`:

```ts
  it("releases the search body's exit freeze from the dockMorphOut timing, never from a config factory", () => {
    const native = readFileSync(new URL("../TabBar.native.tsx", import.meta.url), "utf8")
    // The freeze is armed on ENTER and released when the exit timing LANDS, so the two remounts fall on a
    // quiet, fully-transparent overlay instead of on the fade frames.
    expect(native).toMatch(/searchExitPublish\(target, animated\)/)
    expect(native).toMatch(/runOnJS\(setSearchExitSettled\)\(true\)/)
    // THE RULE (commit a89c3eb): a *Config() factory called from a worklet is a release-build SIGABRT. The
    // completion callback is a worklet, so it must contain the runOnJS hop and nothing else.
    expect(native).not.toMatch(/\(finished\) => \{[^}]*Config\(\)/)
  })
```

- [ ] **Step 2: Run them and watch them fail.**
  `cd /Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui && pnpm vitest run src/bodies/__tests__/SearchBody.test.ts src/shell/__tests__/tabBar.test.ts`
  Expect `Test Files  2 failed (2)` / `Tests  4 failed | 64 passed (68)` — `SearchBody.test.ts` is now 8 cases (3 failing) and `tabBar.test.ts` 60 (1 failing):
  - `freezes the rendered surface during a Search EXIT…` → `AssertionError: expected '/**\n * The Search page owns only its …' to match /isSearchBodyFrozen\(view, exitSettled\)/`
  - `makes ONE surface decision…` → fails on the FIRST assertion, `expected … not to match /\{pinned \? <RecentlySearched/` (that exact text is live at `SearchBody.tsx:278` today)
  - `gates the freeze on the DOCK MORPH's settle…` → `expected … to match /state\.searchExitSettled/`
  - `releases the search body's exit freeze from the dockMorphOut timing…` → `expected … to match /searchExitPublish\(target, animated\)/`

- [ ] **Step 3: Minimal implementation.** (3a) In `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/shell/TabBar.native.tsx`, add two imports immediately after `:63` (`import { useTabBarStore } from "./tabBarStore"`), so the three lines read:

```ts
import { useTabBarStore } from "./tabBarStore"
import { useSearchBarStore } from "./searchBarStore"
import { searchExitPublish } from "./searchExitModel"
```

  Replace the morph effect at `:270-281` with:

```ts
  const p = useSharedValue(searchActive ? 1 : 0)
  // THE SEARCH BODY'S EXIT FREEZE (defect 4). A zustand action is referentially stable, so this is safe to
  // capture and hand to `runOnJS` — it is a plain function reference, NOT a config factory. See THE RULE
  // below: a *Config() factory called from a worklet is a release-build SIGABRT (commit a89c3eb).
  const setSearchExitSettled = useSearchBarStore((s) => s.setSearchExitSettled)
  useEffect(() => {
    const target = searchMorphTarget(view)
    const animated = !reduceMotion && regionW > 0
    // "reset" on enter (arm the freeze for the next exit), "settle" when there are no fade frames to
    // protect, "hold" while an animated exit runs — released below when the timing lands. "hold"
    // publishes nothing on purpose: the freeze is ALREADY live, because SearchBody derives it from the nav
    // view in the very render `selectView` clears the query in.
    const publish = searchExitPublish(target, animated)
    if (publish !== "hold") setSearchExitSettled(publish === "settle")
    if (!animated) {
      p.value = target
      return
    }
    p.value =
      target === 1
        ? withSpring(target, { ...dockMorphInConfig(), reduceMotion: ReduceMotion.System })
        : withTiming(target, { ...dockMorphOutConfig(), reduceMotion: ReduceMotion.System }, (finished) => {
            "worklet"
            // The fade is OVER: let the search body drop its frozen surface now, on a quiet and fully
            // transparent overlay, instead of on the fade frames (exit) or on the spring's opening frames
            // (a release at the next ENTER would land there). `finished` is false when a re-entry
            // interrupts the exit — the "reset" publish above has already unfrozen it in that case.
            // NOTHING but the runOnJS hop may live in this body.
            if (finished) runOnJS(setSearchExitSettled)(true)
          })
  }, [view, reduceMotion, regionW, p, setSearchExitSettled])
```

  (`animated` is exactly the negation of the pre-existing `if (reduceMotion || regionW === 0)` guard at `:273`, so the jump branch is unchanged. `runOnJS` is already imported at `:39`.)

  (3b) In `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/bodies/SearchBody.tsx`, change the react import at `:18` to:

```ts
import React, { useEffect, useMemo, useRef } from "react"
```

  and replace the three body imports at `:36-38` with:

```ts
import { EventHitRow, ReportHitRow, SearchResults } from "./SearchResults"
import { assembleSearchSuggestions } from "./searchSuggestModel"
import { useSearchRecentStore } from "./searchRecentStore"
import {
  isSearchBodyFrozen,
  resolveSearchSurfaceState,
  searchSurfaceState,
} from "./searchSurfaceModel"
```

  (`getSearchBodyMode` moves behind `searchSurfaceModel` and MUST be dropped from this import — `@typescript-eslint/no-unused-vars` is `"error"` in `eslint.config.js`, so leaving it would red `pnpm lint`. `bodies/__tests__/SearchBody.test.ts:3` still imports it from `../searchRecentStore`, which is unchanged. `useSearchBarStore` and `useNavStore` are already imported at `:33` and `:31`.)

  Replace `SearchBody` at `:42-55`:

```ts
export function SearchBody() {
  const rawQuery = useNavStore((state) => state.query)
  const query = rawQuery.trim()
  const recordRecent = useSearchRecentStore((state) => state.record)

  useEffect(() => {
    if (!query) return
    // A brief pause avoids saving every intermediate character as its own recent search.
    const timeout = setTimeout(() => recordRecent(query), RECENT_WRITE_DELAY_MS)
    return () => clearTimeout(timeout)
  }, [query, recordRecent])

  // THE EXIT FREEZE (see bodies/searchSurfaceModel.ts for the full rationale). Leaving Search used to fire
  // TWO hard remounts on the overlay's fade frames: `selectView` clears `query` in the same store update
  // that changes `view` (results -> resting), then the field's blur drops `pinned` ~1 frame later
  // (RecentlySearched -> Discovery — three react-query sections plus a horizontal rail of avatar cards and
  // FollowButtons). Both decisions are made HERE now, once, and held through the exit.
  //
  // `frozen` is DERIVED from the nav view, so it is already true in the render that clears the query; a
  // flag published from an effect would commit one render too late. The hold is released by the dock
  // morph's exit timing (searchBarStore.searchExitSettled), i.e. once the overlay is invisible.
  //
  // Writing `heldRef` during render is deliberate and idempotent (StrictMode's double render writes the
  // same value): a state + effect would be a frame late, which is the entire defect.
  const view = useNavStore((state) => state.view)
  const pinned = useSearchBarStore((state) => state.pinned)
  const exitSettled = useSearchBarStore((state) => state.searchExitSettled)
  const frozen = isSearchBodyFrozen(view, exitSettled)
  const live = searchSurfaceState(query, pinned)
  const heldRef = useRef(live)
  if (!frozen) heldRef.current = live
  const held = resolveSearchSurfaceState(live, heldRef.current, frozen)

  return held.surface === "results" ? (
    <SearchResults query={held.query} />
  ) : (
    <SearchResting surface={held.surface} />
  )
}
```

  Replace `SearchResting` at `:241-287` (THE RULE comment is preserved verbatim except for its final paragraph, which now describes where the surface decision lives):

```ts
function SearchResting({ surface }: { surface: "recents" | "discovery" }) {
  const { ScrollView } = useScrollHost()

  // THE RULE: this surface is TOP-ANCHORED in every state. "Recently searched" starts at the very TOP of the
  // scroll viewport — the 8pt `content` paddingTop above it and nothing else — whether the docked bar is
  // resting or focused with a soft keyboard up. The content container must stay content-height (no grow, no
  // flex-end) and NOTHING about this layout may be gated on a keyboard signal.
  //
  // WHY, spelled out because this file has already been "fixed" the other way once: commit a637875 (shipped
  // as @civfix/ui 0.33.0, "search results bottom-anchor toward the bar") is REVERTED here at the user's
  // explicit request — "recently searched header isnt at the top / doesnt start at the top anymore for some
  // weird reason". What 0.33.0 was chasing is real: with the keyboard up the layer's bottom edge ends just
  // above the risen search pill, so a SHORT recents list leaves a large void between its last row and the
  // field being typed into (measured on an iPhone 17 Pro: ~230pt at 3 recents, ~320pt at 1, ~335pt at 0). It
  // closed that void by giving the container `flex-grow: 1` + `justify-content: flex-end` whenever a real
  // soft keyboard was up, so the list read UPWARD from the bar, Messages/Spotlight style. The cost was that
  // ALL the leftover slack piled up ABOVE the section header, and the user reads "Recently searched" as this
  // page's HEADER — a header sitting a couple of hundred pt down the screen reads as a broken layout, not as
  // an alignment. So the void is the ACCEPTED trade: it is simply the rest of the page. If it ever needs
  // closing again, close it with more content or a taller layer — never by moving the header off the top, and
  // never by reintroducing a grow-and-flex-end content style here.
  //
  // WHICH surface renders is decided ONCE, in `SearchBody`, from the docked bar's `pinned` flag (recents
  // while focused, discovery while resting, exactly where Apple Music / News show it) — and HELD there
  // through a Search exit so neither swap lands on the overlay's fade frames. That freeze is gated on the
  // DOCK MORPH, never on a keyboard signal, and it changes only which children mount: this layout, and this
  // ScrollHost, are identical in both states. The bar itself stays BOTTOM-DOCKED in every state (dock-morph
  // round 2: it no longer relocates to the top), so there is no top chrome to clear; the bottom-bar
  // clearance is the shell's bottomInset plus `bottomPad`.

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {surface === "recents" ? <RecentlySearched /> : <Discovery />}
      {/* Clears the RESTING dock so the last recent row / last discovery card is never trapped under it.
          UNCONDITIONAL, and note which spacer this is: 0.33.0 dropped it while the keyboard was up because
          under flex-end the LAST child becomes the anchor. With the anchor gone it is pure bottom scroll
          range in both states — the pre-a637875 behaviour. Deleting it instead would put the tail of the
          resting discovery list back under the dock. */}
      <View style={styles.bottomPad} />
    </ScrollView>
  )
}
```

  Finally, update the `onExitSearch` comment in `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/shell/TabBar.native.tsx:433-439` (the three comment lines plus the handler) to record the new invariants — the handler BODY is unchanged:

```ts
  // Leave Search entirely (LEADING circle only): dismiss the keyboard (blurs the field so the focus rise
  // reverses) and select the previous view, which drops the morph target to 0 → the dock reverse-morphs
  // back to the tab pill with the previously selected tab restored.
  //
  // THREE THINGS RIDE THIS ONE TAP, and they are deliberately staged so ONE curve carries the dismissal:
  //  1. Keyboard.dismiss() posts keyboardWillHide, whose reservation the anchor now CARRIES through the
  //     blur that follows it one tick later (keyboardInsetModel's ownership/`closing` branch) — the
  //     content-box step lands at did-settle, behind the keyboard's own travel, instead of mid-descent.
  //  2. selectView flips `searchActive` false, which SETTLES focusProgress this frame (focusSettleCommand)
  //     so dockShapes is driven by `p` alone rather than by the product of `p` and `f`.
  //  3. selectView also clears the query, which SearchBody now ignores until the exit timing lands
  //     (isSearchBodyFrozen / searchExitSettled) — zero remounts on the fade frames.
  const onExitSearch = () => {
    Keyboard.dismiss()
    selectView(prevView)
  }
```

- [ ] **Step 4: Run them and watch them pass.**
  `cd /Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui && pnpm vitest run src/bodies/__tests__/SearchBody.test.ts src/shell/__tests__/tabBar.test.ts` → `Test Files  2 passed (2)` / `Tests  68 passed (68)`, reported per file as `src/bodies/__tests__/SearchBody.test.ts (8 tests)` and `src/shell/__tests__/tabBar.test.ts (60 tests)`.
  Then the whole package: `pnpm test`. The gate is **zero failures**, with `src/shell/__tests__/searchExitModel.test.ts (7 tests)`, `src/bodies/__tests__/searchSurfaceModel.test.ts (11 tests)`, `src/shell/__tests__/keyboardInsetModel.test.ts (37 tests)`, `src/shell/__tests__/searchBarStore.test.ts (6 tests)`, `src/bodies/__tests__/SearchBody.test.ts (8 tests)` and `src/shell/__tests__/tabBar.test.ts (60 tests)` among the files, and `src/shell/__tests__/portrait-shell.test.ts` + `src/bodies/__tests__/searchSuggestModel.test.ts` still green (both untouched). Do NOT assert an absolute suite total — Workstreams 1-3 add tests to this same `packages/ui` suite, so the running total depends on how many of them have already landed.
  Then `pnpm typecheck` (two banner lines, exit 0) and `pnpm lint` (two banner lines, exit 0 — `SearchBody.tsx` gains no reanimated/expo import, and `searchSurfaceModel.ts` imports only a type from `../nav` plus `./searchRecentStore`).

- [ ] **Step 5: Commit.**
```bash
cd /Users/theobong/Documents/GitHub/civfix/civfix-shared && git add packages/ui/src/shell/TabBar.native.tsx packages/ui/src/bodies/SearchBody.tsx packages/ui/src/bodies/__tests__/SearchBody.test.ts packages/ui/src/shell/__tests__/tabBar.test.ts && git commit -m "$(cat <<'EOF'
fix(ui): freeze the search body through the Search exit

selectView clears the query in the same update that changes the view, so
leaving Search remounted SearchResults -> SearchResting and then
RecentlySearched -> Discovery on the exact frames the overlay was fading. Both
decisions are now made once in SearchBody and held until the dockMorphOut
timing lands. Layout is untouched: the resting surface stays top-anchored,
content-height, on the same ScrollHost, and gated on no keyboard signal.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Device verification (after 4.1–4.6, before the workstream is called done)

Not a code task — the recipe from the spec's Testing section, run on the iOS simulator because none of the four defects is observable from vitest:

- [ ] **Step 1: Sync the shared source into the app and clear Metro.**
  `@civfix/ui` is installed at the mobile repo ROOT, not under the app (verified: `/Users/theobong/Documents/GitHub/civfix/civfix-mobile/node_modules/@civfix/ui` exists; `/Users/theobong/Documents/GitHub/civfix/civfix-mobile/apps/community-mobile/node_modules/@civfix/ui` does not). Its `package.json` resolves the `react-native` condition to `./src/index.ts`, so syncing `src/` is what Metro actually reads:
  `rsync -a --delete /Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/ /Users/theobong/Documents/GitHub/civfix/civfix-mobile/node_modules/@civfix/ui/src/`
  Then restart the bundler with a cleared cache — a stale Metro cache after an in-place `node_modules` edit shows phantom red screens:
  `cd /Users/theobong/Documents/GitHub/civfix/civfix-mobile/apps/community-mobile && npx expo start --clear`
- [ ] **Step 2: Relaunch (not reload) and enter Search**, type a query so `SearchResults` is up with the keyboard raised.
- [ ] **Step 3: Tap the LEADING circle and watch four things**: (1) the content box does not step down while the keyboard is still travelling; (2) the dock does not re-accelerate mid-descent; (3) the field's width collapses on one continuous curve with no ✕ fade racing it; (4) no content flashes or re-lays-out inside the fading overlay.
- [ ] **Step 4: Tap the ✕ instead and confirm it is UNCHANGED** — query cleared, keyboard down, still in Search, field re-widens on `dockFocus`, recents → discovery swaps live (this surface is deliberately NOT frozen).
- [ ] **Step 5: Turn on Settings → Accessibility → Motion → Reduce Motion and repeat step 3** — the exit must jump straight to the tab bar with no frozen or stale search content left behind (the `"settle"` branch of `searchExitPublish`).
- [ ] **Step 6: Re-enter Search immediately after step 3 (interrupt the exit mid-fade)** — the search body must show LIVE content on the way back in, not the surface it froze on the way out. This is the `finished === false` path of the `dockMorphOut` completion worklet plus the `"reset"` publish; if stale content survives the re-entry, the arm-on-enter publish is not firing.


---


## Workstream 5 — Reports-nearby rows show the report photo + location

Spec section: "Workstream 5 — Reports-nearby rows". Two tasks, both in `@civfix/ui`. No backend change, no new i18n keys (`ReportRowView` already owns its a11y string in the `report-row` namespace, present in all four locales — verified: `src/i18n/locales/{en,es,de,ko}/report-row.json` all contain `"a11y": { "row": "{{title}}, {{status}}" }`).

**Verified baseline** (run before starting, from `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui`): `pnpm typecheck` exits 0 printing only its two pnpm banner lines, `pnpm lint` the same, and `pnpm vitest run` reports **zero failures**. Do NOT record or assert an absolute file/test total for the package anywhere in this workstream: Workstreams 1–4 land in this same vitest suite and any whole-suite number depends on how many of them are already on disk. Every gate below is a **per-file** count, each one measured by running that file.

**Unit warning, already checked by execution:** `distanceLabel` (`packages/ui/src/bodies/relativeTime.ts:34-37`) takes **MILES** — its body is `if (dist == null || Number.isNaN(dist)) return ""` then `return dist < 10 ? \`${dist.toFixed(1)} mi\` : \`${Math.round(dist)} mi\``. `haversineMeters` (`packages/shared/src/geo.ts:19-30`) returns **METERS** (`const EARTH_RADIUS_M = 6_371_000` at `geo.ts:10`; the function ends `return EARTH_RADIUS_M * c`). The conversion constant `METERS_PER_MILE = 1609.344` is therefore mandatory and is defined and exported in Task 5.1, asserted by Task 5.1's second test. Measured proof of the trap: the 644.931 m fixture used below renders **"0.4 mi"** through the conversion and **"645 mi"** without it.

Do not copy the `distanceLabel(cleanup.dist)` idiom from `EventsBody.tsx:95` / `HomeSidebarBody.tsx:572` / `EventDetailBody.tsx:216` — the backend's `dist` is `ST_Distance(c.geom::geography, …::geography)` i.e. metres (`civfix-backend/services/api/src/services/cleanup-sql.ts:75-78`), and the same repo treats it as metres where it matters (`searchSuggestModel.ts:62` and `EventsBody.tsx:234` both feed `c.dist ?? haversineMeters(...)` straight into `eventBlendScore`). Those three `distanceLabel` call sites are an existing, separate, out-of-scope bug.

---

### Task 5.1: Pure `reportHitRowModel` — title fallback, thumb, location subtitle chain

**Files:**
- Create: `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/bodies/reportHitRowModel.ts`
- Test: `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/bodies/__tests__/reportHitRowModel.test.ts`

**Interfaces:**
- Consumes: `haversineMeters(a: LatLngLike, b: LatLngLike): number` and `type LatLng = { lat: number; lng: number }` from `@civfix/shared` (the package root re-exports `./geo.js` and `./schemas/common.js`; `LatLng` resolves to `schemas/common.ts:66`, NOT the unexported `geocode.ts` alias); `distanceLabel(dist: number | null | undefined): string` from `./relativeTime`.
- Produces:
  - `export const METERS_PER_MILE = 1609.344`
  - `export interface ReportHitLike { title?: string | null; description?: string | null; addr?: string | null; thumbUrl?: string | null; lat: number; lng: number }`
  - `export interface ReportHitRowModel { title: string; subtitle: string | null; thumbUrl: string | null }`
  - `export function reportHitRowModel(input: { report: ReportHitLike; categoryLabel: string; viewer: LatLng | null }): ReportHitRowModel`
- `ReportPinDTO` (`packages/shared/src/schemas/entities.ts:188-200`) structurally satisfies `ReportHitLike`: it carries `lat`/`lng` (required, via `LatLngFields`) plus `title`, `description`, `thumbUrl`, `addr` as `string | null | undefined`. No cast is needed at the call site.

---

- [ ] **Step 1: Write the failing test.** Create `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/bodies/__tests__/reportHitRowModel.test.ts` with exactly this content. Every expected string below was computed by running the real `haversineMeters` body against these exact fixtures, not guessed: at `lat 34.05, lng -118.24`, a `+0.0058°` latitude offset is 644.931 m = 0.40074 mi → `"0.4 mi"`; `+0.1°` is 11119.493 m = 6.90933 mi → `"6.9 mi"`; `+0.2°` is 22238.985 m = 13.81866 mi → `"14 mi"` (the whole-mile branch at and above 10).

```ts
import { describe, expect, it } from "vitest"
import { METERS_PER_MILE, reportHitRowModel } from "../reportHitRowModel"

/** Downtown LA — the viewer. */
const HERE = { lat: 34.05, lng: -118.24 }
/** +0.0058 deg lat = 644.93 m = 0.40 mi from HERE (the spec's "0.4 mi" example). */
const NEAR = { lat: 34.0558, lng: -118.24 }
/** +0.1 deg lat = 11119.49 m = 6.909 mi from HERE (one-decimal branch). */
const MID = { lat: 34.15, lng: -118.24 }
/** +0.2 deg lat = 22238.99 m = 13.819 mi from HERE (whole-mile branch, >= 10 mi). */
const FAR = { lat: 34.25, lng: -118.24 }

/** A report pin with everything populated; spread over it to knock fields out. */
const FULL = {
  ...NEAR,
  title: "Broken swing",
  description: "The chain snapped",
  addr: "1200 S Hope St",
  thumbUrl: "https://cdn.civfix.org/thumb.jpg",
}

describe("reportHitRowModel", () => {
  it("joins distance and address into the location subtitle", () => {
    const row = reportHitRowModel({ report: FULL, categoryLabel: "Parks", viewer: HERE })
    expect(row).toEqual({
      title: "Broken swing",
      subtitle: "0.4 mi · 1200 S Hope St",
      thumbUrl: "https://cdn.civfix.org/thumb.jpg",
    })
  })

  it("converts METRES to MILES (a metres-as-miles label would read '645 mi')", () => {
    expect(METERS_PER_MILE).toBe(1609.344)
    expect(
      reportHitRowModel({ report: { ...FULL, addr: null }, categoryLabel: "Parks", viewer: HERE })
        .subtitle,
    ).toBe("0.4 mi")
    expect(
      reportHitRowModel({ report: { ...FULL, ...MID, addr: null }, categoryLabel: "Parks", viewer: HERE })
        .subtitle,
    ).toBe("6.9 mi")
    // Above 10 mi distanceLabel switches to whole miles.
    expect(
      reportHitRowModel({ report: { ...FULL, ...FAR, addr: null }, categoryLabel: "Parks", viewer: HERE })
        .subtitle,
    ).toBe("14 mi")
  })

  it("falls back to the address alone when the viewer has no location", () => {
    const row = reportHitRowModel({ report: FULL, categoryLabel: "Parks", viewer: null })
    expect(row.subtitle).toBe("1200 S Hope St")
  })

  it("falls back to the distance alone when the report has no geocoded address", () => {
    expect(
      reportHitRowModel({ report: { ...FULL, addr: null }, categoryLabel: "Parks", viewer: HERE })
        .subtitle,
    ).toBe("0.4 mi")
    // A whitespace-only addr is treated as absent, not joined as an empty segment.
    expect(
      reportHitRowModel({ report: { ...FULL, addr: "   " }, categoryLabel: "Parks", viewer: HERE })
        .subtitle,
    ).toBe("0.4 mi")
  })

  it("falls back to the description only when there is NO location at all", () => {
    expect(
      reportHitRowModel({ report: { ...FULL, addr: null }, categoryLabel: "Parks", viewer: null })
        .subtitle,
    ).toBe("The chain snapped")
  })

  it("returns a null subtitle when there is no location and no description", () => {
    expect(
      reportHitRowModel({
        report: { ...FULL, addr: null, description: null },
        categoryLabel: "Parks",
        viewer: null,
      }).subtitle,
    ).toBeNull()
    // Whitespace-only description is absent too.
    expect(
      reportHitRowModel({
        report: { ...FULL, addr: null, description: "   " },
        categoryLabel: "Parks",
        viewer: null,
      }).subtitle,
    ).toBeNull()
  })

  it("falls the title back to the localized category label", () => {
    expect(
      reportHitRowModel({ report: { ...FULL, title: null }, categoryLabel: "Parks", viewer: HERE }).title,
    ).toBe("Parks")
    expect(
      reportHitRowModel({ report: { ...FULL, title: "   " }, categoryLabel: "Parks", viewer: HERE }).title,
    ).toBe("Parks")
  })

  it("normalizes a missing or blank thumb to null so the row draws the category pin dot", () => {
    expect(
      reportHitRowModel({ report: { ...FULL, thumbUrl: null }, categoryLabel: "Parks", viewer: HERE })
        .thumbUrl,
    ).toBeNull()
    expect(
      reportHitRowModel({ report: { ...FULL, thumbUrl: "  " }, categoryLabel: "Parks", viewer: HERE })
        .thumbUrl,
    ).toBeNull()
  })
})
```

- [ ] **Step 2: Run it and watch it fail.**
  ```bash
  cd /Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui && pnpm vitest run src/bodies/__tests__/reportHitRowModel.test.ts
  ```
  Expected failure, verified by execution — the file fails to COLLECT, so vitest reports no tests at all rather than N failing tests:
  ```
   ❯ src/bodies/__tests__/reportHitRowModel.test.ts (0 test)

  ⎯⎯⎯⎯⎯⎯ Failed Suites 1 ⎯⎯⎯⎯⎯⎯⎯

   FAIL  src/bodies/__tests__/reportHitRowModel.test.ts [ src/bodies/__tests__/reportHitRowModel.test.ts ]
  Error: Failed to load url ../reportHitRowModel (resolved id: ../reportHitRowModel) in /Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/bodies/__tests__/reportHitRowModel.test.ts. Does the file exist?

   Test Files  1 failed (1)
        Tests  no tests
  ```
  Note the resolved id is the RELATIVE specifier `../reportHitRowModel`, not an absolute path, and the `Tests` line reads `no tests` — not a count.

- [ ] **Step 3: Minimal implementation.** Create `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/bodies/reportHitRowModel.ts`:

```ts
/**
 * Pure row-model for a REPORT hit in the search surfaces (the grouped "Reports" results and the resting
 * "Reports nearby" discovery section) - the field resolution behind the shared `ReportRowView`, lifted out
 * of the component so the fallback chain is unit-testable with no RN in the loop. Mirrors the resolution
 * the other two ReportRowView callers do inline (ReportsBody's renderItem, ClusterReportsBody's row).
 *
 * The subtitle is LOCATION, not the report body (that is the whole point of the change): "0.4 mi · 1200 S
 * Hope St", degrading to whichever half is present, and only falling back to the description when neither
 * is - so a row never shows an empty secondary line.
 *
 * UNITS, the trap this module exists to contain: `haversineMeters` returns METRES (geo.ts:19-30,
 * EARTH_RADIUS_M = 6_371_000), `distanceLabel` formats MILES (relativeTime.ts:34-37). The conversion is
 * explicit here, once. A metres value handed straight to `distanceLabel` renders "645 mi" for the
 * quarter-mile walk that should read "0.4 mi" - measured, not hypothetical.
 *
 * Pure + deterministic: the caller passes the already-localized category label (i18n is a React concern)
 * and the resolved viewer point, so nothing here reads a hook, a store, or the clock.
 */
import { haversineMeters, type LatLng } from "@civfix/shared"
import { distanceLabel } from "./relativeTime"

/** Metres in one statute mile - the bridge between haversineMeters (m) and distanceLabel (mi). */
export const METERS_PER_MILE = 1609.344

/** The minimal report shape this model needs; `ReportPinDTO` satisfies it. */
export interface ReportHitLike {
  title?: string | null
  description?: string | null
  addr?: string | null
  thumbUrl?: string | null
  lat: number
  lng: number
}

/** The three display fields a search report row hands to `ReportRowView`. */
export interface ReportHitRowModel {
  /** Report title, falling back to the caller-supplied localized category label. */
  title: string
  /** "{distance} · {address}", either half alone, else the description, else null. */
  subtitle: string | null
  /** The presigned first-photo thumb, or null so the row draws the category pin dot instead. */
  thumbUrl: string | null
}

export function reportHitRowModel({
  report,
  categoryLabel,
  viewer,
}: {
  report: ReportHitLike
  /** Already localized by the caller, e.g. `t(\`enums:category.${report.category}\`)`. */
  categoryLabel: string
  /** The viewer's resolved point, or null (location denied / still resolving / unavailable). */
  viewer: LatLng | null
}): ReportHitRowModel {
  const title = report.title?.trim() || categoryLabel
  const thumbUrl = report.thumbUrl?.trim() || null
  const addr = report.addr?.trim() || null
  // Metres from the viewer -> miles, because distanceLabel formats miles. "" without a viewer point, which
  // drops out of the join below rather than leaving a dangling separator.
  const distance = viewer
    ? distanceLabel(haversineMeters(viewer, { lat: report.lat, lng: report.lng }) / METERS_PER_MILE)
    : ""
  const location = [distance, addr].filter(Boolean).join(" · ")
  const subtitle = location || report.description?.trim() || null
  return { title, subtitle, thumbUrl }
}
```

- [ ] **Step 4: Run it and watch it pass.**
  ```bash
  cd /Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui && pnpm vitest run src/bodies/__tests__/reportHitRowModel.test.ts
  ```
  Expected, verified by execution: `✓ src/bodies/__tests__/reportHitRowModel.test.ts (8 tests)`, then `Test Files  1 passed (1)` and `Tests  8 passed (8)`.

- [ ] **Step 5: Commit.**
  ```bash
  cd /Users/theobong/Documents/GitHub/civfix/civfix-shared && \
  git add packages/ui/src/bodies/reportHitRowModel.ts packages/ui/src/bodies/__tests__/reportHitRowModel.test.ts && \
  git commit -m "$(cat <<'EOF'
feat(ui): reportHitRowModel — photo + location fields for a search report row

Pure row-model behind the search "Reports" / "Reports nearby" rows: title falls
back to the localized category label, the subtitle becomes "{distance} · {addr}"
degrading to whichever half exists and only then to the description, and a blank
thumb normalizes to null so the row draws the category pin dot.

haversineMeters returns METRES and distanceLabel formats MILES, so the
METERS_PER_MILE conversion is explicit and locked by a test — a metres value fed
straight to distanceLabel renders "645 mi" for a quarter-mile walk.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
  ```

---

### Task 5.2: Render the search report rows through `ReportRowView`, threading the viewer location

Replaces `ReportHitRow`'s hand-rolled `MapPin`-in-a-tinted-circle row (`SearchResults.tsx:105-125`) with the shared `ReportRowView`, so the three report surfaces read identically.

**Nav parity, verified before claiming it:** `ReportHitRow`'s current handler is `useNavStore.getState().push({ kind: "pin", id: report.id, lat: report.lat, lng: report.lng })` (`SearchResults.tsx:110`). `ReportRowView`'s own `onPress` is `useNavStore.getState().push({ kind: "pin", id, lat, lng })` (`ReportRow.tsx:66-68`). Identical. The a11y label is identical too: `home-sidebar:report.row_a11y` and `report-row:a11y.row` are both `"{{title}}, {{status}}"` in en/es/de/ko (checked in all eight JSON files), both interpolated with `{ title, status: t(\`enums:status.${status}\`) }`. So no i18n key is added or removed, and `pnpm i18n:check` is untouched by this task — `home-sidebar:report.row_a11y` stays in use at `HomeSidebarBody.tsx:629`.

**Blast radius, verified:** `ReportHitRow` is NOT re-exported from the package barrel — `src/bodies/index.ts:25` exports only `SearchResults` from this module, and a grep across `civfix-mobile/apps` and `civfix-web/apps` finds zero references. Making `viewer` a required prop is therefore package-internal, which is why Step 3 expects exactly two compile errors and no consumer breakage.

**Card chrome — a decision the spec did not cover.** `SearchResults`' `styles.group` (`SearchResults.tsx:191-198`) sets `gap: SEARCH_RESULT_CARD_LAYOUT.gap` (= 9, `searchResultsModel.ts:3-8`) on a transparent background because `individualCards` is `true`: each child supplies its own rounded card, which `styles.row` (`SearchResults.tsx:199-218`) does. `ReportRowView` is a bare list row with a hairline bottom border and no card chrome, so dropping it in raw would leave floating rows with stray hairlines next to the still-carded event and people rows. Fix: wrap each row in a card `View` and give `ReportRowView` an opt-out `divider` prop so it does not draw a list hairline inside a card that already has a border.

**Both call sites already have the viewer location in scope** — nothing new is fetched:
- `SearchResults.tsx:130` — `const { data: location } = useUserLocation()`. `useUserLocation` is `useQuery<LatLng | null>` (`data/hooks/location.ts:29-48`), so `data` is `LatLng | null | undefined` and the row gets `location ?? null`.
- `SearchBody.tsx:146` (inside `Discovery`) — `const location = useUserLocation().data ?? null`, already `LatLng | null`, so it passes straight through. (The draft said line 148; the real line is 146.)

**Files:**
- Modify: `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/bodies/ReportRow.tsx` — insert into `ReportRowViewProps` after line 39 (before the interface's closing `}` at line 40); destructure block lines 51-62; line 75; insert into the `StyleSheet.create` block after the `rowPressed` entry at lines 127-129
- Modify: `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/bodies/SearchResults.tsx:4, 6-7, 19, 105-125, 171, 226`
- Modify: `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/bodies/SearchBody.tsx:231-233`
- Test: `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/bodies/__tests__/SearchResults.test.ts` — **extend**, do not create. This package has **no React rendering harness** (no `@testing-library`, no `react-test-renderer`; see the note at `src/shell/__tests__/bodyTransition.test.ts:6`), and the spec says plainly "Do not invent a component-testing setup." The house pattern for a component invariant here is a `readFileSync` source guard — `src/bodies/__tests__/SearchBody.test.ts:27` does exactly this. Step 2(f) adds two such guards; they fail honestly at HEAD (measured: `Tests 2 failed | 3 passed (5)`) and are the red that proves both call sites were found. All behavioural coverage still lives in Task 5.1.

**Interfaces:**
- Consumes: `reportHitRowModel({ report, categoryLabel, viewer }): { title: string; subtitle: string | null; thumbUrl: string | null }` from Task 5.1 (`./reportHitRowModel`); `ReportRowView` from `./ReportRow`; `type LatLng` from `@civfix/shared`. (`METERS_PER_MILE` is NOT imported here — it is an implementation detail of the model and is only referenced by Task 5.1's test.)
- Produces:
  - `ReportRowViewProps.divider?: boolean` (defaults to `true` — existing callers `ReportsBody` and `ClusterReportsBody` are unchanged)
  - `ReportHitRow(props: { report: ReportPinDTO; viewer: LatLng | null }): JSX.Element` — the `viewer` prop is **required**

---

- [ ] **Step 1: Add the `divider` opt-out to `ReportRowView`.** Four edits in `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/bodies/ReportRow.tsx`.

  (a) In `ReportRowViewProps`, the `note` prop occupies lines 38-39 (38 is its doc comment, 39 is `note?: string | null`) and line 40 is the interface's closing `}`. Insert the new prop between them, so the tail of the interface reads:
```ts
  /** Latest timeline note shown after `when` in the foot; omit when there is none. */
  note?: string | null
  /**
   * Draw the list divider (the hairline under the row). Default true - the list callers (ReportsBody,
   * ClusterReportsBody) stack rows in one column and the hairline is what separates them. The search
   * results render each row as its OWN rounded card, whose border already separates it, so that caller
   * passes false to avoid a second line hugging the card's bottom edge.
   */
  divider?: boolean
}
```

  (b) In the destructure at lines 51-62, add `divider = true` after `note`:
```tsx
export const ReportRowView = React.memo(function ReportRowView({
  id,
  category,
  status,
  title,
  lat,
  lng,
  thumbUrl,
  subtitle,
  when,
  note,
  divider = true,
}: ReportRowViewProps) {
```

  (c) Replace line 75:
```tsx
      style={({ pressed }) => [styles.row, pressed ? styles.rowPressed : null]}
```
  with:
```tsx
      style={({ pressed }) => [
        styles.row,
        divider ? null : styles.rowNoDivider,
        pressed ? styles.rowPressed : null,
      ]}
```
  (RN merges a style array left-to-right, so `rowNoDivider` overrides `row`'s `borderBottomWidth: StyleSheet.hairlineWidth` at line 124 while leaving `borderBottomColor` inert.)

  (d) In the `StyleSheet.create` block, immediately after the `rowPressed` entry (lines 127-129), add:
```ts
  // Card-hosted rows (search results) suppress the list hairline: the card's own border separates them.
  rowNoDivider: {
    borderBottomWidth: 0,
  },
```

- [ ] **Step 2: Rewrite `ReportHitRow` and its styles, and pin the change with source guards.** Parts (a)–(e) are in `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/bodies/SearchResults.tsx`; part (f) is the test.

  (a) Line 4 — add `LatLng` to the type import:
```ts
import type { CleanupDTO, LatLng, ReportPinDTO, UserSearchResultDTO } from "@civfix/shared"
```

  (b) Lines 6-7 — `categoryColor` and `StatusBadge` become unused once the hand-rolled row is gone. `tsconfig.json` sets no `noUnusedLocals`, so `tsc` will NOT catch them, but `packages/ui/eslint.config.js:58-66` sets `@typescript-eslint/no-unused-vars` to `"error"` and Step 5 runs `pnpm lint`. Drop both:
```ts
import { theme } from "../theme"
import { Avatar, RsvpPill } from "../primitives"
```
  (`theme`, `Avatar` and `RsvpPill` all stay in use; so do `Icon`/`iconMap`, at lines 66 and 158.)

  (c) After line 19 (`import { pushCleanup } from "./navHelpers"`), add:
```ts
import { ReportRowView } from "./ReportRow"
import { reportHitRowModel } from "./reportHitRowModel"
```

  (d) Replace the whole of lines 105-125 — from `export function ReportHitRow({ report }: { report: ReportPinDTO }) {` through its closing `}`, leaving the blank line 126 and `export function SearchResults` at 127 intact — with:
```tsx
/**
 * A report search hit. Renders the ONE shared `ReportRowView` (the same row "Your reports" and the
 * map-cluster list draw), so all three surfaces read identically: the report's first photo as a 36px
 * rounded-square thumb - falling back to the category pin dot - the title with its StatusBadge, and a
 * LOCATION secondary line ("0.4 mi · 1200 S Hope St") instead of the report body. The row owns its own
 * tap nav (`push({ kind: "pin", id, lat, lng })`), byte-identical to the handler this row used before,
 * so nav behaviour is unchanged.
 *
 * `viewer` is the caller's resolved user location (null when denied/pending); the distance half of the
 * subtitle simply drops out without it. All the field resolution is the pure `reportHitRowModel`.
 *
 * Wrapped in a card because THIS list is a card list (SEARCH_RESULT_CARD_LAYOUT.individualCards), unlike
 * the two divided-column lists ReportRowView normally lives in - hence `divider={false}`.
 */
export function ReportHitRow({ report, viewer }: { report: ReportPinDTO; viewer: LatLng | null }) {
  const { t } = useT("home-sidebar")
  const { title, subtitle, thumbUrl } = reportHitRowModel({
    report,
    categoryLabel: t(`enums:category.${report.category}`),
    viewer,
  })
  return (
    <View style={styles.reportCard}>
      <ReportRowView
        id={report.id}
        category={report.category}
        status={report.status}
        title={title}
        lat={report.lat}
        lng={report.lng}
        thumbUrl={thumbUrl}
        subtitle={subtitle}
        divider={false}
      />
    </View>
  )
}
```
  (`when`/`note` are deliberately omitted — a `ReportPinDTO` carries no timestamp or timeline, which is exactly the case `ReportRowView`'s header documents. The `useT("home-sidebar")` binding is kept because `t` is still needed for the cross-namespace `enums:category.*` lookup, exactly as line 107 does today.)

  (e) Replace the now-dead `reportPin` style at line 226:
```ts
  reportPin: { width: 40, height: 40, borderRadius: 20, flexShrink: 0, alignItems: "center", justifyContent: "center" },
```
  with the card wrapper (same chrome as `styles.row`, minus the flex-row/gap/minHeight the shared row supplies itself):
```ts
  // The card shell around a shared ReportRowView. Matches `row`'s chrome so a report hit sits in the same
  // card language as the event/person hits; the row supplies its own vertical padding (13pt).
  reportCard: {
    paddingHorizontal: theme.space["3"],
    borderRadius: SEARCH_RESULT_CARD_LAYOUT.individualCards ? SEARCH_RESULT_CARD_LAYOUT.radius : 0,
    borderWidth: SEARCH_RESULT_CARD_LAYOUT.individualCards ? StyleSheet.hairlineWidth : 0,
    borderColor: theme.colors.border,
    backgroundColor: SEARCH_RESULT_CARD_LAYOUT.individualCards ? theme.colors.surface : "transparent",
    ...theme.shadows.s1,
  },
```
  (`StyleSheet` is already imported at line 3; `theme.space["3"]`, `theme.colors.border`, `theme.colors.surface` and `theme.shadows.s1` all exist on the theme.)

  (f) Extend `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/bodies/__tests__/SearchResults.test.ts`. Add `import { readFileSync } from "node:fs"` as the FIRST line of the file (above the existing `import { describe, expect, it } from "vitest"`), and append this describe block at the end of the file, after the existing `describe("SearchResults groups", ...)`:
```ts
/**
 * Source-text guards, the house pattern for a component invariant in a package with no RN renderer (see
 * SearchBody.test.ts, which guards its top-anchored layout the same way). These pin the two halves of the
 * change that a future edit could silently undo: the row is the SHARED ReportRowView rather than a
 * re-hand-rolled pin glyph with a description subtitle, and the viewer location is threaded from EVERY
 * call site (a new third call site that forgets `viewer` reds on the length assertion, not just on tsc).
 */
describe("report hits render through the shared ReportRowView", () => {
  const searchResults = readFileSync(new URL("../SearchResults.tsx", import.meta.url), "utf8")
  const searchBody = readFileSync(new URL("../SearchBody.tsx", import.meta.url), "utf8")

  it("draws a ReportRowView, not a hand-rolled MapPin circle with a description subtitle", () => {
    expect(searchResults).toMatch(/<ReportRowView\b/)
    expect(searchResults).toMatch(/divider=\{false\}/)
    expect(searchResults).not.toMatch(/reportPin/)
    expect(searchResults).not.toMatch(/iconMap\.MapPin/)
    expect(searchResults).not.toMatch(/report\.description/)
  })

  it("threads the viewer location into every ReportHitRow call site", () => {
    const callSites = [
      ...searchResults.matchAll(/<ReportHitRow\b[^/]*\/>/g),
      ...searchBody.matchAll(/<ReportHitRow\b[^/]*\/>/g),
    ]
    expect(callSites).toHaveLength(2)
    for (const [tag] of callSites) expect(tag).toMatch(/\bviewer=\{/)
  })
})
```

- [ ] **Step 3: Run both reds and watch them fail at the call sites.** This is the point of the step — it proves neither caller was missed. Two commands, two independent signals.

  (a) The compile gate:
  ```bash
  cd /Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui && pnpm typecheck
  ```
  Expected failure, verified by execution: **exactly two** `TS2741` errors and then ` ELIFECYCLE  Command failed with exit code 2`. One is at `src/bodies/SearchBody.tsx(232,16)`; the other is in `src/bodies/SearchResults.tsx` at whatever line the `reportHits.map((report) => <ReportHitRow …/>)` expression now sits on — Step 2(d)'s replacement block is LONGER than the 21 lines it replaced and Step 2(c) added two imports, so that call site is no longer line 171. Find it by text, not by line number. Both errors read:
  ```
  error TS2741: Property 'viewer' is missing in type '{ key: string; report: { lat: number; lng: number; status: … }; }' but required in type '{ report: { … }; viewer: { ...; } | null; }'.
  ```
  TypeScript prints `ReportPinDTO` **structurally expanded** (`{ lat: number; lng: number; status: "held" | "published" | … }`), not by its alias name, and elides the middle with `... N more ...`. Do not expect the literal string `ReportPinDTO` in the message.

  (b) The guard gate:
  ```bash
  cd /Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui && pnpm vitest run src/bodies/__tests__/SearchResults.test.ts
  ```
  Expected failure, verified by execution at exactly this intermediate state: `Tests  1 failed | 4 passed (5)`. The failure is `threads the viewer location into every ReportHitRow call site`, reporting `AssertionError: expected '<ReportHitRow key={report.id} report=…' to match /\bviewer=\{/`. The other four pass because Step 2 has already replaced the row itself; only the threading is still missing. (For reference, on untouched HEAD this same file reds as `Tests  2 failed | 3 passed (5)` — the guards are not vacuous.)

- [ ] **Step 4: Thread the viewer location through both call sites.**

  (a) In `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/bodies/SearchResults.tsx`, the line inside the reports group — `location` is already in scope from line 130 (`const { data: location } = useUserLocation()`), typed `LatLng | null | undefined`, so it needs `?? null`:
```tsx
          <View style={styles.group}>{reportHits.map((report) => <ReportHitRow key={report.id} report={report} viewer={location ?? null} />)}</View>
```

  (b) `/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src/bodies/SearchBody.tsx:231-233` — `location` is already in scope from line 146 (`const location = useUserLocation().data ?? null`), typed `LatLng | null`, so it passes straight through:
```tsx
            {sections.reports.map((report) => (
              <ReportHitRow key={report.id} report={report} viewer={location} />
            ))}
```

- [ ] **Step 5: Run the full gate and watch it pass.** Per-file assertions only — never an absolute suite total, because Workstreams 1–4 land in this same vitest suite and move any whole-suite number.
  ```bash
  cd /Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui && \
    pnpm typecheck && \
    pnpm lint && \
    pnpm vitest run src/bodies/__tests__/reportHitRowModel.test.ts && \
    pnpm vitest run src/bodies/__tests__/SearchResults.test.ts && \
    pnpm vitest run
  ```
  Expected, each verified by execution on the finished tree:
  - `pnpm typecheck` prints only its two pnpm banner lines (`> @civfix/ui@0.36.1 typecheck …` and `> tsc --noEmit -p tsconfig.json`) and exits 0.
  - `pnpm lint` prints only its two pnpm banner lines (`> @civfix/ui@0.36.1 lint …` and `> eslint .`) and exits 0 — no ESLint diagnostics, confirming the dropped `categoryColor` / `StatusBadge` imports left nothing unused.
  - `reportHitRowModel.test.ts` → `Test Files  1 passed (1)` and `Tests  8 passed (8)`.
  - `SearchResults.test.ts` → `Test Files  1 passed (1)` and `Tests  5 passed (5)` (the 3 pre-existing grouping cases plus the 2 new source guards).
  - The final bare `pnpm vitest run` must report **zero failures**: no `FAIL` line, and the summary's `Test Files` / `Tests` lines say `passed` with no `failed` segment. Do NOT compare the totals against any number written down earlier — this workstream adds one file and ten tests to whatever the suite already contains.

- [ ] **Step 6: Commit.**
  ```bash
  cd /Users/theobong/Documents/GitHub/civfix/civfix-shared && \
  git add packages/ui/src/bodies/ReportRow.tsx packages/ui/src/bodies/SearchResults.tsx packages/ui/src/bodies/SearchBody.tsx packages/ui/src/bodies/__tests__/SearchResults.test.ts && \
  git commit -m "$(cat <<'EOF'
feat(ui): search report rows show the report photo and location, not a pin glyph

ReportHitRow drops its hand-rolled MapPin-in-a-tinted-circle row and renders the
shared ReportRowView — the same row "Your reports" and the map-cluster list draw
— so all three surfaces read identically: the report's first photo as a 36px
rounded thumb (category pin dot when there is none) and a location subtitle
("0.4 mi · 1200 S Hope St") in place of the report description.

The viewer location is threaded in from both call sites (the grouped results and
the resting Discovery section); both already resolved it via useUserLocation, so
nothing new is fetched. ReportRowView gains an opt-out `divider` prop because the
search list is a card list, not a divided column. Nav is unchanged: both rows
push { kind: "pin", id, lat, lng }, and both a11y labels are "{{title}}, {{status}}".

Two readFileSync source guards in SearchResults.test.ts pin the row swap and the
viewer threading — the house pattern for a component invariant in a package with
no RN renderer.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
  ```


---


## Workstream 6 — Release

Workstreams 1–5 are invisible until `@civfix/ui` is **published** and every consumer **bumps its
range**. `@civfix/ui` is on the `0.x` line, so a consumer's caret pins the MINOR: `^0.36.1` accepts
`0.36.x` and **excludes `0.37.0`**. A publish without consumer bumps ships nothing; a consumer bump
without a `pnpm install` ships a lockfile that still resolves the old tarball.

**House facts, all verified against the real repos before this section was written — do not re-derive
them:**

- **The workspace is a 2-package pnpm workspace driven by `@changesets/cli`.**
  `/Users/theobong/Documents/GitHub/civfix/civfix-shared/pnpm-workspace.yaml` is `packages: ["packages/*"]`;
  the root `package.json` is `@civfix/shared-workspace@0.0.0` (private) with
  `"changeset": "changeset"`, `"version": "changeset version"`, `"release": "changeset publish"`.
  `.changeset/config.json` is `{ commit: false, fixed: [], linked: [], access: "public",
  baseBranch: "main", updateInternalDependencies: "patch", ignore: [] }`.
- **Publishing is CI-only and is triggered by a push to `main`.**
  `/Users/theobong/Documents/GitHub/civfix/civfix-shared/.github/workflows/publish.yml` runs
  `on: push: branches: [main]` (plus `workflow_dispatch`). It writes a temporary `.npmrc`
  (`@civfix:registry=https://repo.civfix.org/` + the `NPM_TOKEN` secret + `git-checks=false`), then
  `pnpm install --frozen-lockfile` → `pnpm -r build` → **`pnpm changeset publish`** → deletes the
  `.npmrc`. **There is no local `npm publish` / `pnpm publish` path** — the registry
  (`https://repo.civfix.org/`, a private Verdaccio) is anonymous-read, authenticated-publish, and the
  token lives only as a repo secret. `changeset publish` publishes only packages whose version is
  ahead of the registry and creates a per-package tag (`@civfix/ui@0.37.0`).
- **Versions at HEAD (measured):** `@civfix/ui` **0.36.1**, `@civfix/shared` **0.30.0**. The registry
  agrees: `npm view @civfix/ui version --registry https://repo.civfix.org/` → `0.36.1`;
  `npm view @civfix/shared version --registry https://repo.civfix.org/` → `0.30.0`.
- **Who consumes what** (measured by grepping every dependency block under
  `/Users/theobong/Documents/GitHub/civfix`, excluding `node_modules`):

  | manifest | `@civfix/shared` | `@civfix/ui` |
  | --- | --- | --- |
  | `civfix-web/apps/community-web/package.json` | `^0.30.0` | **`^0.36.0`** |
  | `civfix-mobile/apps/community-mobile/package.json` | `^0.30.0` | **`^0.36.1`** |
  | `civfix-backend/services/api/package.json` | `^0.30.0` | — |
  | `civfix-backend/services/media-worker/package.json` | `^0.30.0` | — |
  | `civfix-admin/apps/admin/package.json` | `^0.29.0` | — |
  | `civfix-govt-web/apps/gov-web/package.json` | `^0.24.2` | — |

  **`@civfix/ui` has exactly two consumers: civfix-web and civfix-mobile** (confirmed, not assumed).
  Workstreams 1–5 modify **zero files under `packages/shared`** (verified: the string `packages/shared`
  appears in the five workstream files only as a *read* reference in WS5's `haversineMeters` note), so
  `@civfix/shared` stays **0.30.0** and **civfix-backend, civfix-admin and civfix-govt-web are NOT
  touched by this release**. Do not bump them.
- **No dev-loop `link:` overrides are in place.** `grep -rn 'link:' --include=package.json
  --exclude-dir=node_modules civfix-web civfix-mobile` returns **no output** at HEAD, and both repos'
  `.npmrc` already scope `@civfix` to `https://repo.civfix.org/`. Nothing has to be stripped before
  releasing — but re-run that grep in Task 6.2 anyway, because a link masks publish mistakes.
- **`changeset version` does NOT dirty `pnpm-lock.yaml` in civfix-shared.** The lockfile's
  `importers: packages/ui:` block records the *specifier* (`'@civfix/shared': specifier:
  workspace:^0.30.0, version: link:../shared`), never `@civfix/ui`'s own version — verified by
  inspection, and confirmed by the last two release commits, whose full file lists are
  `.changeset/*.md` (deleted) + `packages/ui/CHANGELOG.md` + `packages/ui/package.json` and nothing
  else (`81f0edc chore(release): @civfix/ui 0.36.1`, `2c8295b chore(release): @civfix/ui 0.36.0`).
  So `pnpm install --frozen-lockfile` in `publish.yml` keeps working. The frozen-lockfile hazard is a
  **consumer** hazard (Tasks 6.6 and 6.7), not a workspace one.
- **Branch state at the start of Workstream 6.** `civfix-shared` is on `mobile-ux-five-fixes`
  (WS1/WS3/WS4/WS5 and WS2's shared half committed there). `civfix-mobile` is on
  `mobile-ux-five-fixes` (created by WS2 Task 2.4 Step 1; WS2's and WS3's mobile halves committed
  there). `civfix-web` is on `main` and has **no** feature work in this release — it only takes the
  dependency bump.
- **What each `main` push actually does** (read from the workflows, because two of these are
  production actions):
  - `civfix-shared` → `main`: **publishes to the registry** (`publish.yml`).
  - `civfix-web` → `main`: **deploys the live web app to Cloudflare Pages** (`deploy.yml`, `on: push:
    branches: [main]`). `deploy.yml` runs only install → build → `wrangler pages deploy`; it does
    **not** lint, typecheck or test. `ci.yml` is `on: pull_request` only. **The local gate in Task 6.6
    Step 4 is therefore the only gate that runs before that deploy.**
  - `civfix-mobile` → `main`: **nothing**. `ci.yml` is `on: pull_request` only and there is no EAS
    job (`eas-build.yml.example` is a commented-out template). The local gate in Task 6.7 Step 4 plus
    the EAS build in Task 6.8 are the only gates that exist.
- **Measured baselines at HEAD** (`c88a746`, tree clean), so a regression is distinguishable from
  arithmetic: `pnpm -r build`, `pnpm -r typecheck`, `pnpm -r lint` all exit 0;
  `@civfix/ui` vitest = **121 files / 1319 tests**, `@civfix/shared` vitest = **31 files / 490 tests**;
  `pnpm i18n:check` = `i18n key check OK: 76 namespaces key-complete across es, de, ko.`;
  civfix-mobile `pnpm test` = `# tests 45 / # pass 45 / # fail 0` and `pnpm typecheck` clean;
  civfix-web `pnpm test` = **14 files / 130 tests**. Workstreams 1–5 add tests to all three suites, so
  the totals below are stated as *deltas or per-file counts*, never as re-asserted absolutes.

---

### Task 6.1: One changeset for the five workstreams

**Files:**
- Create: `/Users/theobong/Documents/GitHub/civfix/civfix-shared/.changeset/mobile-ux-five-fixes.md`

**Why one file and not five:** WS2's hand-off note says explicitly "no changeset added here — five
workstreams each adding one would be noise". One `minor` entry with five labelled bullets folds to the
same `0.36.1 → 0.37.0` bump and produces one coherent CHANGELOG section. (`changeset version` takes the
highest bump across all pending entries, so five mixed `patch`/`minor` files would have folded to
`minor` anyway.)

- [ ] **Step 1: Confirm the branch, a clean tree, and that nothing is already pending.**
  ```bash
  cd /Users/theobong/Documents/GitHub/civfix/civfix-shared && \
  git branch --show-current && \
  git status --porcelain && \
  ls .changeset && \
  pnpm changeset status
  ```
  Expected: `mobile-ux-five-fixes`; **no** `git status` output (all five workstreams committed);
  `README.md` and `config.json` only; and `changeset status` exiting 0 with
  `🦋  info NO packages to be bumped at patch` / `... at minor` / `... at major` (verified by
  execution at HEAD). If `git status` prints anything, stop — an uncommitted workstream file must not
  ride along in the release commit.

- [ ] **Step 2: Write the changeset.** Create
  `/Users/theobong/Documents/GitHub/civfix/civfix-shared/.changeset/mobile-ux-five-fixes.md` with
  exactly this content. The frontmatter names the package and the bump; everything under it becomes the
  `## 0.37.0 / ### Minor Changes` body of `packages/ui/CHANGELOG.md`.

  ```md
  ---
  "@civfix/ui": minor
  ---

  Five mobile UX fixes.

  - **Post thread — inline "Show replies".** A reply's direct children splice into the SAME FlatList
    directly beneath it, at the same left gutter, joined by the existing 2pt threadline, via the new
    `buildThreadRows` row model. Expansion is a plain append: no scroll compensation, no auto-scroll,
    no highlight, no animation. Inline depth is capped at 2 — a depth-2 row's "Show replies" and its
    comment glyph both navigate to the permalink instead. The reply composer can be re-aimed at an
    expanded child, and staged media does not follow the re-aim. `/post/[id]` is unchanged.
  - **Map — the drop-pin pull-up restores the camera.** Dismissing the long-press pull-up (Cancel, a
    drag-down, or a tap on the bare map) flies the camera back to the pre-press camera, on the same
    store event that clears the coral teardrop, so the marker and the camera move on one frame.
    Panning or pinching the strip of map above the sheet cancels the restore, and committing to
    "Report an issue here" / "Host an event here" keeps the drop-pin camera.
  - **Report tab — the camera and the map picker are in-body layers.** The vision-camera viewfinder
    and `PortraitMapPickStep` now render inside the Report tab's base surface instead of a route and
    an RN `<Modal>`, so the liquid-glass dock stays visible and tappable for the whole flow. Compact
    portrait only — `ExpandedShell` (iPad landscape) has no dock and keeps its imperative capture
    route. `PortraitMapPickStep` gains `presentation?: "modal" | "layer"`, defaulting to `"modal"`, so
    host-an-event's picker is byte-identical.
  - **Search — a single-curve exit.** Leaving Search no longer remounts SearchResults → SearchResting
    and RecentlySearched → Discovery on the exact frames the overlay is fading: both decisions are
    frozen in `SearchBody` and released on the `dockMorphOut` completion. The keyboard reserve is
    carried through the blur-driven close, so the content box no longer steps down while the keyboard
    is still travelling. The trailing ✕ keeps its exact current meaning (clear the query, blur, stay
    in Search).
  - **Search — report rows show the photo and the location.** The search "Reports" / "Reports nearby"
    rows render through the shared `ReportRowView` — the report's first photo as a rounded thumb, the
    category pin dot when there is none, and a "0.4 mi · 1200 S Hope St" location subtitle — instead
    of a hand-rolled MapPin-in-a-tinted-circle row, so all three report surfaces read identically.
    `ReportRowView` gains an opt-out `divider` prop for card lists.
  ```

- [ ] **Step 3: Prove the fold is a single MINOR on `@civfix/ui` only.**
  ```bash
  cd /Users/theobong/Documents/GitHub/civfix/civfix-shared && pnpm changeset status
  ```
  Expected: `🦋  info NO packages to be bumped at patch`, then `🦋  info Packages to be bumped at
  minor:` followed by a line naming **`@civfix/ui`** and nothing else, then
  `🦋  info NO packages to be bumped at major`. Exit 0. If `@civfix/shared` appears, the frontmatter
  is wrong — WS1–WS5 touch no file under `packages/shared` and bumping it would drag civfix-backend,
  civfix-admin and civfix-govt-web into a release they have no reason to take.

- [ ] **Step 4: Commit the changeset.**
  ```bash
  cd /Users/theobong/Documents/GitHub/civfix/civfix-shared && \
  git add .changeset/mobile-ux-five-fixes.md && \
  git commit -m "$(cat <<'EOF'
  chore(ui): changeset — five mobile UX fixes, minor

  Inline "Show replies" in the post thread, drop-pin camera restore on dismissal,
  the report camera and map picker embedded in the Report tab, a single-curve
  Search exit, and search report rows with photo + location. Additive public API
  (buildThreadRows, reportHitRowModel, searchExitModel, the camera capability
  seam, PortraitMapPickStep's `presentation` prop), so MINOR: 0.36.1 -> 0.37.0.

  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 6.2: The full pre-publish gate in civfix-shared

Everything the CI publish will do, plus the two checks CI does not do (`test`, `i18n:check`). Run it on
`mobile-ux-five-fixes` **before** merging, because a red `main` here is a red publish.

- [ ] **Step 1: Build both packages exactly as `publish.yml` does.**
  ```bash
  cd /Users/theobong/Documents/GitHub/civfix/civfix-shared && pnpm install && pnpm -r build
  ```
  Expected: `pnpm install` reports `Already up to date` or a no-op resolution (the lockfile must NOT
  change — see Step 6); then tsup emits `packages/shared/dist/**` ending in
  `packages/shared build: Done`, and `packages/ui build$ tsc -p tsconfig.build.json
  --emitDeclarationOnly --outDir dist-types` ending in `packages/ui build: Done`. Both `dist/` and
  `dist-types/` are gitignored — `git status --porcelain` after this step must still print nothing
  (verified at HEAD).

- [ ] **Step 2: Typecheck and lint the whole workspace.**
  ```bash
  cd /Users/theobong/Documents/GitHub/civfix/civfix-shared && pnpm -r typecheck && pnpm -r lint
  ```
  Expected: exit 0 for both. Each prints pnpm's `Scope: 2 of 3 workspace projects` line, one
  `packages/<pkg> typecheck$ tsc --noEmit` / `packages/<pkg> lint$ eslint .` banner per package, and a
  `Done` per package — no diagnostics. The
  `WARN  The field "pnpm.onlyBuiltDependencies" was found in .../packages/shared/package.json` line is
  pre-existing at HEAD and is **not** a failure; ignore it.

- [ ] **Step 3: Run the whole vitest suite in both packages.**
  ```bash
  cd /Users/theobong/Documents/GitHub/civfix/civfix-shared && pnpm -r test
  ```
  Expected: **zero failures** — no `FAIL` line anywhere, and both summaries read `Test Files N passed
  (N)` / `Tests M passed (M)` with no `failed` segment. `@civfix/shared` must be unchanged at
  `Test Files 31 passed (31)` / `Tests 490 passed (490)` (no workstream touches it). `@civfix/ui` must
  be **above** its HEAD baseline of 121 files / 1319 tests, and these per-file counts must appear
  (each one is the exit gate of the workstream that produced it):
  - `src/bodies/thread/__tests__/threadModel.test.ts (55 tests)` — WS1
  - `src/map/__tests__/dropPinCamera.test.ts (60 tests)` and
    `src/map/__tests__/dropPinFlow.test.ts (23 tests)` — WS2
  - `src/report/__tests__/wizardSteps.test.ts (30 tests)`,
    `src/capabilities/__tests__/cameraSeam.test.ts (3 tests)` and
    `src/shell/__tests__/portrait-shell.test.ts (26 tests)` — WS3
  - `src/shell/__tests__/searchExitModel.test.ts (7 tests)`,
    `src/bodies/__tests__/searchSurfaceModel.test.ts (11 tests)`,
    `src/shell/__tests__/keyboardInsetModel.test.ts (37 tests)`,
    `src/shell/__tests__/searchBarStore.test.ts (6 tests)`,
    `src/bodies/__tests__/SearchBody.test.ts (8 tests)` and
    `src/shell/__tests__/tabBar.test.ts (60 tests)` — WS4
  - `src/bodies/__tests__/reportHitRowModel.test.ts (8 tests)` and
    `src/bodies/__tests__/SearchResults.test.ts (5 tests)` — WS5

  Do not compute or assert a whole-suite total; the invariant is "zero failures plus these fourteen
  files at these counts".

- [ ] **Step 4: Run the i18n key gate.**
  ```bash
  cd /Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui && pnpm i18n:check
  ```
  Expected: exit 0, printing `i18n key check OK: 76 namespaces key-complete across es, de, ko.`
  **76 is unchanged from HEAD** and that is the assertion: WS1 adds keys to the existing `home-feed`
  namespace and WS3 adds `gate.camera.open_settings` to the existing `mobile-report-camera` namespace
  (both files already exist in all four locales at HEAD — verified). A count of 77 means someone
  created a new namespace file without the other three locales, and `resources.ts` would not import it.

- [ ] **Step 5: Confirm no dev-loop `link:` override can mask a publish mistake.**
  ```bash
  grep -rn 'link:' --include=package.json --exclude-dir=node_modules \
    /Users/theobong/Documents/GitHub/civfix/civfix-web \
    /Users/theobong/Documents/GitHub/civfix/civfix-mobile ; echo "exit=$?"
  ```
  Expected: no matching lines and `exit=1` (grep's "nothing found"), which is the pass condition —
  verified at HEAD. A `"@civfix/ui": "link:../civfix-shared/packages/ui"` here would resolve every
  subpath from live source and hide a broken `exports` entry or a missing `files` glob that a real
  registry install would surface, and `publish.yml`'s `pnpm install --frozen-lockfile` cannot resolve
  a `link:` at all.

- [ ] **Step 6: Confirm the tree is still clean and the lockfile untouched.**
  ```bash
  cd /Users/theobong/Documents/GitHub/civfix/civfix-shared && git status --porcelain
  ```
  Expected: **no output.** In particular `pnpm-lock.yaml` must not appear — the five workstreams add no
  dependency, so a dirty lockfile here means `pnpm install` re-resolved something and `publish.yml`'s
  `--frozen-lockfile` would fail the publish before it starts.

---

### Task 6.3: Prove the PUBLISHED shape before publishing it

`RELEASING.md` requires this: a link or a workspace resolution hides `files` / `exports` mistakes, and
the registry tarball is what civfix-web and civfix-mobile actually consume. Packing to a scratch
directory leaves the repo clean (`pnpm pack --pack-destination` verified to write outside the repo,
`git status --porcelain` still empty afterwards).

- [ ] **Step 1: Pack the package as the registry will see it.**
  ```bash
  cd /Users/theobong/Documents/GitHub/civfix/civfix-shared && \
  pnpm -C packages/ui pack --pack-destination /private/tmp/claude-501/-Users-theobong-Documents-GitHub-civfix/9f606f01-9b25-42e8-8ec4-6170c51eb0d4/scratchpad
  ```
  Expected: one line, the absolute path
  `/private/tmp/.../scratchpad/civfix-ui-0.36.1.tgz` (still `0.36.1` — `changeset version` has not run
  yet; that is correct and expected here).

- [ ] **Step 2: Audit the tarball's shape.**
  ```bash
  T=/private/tmp/claude-501/-Users-theobong-Documents-GitHub-civfix/9f606f01-9b25-42e8-8ec4-6170c51eb0d4/scratchpad/civfix-ui-0.36.1.tgz && \
  echo "src files:        $(tar -tzf "$T" | grep -c '^package/src/')" && \
  echo "dist-types files: $(tar -tzf "$T" | grep -c '^package/dist-types/')" && \
  for p in index theme typography surface surface/liquidGlass capabilities data realtime nav bodies report i18n; do \
    tar -tzf "$T" | grep -qx "package/dist-types/$p.d.ts" || \
    tar -tzf "$T" | grep -qx "package/dist-types/$p/index.d.ts" || \
    echo "MISSING dist-types for subpath ./$p"; \
  done && echo "subpath audit done" && \
  tar -xzOf "$T" package/package.json | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);console.log("packed version:",j.version,"| @civfix/shared dep:",j.dependencies["@civfix/shared"])})'
  ```
  Expected: `src files:` and `dist-types files:` both **above** their HEAD measurements of `848` and
  `868` (WS4 adds `searchExitModel.ts` + `searchSurfaceModel.ts`, WS5 adds `reportHitRowModel.ts`);
  **no `MISSING dist-types for subpath` line at all** — every one of the twelve `exports` subpaths in
  `packages/ui/package.json` must have a declaration file, or a consumer's `tsc` breaks on
  `@civfix/ui/<subpath>`; then `subpath audit done`; then
  `packed version: 0.36.1 | @civfix/shared dep: ^0.30.0`. **That last value is the load-bearing one:**
  the manifest says `workspace:^0.30.0`, and the pack must have rewritten it to the plain range
  `^0.30.0` (verified by execution at HEAD). A `workspace:` prefix surviving into the tarball would
  make every consumer install fail.

- [ ] **Step 3: Delete the tarball so it cannot be mistaken for an artifact.**
  ```bash
  rm -f /private/tmp/claude-501/-Users-theobong-Documents-GitHub-civfix/9f606f01-9b25-42e8-8ec4-6170c51eb0d4/scratchpad/civfix-ui-*.tgz && \
  cd /Users/theobong/Documents/GitHub/civfix/civfix-shared && git status --porcelain
  ```
  Expected: no output from either command.

---

### Task 6.4: Merge the feature branch into `main` and apply the version bump

The two most recent releases in this repo were cut exactly this way — merge commit onto `main`, then
the `changeset version` commit on `main` (`4ef1cfc Merge: seven UX fixes …` → `2c8295b chore(release):
@civfix/ui 0.36.0`). Follow that, not a separate release branch.

- [ ] **Step 1: Merge with an explicit merge commit.**
  ```bash
  cd /Users/theobong/Documents/GitHub/civfix/civfix-shared && \
  git switch main && git pull --ff-only && \
  git merge --no-ff mobile-ux-five-fixes -m "$(cat <<'EOF'
  Merge: five mobile UX fixes (inline replies, drop-pin camera, report camera + map picker, search exit, report rows)

  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  EOF
  )"
  ```
  Expected: `git pull --ff-only` reports `Already up to date.` (nothing else has landed on `main`
  since `c88a746`); the merge prints a `Merge made by the 'ort' strategy.` summary listing the WS1–WS5
  files plus `.changeset/mobile-ux-five-fixes.md`. **Do NOT push yet** — the next push is the publish.

- [ ] **Step 2: Apply the changeset.**
  ```bash
  cd /Users/theobong/Documents/GitHub/civfix/civfix-shared && pnpm changeset version
  ```
  Do not hand-edit any version. This bumps `packages/ui/package.json`, writes the CHANGELOG section,
  and deletes the consumed changeset file.

- [ ] **Step 3: Verify the bump by its DIFF, not by the CLI banner.**
  ```bash
  cd /Users/theobong/Documents/GitHub/civfix/civfix-shared && \
  git status --porcelain && \
  node -p "require('/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/package.json').version" && \
  node -p "require('/Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/shared/package.json').version" && \
  head -8 packages/ui/CHANGELOG.md
  ```
  Expected, exactly three changed paths and nothing else (this is the same file list as the last two
  release commits):
  ```
   D .changeset/mobile-ux-five-fixes.md
   M packages/ui/CHANGELOG.md
   M packages/ui/package.json
  ```
  then `0.37.0`, then `0.30.0` (`@civfix/shared` must NOT have moved), then a CHANGELOG head of
  `# @civfix/ui`, a blank line, `## 0.37.0`, a blank line, `### Minor Changes`. **`pnpm-lock.yaml` must
  not be in that list** — if it is, something re-resolved and `publish.yml`'s
  `pnpm install --frozen-lockfile` will fail; run `git checkout -- pnpm-lock.yaml` and find out what
  touched it before continuing.

- [ ] **Step 4: Re-run the fast half of the gate against the bumped tree.**
  ```bash
  cd /Users/theobong/Documents/GitHub/civfix/civfix-shared && pnpm -r typecheck && pnpm -r test
  ```
  Expected: exit 0; zero test failures. (The pnpm banner lines now read `> @civfix/ui@0.37.0 …`
  instead of `0.36.1` — that string change is the cheapest confirmation the bump is live in the
  workspace.)

- [ ] **Step 5: Commit the version bump.**
  ```bash
  cd /Users/theobong/Documents/GitHub/civfix/civfix-shared && \
  git add -A .changeset packages/ui/package.json packages/ui/CHANGELOG.md && \
  git commit -m "$(cat <<'EOF'
  chore(release): @civfix/ui 0.37.0

  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  EOF
  )"
  ```
  Expected: a 3-file commit (1 deletion, 2 modifications). Verify with
  `git show --stat --oneline HEAD | head -6`.

---

### Task 6.5: Push `main` — this IS the publish — and verify it landed

- [ ] **Step 1: Push.**
  ```bash
  cd /Users/theobong/Documents/GitHub/civfix/civfix-shared && git push origin main
  ```
  This starts `publish.yml` on `github.com/civfix/civfix-shared`. There is no local publish command to
  run and no `vX.Y.Z` tag to cut — tags are package-scoped and CI creates them.

- [ ] **Step 2: Watch the workflow to completion.** Select the run **by the commit you just pushed**,
  not by "the most recent run" — a run registers a second or two after the push, and watching a stale
  id reports the *previous* release as green.
  ```bash
  cd /Users/theobong/Documents/GitHub/civfix/civfix-shared && \
  gh run watch "$(gh run list --workflow=publish.yml --limit 10 \
    --json databaseId,headSha --jq "map(select(.headSha==\"$(git rev-parse HEAD)\"))[0].databaseId")" --exit-status
  ```
  Expected: the `publish` job goes green through `Write registry auth` → `pnpm install
  --frozen-lockfile` → `pnpm -r build` → `Publish` → `Remove auth file`, and the command exits 0.
  A red `pnpm install --frozen-lockfile` means the lockfile drifted (Task 6.4 Step 3); a red `Publish`
  with `EPUBLISHCONFLICT` means 0.37.0 already exists on the registry.

- [ ] **Step 3: Verify the registry and the tag.**
  ```bash
  npm view @civfix/ui version --registry https://repo.civfix.org/ && \
  npm view @civfix/shared version --registry https://repo.civfix.org/ && \
  cd /Users/theobong/Documents/GitHub/civfix/civfix-shared && git fetch --tags && git tag --list '@civfix/ui@0.37.0'
  ```
  Expected: `0.37.0`, then `0.30.0` (unchanged, and its absence from the publish is correct — nothing
  was ahead of the registry for it), then the line `@civfix/ui@0.37.0`. If `npm view` still says
  `0.36.1`, the workflow published nothing: check that Step 2's run was green and that
  `packages/ui/package.json` on `main` really says `0.37.0`.

---

### Task 6.6: Consumer bump — civfix-web

civfix-web takes WS1 (thread rows) and WS5 (search report rows); both are platform-neutral source in
`@civfix/ui`. WS2/WS3 are native-gated and WS4 is `.native`-only, so nothing else changes for web —
but the bump is still mandatory, because `^0.36.0` excludes `0.37.0`.

**Files:**
- Modify: `/Users/theobong/Documents/GitHub/civfix/civfix-web/apps/community-web/package.json` (line 20)
- Regenerated: `/Users/theobong/Documents/GitHub/civfix/civfix-web/pnpm-lock.yaml`

- [ ] **Step 1: Bump the range.** In
  `/Users/theobong/Documents/GitHub/civfix/civfix-web/apps/community-web/package.json`, change
  `"@civfix/ui": "^0.36.0",` to `"@civfix/ui": "^0.37.0",`. Leave
  `"@civfix/shared": "^0.30.0",` exactly as it is — `@civfix/shared` did not move.

- [ ] **Step 2: Regenerate the lockfile. This step is NOT optional.**
  ```bash
  cd /Users/theobong/Documents/GitHub/civfix/civfix-web && pnpm install && \
  git diff --stat pnpm-lock.yaml && \
  node -p "require('/Users/theobong/Documents/GitHub/civfix/civfix-web/apps/community-web/node_modules/@civfix/ui/package.json').version"
  ```
  Expected: `pnpm-lock.yaml` appears in the diffstat (the `apps/community-web` importer's
  `'@civfix/ui': specifier: ^0.37.0 / version: 0.37.0(...)` entry plus the new package hash), and the
  installed version prints `0.37.0`.
  **A bumped `@civfix/*` range committed without this reinstall is a broken build, not a cosmetic
  miss:** every install in this org is frozen — civfix-web's `ci.yml` and `deploy.yml` both run
  `pnpm install --frozen-lockfile`, civfix-mobile's `ci.yml` does too, and the civfix-backend Docker
  image is built the same way (that is where this rule was learned: a range bump without a lockfile
  install failed the frozen-lockfile Docker build). A stale lockfile either hard-fails with
  `ERR_PNPM_OUTDATED_LOCKFILE` or silently installs `0.36.0` and ships none of the change.

- [ ] **Step 3: Prove the published tarball actually carries the workstream code.**
  ```bash
  diff -r -x '.DS_Store' \
    /Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src \
    /Users/theobong/Documents/GitHub/civfix/civfix-web/apps/community-web/node_modules/@civfix/ui/src \
  && echo "IDENTICAL"
  ```
  Expected: `IDENTICAL` with no diff output (this exact comparison was run at HEAD against the
  installed 0.36.1 and was byte-identical, so it is a real gate, not a hopeful one). Any `Only in
  .../packages/ui/src` line means the tarball predates a workstream file.

- [ ] **Step 4: Run the full local gate — `deploy.yml` will NOT run it for you.**
  ```bash
  cd /Users/theobong/Documents/GitHub/civfix/civfix-web && pnpm lint && pnpm typecheck && pnpm build && pnpm test
  ```
  Expected: all four exit 0. `pnpm test` must be **at or above** the HEAD baseline of `Test Files 14
  passed (14)` / `Tests 130 passed (130)` with zero failures. `pnpm build` is the one that matters
  most here: `@civfix/ui` ships untranspiled TS from `src/`, so the Next.js static export is the only
  thing that actually compiles WS1's and WS5's new components for the web target.

- [ ] **Step 5: Commit and push. Pushing `main` here deploys the live site.**
  ```bash
  cd /Users/theobong/Documents/GitHub/civfix/civfix-web && \
  git add apps/community-web/package.json pnpm-lock.yaml && \
  git commit -m "$(cat <<'EOF'
  chore: @civfix/ui ^0.37.0

  Picks up the two platform-neutral halves of the five-fix release: inline
  "Show replies" in the post thread, and search report rows rendered through
  ReportRowView with a photo thumb and a location subtitle. The 0.x caret pins
  the minor, so ^0.36.0 excluded 0.37.0 entirely.

  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  EOF
  )" && \
  git push origin main
  ```
  Then confirm the deploy, again selecting the run by the pushed commit:
  ```bash
  cd /Users/theobong/Documents/GitHub/civfix/civfix-web && \
  gh run watch "$(gh run list --workflow=deploy.yml --limit 10 \
    --json databaseId,headSha --jq "map(select(.headSha==\"$(git rev-parse HEAD)\"))[0].databaseId")" --exit-status
  ```
  Expected: the `Deploy (Cloudflare Pages)` run goes green through install → build →
  `pnpm dlx wrangler@3 pages deploy`.

---

### Task 6.7: Consumer bump — civfix-mobile

civfix-mobile's own WS2/WS3 commits **import symbols that only exist in 0.37.0**
(`setDropPinCameraRestorer` and the drop-pin snapshot API from `@civfix/ui/map`, the camera capability
seam from `@civfix/ui/capabilities`). Until this bump lands, that branch cannot typecheck against a
registry install — which is why WS2 and WS3 verified themselves by rsync'ing
`packages/ui/src/` over `civfix-mobile/node_modules/@civfix/ui/src/`. **This task's first job is to
destroy that rsync'd copy** so the gate runs against the real tarball.

**Files:**
- Modify: `/Users/theobong/Documents/GitHub/civfix/civfix-mobile/apps/community-mobile/package.json` (line 19)
- Regenerated: `/Users/theobong/Documents/GitHub/civfix/civfix-mobile/pnpm-lock.yaml`

- [ ] **Step 1: Get on the feature branch and delete the rsync'd package.**
  ```bash
  cd /Users/theobong/Documents/GitHub/civfix/civfix-mobile && \
  git switch mobile-ux-five-fixes && git status --porcelain && \
  rm -rf /Users/theobong/Documents/GitHub/civfix/civfix-mobile/node_modules/@civfix/ui
  ```
  Expected: the branch switch succeeds and `git status --porcelain` prints nothing (WS2 and WS3
  committed everything). `@civfix/ui` is installed at the **repo ROOT** `node_modules`, not under
  `apps/community-mobile/node_modules` (which has no `@civfix` at all) — verified; deleting the wrong
  path leaves the doctored copy in place and the gate proves nothing.

- [ ] **Step 2: Bump the range.** In
  `/Users/theobong/Documents/GitHub/civfix/civfix-mobile/apps/community-mobile/package.json`, change
  `"@civfix/ui": "^0.36.1",` to `"@civfix/ui": "^0.37.0",`. Leave `"@civfix/shared": "^0.30.0",` alone.

- [ ] **Step 3: Reinstall and verify the real tarball is on disk.**
  ```bash
  cd /Users/theobong/Documents/GitHub/civfix/civfix-mobile && pnpm install && \
  git diff --stat pnpm-lock.yaml && \
  node -p "require('/Users/theobong/Documents/GitHub/civfix/civfix-mobile/node_modules/@civfix/ui/package.json').version" && \
  diff -r -x '.DS_Store' \
    /Users/theobong/Documents/GitHub/civfix/civfix-shared/packages/ui/src \
    /Users/theobong/Documents/GitHub/civfix/civfix-mobile/node_modules/@civfix/ui/src \
  && echo "IDENTICAL"
  ```
  Expected: `pnpm-lock.yaml` in the diffstat with the importer entry moving to
  `specifier: ^0.37.0 / version: 0.37.0(...)`; then `0.37.0`; then `IDENTICAL`. If `node -p` throws
  `Cannot find module`, pnpm did not re-link the directory you deleted — run
  `pnpm install --force` and repeat this step. `IDENTICAL` here is doing double duty: it proves the
  publish carried the code **and** that no rsync residue survived.

- [ ] **Step 4: Run the local gate — nothing runs on a `main` push in this repo.**
  ```bash
  cd /Users/theobong/Documents/GitHub/civfix/civfix-mobile && \
  pnpm typecheck && pnpm lint && pnpm test && pnpm doctor
  ```
  (`pnpm doctor` is the root script `pnpm --filter community-mobile exec expo-doctor` — the same check
  `ci.yml` runs as `npx expo-doctor` inside `apps/community-mobile`.)
  Expected: `tsc --noEmit` prints nothing beyond its two pnpm banner lines and exits 0 — **this is the
  first time WS2's and WS3's mobile imports are checked against the real published `@civfix/ui`**;
  `eslint .` clean; `pnpm test` reports `# tests 54 / # pass 54 / # fail 0` (the HEAD baseline of 45,
  plus WS2's 3 in `src/lib/dropPinRestore.test.ts` and WS3's 6 in `src/lib/cameraSession.test.ts` —
  the invariant is `# fail 0`, so if only some workstreams have landed, check that number instead);
  and `expo-doctor` reports all checks passed. `ci.yml` here is `on: pull_request` only, so this local
  run is the only gate that exists before TestFlight.

- [ ] **Step 5: Commit the bump and merge to `main`.**
  ```bash
  cd /Users/theobong/Documents/GitHub/civfix/civfix-mobile && \
  git add apps/community-mobile/package.json pnpm-lock.yaml && \
  git commit -m "$(cat <<'EOF'
  chore: @civfix/ui ^0.37.0

  The drop-pin camera restore and the embedded report camera both import symbols
  that first exist in 0.37.0 (setDropPinCameraRestorer and the drop-pin snapshot
  API from @civfix/ui/map, the camera capability seam from @civfix/ui/capabilities),
  so this bump is what makes this branch compile against a registry install rather
  than a linked working copy. The 0.x caret pins the minor: ^0.36.1 excluded 0.37.0.

  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  EOF
  )" && \
  git switch main && git pull --ff-only && \
  git merge --no-ff mobile-ux-five-fixes -m "$(cat <<'EOF'
  Merge: drop-pin camera restore + report camera/map picker in-body + @civfix/ui 0.37.0

  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  EOF
  )" && \
  git push origin main
  ```
  Expected: the merge lists WS2's and WS3's mobile files plus `package.json` and `pnpm-lock.yaml`; the
  push succeeds and starts **no** workflow (by design).

---

### Task 6.8: EAS production build → TestFlight

No workstream adds a native dependency or an Expo config plugin (verified: the five workstream files
contain no `pnpm add`, no `expo install`, no `expo prebuild`, no `pod install`;
`react-native-vision-camera@^4.7.3` was already a dependency). So this is a plain rebuild of the same
native surface with new JS — no prebuild dance, no Podfile change.

**Run every `eas` command from `/Users/theobong/Documents/GitHub/civfix/civfix-mobile/apps/community-mobile`.**
The EAS project is `@tigerbong/civfix-community` (`projectId 11d261f5-ddc9-40c1-9f25-3a2cb9f49369`,
slug `civfix-community`, which must match `app.config.js`'s `slug`). Running `eas` from the monorepo
root has historically picked up a stray root `app.json` with a different project and failed with
`Specify "ios.bundleIdentifier" in app.json` — there is no stray root `app.json`, `eas.json` or
`package-lock.json` today (verified), and it must stay that way, because a `package-lock.json` also
makes EAS Build install with `npm ci` and ship an empty tree.

- [ ] **Step 1: Read the remote build number and confront the collision.**
  ```bash
  cd /Users/theobong/Documents/GitHub/civfix/civfix-mobile/apps/community-mobile && \
  npx eas-cli build:version:get --platform ios --non-interactive
  ```
  Expected: `iOS buildNumber - 10` (measured 2026-07-26), preceded by the informational line
  `ios.buildNumber field in app config is ignored when version source is set to remote…` — that notice
  is correct and expected: `eas.json` sets `"appVersionSource": "remote"`, so EAS owns the counter and
  `app.config.js`'s `ios.buildNumber: "12"` only ever applies to a **local Xcode archive**.
  **The hazard:** `app.version` is `1.0.9`, the production profile has `"autoIncrement": true`, and a
  local Xcode archive of 1.0.9 already went to App Store Connect as build **11** on 2026-07-26 (which
  is why `app.config.js` was then bumped to `"12"` to reserve the next local number, commit
  `04ee781`). Left alone, `autoIncrement` would ship **11** and App Store Connect would reject the
  duplicate `(1.0.9, 11)` pair.

- [ ] **Step 2: Confirm the highest existing build for 1.0.9, then raise the remote counter.**
  Open App Store Connect → the civfix app (`ascAppId 6781838072`) → TestFlight → iOS builds, and note
  the highest build number listed under version **1.0.9**. Then:
  ```bash
  cd /Users/theobong/Documents/GitHub/civfix/civfix-mobile/apps/community-mobile && \
  npx eas-cli build:version:set --platform ios
  ```
  When it prompts for the new build number, enter **`12`** (or, if App Store Connect showed anything
  higher than 12, that number instead). `autoIncrement` then makes this build ship **13** — strictly
  above both build 11 (already uploaded) and the `"12"` reserved in `app.config.js`. Verify:
  ```bash
  npx eas-cli build:version:get --platform ios --non-interactive
  ```
  Expected: `iOS buildNumber - 12`.

- [ ] **Step 3: Keep the local-archive reservation ahead of the remote counter.** In
  `/Users/theobong/Documents/GitHub/civfix/civfix-mobile/apps/community-mobile/app.config.js` line 79,
  change `buildNumber: "12",` to `buildNumber: "14",` (one above the 13 this EAS build will consume).
  If Step 2 had to use a number **higher** than 12, use `<that number> + 2` here instead and adjust the
  two numerals in the commit message to match. Then commit:
  ```bash
  cd /Users/theobong/Documents/GitHub/civfix/civfix-mobile && \
  git add apps/community-mobile/app.config.js && \
  git commit -m "$(cat <<'EOF'
  chore(mobile): reserve ios.buildNumber 14 for the next local Xcode archive

  EAS owns the build number (eas.json appVersionSource: "remote"); its counter was
  raised to 12 before this release, so the production build ships 13. This field is
  read only by a local Xcode archive, and App Store Connect rejects a (version,
  build) pair it has already seen — so it stays one ahead of the remote counter.

  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  EOF
  )" && \
  git push origin main
  ```

- [ ] **Step 4: Kick off the build and submit.** This is the command the **user** runs in a real
  terminal — `eas` needs an interactive Apple ID login with 2FA, which a non-interactive tool session
  cannot complete (an App Store Connect API key is unavailable: only the Account Holder can request
  API access, and this account is an Admin).
  ```bash
  cd /Users/theobong/Documents/GitHub/civfix/civfix-mobile/apps/community-mobile && \
  eas build -p ios -e production --auto-submit
  ```
  `eas.json`'s `submit.production.ios` is already filled in (`appleId romanaytur@gmail.com`,
  `ascAppId 6781838072`, `appleTeamId 27SWKQ5NF4`), so `--auto-submit` uploads to TestFlight when the
  build finishes. Expected: EAS resolves the `production` environment, prints the six env vars from
  the profile, uploads the project, and prints a build URL. The build itself takes ~30–45 minutes
  (`RCT_USE_PREBUILT_RNCORE=0` / `RCT_USE_RN_DEP=0` build React from source deliberately, for dSYMs).

- [ ] **Step 5: Confirm it built, submitted, and shipped the right number.**
  ```bash
  cd /Users/theobong/Documents/GitHub/civfix/civfix-mobile/apps/community-mobile && \
  npx eas-cli build:list --platform ios --limit 1 --non-interactive
  ```
  Expected: status `finished`, version `1.0.9`, build number **13**. Then check App Store Connect →
  TestFlight for build 13 processing. **The two "Upload Symbols Failed" warnings for
  `MapLibre.framework` and `hermes.framework` are EXPECTED and non-blocking — do not chase them**;
  both arrive as prebuilt binaries with no `__DWARF` segment and there is simply no dSYM to upload.

---

### Task 6.9: Device smoke checklist — one check per workstream

Run on a real iPhone from the TestFlight build of 1.0.9 that Task 6.8 Step 5 reported (**13**, unless
Step 2 had to start the counter higher), signed in. Five checks, one per
workstream; each is the single observation that fails loudest if that workstream did not reach the
device. If **all five** fail, the build predates the bump — re-check `eas build:list` and that the
merged `apps/community-mobile/package.json` says `^0.37.0`.

- [ ] **Step 1: WS1 — inline "Show replies".** Open a post whose reply itself has replies. Tap
  **"Show N replies"** on that reply. Expected: the children appear in the same list directly beneath
  it at the **same left gutter** (no indentation), joined by the continuous 2pt threadline through the
  avatar column; the focal post does not move and the list does not scroll; the label flips to
  **"Hide replies"**. Then tap a child's own "Show N replies" — it must **navigate** to that post
  rather than expanding (the depth cap).

- [ ] **Step 2: WS2 — the drop-pin camera restores.** On the Map tab, pan somewhere recognisable,
  **long-press** the map: the pull-up opens and the camera flies to the coral teardrop. Tap
  **Cancel**. Expected: the pin disappears and the camera flies **back to where you were**, on one
  gesture — not a two-beat "pin vanishes, map sits still, then moves". Repeat once dragging the sheet
  down instead of tapping Cancel: same restore.

- [ ] **Step 3: WS3 — the dock survives the report flow.** Tap **Report**. Expected: the camera
  viewfinder is **embedded in the Report tab**, and the liquid-glass dock stays **visible and
  tappable underneath it** — you can leave the flow by tapping another tab, with no full-screen sheet
  covering the bottom of the screen. Capture a photo, continue to the location step, open the map
  picker: the dock is still there (this is the un-Modal'd `presentation="layer"` picker). Then, from
  the **Map** tab, long-press → **"Host an event here"** → open its location picker: that one is still
  a full-screen Modal that covers the dock, and that is **correct and deliberate** (see Task 6.10).

- [ ] **Step 4: WS4 — the Search exit is one curve.** Enter Search, type a query so results are up
  with the keyboard raised, then tap the **leading glass circle**. Expected: one continuous exit — the
  content box does not step down while the keyboard is still travelling, the dock does not
  re-accelerate mid-descent, and **no content flashes or re-lays-out inside the fading overlay**.
  Then re-enter Search and tap the trailing **✕** instead: it must behave exactly as before — query
  cleared, keyboard down, **still in Search**, recents → discovery swapping live.

- [ ] **Step 5: WS5 — search report rows carry photo + location.** Enter Search and type a query that
  returns reports. Expected: each report row shows the report's **first photo** as a rounded thumb
  (a category pin **dot** when the report has no photo) and a subtitle of the form
  **"0.4 mi · 1200 S Hope St"** — not the old MapPin-glyph-in-a-tinted-circle with the description
  underneath. Sanity-check the distance against a nearby report: a value like "645 mi" for something a
  few blocks away means the metres→miles conversion regressed.

---

### Task 6.10 (follow-up — NOT part of this release): shell-level full-screen layer host

WS3 un-Modals the map picker for the **report wizard only**. The spec asked for both flows;
host-an-event's `CleanupForm` → `MeetLocationCompact` keeps its RN `<Modal>` because
`CreateCleanupBody` is a `"scroll"` detail inside the gorhom bottom sheet, which `usePickStepSheetSnap`
deliberately collapses to peek while picking — an in-body absolute-fill layer there is clipped to a
peeked card. `presentation` therefore defaults to `"modal"` and `CleanupForm` is byte-identical after
WS3. Closing the gap needs a shell-level full-screen layer host and is separate work.

- [ ] **Step 1: File the tracking issue.**
  ```bash
  cd /Users/theobong/Documents/GitHub/civfix/civfix-shared && \
  gh issue create \
    --title "Un-Modal host-an-event's map picker (shell-level full-screen layer host)" \
    --body "$(cat <<'EOF'
  @civfix/ui 0.37.0 un-Modal'd the map picker for the report wizard only, via
  PortraitMapPickStep's new `presentation?: "modal" | "layer"` prop (default
  "modal"). Host-an-event still covers the liquid-glass dock.

  Why it was deferred: CleanupForm's MeetLocationCompact lives inside
  CreateCleanupBody, a "scroll" detail rendered inside the gorhom bottom sheet,
  which usePickStepSheetSnap collapses to peek while picking. An in-body
  absolute-fill layer there is clipped to a peeked card, so the RN <Modal> is
  currently the only way to cover the screen from that surface.

  What it needs: a shell-level full-screen layer host shaped like
  MediaLightboxProvider, mounted below the dock's z-index, plus switching
  CleanupForm's PortraitMapPickStep to presentation="layer" once it exists.
  EOF
  )"
  ```
  Expected: `gh` prints the new issue URL. Do not attempt the change inside this release.

---

### Workstream 6 — done when

- [ ] `.changeset/mobile-ux-five-fixes.md` was written, `pnpm changeset status` showed one **minor** on
      `@civfix/ui` and nothing on `@civfix/shared`, and the file was consumed by `changeset version`.
- [ ] The civfix-shared gate was green on the merged tree: `pnpm -r build`, `pnpm -r typecheck`,
      `pnpm -r lint`, `pnpm -r test` (zero failures, all fourteen per-file counts in Task 6.2 Step 3),
      and `pnpm i18n:check` = `76 namespaces key-complete`.
- [ ] The packed tarball audit passed: every one of the twelve `exports` subpaths has a `dist-types`
      declaration, and the `@civfix/shared` dependency is the plain range `^0.30.0`, not `workspace:`.
- [ ] `packages/ui/package.json` reads `0.37.0`, `packages/shared/package.json` still reads `0.30.0`,
      the release commit changed exactly 3 files, and `pnpm-lock.yaml` was NOT among them.
- [ ] `main` was pushed; `publish.yml` ran green;
      `npm view @civfix/ui version --registry https://repo.civfix.org/` → `0.37.0`; the tag
      `@civfix/ui@0.37.0` exists.
- [ ] Both `@civfix/ui` consumers were bumped to `^0.37.0` **and reinstalled** — civfix-web
      (`apps/community-web/package.json` + `pnpm-lock.yaml`) and civfix-mobile
      (`apps/community-mobile/package.json` + `pnpm-lock.yaml`) — and in each repo `diff -r` between
      `civfix-shared/packages/ui/src` and the installed `@civfix/ui/src` printed nothing.
- [ ] civfix-backend (`services/api`, `services/media-worker`), civfix-admin and civfix-govt-web were
      **left alone**: `@civfix/shared` did not move, and none of them depends on `@civfix/ui`.
- [ ] civfix-web's gate (`lint`, `typecheck`, `build`, `test`) was green **before** the `main` push,
      and `deploy.yml` went green afterwards.
- [ ] civfix-mobile's gate (`typecheck`, `lint`, `test` = `# fail 0`, `expo-doctor`) was green against
      the **registry** copy of 0.37.0, not an rsync'd working copy, and the branch was merged to `main`.
- [ ] The EAS remote iOS build number was raised past every build App Store Connect has already seen
      for 1.0.9, `eas build -p ios -e production --auto-submit` finished, and
      `eas build:list --platform ios --limit 1` shows `finished` / `1.0.9` / build **13** (or whatever
      number the raised counter produced), and `app.config.js`'s `ios.buildNumber` is one above it.
- [ ] All five device smoke checks in Task 6.9 passed on the TestFlight build.
- [ ] The host-an-event un-Modal follow-up is filed as a GitHub issue on `civfix/civfix-shared`.


---
