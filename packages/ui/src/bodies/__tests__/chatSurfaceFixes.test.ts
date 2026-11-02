import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { pathForEntry } from "../../nav"
import { expectWrittenInLayoutEffect, sliceBetween } from "../../__tests__/sourceGuards"

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
const CREATE_AND_OPEN = code(read("../useCreateGroupAndOpen.ts"))
const INBOX = ["../MessagingListBody.tsx", "../inbox/ThreadRow.tsx"]
  .map((file) => code(read(file)))
  .join("\n")
const MEMBER_PICKER = code(read("../MemberPicker.tsx"))
const IDENTITY = code(read("../GroupIdentityFields.tsx"))
const ROLE_CHIP = code(read("../RoleChip.tsx"))
const BUBBLE = code(read("../conversation/MessageBubble.tsx"))
const BUBBLE_MENUS = code(read("../conversation/BubbleMenus.tsx"))
const BUBBLE_STYLES = code(read("../conversation/bubbleStyles.ts"))
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

describe("group link copy", () => {
  it("copies an absolute, openable URL built from the router's own path", () => {
    expect(pathForEntry({ kind: "thread", id: "g1", roomKind: "group" })).toBe("/messages/group/g1")
    expect(GROUP_INFO).toContain(
      'setString(absoluteUrl(pathForEntry({ kind: "thread", id, roomKind: "group" })))',
    )
    expect(GROUP_INFO).not.toContain("setString(`/messages/group/${id}`)")
  })
})

describe("ConversationBody depends on the stable chat methods, not the per-render chat object", () => {
  it("destructures the seven methods once", () => {
    expect(CONVERSATION).toMatch(
      /const \{\s*createPoll,\s*votePoll,\s*closePoll,\s*setPinned,\s*clearAround,\s*delete: deleteMessage,\s*toggleReaction,\s*\} = chat/,
    )
  })

  it("lists no chat.X member in any hook dependency array", () => {
    for (const dep of [
      "createPoll",
      "votePoll",
      "closePoll",
      "setPinned",
      "clearAround",
      "delete",
      "toggleReaction",
    ]) {
      expect(CONVERSATION).not.toContain(`chat.${dep}`)
    }
    expect(CONVERSATION).toContain("onToggleReaction={toggleReaction}")
  })
})

describe("clipboard failures are told, not swallowed", () => {
  it("toasts an error when the copy is refused", () => {
    expect(BUBBLE_MENUS).toContain(
      '.catch(() => toast.show(t("context_menu.copy_failed"), { variant: "error" }))',
    )
    expect(GROUP_INFO).toContain(
      '.catch(() => toast.show(t("link_copy_failed"), { variant: "error" }))',
    )
    expect(BUBBLE).not.toContain(".catch(() => {})")
    expect(BUBBLE_MENUS).not.toContain(".catch(() => {})")
    expect(GROUP_INFO).not.toContain(".catch(() => {})")
  })
})

describe("MembersBody renderItem follows the colour scheme", () => {
  it("lists the themed styles in the renderItem dependencies", () => {
    const renderItem = sliceBetween(MEMBERS, "const renderItem = useCallback(", "const linkedRow")
    expect(renderItem).toContain("styles.slotEmpty")
    expect(renderItem).toMatch(/cleanupTimeZone,\s*styles,\s*\]/)
  })
})

