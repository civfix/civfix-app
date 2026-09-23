import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { useNavStore } from "../../nav"
import {
  PROFILE_DEFAULT_TAB,
  buildProfileTabsModel,
  type ProfileTabAvailability,
  type ProfileTabId,
} from "../profileTabsModel"

const SOURCE = readFileSync(new URL("../ProfileView.tsx", import.meta.url), "utf8")

const OWN_FULL: ProfileTabAvailability = { posts: true, events: true, hours: true, reports: true }

describe("the own profile's tabs", () => {
  it("offers all four, in order, and opens on Posts", () => {
    const model = buildProfileTabsModel(PROFILE_DEFAULT_TAB, OWN_FULL)
    expect(model.tabs.map((tab) => tab.id)).toEqual(["posts", "events", "hours", "reports"])
    expect(model.active).toBe("posts")
  })

  it("honours a deep link into the Hours tab", () => {
    expect(buildProfileTabsModel("hours", OWN_FULL).active).toBe("hours")
    expect(SOURCE).toMatch(/useNavStore\.getState\(\)\.active\?\.profileTab \?\? PROFILE_DEFAULT_TAB/)
  })

  it("degrades a requested tab whose slot the host did not supply", () => {
    const noHours = buildProfileTabsModel("hours", { ...OWN_FULL, hours: false })
    expect(noHours.tabs.map((tab) => tab.id)).toEqual(["posts", "events", "reports"])
    expect(noHours.active).toBe("posts")
  })

  it("reads availability off the host's slots, so a tab is never offered empty", () => {
    expect(SOURCE).toMatch(/posts: posts != null/)
    expect(SOURCE).toMatch(/hours: hours != null/)
    expect(SOURCE).toMatch(/reports: reports != null/)
    expect(SOURCE).toMatch(/events: true/)
  })
})

describe("the tree the tab bar replaced", () => {
  it("mounts the bar once and renders only the ACTIVE tab", () => {
    expect(SOURCE.match(/<ProfileTabBar\b/g) ?? []).toHaveLength(1)
    expect(SOURCE).toContain("{renderTab(tabsModel.active)}")
    expect(SOURCE).not.toMatch(/sectionOrder/)
    expect(SOURCE).not.toMatch(/profileViewModel/)
  })

  it("runs the social icon row between the bio and the stats row, above the bar", () => {
    const bio = SOURCE.indexOf("<Text style={styles.bio}>")
    const social = SOURCE.indexOf("<SocialLinksRow")
    const stats = SOURCE.indexOf("<ProfileStatsRow")
    const bar = SOURCE.indexOf("<ProfileTabBar")
    expect(bio).toBeGreaterThan(-1)
    expect(social).toBeGreaterThan(bio)
    expect(stats).toBeGreaterThan(social)
    expect(bar).toBeGreaterThan(stats)
  })

  it("keeps no trace of the card stack it replaced", () => {
    expect(SOURCE).not.toContain("ImpactTiles")
    expect(SOURCE).not.toContain("ProfileConnections")
  })

  it("has no hours pill, and therefore no volunteer-hours query", () => {
    expect(SOURCE).not.toMatch(/hoursStat/)
    expect(SOURCE).not.toMatch(/useMyHours/)
    expect(SOURCE).not.toMatch(/byJurisdiction/)
  })
})

