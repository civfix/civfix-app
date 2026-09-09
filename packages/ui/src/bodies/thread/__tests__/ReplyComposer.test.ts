import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

/**
 * ReplyComposer's RE-AIM ordering invariant (Task 1.6, see .superpowers/sdd/task-1.6-report.md).
 *
 * The package ships no React renderer by design (SearchBody.test.ts / PostActionBar.test.ts /
 * backAffordance.test.ts are the same house pattern), so this is a SOURCE-TEXT guard for a property that
 * is otherwise invisible to `pnpm typecheck`, `pnpm lint`, and threadModel.test.ts: none of them touch
 * either effect below.
 *
 * THE HAZARD. `ReplyComposer` selects its draft by `targetId` (`replyTarget ?? focalPost`, i.e. which
 * reply the docked bar is currently aimed at). Two effects keep component state in sync with that draft:
 *   1. The MIRROR effect writes the finalized `readyMedia` into the draft (`setDraftMedia`).
 *   2. The RESET effect, on a re-aim, adopts the new target and re-seeds `carried` / `attachments` from IT.
 * React runs effects within a single commit in DECLARATION ORDER. On the commit where `targetId` switches
 * (re-aiming from reply A to reply B), `targetId` is already B, but `carried` / `attachments.attachments`
 * are still A's - the reset effect's `setCarried` / `attachments.reset()` are only SCHEDULED on that
 * commit, not applied yet. The `aimedAt` ref is how the mirror effect tells "I am still holding A's media"
 * apart from "B's media has caught up": it bails via `aimedAt.current !== targetId` while it lags, and the
 * reset effect (declared AFTER it) is what advances `aimedAt.current` to B once it has cleared the stale
 * state. On the NEXT commit the two are back in sync and the mirror resumes normally.
 *
 * If a future edit drops that guard, or reorders the two effects so the reset runs first, the mirror fires
 * on the re-aim commit itself using the STALE `carried` / `attachments` - i.e. it writes reply A's staged
 * media onto reply B's draft (and bumps B's `updatedAt`, the store's eviction order). The user experience
 * is: re-aim the composer at a different reply, and the photo you were attaching to the first one silently
 * follows you to the second. That is exactly what this guard exists to catch - a passing typecheck/lint
 * and a green threadModel.test.ts give ZERO signal that either half of this has regressed.
 *
 * THE ATTACHED-REPORT CHIP IS DELIBERATELY NOT PART OF THIS RESET. An earlier version cached the picked
 * report row in its own `attachedReport` useState, populated only by the attach action, with no
 * repopulation path - so re-aiming away from a target and back showed the generic "Attach a report" label
 * forever after, even though `draft.attachedReportId` (the actual submitted data) was intact and correct.
 * The fix DERIVES the chip's title from `draft.attachedReportId` via `useReport` instead of caching it, so
 * there is nothing left for a reset effect to clear and no window where it can go stale. The last test
 * below pins that this write-only cache does not come back.
 */
describe("ReplyComposer re-aim effect ordering", () => {
  const source = readFileSync(new URL("../ReplyComposer.tsx", import.meta.url), "utf8")

  /** Text between two markers, so a grep can be scoped to one effect body - house style (PostActionBar.test.ts, backAffordance.test.ts). */
  const between = (from: string, to: string): string => {
    const start = source.indexOf(from)
    expect(start, `marker "${from}" is gone - re-scope the guard, do not delete it`).toBeGreaterThan(-1)
    const end = source.indexOf(to, start + from.length)
    expect(end, `marker "${to}" is gone - re-scope the guard, do not delete it`).toBeGreaterThan(-1)
    return source.slice(start, end)
  }

  it("declares the mirror effect's bail BEFORE the reset effect's bail", () => {
    // The two effects' own guard lines, not surrounding prose - this is the actual declaration order
    // React commits them in, which is the property the whole scheme depends on.
    const mirrorGuardAt = source.indexOf("if (aimedAt.current !== targetId) return")
    const resetGuardAt = source.indexOf("if (aimedAt.current === targetId) return")
    expect(mirrorGuardAt).toBeGreaterThan(-1)
    expect(resetGuardAt).toBeGreaterThan(-1)
    expect(mirrorGuardAt).toBeLessThan(resetGuardAt)
  })

  it("bails the mirror effect on the re-aim commit, before it can write stale media into the new draft", () => {
    const mirror = between(
      "// Mirror only the FINALIZED media into the draft",
      "}, [readyKey, draftMediaKey, readyMedia, setDraftMedia, targetId])",
    )
    const guardAt = mirror.indexOf("if (aimedAt.current !== targetId) return")
    const writeAt = mirror.indexOf("setDraftMedia(targetId, readyMedia)")
    expect(guardAt).toBeGreaterThan(-1)
    expect(writeAt).toBeGreaterThan(-1)
    // The bail has to precede the write in the SAME effect body, or it does not actually stop the write on
    // the commit where `aimedAt` is stale.
    expect(guardAt).toBeLessThan(writeAt)
  })

  it("only the reset effect adopts the new target, and only once it is actually out of sync", () => {
    const reset = between(
      "DECLARED AFTER THE MIRROR ON PURPOSE",
      "}, [targetId, attachments.reset])",
    )
    const guardAt = reset.indexOf("if (aimedAt.current === targetId) return")
    const adoptAt = reset.indexOf("aimedAt.current = targetId")
    expect(guardAt).toBeGreaterThan(-1)
    expect(adoptAt).toBeGreaterThan(-1)
    // The no-op guard has to run before the adoption, or `aimedAt` would advance on every render instead
    // of staying pinned to the stale target for exactly the one commit the mirror needs to see it lag.
    expect(guardAt).toBeLessThan(adoptAt)
    // The rest of the per-target reset the mirror's bail is protecting: without this the draft-media
    // mirror would eventually be right, but the staged (not-yet-finalized) attachments would keep showing
    // the PREVIOUS target's in-flight state.
    expect(reset).toContain("attachments.reset()")
  })

  it("derives the attached-report chip from draft.attachedReportId instead of caching it as write-only state", () => {
    // Task 1.6's finding, restated as a regression guard: a separate `attachedReport` useState populated
    // only by the attach action - with no repopulation path - meant re-aiming away from a target and back
    // showed the generic label forever after, even though `draft.attachedReportId` was intact. If a future
    // edit reintroduces a `setAttachedReport` write-only cache, this is the first thing to catch it.
    expect(source).toContain("useReport(draft.attachedReportId")
    expect(source).not.toContain("setAttachedReport(")
  })
})
