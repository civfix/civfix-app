import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const read = (rel: string): string => readFileSync(new URL(rel, import.meta.url), "utf8")

describe("another person's profile", () => {
  const src = read("../PersonDetailBody.tsx")

  it("labels past events in the past tense, as the own profile does", () => {
    expect(src).toContain('role={t("profile-view:events.badge_hosted")}')
    expect(src).toContain('role={t("profile-view:events.badge_went")}')
    expect(src.match(/role=\{t\("events\.role_hosting"\)\}/g) ?? []).toHaveLength(1)
    expect(src.match(/role=\{t\("events\.role_going"\)\}/g) ?? []).toHaveLength(1)
  })

  it("confirms a block in the house danger dialog with 44pt buttons and a busy state", () => {
    expect(src).not.toMatch(/import \{[^}]*\bModal\b[^}]*\} from "react-native"/)
    expect(src).not.toContain('accessibilityRole="alert"')
    expect(src).toMatch(/<ModalCardSheet\s*visible=\{confirmingBlock\}[\s\S]{0,200}tone="danger"/)
    expect(src).toMatch(
      /<PrimaryButton\s*label=\{t\("block\.confirm"\)\}\s*variant="destructive"\s*onPress=\{confirmBlock\}\s*loading=\{blockUser\.isPending\}/,
    )
  })
})

describe("blocked accounts", () => {
  it("exposes the unblock in-flight state and reaches 44pt", () => {
    const src = read("../BlockedAccountsBody.tsx")
    expect(src).toContain("accessibilityState={{ disabled: pending, busy: pending }}")
    expect(src).toContain("hitSlop={UNBLOCK_HIT_SLOP}")
    expect(src).toContain("const UNBLOCK_HIT_SLOP = (MIN_TOUCH_TARGET - UNBLOCK_HEIGHT) / 2")
  })
})

describe("notifications list", () => {
  const src = read("../NotificationsBody.tsx")

  it("rebuilds the empty state on a theme switch", () => {
    expect(src).toContain(
      "}, [isAuthenticated, isPending, query.isLoading, query.isError, requireAuth, t, styles, th])",
    )
  })

  it("announces the body and the time, not only the title", () => {
    expect(src).toContain("const a11yDetails = [item.body, timeAgo(item.createdAt)].filter(Boolean)")
    expect(src).toMatch(
      /accessibilityLabel=\{item\.read\s*\? \[item\.title, \.\.\.a11yDetails\]\.join\(", "\)\s*: \[t\("row\.unreadSuffix", \{ title: item\.title \}\), \.\.\.a11yDetails\]\.join\(", "\)\}/,
    )
  })
})

describe("service-hours transcript card", () => {
  const src = read("../profile/ServiceHoursCertificateCard.tsx")

  it("tells the person when copying failed instead of swallowing it", () => {
    expect(src).toContain('.catch(() => toast.show(t("transcript.copy_error"), { variant: "error" }))')
    expect(src).not.toContain(".catch(() => {})")
  })

  it("brings the revoke link and both confirm buttons to the 44pt floor", () => {
    expect(src).toContain("hitSlop={REVOKE_LINK_HIT_SLOP}")
    expect(src.match(/hitSlop=\{CONFIRM_BTN_HIT_SLOP\}/g) ?? []).toHaveLength(2)
    expect(src).toMatch(/top: \(MIN_TOUCH_TARGET - CONFIRM_BTN_HEIGHT\) \/ 2/)
  })
})

describe("profile invitations", () => {
  it("keeps the invitations that loaded when the other source failed", () => {
    const card = read("../profile/InvitationsCard.tsx")
    expect(card).toMatch(/if \(errorNotice && slice\.total === 0\)/)
    expect(card).toMatch(/onDecline=\{onDeclineOrgInvite\}\s*\/>\s*\)\)\}\s*\{errorNotice\}\s*<\/SectionCard>/)
  })

  it("exposes the decline link as disabled while the invite is in flight", () => {
    const rows = read("../profile/InviteRows.tsx")
    expect(rows).toMatch(/disabled=\{pending\}\s*onPress=\{onDecline\}/)
    expect(rows).not.toContain("() => {}")
  })
})

describe("profile events segment control", () => {
  it("reaches 44pt vertically and answers a press", () => {
    const src = read("../profile/ProfileEventsSection.tsx")
    expect(src).toContain("hitSlop={{ top: 5, bottom: 5 }}")
    expect(src).toContain("pressed && !selected ? styles.segBtnPressed : null")
  })
})
