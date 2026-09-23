/**
 * Source guards for the own/public service-hours surfaces.
 *
 * These are the rules typecheck cannot see and that a well-meaning refactor breaks first:
 *
 *   1. NO `Modal` / `FlatList` / inner `ScrollView`. Both files render inside the profile body's
 *      scroller, which on compact is the gorhom bottom sheet. A nested vertical scroller there swallows
 *      the sheet's own pan (the ScrollHostProvider handoff bug) and a `Modal` inside a sheet is the
 *      banned pattern outright.
 *   2. Coral as INK is `theme.colors.accentText`. `theme.colors.accent` is the FILL token and measures
 *      under the 4.5:1 AA floor on all three civfix surfaces, so it must never colour text.
 *   3. The transcript stays TWO-PHASE. `mutateAsync` + an awaited open is precisely the shape the web
 *      popup blocker kills: `window.open` in a promise continuation has lost its user-activation token.
 *
 * Plus the two `typeMeta` cases in NotificationsBody, which are trivially droppable in a merge and whose
 * absence is invisible (both bells silently fall through to the generic grey `Bell`).
 */
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const section = readFileSync(new URL("../profile/ServiceHoursSection.tsx", import.meta.url), "utf8")
const certificate = readFileSync(
  new URL("../profile/ServiceHoursCertificateCard.tsx", import.meta.url),
  "utf8",
)
const notifications = readFileSync(new URL("../NotificationsBody.tsx", import.meta.url), "utf8")
const privacy = readFileSync(new URL("../SettingsPrivacyBody.tsx", import.meta.url), "utf8")
const prefs = readFileSync(new URL("../NotificationPrefsBody.tsx", import.meta.url), "utf8")

/**
 * Strip block + line comments so the assertions read CODE only. The header comments in both files name
 * the banned components deliberately (explaining why they are absent), and a naive whole-file grep would
 * fail on the prose that documents the rule.
 */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
}

describe("service-hours profile surfaces", () => {
  it("keeps every gorhom-hostile container out of both files", () => {
    for (const source of [section, certificate]) {
      const body = code(source)
      expect(body).not.toMatch(/\bModal\b/)
      expect(body).not.toMatch(/\bFlatList\b/)
      expect(body).not.toMatch(/\bScrollView\b/)
    }
  })

  it("uses the WCAG-safe coral ink token and never the fill token for text", () => {
    for (const source of [section, certificate]) {
      expect(code(source)).not.toMatch(/\b(?:theme|t|th)\.colors\.accent\b(?!Text)/)
    }
    // The ledger's hours column and the visibility indicator are the coral-ink call sites.
    expect(section).toContain("t.colors.accentText")
  })

  it("issues the transcript in two phases so the open press keeps its user-activation token", () => {
    const body = code(certificate)
    expect(body).toContain("issue.mutate(")
    expect(body).toContain("openExternal.open(url)")
    expect(body).not.toContain("mutateAsync")
  })

  it("styles both new notification types instead of leaving them on the grey Bell fallback", () => {
    const hours = notifications.indexOf('case "hours_logged":')
    const slot = notifications.indexOf('case "cleanup_slot":')
    const fallback = notifications.indexOf('case "system":')

    expect(hours).toBeGreaterThan(-1)
    expect(slot).toBeGreaterThan(-1)
    expect(hours).toBeLessThan(fallback)
    expect(slot).toBeLessThan(fallback)
    expect(notifications).toContain('glyph: "ClipboardList"')
  })

  it("renders the by-organization chips on BOTH hours surfaces, capped at three", () => {
    const body = code(section)
    expect(body).toContain("const MAX_ORGANIZATION_CHIPS = 3")
    expect(body).toContain("<OrganizationChips")
    expect(body).toContain("items.slice(0, MAX_ORGANIZATION_CHIPS)")
    expect(body).toContain("hoursQuery.data?.hours.byOrganization ?? []")
    expect(body).toContain("firstPage?.byOrganization ?? []")
    expect(body).toContain('push({ kind: "org", slug: organization.slug })')
    expect(body).toContain('t("total.org_chip"')
  })

  it("sends the visibility indicator to the privacy settings that own the switch", () => {
    const body = code(section)
    expect(body).toContain('push({ kind: "settings-privacy" })')
    expect(body).not.toContain('push({ kind: "notification-prefs" })')
  })

  it("exposes the ledger load-more's in-flight state to assistive tech", () => {
    expect(code(section)).toContain(
      "accessibilityState={{ disabled: isFetchingNextPage, busy: isFetchingNextPage }}",
    )
  })

  it("renders the service-record privacy switch OFF for a never-chosen account", () => {
    // `?? true` here would opt every existing account into the itemised per-event list on deploy day.
    expect(code(privacy)).toContain("user?.showVolunteerHours === true")
    expect(privacy).not.toContain("user?.showVolunteerHours ?? true")
    expect(privacy).toContain("savePrivacy({ showVolunteerHours: next })")
    // The switch lives only in the PRIVACY section: in both places, two surfaces would write the same
    // tri-state from two different reads.
    expect(code(prefs)).not.toContain("showVolunteerHours")
  })
})