describe("group and channel mutations claim the submit synchronously", () => {
  const cases: [string, string, string, RegExp][] = [
    ["useCreateGroupAndOpen create", CREATE_AND_OPEN, "submittingRef", /createGroup\.mutate\(/],
    ["GroupInfoBody add", GROUP_INFO, "addingRef", /addMembers\.mutate\(/],
    ["GroupInfoBody edit", GROUP_INFO, "savingRef", /updateGroup\.mutate\(/],
    [
      "GroupInfoBody leave",
      GROUP_INFO,
      "leavingRef",
      /removeMember\.mutate\(\s*\{ id, userId: viewerId \}/,
    ],
    ["MembersBody leave", MEMBERS, "leavingRef", /leaveReportChat\.mutate\(/],
  ]
  it.each([
    ["NewGroupBody", NEW_GROUP],
    ["NewChannelBody", NEW_CHANNEL],
  ])("%s creates through the guarded hook, never a bare mutate", (_name, source) => {
    expect(source).toContain("const { submit, pending, submitError } = useCreateGroupAndOpen()")
    expect(source).not.toContain("useCreateGroup()")
    expect(source).not.toMatch(/\.mutate\(/)
  })

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

describe("refs are written after commit, never during render", () => {
  it.each([
    ["ConversationBody chatRef", CONVERSATION, "chatRef.current = chat"],
    ["ConversationBody dataRef", CONVERSATION, "dataRef.current = data"],
    [
      "useComposerMode draftStateRef",
      COMPOSER_MODE,
      "draftStateRef.current = { draft, mentioned }",
    ],
    [
      "useComposerMode composerModeStateRef",
      COMPOSER_MODE,
      "composerModeStateRef.current = { mode: composerMode, editPending }",
    ],
    ["useJumpToMessage dataRef", JUMP, "dataRef.current = data"],
    [
      "useReplyDockInset systemBarInsetRef",
      DOCK_INSET,
      "systemBarInsetRef.current = insets?.bottom ?? 0",
    ],
  ])("%s", (_name, source, assignment) => {
    expectWrittenInLayoutEffect(source, assignment)
  })
})

describe("room switch resets the pin cycle without a stale frame", () => {
  it("adjusts during render instead of in an effect", () => {
    expect(PIN_CYCLE).not.toContain("useEffect")
    expect(PIN_CYCLE).toMatch(
      /if \(cycleRoom !== roomKey\) \{\s*setCycleRoom\(roomKey\)\s*setPinActiveIndex\(0\)/,
    )
  })

  it("resets the reply attach sheet to its menu the same way", () => {
    expect(REPLY_SHEET).not.toMatch(/useEffect\(\(\) => \{\s*if \(visible\) setLevel\("menu"\)/)
    expect(REPLY_SHEET).toMatch(
      /if \(visible !== shownVisible\) \{\s*setShownVisible\(visible\)\s*if \(visible\) setLevel\("menu"\)/,
    )
  })
})

describe("the group edit sheet can discard a newly picked photo", () => {
  it("passes the clear label that GroupIdentityFields gates the button on", () => {
    expect(IDENTITY).toContain("const showClear = !!picked && !!labels.avatarClearA11y")
    expect(GROUP_INFO).toContain('avatarClearA11y: t("avatar_clear_a11y")')
  })
})

describe("the inbox row menu is reachable without hover on web", () => {
  it("always mounts the More chip on web and reveals it on hover, focus, open menu or touch", () => {
    expect(INBOX).not.toContain("{IS_WEB && (hovered || menuOpen) ? (")
    expect(INBOX).toMatch(
      /rowMenuChipShown\(state, hovered \|\| menuOpen, coarsePointer\)\s+\? null\s+: styles\.menuChipConcealed/,
    )
    expect(INBOX).toContain("const coarsePointer = useCoarsePointer()")
    expect(INBOX).toMatch(/if \(hoveredOrOpen \|\| coarsePointer\) return true/)
    expect(INBOX).toMatch(/\.focused === true/)
  })
})

describe("status and errors are announced", () => {
  it("marks the connection row as a polite live region and the room error as an alert", () => {
    expect(CONVERSATION).toContain(
      '<View style={styles.offlineRow} accessibilityLiveRegion="polite">',
    )
    expect(CONVERSATION).toContain('<View style={styles.errorRow} accessibilityRole="alert">')
  })

  it("marks every inline create, attach and send error as an alert", () => {
    expect(NEW_GROUP).toMatch(
      /<Text style=\{styles\.errorText\} accessibilityRole="alert">\s*\{t\("create_error"\)\}/,
    )
    expect(NEW_CHANNEL).toMatch(/accessibilityRole="alert">\s*\{t\("create_error"\)\}/)
    expect(IDENTITY).toMatch(/accessibilityRole="alert">\s*\{avatar\.attachError\}/)
    expect(REPLY_COMPOSER).toMatch(/accessibilityRole="alert">\s*\{attachments\.attachError\}/)
    expect(REPLY_COMPOSER).toMatch(/accessibilityRole="alert">\s*\{t\("submit_error"\)\}/)
    expect(CONVO_COMPOSER).toContain(
      '<View style={styles.composerAttachError} accessibilityRole="alert">',
    )
  })
})

describe("visibility options form a labelled radio group", () => {
  it("wraps the channel wizard and group edit options", () => {
    expect(NEW_CHANNEL).toContain(
      '<View accessibilityRole="radiogroup" accessibilityLabel={t("visibility_title")}>',
    )
    expect(GROUP_INFO).toMatch(
      /accessibilityRole="radiogroup"\s*accessibilityLabel=\{t\("visibility_label"\)\}/,
    )
  })
})

describe("the conversation header exposes one title control", () => {
  it("hides the avatar tap from assistive tech and the Tab order", () => {
    const avatarTap = sliceBetween(CONVO_BAR, "onPress={onTitlePress}", "<ThreadAvatar")
    expect(avatarTap).toContain("accessible={false}")
    expect(avatarTap).toContain("focusable={false}")
    expect(avatarTap).toContain('importantForAccessibility="no-hide-descendants"')
    expect(avatarTap).not.toContain("accessibilityLabel={titlePressLabel}")
    expect(
      CONVO_BAR.match(/accessibilityLabel=\{onTitlePress \? titlePressLabel : undefined\}/g),
    ).toHaveLength(1)
  })
})

describe("typing indicator label is exposed on native", () => {
  it("makes the labelled View one accessible element", () => {
    expect(TYPING).toMatch(/accessible\s*accessibilityLabel=\{name \? t\("typing\.indicator_named"/)
  })
})

describe("the native bubble offers its long-press menu to screen readers", () => {
  it("declares a labelled longpress action that opens the context menu", () => {
    expect(BUBBLE).toMatch(
      /menuAvailable\s+\? \[\{ name: "longpress", label: t\("bubble\.message_actions"\) \}\]\s+: undefined/,
    )
    expect(BUBBLE).toMatch(/if \(e\.nativeEvent\.actionName === "longpress"\) openContextMenu\(\)/)
  })
})

describe("a long message wraps inside its bubble", () => {
  const style = (name: string): string => {
    const found = new RegExp(`\\n    ${name}: \\{([\\s\\S]*?)\\n    \\},`).exec(BUBBLE_STYLES)
    if (!found || found[1] === undefined) throw new Error(`style "${name}" not found`)
    return found[1]
  }
  const row = (): string =>
    sliceBetween(BUBBLE, "<View style={[styles.bubbleRow, rowFit]}>", "<BubbleAttachments")

  it("keeps the bubble row inside the 80% column, so a URL or a reply quote cannot widen it", () => {
    expect(style("bubbleWrap")).toContain('maxWidth: "80%"')
    expect(style("bubbleRowFit")).toContain('maxWidth: "100%"')
  })

  it("caps the text bubble at the row on web and native instead of sizing it to one line", () => {
    expect(style("bubbleInRow")).toContain('maxWidth: "100%"')
    const placed = row().match(/style=\{\[styles\.bubble, bubbleFit, bubbleChrome, bubbleTint\]\}/g)
    expect(placed).toHaveLength(2)
    expect(row()).toMatch(/<View ref=\{menuAnchorRef\} style=\{\[styles\.bubble, bubbleFit,/)
    expect(row()).toMatch(/\{\.\.\.focusRingProps\}\s*style=\{\[styles\.bubble, bubbleFit,/)
  })

  it("keeps a text bubble with a link card at main's width: the bubble never shrinks to make room for the web hover actions", () => {
    expect(style("bubbleInRow")).not.toMatch(/flexShrink|flex:/)
    expect(style("bubble")).not.toMatch(/flexShrink|flex:/)
    expect(style("bubbleRowFit")).not.toMatch(/flexShrink|flex:/)
  })

  it("lets the hover actions of a full-width mine bubble overflow inward, toward the column, instead of off the screen edge", () => {
    expect(style("bubbleRowFitMine")).toContain('maxWidth: "100%"')
    expect(style("bubbleRowFitMine")).toContain('justifyContent: "flex-end"')
    expect(style("bubbleRowFit")).not.toContain("justifyContent")
    expect(BUBBLE).toContain(
      "const rowFit = bare ? null : mine ? styles.bubbleRowFitMine : styles.bubbleRowFit",
    )
  })

  it("leaves the link-only card and its row as they were, so the card keeps its fixed width beside the hover actions", () => {
    expect(BUBBLE).toContain("const bubbleFit = bare ? null : styles.bubbleInRow")
    expect(style("bubbleRow")).not.toMatch(/maxWidth|flexShrink|justifyContent/)
    expect(style("bubbleBare")).not.toMatch(/maxWidth|flexShrink/)
  })

  it("keeps the web hover actions at full size beside a wrapped bubble", () => {
    const button = style("hoverActionBtn")
    expect(button).toContain("width: 22")
    expect(button).not.toMatch(/flexShrink|flex:/)
  })
})

describe("role chip text sits on the type scale", () => {
  it("uses the 12 token instead of 9.5px", () => {
    expect(ROLE_CHIP).not.toContain("fontSize: 9.5")
    expect(ROLE_CHIP).toContain('fontSize: t.fontSize["12"]')
  })
})

describe("loading states are announced", () => {
  it("labels the attach sheet placeholders as busy progress", () => {
    const placeholders = REPLY_SHEET.match(
      /style=\{styles\.placeholder\}\s*accessible\s*accessibilityRole="progressbar"\s*accessibilityLabel=\{tCommon\("loading"\)\}\s*accessibilityState=\{\{ busy: true \}\}/g,
    )
    expect(placeholders).toHaveLength(2)
  })

  it("shows a labelled loading row while a member search is pending", () => {
    expect(MEMBER_PICKER).not.toContain("searchPending ? null")
    expect(MEMBER_PICKER).toMatch(
      /searchPending \? \(\s*<View\s*accessible\s*accessibilityRole="progressbar"/,
    )
    expect(MEMBER_PICKER).toContain('<LoadingState skeleton="person" rows={3} />')
  })
})

describe("pressable mentions announce as links", () => {
  it.each([
    [
      "MessageBubble",
      BUBBLE,
      /accessibilityRole="link"\s*onPress=\{\(\) => onOpenPerson\(\{ id: userId/,
    ],
    [
      "ThreadFocalPost",
      FOCAL,
      /accessibilityRole="link"\s*onPress=\{\(\) => openPerson\(segment\.userId\)\}/,
    ],
    [
      "ThreadReplyRow",
      REPLY_ROW,
      /accessibilityRole="link"\s*onPress=\{\(event\) => \{\s*stopPress\(event\)\s*openPerson\(segment\.userId\)/,
    ],
  ])("%s", (_name, source, pattern) => {
    expect(source).toMatch(pattern)
  })
})
