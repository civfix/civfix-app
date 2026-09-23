/**
 * One region per politeness, both created when the module loads (or on first use if there is no body
 * yet): some AT/browser pairs ignore the first mutation of a just-inserted region, and several ignore a
 * region whose aria-live changed in the same task it mutated.
 *
 * Each announcement clears its region synchronously and writes the text in a deferred task. Without the
 * deferral the two coalesce into one mutation, so a repeat of the same message is silently dropped, as
 * are all but the last of several announcements fired in one tick.
 */
import type { AnnounceFn, AnnounceOptions } from "./announce.types"

type Priority = NonNullable<AnnounceOptions["priority"]>

const REGION_ID: Record<Priority, string> = {
  polite: "civfix-aria-live-polite",
  assertive: "civfix-aria-live-assertive",
}

/** One task, long enough for AT to see the clear and the write as separate mutations. */
const ANNOUNCE_DELAY_MS = 50

/** Per region, so a rapid re-announce replaces its own stale write. */
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

  const prior = pending[priority]
  if (prior !== undefined) clearTimeout(prior)
  region.textContent = ""
  pending[priority] = setTimeout(() => {
    delete pending[priority]
    region.textContent = message
  }, ANNOUNCE_DELAY_MS)
}
