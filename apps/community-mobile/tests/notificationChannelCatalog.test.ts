import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

const SECTIONS = ["reports", "messages", "events", "social", "organizations"] as const

function catalog(locale: string, namespace: string): Record<string, unknown> {
  const url = new URL(
    `../../../packages/ui/src/i18n/locales/${locale}/${namespace}.json`,
    import.meta.url,
  )
  return JSON.parse(readFileSync(url, "utf8")) as Record<string, unknown>
}

test("T35: every locale names the five section channels and drops the retired two", () => {
  const english = catalog("en", "mobile-system")
  assert.deepEqual(
    SECTIONS.map((id) => english[`notification_channel_${id}`]),
    ["Your reports", "Messages", "Events", "Social", "Organizations"],
  )
  for (const locale of ["en", "de", "es", "ko"]) {
    const system = catalog(locale, "mobile-system")
    const settingsSections = catalog(locale, "notifications-prefs").sections as Record<
      string,
      string
    >
    for (const id of SECTIONS) {
      assert.equal(system[`notification_channel_${id}`], settingsSections[id], `${locale} ${id}`)
    }
    assert.equal("notification_channel_host_broadcasts" in system, false, locale)
    assert.equal("notification_channel_event_reminders" in system, false, locale)
  }
})
