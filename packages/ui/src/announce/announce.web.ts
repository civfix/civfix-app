/**
 * announce (web seam) - screen-reader live-region announcements (WCAG 4.1.3 status messages).
 *
 * TWO permanent regions (one aria-live="polite", one aria-live="assertive") are mounted when this module
 * loads, not on the first announcement: some AT/browser pairs ignore the first mutation of a region that
 * was inserted just before it. We write into the matching one, rather than flipping aria-live on a single
 * shared region at announcement time (several AT/browser combos ignore a live-region whose politeness
 * changed in the same task it mutated).
 *
 * Each announcement CLEARS its region synchronously and sets the text in a DEFERRED task, so assistive
 * tech observes two distinct mutations. Without the deferral the clear+set coalesce into one mutation and
 * re-announcing the SAME message (e.g. re-submitting a form and getting the identical error) is silently
 * dropped, as are all-but-the-last of several announcements fired in one tick.
 */
import type { AnnounceFn, AnnounceOptions } from "./announce.types"

type Priority = NonNullable<AnnounceOptions["priority"]>

const REGION_ID: Record<Priority, string> = {
  polite: "civfix-aria-live-polite",
  assertive: "civfix-aria-live-assertive",
}

/** Delay between clearing a region and writing the new text (one task, long enough for AT to see both). */
const ANNOUNCE_DELAY_MS = 50

/** The pending "write the text" timer per region, so a rapid re-announce replaces its own stale write. */
const pending: Partial<Record<Priority, ReturnType<typeof setTimeout>>> = {}

function getOrCreate(priority: Priority): HTMLElement {
  const id = REGION_ID[priority]
  const existing = document.getElementById(id)
  if (existing) return existing
  const region = document.createElement("div")
  region.id = id
  region.setAttribute("aria-live", priority)
  region.setAttribute("aria-atomic", "true")
  region.style.position = "absolute"
  region.style.width = "1px"
  region.style.height = "1px"
  region.style.overflow = "hidden"
  region.style.clip = "rect(0, 0, 0, 0)"
  document.body.appendChild(region)
  return region
}

if (typeof document !== "undefined" && document.body) {
  getOrCreate("polite")
  getOrCreate("assertive")
}

export const announce: AnnounceFn = (message, opts) => {
  if (typeof document === "undefined" || !message) return
  const priority: Priority = opts?.priority ?? "polite"
  const region = getOrCreate(priority)

  // Clear NOW, write in a later task: two separate mutations, so a repeat of the same text still fires.
  const prior = pending[priority]
  if (prior !== undefined) clearTimeout(prior)
  region.textContent = ""
  pending[priority] = setTimeout(() => {
    delete pending[priority]
    region.textContent = message
  }, ANNOUNCE_DELAY_MS)
}
