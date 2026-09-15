import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const read = (rel: string): string => readFileSync(new URL(rel, import.meta.url), "utf8")
const code = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

const CONTEXT = code(read("../SharePostContext.ts"))
const PROVIDER = code(read("../SharePostProvider.tsx"))
const SELECTOR = code(read("../SharePostSheet.tsx"))
const SHEET = code(read("../SharePostSheet.web.tsx"))
const NATIVE_SHEET = code(read("../SharePostSheet.native.tsx"))
const SESSION = code(read("../useSharePostSession.ts"))
const HOOK = code(read("../useShareToDm.ts"))
const DELIVERY = code(read("../shareDelivery.ts"))
const TILE = code(read("../ShareActionTile.tsx"))
const PEOPLE = code(read("../SharePeople.tsx"))
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

  it("keeps the sheet mounted until it reports itself closed, so a deferred OS share cannot be dropped", () => {
    expect(PROVIDER).toContain("onClosed={release}")
    expect(PROVIDER).not.toContain("setTimeout")
  })
})

describe("the sheet is a platform seam: a house dialog on web, a slide-up sheet on native", () => {
  it("selects through a .tsx selector that re-exports the web seam, never a .ts one Metro would shadow", () => {
    expect(SELECTOR).toContain('export { SharePostSheet } from "./SharePostSheet.web"')
    expect(SELECTOR).toContain('export type { SharePostSheetProps } from "./SharePostSheet.types"')
  })

  it("shares one session hook between both presentations", () => {
    expect(SHEET).toContain("const session = useSharePostSession({ visible, target, onClose })")
    expect(NATIVE_SHEET).toContain("const session = useSharePostSession({ visible, target, onClose })")
    expect(SESSION).not.toMatch(/<\/?[A-Z][A-Za-z]*(\s|>|\/)/)
  })

  it("web is built on ModalCardSheet with a filling body", () => {
    expect(SHEET).toContain("<ModalCardSheet")
    expect(SHEET).toContain('bodyLayout="fill"')
    expect(SHEET).toContain("modalSheetInputStyle")
    expect(SHEET).toContain("modalSheetInputFocusedStyle")
  })

  it("native rises from the bottom on SlideUpSheet, TikTok/Instagram style: people row first, then action tiles", () => {
    expect(NATIVE_SHEET).toContain("<SlideUpSheet")
    expect(NATIVE_SHEET).not.toContain("<ModalCardSheet")
    expect(NATIVE_SHEET).toContain("<SharePeople")
    expect(NATIVE_SHEET).toMatch(/<ShareActionTile\s+icon=\{copyTile\.icon\}\s+label=\{copyTile\.label\}/)
    expect(NATIVE_SHEET).toMatch(/tone=\{copyTile\.tone\}/)
    expect(NATIVE_SHEET).toMatch(/<ShareActionTile icon="Share" label=\{t\("actions.more"\)\} onPress=\{onShareAnotherWay\} disabled=\{pending\}/)
    expect(PEOPLE).toMatch(/<FlatList\s+horizontal/)
    expect(PEOPLE).toContain('accessibilityRole="checkbox"')
  })

  it("lets ONLY the recipient list give up height, so the note field and Send never fall behind the keyboard", () => {
    expect(PEOPLE).toContain("const sizing = shareRecipientsSizing(view.mode)")
    expect(PEOPLE).toContain("style={sizing}")
    expect(PEOPLE).not.toContain("maxHeight: RESULTS_MAX_HEIGHT")
    expect(PEOPLE).not.toMatch(/results: \{/)
    expect(NATIVE_SHEET).toMatch(/compose: \{\s*flexDirection: "row"/)
  })

  it("keeps the copy tile's accessible NAME stable and reports the copied state as a value, not a rename", () => {
    expect(TILE).toContain("accessibilityLabel={name ?? label}")
    expect(TILE).toContain("accessibilityValue={status === undefined ? undefined : { text: status }}")
    expect(TILE).not.toContain("accessibilityLiveRegion")
    expect(TILE).toContain("AccessibilityInfo.announceForAccessibility(status)")
    expect(NATIVE_SHEET).toContain('name={t("actions.copy_link")}')
    expect(NATIVE_SHEET).toContain('status={copyState === "idle" ? undefined : copyTile.label}')
  })

  it("native swaps the tiles for the compose bar once someone is picked, and never for a guest", () => {
    expect(NATIVE_SHEET).toContain("const footer = shareSheetFooter(isAuthenticated, selected.length)")
    expect(NATIVE_SHEET).toMatch(/footer === "compose" \? \(/)
    expect(NATIVE_SHEET).toContain('t("actions.send_count", { count: selected.length })')
  })

  it("native hides Copy link when the host injects no clipboard capability", () => {
    expect(NATIVE_SHEET).toContain("const clipboard = useClipboard()")
    expect(NATIVE_SHEET).toMatch(/\{clipboard \? \(\s*<ShareActionTile\s+icon=\{copyTile\.icon\}/)
  })

  it("native confirms a copied link on the tile itself and never through the app toast, which sits behind the sheet's Modal", () => {
    expect(NATIVE_SHEET).not.toContain("useToast")
    expect(NATIVE_SHEET).toMatch(/\.then\(\(\) => \{\s*haptics\.success\(\)\s*showCopyState\("copied"\)/)
    expect(NATIVE_SHEET).toMatch(/\.catch\(\(\) => \{\s*haptics\.error\(\)\s*showCopyState\("failed"\)/)
    expect(NATIVE_SHEET).toMatch(/\}, TOAST_QUIET_MS\)/)
    expect(NATIVE_SHEET).toMatch(/clearCopyReset\(\)\s*setCopyState\("idle"\)/)
  })

  it("native lays the guest prompt out as a row, so its fill-height variant takes its content height inside the content-sized sheet", () => {
    expect(NATIVE_SHEET).toMatch(/<View style=\{styles\.signedOut\}>\s*<SignInPrompt/)
    expect(NATIVE_SHEET).toMatch(/signedOut: \{\s*flexDirection: "row"/)
    expect(NATIVE_SHEET).toContain('bodyLayout="fill"')
  })

  it("inherits the scrim and the dialog keys from ModalCardSheet rather than re-rolling them", () => {
    const modal = code(read("../../primitives/ModalCardSheet.tsx"))
    expect(modal).toContain("{...webScrimProps}")
    expect(modal).toContain("useDialogWebKeys({ visible, onCommit, onClose })")
    expect(SHEET).not.toMatch(/<Modal[\s/>]/)
    expect(SHEET).toMatch(/onCommit=\{canSend \? onSend : undefined\}/)
  })

  it("web reuses MemberPicker (with its recents section) instead of forking a picker", () => {
    expect(SHEET).toContain('import { MemberPicker } from "../bodies/MemberPicker"')
    expect(SHEET).toContain("suggested={session.suggested}")
    expect(SHEET).toContain('suggestedLabel={t("recipients.recent")}')
    const picker = code(read("../../bodies/MemberPicker.tsx"))
    expect(picker).toContain("suggested?: readonly UserSearchResultDTO[]")
    expect(picker).toContain("const showSuggestions = !hasQuery && suggestions.length > 0")
  })

  it("never offers the viewer themselves as a recipient", () => {
    expect(SESSION).toContain("const excludeIds = useMemo(() => (user?.id ? [user.id] : EMPTY_EXCLUDE)")
    expect(SHEET).toContain("excludeIds={session.excludeIds}")
    expect(NATIVE_SHEET).toContain("excludeIds,")
  })

  it("labels Send with the recipient count and disables it with none selected", () => {
    expect(SHEET).toContain('t("actions.send_count", { count: selected.length })')
    expect(SESSION).toContain("const canSend = isAuthenticated && selected.length > 0 && !pending")
    expect(SHEET).toContain("disabled={!canSend}")
    expect(NATIVE_SHEET).toContain("disabled={!canSend}")
  })

  it("caps the note so note + link always fit one message frame", () => {
    expect(SESSION).toContain("const noteMax = shareNoteMaxLength(url)")
    expect(SESSION).toContain("setNoteRaw(next.slice(0, noteMax))")
    expect(SHEET).toContain("maxLength={session.noteMax}")
    expect(NATIVE_SHEET).toContain("maxLength={session.noteMax}")
  })

  it("offers the OS share sheet only AFTER its own overlay has fully left, which iOS requires", () => {
    for (const source of [SHEET, NATIVE_SHEET]) {
      expect(source).toContain("const { run, settled } = useDeferredOverlayAction(visible, onCancel, onClosed)")
      expect(source).toContain("onClosed={settled}")
      expect(source).toMatch(/const onShareAnotherWay = useCallback\(\(\) => run\(session\.shareElsewhere\)/)
    }
    expect(SESSION).toContain("void shareLink({")
  })

  it("shares the post link with the short invitation copy, translated per locale", () => {
    expect(SESSION).toMatch(/message: t\("os_share\.message"\)/)
    expect(SESSION).toContain("path: target.path,")
  })

  it("shows the copied toast only for a real clipboard copy", () => {
    expect(SESSION).toMatch(/if \(result === "copied"\)/)
    expect(SESSION).toContain('t("common-share:button.copied")')
  })

  it("prompts a signed-out viewer to sign in but still lets them share the link", () => {
    expect(SESSION).toMatch(/requireAuth\(\(\) => undefined, \{ next: target\.path \}\)/)
    expect(SHEET).toContain("<SignInPrompt")
    expect(SHEET).toMatch(/isAuthenticated \? \(\s*<>\s*<MemberPicker/)
    expect(SHEET).toMatch(/label=\{t\("actions.more"\)\}/)
    expect(NATIVE_SHEET).toContain("<SignInPrompt")
    expect(NATIVE_SHEET).toMatch(/const onSignIn = useCallback\(\(\) => run\(session\.signIn\)/)
  })
})

describe("a send in flight can never seal the sheet", () => {
  it("keeps Cancel, the backdrop and Escape live, all through the same abort-then-close handler", () => {
    expect(SHEET).not.toContain("backdropDismissDisabled")
    expect(SHEET).toContain("onClose={onCancel}")
    expect(NATIVE_SHEET).toContain("onClose={onCancel}")
    expect(SESSION).toMatch(
      /const onCancel = useCallback\(\(\): void => \{\s*if \(share\.isPending\) \{\s*cancelledRef\.current = true\s*share\.abort\(\)/,
    )
    expect(SHEET).toContain('<SecondaryButton label={t("actions.cancel")} onPress={onCancel} size="sm" />')
  })

  it("parks the OS share sheet while a send is running, so the two cannot race", () => {
    expect(SHEET).toMatch(/onPress=\{onShareAnotherWay\}\s*disabled=\{pending\}/)
    expect(NATIVE_SHEET).toMatch(/onPress=\{onShareAnotherWay\} disabled=\{pending\}/)
  })

  it("stays quiet about a run the viewer cancelled, beyond what actually got through", () => {
    expect(SESSION).toMatch(/if \(cancelledRef\.current\) \{/)
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
    expect(SESSION).toContain("const knownRooms = useMemo(() => dmThreadIdsByPeer(threads.data?.pages)")
    expect(SESSION).toContain("share.send({ entries, body, knownRooms })")
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
    expect(SESSION).toMatch(/summary\.status === "all"/)
    expect(SESSION).toContain("retryEntries(entries, summary.failed)")
    expect(SESSION).toMatch(/\} catch \{\s*toast\.show\(t\("toast.none_sent"\)/)
  })

  it("keeps only the failed recipients selected, so a manual resend cannot double-post", () => {
    expect(SESSION).toContain("setSelected((prev) => prev.filter((person) => failedIds.has(person.id)))")
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
    expect(MOBILE_LAYOUT).toContain("const applied = applyInternalHref(path)")
    expect(MOBILE_LAYOUT).toContain("if (!applied) return false")
    expect(MOBILE_LAYOUT).toContain(
      'import { applyInternalHref, useMobileNavAdapter } from "@/components/MobileNavAdapter"',
    )
  })

  it("mobile dismisses back to the shell only when the adapter says the shell is not showing it", () => {
    // The host asks; it never re-derives the rule. A link to the entry a shell-hosted route is ALREADY
    // showing must be a no-op - `goHome` there tears the route down and empties the nav stack.
    expect(MOBILE_LAYOUT).toContain("if (applied.dismissToShell) dismissToShell?.()")
    expect(MOBILE_LAYOUT).not.toContain("bridgeKey(entry)")
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
