/**
 * Truthfulness guards for the service-hours privacy surfaces, plus the locale-aware hours formatter.
 *
 * `show_volunteer_hours` is a NULLABLE TRI-STATE and the server reads it as
 * `(IS NOT FALSE) AS aggregate, (IS TRUE) AS items`. Reading it as a boolean makes the UI assert the
 * OPPOSITE of the truth for every account that has never touched the switch, which is every account:
 *
 *   1. the own-profile indicator would print a padlock + "Hidden from your profile" over a total that is
 *      public and a leaderboard placement that exists;
 *   2. the public Hours tab would print a real total directly above "No volunteer hours logged yet.";
 *   3. the settings helper would promise "your total hours and the leaderboard stay public either way",
 *      which is precisely what turning the switch OFF takes away.
 *
 * These are source + catalog guards because the surfaces are components: the states are branches over a
 * tri-state, and the only thing a re-render can silently undo is the branch itself.
 */
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { formatHours, formatHoursDisplay } from "../formatHours"
import { surfaceSource } from "../../__tests__/sourceGuards"

const LOCALES = ["en", "es", "de", "ko"] as const

function read(relative: string): string {
  return readFileSync(new URL(relative, import.meta.url), "utf8")
}

/** The string at a dotted catalog path, or undefined - so a missing key fails as a missing STRING. */
function stringAt(lng: string, ns: string, path: string): string | undefined {
  let cursor: unknown = JSON.parse(read(`../../i18n/locales/${lng}/${ns}.json`))
  for (const part of path.split(".")) {
    if (typeof cursor !== "object" || cursor === null) return undefined
    cursor = (cursor as Record<string, unknown>)[part]
  }
  return typeof cursor === "string" ? cursor : undefined
}

/** Strip comments so the assertions read CODE, not the prose that documents the rule. */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
}

const section = read("../profile/ServiceHoursSection.tsx")
const tabBar = read("../profile/ProfileTabBar.tsx")
const person = surfaceSource("personDetail")
const notificationsHook = read("../../data/hooks/notifications.ts")
const privacyBody = read("../SettingsPrivacyBody.tsx")

describe("formatHoursDisplay", () => {
  it("writes the decimal separator the way es/de write it", () => {
    expect(formatHoursDisplay(2.5, "es")).toBe("2,5")
    expect(formatHoursDisplay(2.5, "de")).toBe("2,5")
    expect(formatHoursDisplay(12.46, "de")).toBe("12,5")
    expect(formatHoursDisplay(0, "es")).toBe("0,0")
  })

  it("keeps the period for en/ko and for an unknown or absent locale", () => {
    expect(formatHoursDisplay(2.5, "en")).toBe("2.5")
    expect(formatHoursDisplay(2.5, "ko")).toBe("2.5")
    expect(formatHoursDisplay(2.5, "pt")).toBe("2.5")
    expect(formatHoursDisplay(2.5)).toBe("2.5")
  })

  it("rounds exactly as formatHours does - only the separator differs", () => {
    for (const hours of [0, 2, 2.46, 1.25, 1234.5]) {
      expect(formatHoursDisplay(hours, "en")).toBe(formatHours(hours))
      expect(formatHoursDisplay(hours, "de")).toBe(formatHours(hours).replace(".", ","))
    }
  })

  it("adds NO grouping separator, which in de/es would read as a decimal point", () => {
    expect(formatHoursDisplay(1234.5, "de")).toBe("1234,5")
    expect(formatHoursDisplay(1234.5, "de")).not.toContain(".")
  })

  it("leaves formatHours itself Number()-parseable for the editor seed round trip", () => {
    expect(formatHours(2.5)).toBe("2.5")
    expect(Number(formatHours(2.46))).toBe(2.5)
  })
})

