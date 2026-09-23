import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { pathForEntry } from "../../nav"

/**
 * Source guards for chat and messaging fixes the package cannot render in node (no React Native
 * renderer). Each assertion pins the exact prop or call the fix depends on.
 */
const read = (rel: string): string => readFileSync(new URL(rel, import.meta.url), "utf8")
const code = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

const CONVERSATION = code(read("../ConversationBody.tsx"))
const GROUP_INFO = code(read("../GroupInfoBody.tsx"))
const MEMBERS = code(read("../MembersBody.tsx"))
const NEW_GROUP = code(read("../NewGroupBody.tsx"))
const NEW_CHANNEL = code(read("../NewChannelBody.tsx"))
const INBOX = code(read("../MessagingListBody.tsx"))
const MEMBER_PICKER = code(read("../MemberPicker.tsx"))
const IDENTITY = code(read("../GroupIdentityFields.tsx"))
const ROLE_CHIP = code(read("../RoleChip.tsx"))
const BUBBLE = code(read("../conversation/MessageBubble.tsx"))
const TYPING = code(read("../conversation/TypingBubble.tsx"))
const CONVO_BAR = code(read("../conversation/ConvoBar.tsx"))
const CONVO_COMPOSER = code(read("../conversation/ConversationComposer.tsx"))
const COMPOSER_MODE = code(read("../conversation/useComposerMode.ts"))
const JUMP = code(read("../conversation/useJumpToMessage.ts"))
const PIN_CYCLE = code(read("../conversation/usePinCycle.ts"))
const REPLY_COMPOSER = code(read("../thread/ReplyComposer.tsx"))
const REPLY_SHEET = code(read("../thread/ReplyAttachSheet.tsx"))
const DOCK_INSET = code(read("../thread/useReplyDockInset.ts"))
const FOCAL = code(read("../thread/ThreadFocalPost.tsx"))
const REPLY_ROW = code(read("../thread/ThreadReplyRow.tsx"))

describe("group link copy (APP-BUG-144)", () => {
  it("copies an absolute, openable URL built from the router's own path", () => {
    expect(pathForEntry({ kind: "thread", id: "g1", roomKind: "group" })).toBe("/messages/group/g1")
    expect(GROUP_INFO).toContain(
      'setString(absoluteUrl(pathForEntry({ kind: "thread", id, roomKind: "group" })))',
    )
    expect(GROUP_INFO).not.toContain("setString(`/messages/group/${id}`)")
  })
})

describe("ConversationBody depends on the stable chat methods, not the per-render chat object (APP-BUG-146)", () => {
  it("destructures the seven methods once", () => {
    expect(CONVERSATION).toMatch(
      /const \{\s*createPoll,\s*votePoll,\s*closePoll,\s*setPinned,\s*clearAround,\s*delete: deleteMessage,\s*toggleReaction,\s*\} = chat/,
    )
  })

  it("lists no chat.X member in any hook dependency array", () => {
    for (const dep of ["createPoll", "votePoll", "closePoll", "setPinned", "clearAround", "delete", "toggleReaction"]) {
      expect(CONVERSATION).not.toContain(`chat.${dep}`)
    }
    expect(CONVERSATION).toContain("onToggleReaction={toggleReaction}")
  })
})

describe("clipboard failures are told, not swallowed (APP-BUG-147)", () => {
  it("toasts an error when the copy is refused", () => {
    expect(BUBBLE).toContain('.catch(() => toast.show(t("context_menu.copy_failed"), { variant: "error" }))')
    expect(GROUP_INFO).toContain('.catch(() => toast.show(t("link_copy_failed"), { variant: "error" }))')
    expect(BUBBLE).not.toContain(".catch(() => {})")
    expect(GROUP_INFO).not.toContain(".catch(() => {})")
  })
})

describe("MembersBody renderItem follows the colour scheme (APP-BUG-149)", () => {
  it("lists the themed styles in the renderItem dependencies", () => {
    const renderItem = MEMBERS.slice(MEMBERS.indexOf("const renderItem = useCallback("), MEMBERS.indexOf("const linkedRow"))
    expect(renderItem).toContain("styles.slotEmpty")
    expect(renderItem).toMatch(/cleanupTimeZone,\s*styles,\s*\]/)
  })
})