describe("the hero's trailing affordance", () => {
  const BODY = readFileSync(new URL("../ProfileBody.tsx", import.meta.url), "utf8")
  const SETTINGS = readFileSync(new URL("../SettingsBody.tsx", import.meta.url), "utf8")

  it("no longer carries the settings gear - the shell's detail header draws it", () => {
    expect(SOURCE).not.toContain("onOpenSettings")
    expect(SOURCE).not.toContain("iconMap.Settings")
    expect(SOURCE).not.toContain("hero.settings_a11y")
    expect(SOURCE).not.toContain("signOut")
    expect(BODY).not.toContain("onOpenSettings")
    expect(BODY).not.toMatch(/push\(\{ kind: "settings" \}\)/)
  })

  it("keeps the hero chip family for share and close, with no gap where the gear was", () => {
    expect(SOURCE).toMatch(/heroBtn: \{\s*width: 36,\s*height: 36,\s*borderRadius: 18,/)
    expect(SOURCE).toContain('t("hero.share_a11y")')
    expect(SOURCE).toContain('t("hero.close_a11y")')
    expect(SOURCE).not.toContain("heroSignOut")
  })

  it("leaves ProfileBody with no settings list of its own - Saved posts lives in the Posts tab", () => {
    const POSTS = readFileSync(new URL("../profile/ProfilePostsSection.tsx", import.meta.url), "utf8")
    expect(BODY).not.toContain("SettingsSection")
    expect(BODY).not.toContain('label={t("nav.settings.label")}')
    expect(BODY).not.toContain("useLogout")
    expect(SOURCE).not.toContain("settings?: React.ReactNode")
    expect(BODY).toContain("onOpenSaved={onOpenSaved}")
    expect(BODY).toMatch(/const onOpenSaved = useCallback\(\(\) => pushKind\("saves"\), \[pushKind\]\)/)
    expect(POSTS).toContain('t("posts.saved")')
    expect(POSTS).toContain("onOpenSaved ? (")
  })

  it("keeps the Saved affordance off a stranger's profile, which never passes the handler", () => {
    const PERSON = readFileSync(new URL("../PersonDetailBody.tsx", import.meta.url), "utf8")
    expect(PERSON).not.toContain("ProfilePostsSection")
    expect(PERSON).not.toContain("onOpenSaved")
  })

  it("reads the hero as display-only - avatar, name and bio are edited in Settings > Account", () => {
    const ACCOUNT = readFileSync(new URL("../SettingsAccountBody.tsx", import.meta.url), "utf8")
    expect(SOURCE).not.toContain("onChangeAvatar")
    expect(SOURCE).not.toContain("EditableName")
    expect(SOURCE).not.toContain("EditableBio")
    expect(ACCOUNT).toContain("<AvatarSettingRow")
    expect(ACCOUNT).toContain("<DisplayNameEditor")
    expect(ACCOUNT).toContain("<BioEditor")
    expect(ACCOUNT).toContain("uploadAvatar(api, camera, picked)")
  })

  it("keeps Activity off both profiles, hook and all", () => {
    const PERSON = readFileSync(new URL("../PersonDetailBody.tsx", import.meta.url), "utf8")
    const SOCIAL = readFileSync(new URL("../../data/hooks/social.ts", import.meta.url), "utf8")
    expect(SOURCE).not.toContain("ActivitySection")
    expect(PERSON).not.toContain("ActivitySection")
    expect(SOCIAL).not.toContain("useUserActivity")
  })

  it("keeps sign out reachable - once - from the Settings hub", () => {
    expect(SETTINGS).toMatch(/icon="LogOut"[\s\S]*?variant="destructive"[\s\S]*?void logout\(\)/)
  })
})

describe("a profileTab merged into the ALREADY-ACTIVE entry", () => {
  type NavSnapshot = ReturnType<typeof useNavStore.getState>
  const selectNavProfileTab = (s: NavSnapshot): ProfileTabId | undefined =>
    s.active?.kind === "profile" ? s.active.profileTab : undefined

  it("changes only what a SUBSCRIPTION yields - navigateTo merges without remounting the body", () => {
    const store = useNavStore.getState()
    store.reset()
    store.push({ kind: "profile", profileTab: "posts" })
    const atMount = selectNavProfileTab(useNavStore.getState())
    let observed: ProfileTabId | undefined
    const unsub = useNavStore.subscribe((s) => {
      observed = selectNavProfileTab(s)
    })
    useNavStore.getState().navigateTo({ kind: "profile", profileTab: "hours" }, "compact")
    unsub()
    useNavStore.getState().reset()
    expect(atMount).toBe("posts")
    expect(observed).toBe("hours")
  })

  it("is read through that subscription, not only the mount-time initializer", () => {
    expect(SOURCE).toMatch(
      /const navProfileTab = useNavStore\(\(s\) =>\s*s\.active\?\.kind === "profile" \? s\.active\.profileTab : undefined,\s*\)/,
    )
  })

  it("lands on requestedTab through an effect, the way ConversationBody consumes jumpToMessageId", () => {
    const CONVO = readFileSync(new URL("../ConversationBody.tsx", import.meta.url), "utf8")
    expect(CONVO).toContain("const consumedJumpParamRef = useRef<string | null>(null)")
    expect(SOURCE).toContain(
      "const consumedNavTabRef = useRef<ProfileTabId | undefined>(navProfileTab)",
    )
    expect(SOURCE).toContain("setRequestedTab(navProfileTab)")
    expect(SOURCE).toContain("}, [navProfileTab])")
  })

  it("never re-applies a stale value over a local tab tap, and an absent one never resets the tab", () => {
    expect(SOURCE).toContain(
      "if (!navProfileTab || navProfileTab === consumedNavTabRef.current) return",
    )
  })

  it("keeps the PROFILE_DEFAULT_TAB fallback for the first mount", () => {
    expect(SOURCE).toMatch(/useNavStore\.getState\(\)\.active\?\.profileTab \?\? PROFILE_DEFAULT_TAB/)
  })
})
