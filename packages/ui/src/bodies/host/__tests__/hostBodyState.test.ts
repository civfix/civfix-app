import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const read = (rel: string): string => readFileSync(new URL(rel, import.meta.url), "utf8")
const strip = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

const state = strip(read("../HostBodyState.tsx"))

const LOCALES = ["en", "es", "de", "ko"] as const

const STATE_KEYS = {
  loading: ["loading"],
  error: ["error_title", "error_body"],
  denied: ["denied_title", "denied_body"],
} as const

type StateKind = keyof typeof STATE_KEYS

const CALLERS: readonly { file: string; ns: string; states: readonly StateKind[] }[] = [
  { file: "HostCheckinBody.tsx", ns: "host-checkin", states: ["loading", "error", "denied"] },
  { file: "HostTeamBody.tsx", ns: "host-team", states: ["loading", "error", "denied"] },
  { file: "HostModeBody.tsx", ns: "host-mode", states: ["error", "denied"] },
  { file: "HostAnnounceBody.tsx", ns: "host-broadcasts", states: ["error", "denied"] },
  { file: "HostLogHoursBody.tsx", ns: "host-common", states: ["loading", "error"] },
  { file: "MyTicketBody.tsx", ns: "host-ticket", states: ["loading", "error"] },
  { file: "OrgPageBody.tsx", ns: "host-org", states: ["error"] },
]

describe("HostBodyState", () => {
  it("renders loading as muted copy inside the screen's scroll host", () => {
    expect(state).toContain('if (state === "loading") {')
    expect(state).toContain('<Text style={styles.muted}>{t("state.loading")}</Text>')
    expect(state).toContain("const { ScrollView } = useScrollHost()")
  })

  it("renders error and denied as full-screen notices with their own icons", () => {
    expect(state).toContain(
      '<HostStateNotice icon="CloudOff" title={t("state.error_title")} body={t("state.error_body")} />',
    )
    expect(state).toContain(
      '<HostStateNotice icon="Lock" title={t("state.denied_title")} body={t("state.denied_body")} />',
    )
  })

  for (const { file, ns, states } of CALLERS) {
    it(`${file} binds t to ${ns}, whose catalogs carry every state it renders`, () => {
      const body = strip(read(`../${file}`))
      expect(body).toContain(`useT("${ns}")`)
      for (const kind of states) {
        expect(body).toContain(`<HostBodyState state="${kind}" t={t} />`)
        for (const locale of LOCALES) {
          const catalog = JSON.parse(read(`../../../i18n/locales/${locale}/${ns}.json`)) as {
            state?: Record<string, string>
          }
          for (const key of STATE_KEYS[kind]) {
            expect(catalog.state?.[key], `${locale}/${ns} state.${key}`).toBeTruthy()
          }
        }
      }
    })
  }
})
