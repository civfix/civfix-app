import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const read = (rel: string): string => readFileSync(new URL(rel, import.meta.url), "utf8")
const code = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

const CONTEXT = code(read("../SharePostContext.ts"))
const PROVIDER = code(read("../SharePostProvider.tsx"))
const SHEET = code(read("../SharePostSheet.tsx"))
const HOOK = code(read("../useShareToDm.ts"))
const DELIVERY = code(read("../shareDelivery.ts"))
const BAR = code(read("../../primitives/PostActionBar.tsx"))
const SHELL = code(read("../../shell/AppShell.tsx"))
const BUBBLE = code(read("../../bodies/conversation/MessageBubble.tsx"))
const MOBILE_LAYOUT = code(read("../../../../../apps/community-mobile/app/_layout.tsx"))
const WEB_PROVIDERS = code(read("../../../../../apps/community-web/src/components/providers.tsx"))

describe("the share glyph opens the sheet, and the primitives layer stays independent of it", () => {
  it("routes PostActionBar's onShare through useSharePost, not straight at shareLink", () => {
    expect(BAR).toContain('import { useSharePost } from "../share/SharePostContext"')
    expect(BAR).toContain("const sharePost = useSharePost()")
    expect(BAR).toMatch(/sharePost\.open\(\{ title: shareTitle, path \}\)/)
    expect(BAR).not.toContain("shareLink(")
  })

  it("keeps the hook's module free of the sheet, so primitives never pull in bodies or data", () => {
    expect(CONTEXT).not.toContain("SharePostSheet")
    expect(CONTEXT).not.toContain("MemberPicker")
    expect(CONTEXT).not.toMatch(/from "\.\.\/data/)
    expect(CONTEXT).not.toMatch(/from "\.\.\/bodies/)
  })

  it("falls back to the OS/browser share sheet when no provider is mounted", () => {
    expect(CONTEXT).toMatch(/const DIRECT_SHARE: SharePostHandle = \{/)
    expect(CONTEXT).toContain("void shareLink({")
    expect(CONTEXT).toMatch(/useContext\(SharePostContext\) \?\? DIRECT_SHARE/)
  })
})

describe("the provider is mounted by every host that renders a feed", () => {
  it("wraps the shared shell, next to the lightbox provider", () => {
    expect(SHELL).toContain('import { SharePostProvider } from "../share/SharePostProvider"')
    expect(SHELL).toMatch(/<MediaLightboxProvider>\s*<SharePostProvider>/)
    expect(SHELL).toMatch(/<\/SharePostProvider>\s*<\/MediaLightboxProvider>/)
  })

  it("wraps the mobile root layout too, since its detail routes bypass the shell", () => {
    expect(MOBILE_LAYOUT).toMatch(/SharePostProvider,/)
    expect(MOBILE_LAYOUT).toMatch(/<MediaLightboxProvider>\s*<SharePostProvider>/)
    expect(MOBILE_LAYOUT).toMatch(/<\/SharePostProvider>\s*<\/MediaLightboxProvider>/)
  })

  it("mounts the sheet only once a target exists, so no session pays for its queries", () => {
    expect(PROVIDER).toMatch(/\{target \? <SharePostSheet visible=\{visible\}/)
  })
})

describe("the sheet is a house dialog", () => {
  it("is built on ModalCardSheet with a filling body", () => {
    expect(SHEET).toContain("<ModalCardSheet")
    expect(SHEET).toContain('bodyLayout="fill"')
    expect(SHEET).toContain("modalSheetInputStyle")
    expect(SHEET).toContain("modalSheetInputFocusedStyle")
  })

  it("inherits the scrim and the dialog keys from ModalCardSheet rather than re-rolling them", () => {
    const modal = code(read("../../primitives/ModalCardSheet.tsx"))
    expect(modal).toContain("{...webScrimProps}")
    expect(modal).toContain("useDialogWebKeys({ visible, onCommit, onClose })")
    expect(SHEET).not.toMatch(/<Modal[\s/>]/)
    expect(SHEET).toMatch(/onCommit=\{canSend \? onSend : undefined\}/)
  })

  it("reuses MemberPicker (with its recents section) instead of forking a picker", () => {
    expect(SHEET).toContain('import { MemberPicker } from "../bodies/MemberPicker"')
    expect(SHEET).toContain("suggested={suggested}")
    expect(SHEET).toContain('suggestedLabel={t("recipients.recent")}')
    const picker = code(read("../../bodies/MemberPicker.tsx"))
    expect(picker).toContain("suggested?: readonly UserSearchResultDTO[]")
    expect(picker).toContain("const showSuggestions = !hasQuery && suggestions.length > 0")
  })

  it("never offers the viewer themselves as a recipient", () => {
    expect(SHEET).toContain("const excludeIds = useMemo(() => (user?.id ? [user.id] : EMPTY_EXCLUDE)")
    expect(SHEET).toContain("excludeIds={excludeIds}")
  })

  it("labels Send with the recipient count and disables it with none selected", () => {
    expect(SHEET).toContain('t("actions.send_count", { count: selected.length })')
    expect(SHEET).toContain("const canSend = isAuthenticated && selected.length > 0 && !pending")
    expect(SHEET).toContain("disabled={!canSend}")
  })

  it("caps the note so note + link always fit one message frame", () => {
    expect(SHEET).toContain("const noteMax = shareNoteMaxLength(url)")
    expect(SHEET).toContain("setNote(next.slice(0, noteMax))")
    expect(SHEET).toContain("maxLength={noteMax}")
  })

  it("offers the OS share sheet AFTER the modal has dismissed, which iOS requires", () => {
    expect(SHEET).toContain("onDismiss={onModalDismiss}")
    expect(SHEET).toMatch(/if \(Platform\.OS === "ios"\) \{\s*pendingAfterDismiss\.current = action/)
    expect(SHEET).toMatch(/const onShareAnotherWay = useCallback\(\(\) => \{\s*runAfterDismiss\(/)
    expect(SHEET).toContain("void shareLink({")
  })

  it("shows the copied toast only for a real clipboard copy", () => {
    expect(SHEET).toMatch(/if \(result === "copied"\)/)
    expect(SHEET).toContain('t("common-share:button.copied")')
  })

  it("prompts a signed-out viewer to sign in but still lets them share the link", () => {
    expect(SHEET).toContain("<SignInPrompt")
    expect(SHEET).toMatch(/requireAuth\(\(\) => undefined, \{ next: target\.path \}\)/)
    expect(SHEET).toMatch(/isAuthenticated \? \(\s*<>\s*<MemberPicker/)
    expect(SHEET).toMatch(/label=\{t\("actions.more"\)\}/)
  })
})

describe("a send in flight can never seal the sheet", () => {
  it("keeps Cancel, the backdrop and Escape live, all through the same abort-then-close handler", () => {
    expect(SHEET).not.toContain("backdropDismissDisabled")
    expect(SHEET).toContain("onClose={onCancel}")
    expect(SHEET).toMatch(
      /const onCancel = \(\): void => \{\s*if \(pending\) \{\s*cancelledRef\.current = true\s*share\.abort\(\)/,
    )
    expect(SHEET).toContain('<SecondaryButton label={t("actions.cancel")} onPress={onCancel} size="sm" />')
  })

  it("parks the OS share sheet while a send is running, so the two cannot race", () => {
    expect(SHEET).toMatch(/onPress=\{onShareAnotherWay\}\s*disabled=\{pending\}/)
  })

  it("stays quiet about a run the viewer cancelled, beyond what actually got through", () => {
    expect(SHEET).toMatch(/if \(cancelledRef\.current\) \{/)
  })
})

describe("the DM send path", () => {
  it("never joins the room, because the ack is unicast on the sending connection", () => {
    expect(DELIVERY).toContain('roomKind: "dm"')
    expect(DELIVERY).not.toContain("socket.join(")
    expect(DELIVERY).not.toContain("socket.leave(")
  })

  it("retains the socket once and releases it in a finally, so a throw cannot leak a ref", () => {
    expect(DELIVERY).toContain("deps.socket.retain()")
    expect(DELIVERY).toMatch(/\} finally \{\s*deps\.socket\.release\(\)/)
  })

  it("stops the whole run on any transport failure, and only continues past a server refusal", () => {
    expect(DELIVERY).toMatch(/if \(!\(await waitForSocketOpen\(deps\.socket, openTimeoutMs\)\)\) \{\s*stopped = true\s*break/)
    expect(DELIVERY).toMatch(/if \(outcome === "dropped"\) \{\s*waiter\.cancel\(\)\s*stopped = true\s*break/)
    expect(DELIVERY).toMatch(/if \(verdict === "rejected"\) \{\s*outcomes\.set\(entry\.clientId, "failed"\)\s*continue/)
    expect(DELIVERY).toMatch(/stopped = true\s*break\s*\}\s*\} finally/)
  })

  it("checks the abort flag before resolving a thread and again before writing a frame", () => {
    const loop = DELIVERY.slice(DELIVERY.indexOf("for (const entry of entries)"))
    const checks = loop.match(/if \(aborted\(\)\) \{/g) ?? []
    expect(checks.length).toBeGreaterThanOrEqual(2)
  })

  it("bounds the ack wait with the same timeout the conversation composer uses", () => {
    expect(HOOK).toContain('import { SEND_TIMEOUT_MS } from "../data/hooks/chat"')
    expect(HOOK).toContain("ackTimeoutMs: SEND_TIMEOUT_MS")
  })

  it("reuses a thread id the inbox already knows instead of spending the openDm budget", () => {
    expect(HOOK).toMatch(/const known = knownRooms\?\.get\(recipientId\)/)
    expect(HOOK).toContain("return known ? Promise.resolve(known) : openDmRoom(api, recipientId)")
    expect(SHEET).toContain("const knownRooms = useMemo(() => dmThreadIdsByPeer(threads.data?.pages)")
    expect(SHEET).toContain("share.send({ entries, body, knownRooms })")
  })

  it("refreshes the inbox and each posted thread once, not per recipient", () => {
    expect(HOOK).toContain("queryKeys.threads")
    expect(HOOK).toContain("queryKeys.threadsUnread")
    expect(HOOK).toContain('queryKeys.chatHistory(roomId, "dm")')
    expect(HOOK).toMatch(/if \(rooms\.length > 0\) \{/)
  })

  it("re-arms the mounted flag on mount, so a dev double-invoke cannot wedge Send", () => {
    expect(HOOK).toMatch(/useEffect\(\(\) => \{\s*alive\.current = true\s*return \(\) => \{\s*alive\.current = false/)
    expect(HOOK).toContain("if (alive.current) setIsPending(false)")
  })

  it("reports per-recipient outcomes instead of throwing out of the sheet", () => {
    expect(DELIVERY).toContain("summarizeShareRun(entries, outcomes, stopped)")
    expect(SHEET).toMatch(/summary\.status === "all"/)
    expect(SHEET).toContain("retryEntries(entries, summary.failed)")
    expect(SHEET).toMatch(/\} catch \{\s*toast\.show\(t\("toast.none_sent"\)/)
  })

  it("keeps only the failed recipients selected, so a manual resend cannot double-post", () => {
    expect(SHEET).toContain("setSelected((prev) => prev.filter((person) => failedIds.has(person.id)))")
  })
})

describe("a link in a message is opened BY THE HOST, never by shared code driving the nav store", () => {
  it("tokenizes the body through the pure module rather than a second regex in the component", () => {
    expect(BUBBLE).toContain('from "./chatLinks"')
    expect(BUBBLE).toContain("tokenizeChatBody(body, {")
    expect(BUBBLE).not.toContain("mentionScanRegex")
  })

  it("asks the openInternalHref capability first and never touches useNavStore", () => {
    expect(BUBBLE).toContain("const openInternalHref = useOpenInternalHref()")
    expect(BUBBLE).toContain(
      'if (target.kind === "internal" && openInternalHref?.open(target.path) === true) return',
    )
    expect(BUBBLE).not.toContain("useNavStore")
    expect(BUBBLE).not.toContain("Linking")
  })

  it("falls through to the external opener when the host cannot present that path", () => {
    expect(BUBBLE).toContain("openExternal.open(target.url)")
    expect(BUBBLE).toContain('accessibilityRole="link"')
    expect(BUBBLE).toContain('t("bubble.link_failed")')
  })

  it("hands the host a path, and keeps the entry lookup as the shared route parser's job", () => {
    const links = code(read("../../bodies/conversation/chatLinks.ts"))
    expect(links).toContain('if (entryFromPath(parsed.path) === null) return { kind: "external", url }')
    expect(links).toContain('return { kind: "internal", path: parsed.path, url }')
    expect(links).not.toContain("useNavStore")
  })

  it("tokenizes https only, since neither host opens an http target", () => {
    const links = code(read("../../bodies/conversation/chatLinks.ts"))
    expect(links).toContain("const HTTPS_URL_SCAN = /https:\\/\\/[^\\s]+/gi")
    expect(links).not.toMatch(/https\?/)
  })

  it("reads the app's own origins lazily, never at module scope", () => {
    expect(BUBBLE).toContain("const linkOrigins = appLinkOrigins()")
    const links = code(read("../../bodies/conversation/chatLinks.ts"))
    expect(links).toMatch(/export function appLinkOrigins\(\)/)
    expect(links).toContain("(globalThis as { location?: { origin?: unknown } }).location")
  })
})

describe("both hosts inject openInternalHref", () => {
  it("mobile reuses the SAME universal-link entry point the notification handler uses", () => {
    expect(MOBILE_LAYOUT).toMatch(/openInternalHref: \{\s*open: \(path: string\): boolean => \{/)
    expect(MOBILE_LAYOUT).toContain("const entry = applyInternalHref(path)")
    expect(MOBILE_LAYOUT).toContain("if (!entry) return false")
    expect(MOBILE_LAYOUT).toContain(
      'import { applyInternalHref, useMobileNavAdapter } from "@/components/MobileNavAdapter"',
    )
  })

  it("mobile dismisses back to the shell for an entry its router bridge does not map", () => {
    expect(MOBILE_LAYOUT).toContain('import { bridgeKey } from "@/lib/navBridge"')
    expect(MOBILE_LAYOUT).toContain("if (bridgeKey(entry) === null) dismissToShell?.()")
    expect(MOBILE_LAYOUT).toMatch(/function InternalHrefBridge\(\): null \{/)
    expect(MOBILE_LAYOUT).toContain("dismissToShell = () => goHome(router)")
    expect(MOBILE_LAYOUT).toContain("<InternalHrefBridge />")
  })

  it("web pushes the parsed entry, because its shell persists across a push", () => {
    expect(WEB_PROVIDERS).toMatch(/openInternalHref: \{\s*open: \(path: string\): boolean => \{/)
    expect(WEB_PROVIDERS).toContain("const entry = entryFromPath(path)")
    expect(WEB_PROVIDERS).toContain("useNavStore.getState().push(entry)")
    expect(WEB_PROVIDERS).toContain("if (!entry) return false")
  })
})

describe("web gets a REAL clipboard, so Copy link actually copies", () => {
  it("registers webClipboardCapability in the web host bundle", () => {
    expect(WEB_PROVIDERS).toContain("webClipboardCapability")
    expect(WEB_PROVIDERS).toContain("clipboard: webClipboardCapability")
  })

  it("declares it after the fake spread, or the fake would win", () => {
    const spread = WEB_PROVIDERS.indexOf("...makeFakeCapabilities()")
    const clipboard = WEB_PROVIDERS.indexOf("clipboard: webClipboardCapability")
    expect(spread).toBeGreaterThan(-1)
    expect(clipboard).toBeGreaterThan(spread)
  })
})