describe("group and channel mutations claim the submit synchronously (APP-BUG-151)", () => {
  const cases: [string, string, string, RegExp][] = [
    ["NewGroupBody create", NEW_GROUP, "submittingRef", /createGroup\.mutate\(/],
    ["NewChannelBody create", NEW_CHANNEL, "submittingRef", /createGroup\.mutate\(/],
    ["GroupInfoBody add", GROUP_INFO, "addingRef", /addMembers\.mutate\(/],
    ["GroupInfoBody edit", GROUP_INFO, "savingRef", /updateGroup\.mutate\(/],
    ["GroupInfoBody leave", GROUP_INFO, "leavingRef", /removeMember\.mutate\(\s*\{ id, userId: viewerId \}/],
    ["MembersBody leave", MEMBERS, "leavingRef", /leaveReportChat\.mutate\(/],
  ]
  for (const [name, source, ref, mutate] of cases) {
    it(`${name} checks and claims ${ref} before mutating and releases it on settle`, () => {
      const mutateAt = source.search(mutate)
      expect(mutateAt).toBeGreaterThan(-1)
      const before = source.slice(0, mutateAt)
      const check = before.lastIndexOf(`if (${ref}.current) return`)
      const claim = before.lastIndexOf(`${ref}.current = true`)
      expect(check).toBeGreaterThan(-1)
      expect(claim).toBeGreaterThan(check)
      expect(source.slice(mutateAt)).toMatch(
        new RegExp(`onSettled: \\(\\) => \\{\\s*${ref}\\.current = false\\s*\\}`),
      )
    })
  }
})

describe("refs are written after commit, never during render (APP-BUG-155)", () => {
  it.each([
    ["ConversationBody chatRef", CONVERSATION, "chatRef.current = chat"],
    ["ConversationBody dataRef", CONVERSATION, "dataRef.current = data"],
    ["useComposerMode draftStateRef", COMPOSER_MODE, "draftStateRef.current = { draft, mentioned }"],
    ["useComposerMode composerModeStateRef", COMPOSER_MODE, "composerModeStateRef.current = { mode: composerMode, editPending }"],
    ["useJumpToMessage dataRef", JUMP, "dataRef.current = data"],
    ["useReplyDockInset systemBarInsetRef", DOCK_INSET, "systemBarInsetRef.current = insets?.bottom ?? 0"],
  ])("%s", (_name, source, assignment) => {
    const at = source.indexOf(assignment)
    expect(at).toBeGreaterThan(-1)
    const effectAt = source.lastIndexOf("useLayoutEffect(() => {", at)
    expect(effectAt).toBeGreaterThan(-1)
    expect(source.slice(effectAt, at)).not.toContain("})")
  })
})

describe("room switch resets the pin cycle without a stale frame (APP-BUG-154)", () => {
  it("adjusts during render instead of in an effect", () => {
    expect(PIN_CYCLE).not.toContain("useEffect")
    expect(PIN_CYCLE).toMatch(/if \(cycleRoom !== roomKey\) \{\s*setCycleRoom\(roomKey\)\s*setPinActiveIndex\(0\)/)
  })

  it("resets the reply attach sheet to its menu the same way", () => {
    expect(REPLY_SHEET).not.toMatch(/useEffect\(\(\) => \{\s*if \(visible\) setLevel\("menu"\)/)
    expect(REPLY_SHEET).toMatch(/if \(visible !== shownVisible\) \{\s*setShownVisible\(visible\)\s*if \(visible\) setLevel\("menu"\)/)
  })
})

describe("the group edit sheet can discard a newly picked photo (APP-BUG-156)", () => {
  it("passes the clear label that GroupIdentityFields gates the button on", () => {
    expect(IDENTITY).toContain("const showClear = !!picked && !!labels.avatarClearA11y")
    expect(GROUP_INFO).toContain('avatarClearA11y: t("avatar_clear_a11y")')
  })
})

describe("the inbox row menu is reachable without hover on web (APP-A11Y-070)", () => {
  it("always mounts the More chip on web and reveals it on hover, focus, open menu or touch", () => {
    expect(INBOX).not.toContain("{IS_WEB && (hovered || menuOpen) ? (")
    expect(INBOX).toContain("rowMenuChipShown(state, hovered || menuOpen) ? null : styles.menuChipConcealed")
    expect(INBOX).toMatch(/if \(hoveredOrOpen \|\| isCoarsePointer\(\)\) return true/)
    expect(INBOX).toMatch(/\.focused === true/)
  })
})

describe("status and errors are announced (APP-A11Y-071)", () => {
  it("marks the connection row as a polite live region and the room error as an alert", () => {
    expect(CONVERSATION).toContain('<View style={styles.offlineRow} accessibilityLiveRegion="polite">')
    expect(CONVERSATION).toContain('<View style={styles.errorRow} accessibilityRole="alert">')
  })

  it("marks every inline create, attach and send error as an alert", () => {
    expect(NEW_GROUP).toMatch(/<Text style=\{styles\.errorText\} accessibilityRole="alert">\s*\{t\("create_error"\)\}/)
    expect(NEW_CHANNEL).toMatch(/accessibilityRole="alert">\s*\{t\("create_error"\)\}/)
    expect(IDENTITY).toMatch(/accessibilityRole="alert">\s*\{avatar\.attachError\}/)
    expect(REPLY_COMPOSER).toMatch(/accessibilityRole="alert">\s*\{attachments\.attachError\}/)
    expect(REPLY_COMPOSER).toMatch(/accessibilityRole="alert">\s*\{t\("submit_error"\)\}/)
    expect(CONVO_COMPOSER).toContain('<View style={styles.composerAttachError} accessibilityRole="alert">')
  })
})

describe("visibility options form a labelled radio group (APP-A11Y-072)", () => {
  it("wraps the channel wizard and group edit options", () => {
    expect(NEW_CHANNEL).toContain('<View accessibilityRole="radiogroup" accessibilityLabel={t("visibility_title")}>')
    expect(GROUP_INFO).toMatch(/accessibilityRole="radiogroup"\s*accessibilityLabel=\{t\("visibility_label"\)\}/)
  })
})

describe("the conversation header exposes one title control (APP-A11Y-073)", () => {
  it("hides the avatar tap from assistive tech and the Tab order", () => {
    const avatarTap = CONVO_BAR.slice(CONVO_BAR.indexOf("onPress={onTitlePress}"), CONVO_BAR.indexOf("<ThreadAvatar"))
    expect(avatarTap).toContain("accessible={false}")
    expect(avatarTap).toContain("focusable={false}")
    expect(avatarTap).toContain('importantForAccessibility="no-hide-descendants"')
    expect(avatarTap).not.toContain("accessibilityLabel={titlePressLabel}")
    expect(CONVO_BAR.match(/accessibilityLabel=\{onTitlePress \? titlePressLabel : undefined\}/g)).toHaveLength(1)
  })
})

describe("typing indicator label is exposed on native (APP-A11Y-074)", () => {
  it("makes the labelled View one accessible element", () => {
    expect(TYPING).toMatch(/accessible\s*accessibilityLabel=\{name \? t\("typing\.indicator_named"/)
  })
})

describe("the native bubble offers its long-press menu to screen readers (APP-A11Y-075)", () => {
  it("declares a labelled longpress action that opens the context menu", () => {
    expect(BUBBLE).toContain('menuAvailable ? [{ name: "longpress", label: t("bubble.message_actions") }] : undefined')
    expect(BUBBLE).toMatch(/if \(e\.nativeEvent\.actionName === "longpress"\) openContextMenu\(\)/)
  })
})

describe("role chip text sits on the type scale (APP-A11Y-077)", () => {
  it("uses the 12 token instead of 9.5px", () => {
    expect(ROLE_CHIP).not.toContain("fontSize: 9.5")
    expect(ROLE_CHIP).toContain('fontSize: t.fontSize["12"]')
  })
})

describe("loading states are announced (APP-A11Y-078)", () => {
  it("labels the attach sheet placeholders as busy progress", () => {
    const placeholders = REPLY_SHEET.match(
      /style=\{styles\.placeholder\}\s*accessible\s*accessibilityRole="progressbar"\s*accessibilityLabel=\{tCommon\("loading"\)\}\s*accessibilityState=\{\{ busy: true \}\}/g,
    )
    expect(placeholders).toHaveLength(2)
  })

  it("shows a labelled loading row while a member search is pending", () => {
    expect(MEMBER_PICKER).not.toContain("searchPending ? null")
    expect(MEMBER_PICKER).toMatch(/searchPending \? \(\s*<View\s*accessible\s*accessibilityRole="progressbar"/)
    expect(MEMBER_PICKER).toContain('<LoadingState skeleton="person" rows={3} />')
  })
})

describe("pressable mentions announce as links (APP-A11Y-079)", () => {
  it.each([
    ["MessageBubble", BUBBLE, /accessibilityRole="link"\s*onPress=\{\(\) => onOpenPerson\(\{ id: userId/],
    ["ThreadFocalPost", FOCAL, /accessibilityRole="link"\s*onPress=\{\(\) => openPerson\(segment\.userId\)\}/],
    ["ThreadReplyRow", REPLY_ROW, /accessibilityRole="link"\s*onPress=\{\(event\) => \{\s*stopPress\(event\)\s*openPerson\(segment\.userId\)/],
  ])("%s", (_name, source, pattern) => {
    expect(source).toMatch(pattern)
  })
})
