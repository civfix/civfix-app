import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const read = (relative: string): string => readFileSync(new URL(relative, import.meta.url), "utf8")

const code = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

const CONVERSATION = code(read("../ConversationBody.tsx"))
const MESSAGE_ACTIONS = code(read("../conversation/useChatMessageActions.ts"))
const BUBBLE = code(read("../conversation/MessageBubble.tsx"))
const COMPOSER_ATTACHMENTS = code(read("../../primitives/useComposerAttachments.ts"))
const INBOX = ["../MessagingListBody.tsx", "../inbox/ThreadRow.tsx"].map((file) => code(read(file))).join("\n")
const TYPING = code(read("../conversation/TypingBubble.tsx"))

describe("the message list's virtualization", () => {
  it("does not clip subviews on the inverted transcript", () => {
    expect(CONVERSATION).not.toMatch(/removeClippedSubviews/)
  })

  it("keeps the explicit render budget that bounds the cost instead", () => {
    expect(CONVERSATION).toMatch(/windowSize=\{11\}/)
    expect(CONVERSATION).toMatch(/maxToRenderPerBatch=\{12\}/)
    expect(CONVERSATION).toMatch(/initialNumToRender=\{15\}/)
  })

  it("installs ONE module-constant scroll anchor, never a per-render literal", () => {
    expect(CONVERSATION).toMatch(/maintainVisibleContentPosition=\{MAINTAIN_VISIBLE_CONTENT_POSITION\}/)
    expect(CONVERSATION).toMatch(
      /const MAINTAIN_VISIBLE_CONTENT_POSITION = \{\s*minIndexForVisible: 0,\s*autoscrollToTopThreshold:/,
    )
    expect(CONVERSATION).not.toMatch(/maintainVisibleContentPosition=\{isAtBottom/)
  })
})

describe("poll voting is a LIVE gate, not the composer's", () => {
  it("the bubble hands PollBubble canVote, never canReply", () => {
    expect(BUBBLE).toMatch(/disabled=\{!onVotePoll \|\| !canVote\}/)
    expect(BUBBLE).not.toMatch(/disabled=\{!onVotePoll \|\| !canReply\}/)
  })

  it("the body derives all three gates from liveGates and passes canVote down", () => {
    expect(CONVERSATION).toMatch(/import \{ canReactIn, canReplyIn, canVoteIn \} from "\.\/conversation\/liveGates"/)
    expect(CONVERSATION).toMatch(/const canVote = canVoteIn\(gateSignals\)/)
    expect(CONVERSATION).toMatch(/canVote=\{canVote\}/)
  })
})

describe("the row memo can actually skip", () => {
  it("Bubble is memoized with the explicit comparator", () => {
    expect(BUBBLE).toMatch(/\}, bubblePropsEqual\)/)
    expect(BUBBLE).toMatch(/function bubblePropsEqual\(prev: BubbleProps, next: BubbleProps\): boolean/)
    expect(BUBBLE).toMatch(/a\.message !== b\.message \|\| a\.mine !== b\.mine/)
  })

  it("renderItem depends on a stable retry, not on chat.retry", () => {
    expect(CONVERSATION).toMatch(/const onRetry = useCallback\(\(clientId: string\) => chatRef\.current\.retry\(clientId\), \[\]\)/)
    expect(CONVERSATION).toMatch(/onRetry=\{onRetry\}/)
    expect(CONVERSATION).not.toMatch(/onRetry=\{chat\.retry\}/)
  })
})

describe("failures are surfaced, not swallowed", () => {
  it("a failed delete toasts like its pin/vote siblings", () => {
    expect(CONVERSATION).not.toMatch(/chat\.delete\(messageId\)\.catch\(\(\) => \{\}\)/)
    expect(CONVERSATION).toContain("useChatMessageActions({ createPoll, votePoll, closePoll, setPinned, deleteMessage })")
    expect(CONVERSATION).toContain("onDelete={onDeleteMessage}")
    expect(MESSAGE_ACTIONS).not.toMatch(/deleteMessage\(messageId\)\.catch\(\(\) => \{\}\)/)
    expect(MESSAGE_ACTIONS).toMatch(/deleteMessage\(messageId\)\.catch\(\(\) => \{\s*toast\.show\(t\("menu\.delete_failed"\)/)
  })

  it("a blocked attachment pick says why instead of returning silently", () => {
    expect(COMPOSER_ATTACHMENTS).not.toMatch(
      /if \(!\(camera\.isAvailable\(\) && attachments\.length < maxAttachments\) \|\| uploading\) return/,
    )
    expect(COMPOSER_ATTACHMENTS).toMatch(/if \(uploading\) \{\s*setAttachError\(/)
    expect(COMPOSER_ATTACHMENTS).toMatch(/if \(attachments\.length >= maxAttachments\) \{\s*setAttachError\(/)
  })
})

describe("the keyboard is avoided on BOTH platforms, by ONE owner each", () => {
  it("gives iOS the KeyboardAvoidingView and Android the reserve, never both at once", () => {
    expect(CONVERSATION).toMatch(/<IosKeyboardAvoidingView style=\{styles\.flex\} keyboardVerticalOffset=\{0\}>/)
    expect(CONVERSATION).not.toMatch(/behavior=/)
    expect(CONVERSATION).toMatch(/const kbReserve = useKeyboardReserve\(\)/)
    expect(CONVERSATION).toMatch(/marginBottom: kbReserve/)
  })
})

describe("the inbox list", () => {
  it("memoizes its data array on the query data", () => {
    expect(INBOX).toMatch(/const threads = useMemo\(\(\) => \(query\.data\?\.pages \?\? \[\]\)\.flatMap\(\(p\) => p\.items\), \[query\.data\]\)/)
  })
})
describe("the typing indicator", () => {
  it("is rendered from the live WS typing state, never from a room subscription the inbox lacks", () => {
    expect(CONVERSATION).toContain("chat.typingUserIds.length === 0")
    expect(CONVERSATION).toContain("<TypingBubble name={item.name} color={item.color} />")
    expect(INBOX, "an inbox row holds no room subscription to learn typing from").not.toContain("typing")
  })

  it("names the typer(s) through the catalog, with the package's plural conventions", () => {
    expect(TYPING).toContain('t("typing.indicator_named", { name })')
    expect(TYPING).toContain('t("typing.indicator")')
    expect(CONVERSATION).toContain("typingNames(chat.typingUserIds, memberNames, t)")
  })

  it("stops looping under reduce-motion, off the package's SHARED accessibility store", () => {
    // A looping animation with no stop condition is the one an OS motion setting exists for. The shared
    // `useReducedMotion` store is one AccessibilityInfo query + one listener for the whole app, so N
    // mounted bubbles do not become N subscriptions.
    expect(TYPING).toContain("const reduceMotion = useReducedMotion() === true")
    expect(TYPING).toMatch(/if \(reduceMotion\) \{[\s\S]{0,200}?value\.setValue\(1\)/)
    expect(TYPING).toContain("}, [dots, reduceMotion])")
    expect(TYPING).not.toContain("AccessibilityInfo")
  })
})
