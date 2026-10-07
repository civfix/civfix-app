import type { ReportCategory } from "@civfix/shared"
import type { DraftReport } from "../../report/draftStore"
import type { ReportSubmitOutcome } from "../../report/submit"

export type SubmitPhase = "idle" | "submitting" | "error" | "done"

/** Taken before the draft resets, because the success screen outlives the draft it describes. */
export interface ShareSnapshot {
  title: string
  category: ReportCategory | null
  addr: string | null
  thumbUrl: string | null
  caption: string
}

export type SubmitSettled =
  | { kind: "done"; result: ReportSubmitOutcome; share: ShareSnapshot }
  | { kind: "composer" }
  | { kind: "error"; error: unknown }
  | { kind: "discarded" }

export function shareSnapshotOf(
  draft: Pick<DraftReport, "title" | "category" | "addr" | "media" | "feedCaption">,
  untitled: string,
): ShareSnapshot {
  return {
    title: draft.title.trim() || untitled,
    category: (draft.category as ReportCategory | null) ?? null,
    addr: draft.addr,
    thumbUrl: draft.media[0]?.uri ?? null,
    caption: draft.feedCaption,
  }
}
