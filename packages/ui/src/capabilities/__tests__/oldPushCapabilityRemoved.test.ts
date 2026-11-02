import { spawnSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { makeFakeCapabilities } from "../fakes"

// pushPermission replaced the old push capability, and NotificationSettingsBody the body that used it (D6).
const REPO = fileURLToPath(new URL("../../../../../", import.meta.url))
const THIS_FILE = fileURLToPath(import.meta.url).slice(REPO.length)
const REMOVED = [
  "NotificationPrefsBody",
  "PushCapability",
  "usePush",
  "nativePush",
  "useNotificationPrefs",
  "useUpdateNotificationPrefs",
]

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8")

function platformCapabilitiesMembers(): string[] {
  const types = read("../types.ts")
  const start = types.indexOf("export interface PlatformCapabilities {")
  expect(start).toBeGreaterThanOrEqual(0)
  const body = types.slice(start, types.indexOf("\n}", start))
  return [...body.matchAll(/^ {2}(\w+)\??:/gm)].map((m) => m[1]!)
}

describe("T24: the old push capability and NotificationPrefsBody are gone", () => {
  it("leaves none of their identifiers in packages/ or apps/", () => {
    const grep = spawnSync(
      "git",
      [
        "grep",
        "-n",
        "-w",
        ...REMOVED.flatMap((id) => ["-e", id]),
        "--",
        "packages",
        "apps",
        `:!${THIS_FILE}`,
      ],
      { cwd: REPO, encoding: "utf8" },
    )
    // git grep exits 1 when nothing matches and 2 or more when it could not search.
    expect(grep.status, grep.stderr).toBe(1)
    expect(grep.stdout).toBe("")
  })

  it("keeps pushPermission and usePushPermission", () => {
    expect(read("../hooks.ts")).toMatch(/export function usePushPermission\(/)
    expect(read("../types.ts")).toMatch(/export interface PushPermissionCapability \{/)
  })

  it("drops the push member from PlatformCapabilities and its fake", () => {
    const members = platformCapabilitiesMembers()
    expect(members).toContain("pushPermission")
    expect(members).not.toContain("push")
    expect(Object.keys(makeFakeCapabilities())).not.toContain("push")
  })

  it("drops push from the mobile capabilities provider", () => {
    const layout = read("../../../../../apps/community-mobile/app/_layout.tsx")
    const start = layout.indexOf("const mobileCapabilities: PlatformCapabilities = {")
    expect(start).toBeGreaterThanOrEqual(0)
    const provider = layout.slice(start, layout.indexOf("\n}\n", start))
    expect(provider).toMatch(/^ {2}pushPermission: /m)
    expect(provider).not.toMatch(/^ {2}push:/m)
  })
})