describe("ServiceHoursSection tri-state truthfulness", () => {
  it("renders the visibility indicator from three states, not a boolean", () => {
    const body = code(section)
    // true -> public, false -> private, undefined (never chosen) -> the third string.
    expect(body).toContain('choice === true ? "public" : choice === false ? "private" : "default"')
    expect(body).toContain("visibility.${state}")
    // The boolean shape: one choice picking between exactly two strings.
    expect(body).not.toContain('t("visibility.public") : t("visibility.private")')
  })

  it("does not print a total above the ledger's empty copy when itemisation is withheld", () => {
    const body = code(section)
    expect(body).toContain("const itemisationWithheld =")
    expect(body).toContain("total > 0 && items.length === 0 && !query.hasNextPage")
    expect(body).toContain('t("ledger.withheld_title")')
    expect(body).toContain('t("ledger.withheld_body")')
  })

  it("formats every rendered hours number through the locale-aware formatter", () => {
    const body = code(section)
    expect(body).toContain("formatHoursDisplay")
    // A bare formatHours( call would print "2.5" inside a German "{{hours}} Std.".
    expect(body).not.toMatch(/\bformatHours\(/)
  })

  it("keeps the WCAG-safe coral ink token", () => {
    expect(code(section)).not.toMatch(/\b(?:theme|t|th)\.colors\.accent\b(?!Text)/)
  })

  it("keeps every gorhom-hostile container out of the file", () => {
    const body = code(section)
    expect(body).not.toMatch(/\bModal\b/)
    expect(body).not.toMatch(/\bFlatList\b/)
    expect(body).not.toMatch(/\bScrollView\b/)
  })

  it("lifts the sub-44pt chips and the visibility row to the touch-target floor", () => {
    const body = code(section)
    expect(body).toContain("hitSlop={{ top: 9, bottom: 9 }}")
    expect(body).toContain("hitSlop={{ top: 12, bottom: 12, right: 12 }}")
  })
})

describe("profile tab bar", () => {
  it("labels the OUTER tablist so it is distinguishable from the nested Hosting/Going one", () => {
    const body = code(tabBar)
    expect(body).toContain('accessibilityRole={model.role} accessibilityLabel={t("tabs.a11y")}')
  })

  it("gives the 34pt tabs vertical hitSlop to reach 44pt, and no horizontal overlap", () => {
    expect(code(tabBar)).toContain("hitSlop={{ top: 5, bottom: 5 }}")
  })
})

describe("PersonDetailBody events tab", () => {
  it("renders empty copy instead of nothing when the person has no events", () => {
    const body = code(person)
    expect(body).toContain('tabsModel.active === "events" && !hasEvents')
    expect(body).toContain('t("events.empty")')
  })
})

describe("SettingsPrivacyBody tri-state truthfulness", () => {
  it("reads the service-record switch as a TRI-state, never as a defaulted boolean", () => {
    const body = code(privacyBody)
    expect(body).toContain("user?.showVolunteerHours === true")
    expect(body).not.toContain("user?.showVolunteerHours ?? true")
  })

  it("keeps the DM switch defaulting ON when unset - the opposite default, deliberately", () => {
    expect(code(privacyBody)).toContain("user?.allowDirectMessages ?? true")
  })
})

describe("useUpdatePrivacySettings cache reflection", () => {
  it("patches the profile INSIDE the cached envelope, the shape myProfile actually holds", () => {
    const body = code(notificationsHook)
    expect(body).toContain("qc.setQueryData<GetProfileResponse>(queryKeys.myProfile")
    expect(body).toContain("profile: { ...prev.profile, showVolunteerHours: res.user.showVolunteerHours }")
    expect(body).not.toContain("qc.setQueryData<UserProfileDTO>")
  })

  it("invalidates the person-profile entry under the @handle key as well as the uuid", () => {
    const body = code(notificationsHook)
    expect(body).toContain("queryKeys.profile(res.user.id)")
    expect(body).toContain("queryKeys.profile(res.user.handle)")
  })
})

describe("privacy + visibility copy in all four locales", () => {
  it("carries the third visibility state and the withheld-itemisation strings", () => {
    for (const lng of LOCALES) {
      for (const path of [
        "visibility.public",
        "visibility.default",
        "visibility.private",
        "ledger.withheld_title",
        "ledger.withheld_body",
      ]) {
        expect(stringAt(lng, "volunteer-hours", path), `${lng}:${path}`).toBeTruthy()
      }
    }
  })

  it("stops promising that the total and the leaderboard survive the switch being off", () => {
    for (const lng of LOCALES) {
      const helper = stringAt(lng, "settings-privacy", "showHours.helper")
      expect(helper, lng).toBeTruthy()
      expect(helper, lng).not.toContain("stay public either way")
      expect(helper, lng).not.toContain("son públicos de todos modos")
      expect(helper, lng).not.toContain("bleiben ohnehin öffentlich")
      expect(helper, lng).not.toContain("어느 쪽이든 공개")
    }
  })

  it("carries the events empty state and the outer tablist label", () => {
    for (const lng of LOCALES) {
      expect(stringAt(lng, "profile-person", "events.empty"), lng).toBeTruthy()
      expect(stringAt(lng, "profile-view", "tabs.a11y"), lng).toBeTruthy()
    }
  })
})
