import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const read = (relative: string): string => readFileSync(new URL(relative, import.meta.url), "utf8")

const code = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

const BUBBLE = code(read("../conversation/MessageBubble.tsx"))
const EMBEDS = code(read("../conversation/ChatLinkEmbeds.tsx"))
const CLASSIFIER = code(read("../conversation/civfixLinks.ts"))
const SCHEDULER = code(read("../conversation/embedScheduler.ts"))
const SCOPE = code(read("../conversation/chatEmbedScope.ts"))
const CONVERSATION = code(read("../ConversationBody.tsx"))
const STYLES = code(read("../conversation/styles.ts"))
const REPORT_CARD = code(read("../LinkedReportCard.tsx"))
const EVENT_CARD = code(read("../LinkedEventCard.tsx"))
const LOCALES = ["en", "es", "de", "ko"].map((locale) => ({
  locale,
  catalog: JSON.parse(read(`../../i18n/locales/${locale}/conversation.json`)) as {
    embed?: Record<string, string>
  },
}))

describe("a civfix link in a message becomes a card inside the bubble", () => {
  it("tokenizes the body ONCE and derives both the text and the embed plan from those tokens", () => {
    expect(BUBBLE).toMatch(/const bodyTokens = useMemo\(\s*\(\) =>\s*chatBodyTokens\(\{/)
    expect(BUBBLE).toContain("const embedPlan = useMemo(() => planChatEmbeds(bodyTokens), [bodyTokens])")
    expect(BUBBLE).toContain("const bodyContent = renderChatTokens(bodyTokens, {")
    expect(BUBBLE.match(/tokenizeChatBody\(/g)?.length).toBe(1)
  })

  it("memoizes the plan on its real inputs, so React.memo can spare the cards a re-render", () => {
    expect(BUBBLE).toContain("[body, message.mentions, message.cityMention?.handle, linkOrigins],")
    expect(EMBEDS).toContain("export const ChatLinkEmbeds = React.memo(function ChatLinkEmbeds({")
  })

  it("mounts the embeds in the bubble body, for polls never, beneath the text otherwise", () => {
    expect(BUBBLE).toMatch(/\{!isPoll && embedPlan\.refs\.length > 0 \? \(\s*<ChatLinkEmbeds/)
    const bubbleInner = BUBBLE.slice(BUBBLE.indexOf("const bubbleInner = ("), BUBBLE.indexOf("const bubbleClone"))
    expect(bubbleInner).toContain("<ChatLinkEmbeds")
    expect(bubbleInner).toContain("<ReactionChips")
    expect(bubbleInner.indexOf("<ChatLinkEmbeds")).toBeLessThan(bubbleInner.indexOf("<ReactionChips"))
  })

  it("drops the duplicated raw url when the message is nothing but that one link", () => {
    expect(BUBBLE).toContain("const showBodyText = !embedPlan.linkOnly")
    expect(BUBBLE).toMatch(/\) : showBodyText \? \(\s*<Text style=\{\[styles\.bubbleBody/)
    expect(BUBBLE).toContain("linkOnly={embedPlan.linkOnly}")
  })

  it("navigates a card tap through the same internal-link path as a tapped url", () => {
    expect(BUBBLE).toMatch(
      /const onOpenEmbed = useCallback\(\s*\(ref: CivfixLinkRef\) => onOpenLink\(\{ kind: "internal", path: ref\.path, url: ref\.url \}\)/,
    )
    expect(BUBBLE).toContain("onOpen={onOpenEmbed}")
    expect(EMBEDS).not.toContain("next/navigation")
    expect(EMBEDS).not.toContain("expo-router")
    expect(EMBEDS).not.toContain("useNavStore")
  })

  it("keeps the pure classifier free of React and the data layer", () => {
    expect(CLASSIFIER).not.toMatch(/from "react/)
    expect(CLASSIFIER).not.toMatch(/from "\.\.\/\.\.\/data/)
    expect(CLASSIFIER).toContain('import { parseHttpsUrl, type ChatBodyToken } from "./chatLinks"')
  })
})

describe("the embed cards reuse the house cards and the cached data hooks", () => {
  it("renders reports and events with LinkedReportCard / LinkedEventCard in their list layout", () => {
    expect(EMBEDS).toContain('import { LinkedEventCard } from "../LinkedEventCard"')
    expect(EMBEDS).toContain('import { LinkedReportCard } from "../LinkedReportCard"')
    expect(EMBEDS).toMatch(/<LinkedReportCard report=\{reportToCardData\(report\)\} layout="list" headline="title"/)
    expect(EMBEDS).toMatch(/<LinkedEventCard\s+event=\{ref\}\s+cleanup=\{query\.data\}\s+layout="list"/)
  })

  it("builds the post byline with the feed's identity model and its media with PostMediaGrid", () => {
    expect(EMBEDS).toContain('import { buildPostIdentity } from "../postCardModel"')
    expect(EMBEDS).toContain('import { PostMediaGrid } from "../PostMediaGrid"')
    expect(EMBEDS).toContain('buildPostIdentity(post.author, post.organization, tf, tf("post_card.deleted_account"))')
  })

  it("fetches through the shared @civfix/ui/data hooks, one observer per card", () => {
    expect(EMBEDS).toContain('import { useCleanup, useOrganization, useProfile, useReport } from "../../data"')
    expect(EMBEDS).toContain('import { usePost } from "../../data/hooks/posts"')
    expect(EMBEDS).toContain("const query = useReport(link.id)")
    expect(EMBEDS).toContain("const query = useCleanup(link.id)")
    expect(EMBEDS).toContain("const query = usePost(link.id)")
    expect(EMBEDS).toContain("const query = useProfile(link.id)")
    expect(EMBEDS).toContain("const query = useOrganization(link.id)")
    expect(EMBEDS).not.toContain("useQuery(")
    expect(EMBEDS).not.toContain("fetch(")
  })

  it("hands LinkedEventCard the cleanup it already has, so the card does not refetch it", () => {
    expect(EMBEDS).toContain("cleanup={query.data}")
  })

  it("bounds the cards per message in the classifier, not in the renderer", () => {
    expect(CLASSIFIER).toContain("export const MAX_EMBEDS_PER_MESSAGE = 2")
    expect(CLASSIFIER).toMatch(/if \(seen\.has\(found\.key\) \|\| refs\.length >= limit\) continue/)
    expect(EMBEDS).not.toContain("slice(0")
  })
})

describe("the embed states never break the bubble", () => {
  it("reserves each kind's own card height while it loads and falls back to the plain link on an error", () => {
    expect(EMBEDS).toMatch(/export const EMBED_RESERVED_HEIGHT: Record<CivfixLinkKind, number> = \{\s*report: 64,\s*event: 68,\s*post: 88,\s*person: 64,\s*org: 64,\s*\}/)
    expect(EMBEDS).toContain("<SkeletonBlock height={EMBED_RESERVED_HEIGHT[kind]} radius={th.radius.lg} />")
    expect(EMBEDS).toMatch(/if \(data !== undefined\) return <>\{render\(data\)\}<\/>\s*if \(query\.isLoading\) return <EmbedSkeleton kind=\{props\.link\.kind\} \/>\s*return <EmbedFallback/)
    expect(EMBEDS).toMatch(/function EmbedFallback[\s\S]*?if \(!linkOnly\) return null/)
  })

  it("takes the reserved report and event heights from the list cards those embeds actually render", () => {
    expect(REPORT_CARD).toMatch(/thumbList: \{[\s\S]*?minHeight: 64/)
    expect(EVENT_CARD).toMatch(/eventTarget: \{\s*minHeight: 68/)
  })

  it("gives the card column a stable width so scroll anchoring holds", () => {
    expect(EMBEDS).toContain("export const EMBED_CARD_WIDTH = 260")
    expect(EMBEDS).toMatch(/host: \{\s*width: EMBED_CARD_WIDTH,\s*maxWidth: "100%"/)
  })

  it("labels every card for assistive tech and truncates long text", () => {
    expect(EMBEDS).toContain('accessibilityLabel={t("embed.loading")}')
    expect(EMBEDS).toContain('accessibilityLabel={t("embed.post_a11y", { name: identity.name })}')
    expect(EMBEDS).toContain('accessibilityLabel={t("embed.person_a11y", { name: profile.name })}')
    expect(EMBEDS).toContain('accessibilityLabel={t("embed.org_a11y", { name: org.name })}')
    expect(EMBEDS).toMatch(/numberOfLines=\{4\}/)
    expect(EMBEDS).toMatch(/numberOfLines=\{2\}/)
    expect(EMBEDS).not.toMatch(/#[0-9a-fA-F]{6}\b/)
  })

  it("ships the embed strings in every catalog", () => {
    for (const { locale, catalog } of LOCALES) {
      expect(catalog.embed, locale).toBeDefined()
      for (const key of ["loading", "post_a11y", "person_a11y", "org_a11y", "followers_other"]) {
        expect(catalog.embed?.[key], `${locale}.embed.${key}`).toBeTruthy()
      }
    }
  })
})

describe("only the cards the reader can see are allowed to fetch", () => {
  it("gates every card on the gate before any data hook is mounted", () => {
    expect(EMBEDS).toContain("const { ready, onSettled } = useEmbedGate(rowKey, props.link.key)")
    expect(EMBEDS).toContain("if (!ready) return <EmbedSkeleton kind={props.link.kind} />")
    expect(EMBEDS.indexOf("useEmbedGate")).toBeLessThan(EMBEDS.indexOf("<ReportEmbed"))
    for (const hook of ["useReport(", "useCleanup(", "usePost(", "useProfile(", "useOrganization("]) {
      expect(EMBEDS.match(new RegExp(hook.replace("(", "\\("), "g"))?.length, hook).toBe(1)
    }
  })

  it("reads visibility from the list's own viewability, not from the bubble mounting", () => {
    expect(CONVERSATION).toContain("const embedScope = useOwnChatEmbedScope()")
    expect(CONVERSATION).toContain("viewabilityConfig={EMBED_VIEWABILITY}")
    expect(CONVERSATION).toContain("onViewableItemsChanged={onViewableItemsChanged}")
    expect(CONVERSATION).toContain("const keys = viewportWindowKeys(dataRef.current, viewableItems)")
    expect(CONVERSATION).toContain("<ChatEmbedScopeProvider value={embedScope}>")
    expect(BUBBLE).toContain("const rowKey = message.clientId ?? message.id")
    expect(BUBBLE).toContain("rowKey={rowKey}")
  })

  it("caps how many cards may be in flight at once and releases the slot when one settles", () => {
    expect(SCHEDULER).toContain("export const EMBED_LOAD_CONCURRENCY = 6")
    expect(SCHEDULER).toMatch(/while \(active\.size < limit && waiting\.length > 0\)/)
    expect(SCOPE).toContain("queue.request(embedKey)")
    expect(SCOPE).toContain("return () => queue.drop(embedKey)")
    expect(SCOPE).toContain("return { ready: visible && admitted, onSettled }")
    expect(EMBEDS).toMatch(/useEffect\(\(\) => \{\s*if \(settled\) onSettled\(cached\)/)
  })

  it("falls back to the in-flight cap, never to a dead card, if the list never reports viewability", () => {
    expect(SCHEDULER).toContain("isVisible: (key) => !reported || visible.has(key)")
    expect(SCOPE).toContain("unscoped.current ??= { queue: createEmbedLoadQueue(), viewport: createOpenViewport() }")
  })

  it("gives a provider-less bubble its OWN fallback scope, never a module-level one that outlives it", () => {
    expect(SCOPE).toContain("createContext<ChatEmbedScope | null>(null)")
    expect(SCOPE).toContain("const unscoped = useRef<ChatEmbedScope | null>(null)")
    expect(SCOPE).toContain("if (provided) return provided")
    expect(SCOPE).not.toMatch(/^const UNSCOPED/m)
  })

  it("makes an already-loaded embed take a slot again, so the in-flight cap is never exceeded", () => {
    expect(SCHEDULER).toContain("const isAdmitted = (key: string): boolean => active.has(key) || holding.has(key)")
    expect(SCHEDULER).toContain("if (settledOnce.has(key)) waiting.unshift(key)")
    expect(SCHEDULER).toMatch(/if \(settledOnce\.size <= hintLimit\) break/)
  })

  it("keeps the scheduler pure, so the queue is unit-testable without React", () => {
    expect(SCHEDULER).not.toMatch(/from "react/)
    expect(SCHEDULER).not.toMatch(/from "\.\/Chat/)
    expect(SCHEDULER).not.toMatch(/from "\.\.\/\.\.\/data/)
  })
})

describe("a link-only message is drawn as its card, never as a tinted bubble framing it", () => {
  it("drops the bubble chrome when the body is nothing but the link and there is no quote above it", () => {
    expect(BUBBLE).toContain("const bare = embedPlan.linkOnly && !message.replyTo")
    expect(BUBBLE).toContain("const bubbleChrome = bare ? styles.bubbleBare : mine ? styles.bubbleMine : styles.bubbleTheirs")
    expect(BUBBLE.match(/\[styles\.bubble, bubbleChrome, bubbleTint\]/g)?.length).toBe(3)
    expect(BUBBLE).not.toMatch(/styles\.bubble, mine \? styles\.bubbleMine/)
    expect(STYLES).toMatch(/bubbleBare: \{\s*paddingHorizontal: 0,\s*paddingVertical: 0,\s*borderRadius: t\.radius\.lg,\s*\}/)
  })

  it("styles the chips, the flash and the fallback link for the page, not the tint, once the bubble is bare", () => {
    expect(BUBBLE).toContain("const tinted = mine && !bare")
    expect(BUBBLE).toContain("const tintStyle = tinted ? styles.mentionTokenMine : styles.mentionToken")
    expect(BUBBLE).toContain("<ReactionChips reactions={reactions} onToggle={toggleReaction} mine={tinted} disabled={!reactable} />")
    expect(BUBBLE.match(/<FlashOverlay mine=\{tinted\} shape=\{bare \? "card" : "bubble"\} \/>/g)?.length).toBe(2)
    expect(STYLES).toMatch(/flashOverlayCard: \{\s*borderRadius: t\.radius\.lg,\s*\}/)
  })

  it("paints every card on the neutral surface with the hairline border, in both schemes", () => {
    expect(EMBEDS).toMatch(
      /card: \{[^}]*borderWidth: StyleSheet\.hairlineWidth,\s*borderColor: t\.colors\.border,\s*backgroundColor: t\.colors\.surface,/,
    )
    expect(EMBEDS).toMatch(/cardHovered: \{\s*borderColor: t\.colors\.borderStrong,\s*backgroundColor: t\.colors\.surfaceTint,\s*\}/)
    expect(EMBEDS).not.toMatch(/bloom|danger|accent|brand\./)
  })
})

describe("an optimistic send is drawn by the same tree the ack will confirm, so nothing snaps", () => {
  const rowContent = () => BUBBLE.slice(BUBBLE.indexOf("const rowContent = ("), BUBBLE.indexOf("return (\n    <View\n      ref={hasBody"))

  it("has no dedicated pending render path: one bubble tree, one ChatLinkEmbeds mount", () => {
    expect(BUBBLE).not.toMatch(/if \(mine && \(pending \|\| failed\)\) \{\s*return/)
    expect(BUBBLE.match(/<ChatLinkEmbeds/g)?.length).toBe(1)
    expect(BUBBLE).toContain("const inFlight = mine && (pending || failed)")
  })

  it("tints only a real bubble on failure; a bare card keeps the neutral surface", () => {
    expect(BUBBLE).toContain("const bubbleTint = failed && !bare ? styles.bubbleFailed : null")
    expect(BUBBLE).not.toMatch(/failed \? styles\.bubbleFailed/)
  })

  it("keeps the sending state and the retry affordance beneath the bubble, where attachment-only sends already show them", () => {
    const content = rowContent()
    const attachmentsAt = content.indexOf("<BubbleAttachments")
    const statusAt = content.indexOf("{inFlight ? <SendStatusLine failed={failed} onRetry={retrySend} /> : null}")
    expect(attachmentsAt).toBeGreaterThan(0)
    expect(statusAt).toBeGreaterThan(attachmentsAt)
    expect(content).toContain("{(groupEnd || edited) && !inFlight ? (")
    const status = BUBBLE.slice(BUBBLE.indexOf("function SendStatusLine("), BUBBLE.indexOf("interface MenuModel"))
    expect(status).toMatch(/accessibilityLabel=\{t\("bubble\.retry_sending"\)\}/)
    expect(status).toMatch(/\{t\("bubble\.failed_retry"\)\}/)
    expect(status).toMatch(/\{t\("bubble\.sending"\)\}/)
    expect(BUBBLE).toMatch(/const retrySend = \(\) => \{\s*if \(message\.clientId\) onRetry\(message\.clientId\)/)
  })

  it("gates the card on the row key the ack preserves, so the optimistic row and the echoed row share one gate", () => {
    expect(BUBBLE).toContain("const rowKey = message.clientId ?? message.id")
    const model = code(read("../conversation/conversationModel.ts"))
    expect(model).toContain("id: item.message.clientId ?? item.message.id")
    expect(SCOPE).toContain("export function useEmbedGate(rowKey: string, embedKey: string): EmbedGate")
  })

  it("never opens a context menu or a reaction for an in-flight message", () => {
    const actions = code(read("../messageActions.ts"))
    expect(actions).toContain("if (input.deleted || input.pendingOrFailed) return []")
    expect(BUBBLE).toContain("const reactable = canReact && !pending && !failed")
    expect(BUBBLE).toContain("const menuAvailable = descriptors.length > 0 || reactable")
  })
})

describe("the post card byline gives the name the first line and moves the handle beneath it", () => {
  const postCard = () => EMBEDS.slice(EMBEDS.indexOf("function PostEmbedCard("), EMBEDS.indexOf("function PostEmbed("))

  it("stacks name (+ org badge) over handle · time in the identity column the person and org cards already use", () => {
    const card = postCard()
    expect(card).toContain("const byline = identity.handleLabel ?? identity.viaLabel")
    expect(card).toMatch(/<View style=\{styles\.identityRow\}>\s*<Avatar[\s\S]*?size=\{40\}[\s\S]*?<View style=\{styles\.identityCol\}>/)
    const nameRow = card.slice(card.indexOf("<View style={styles.identityCol}>"), card.indexOf("{byline ? ("))
    expect(nameRow).toContain("{identity.name}")
    expect(nameRow).toContain('<OrgAffiliationBadge organization={identity.affiliation} size="sm" interactive={false} />')
    expect(nameRow).not.toContain("byline")
    expect(nameRow).not.toContain("timeAgo")
    expect(card).toContain("<Text style={[styles.meta, styles.metaFixed]}>{byline ? `· ${time}` : time}</Text>")
  })

  it("lets the handle truncate but never the time", () => {
    expect(EMBEDS).toMatch(/meta: \{\s*flexShrink: 1,/)
    expect(EMBEDS).toMatch(/metaFixed: \{\s*flexShrink: 0,\s*\}/)
    expect(EMBEDS).toMatch(/identityCol: \{\s*flex: 1,\s*minWidth: 0,/)
  })

  it("matches the other person-led rows in the package, which all stack name over @handle", () => {
    for (const file of ["../SearchResults.tsx", "../ConnectionsBody.tsx", "../RosterRow.tsx", "../LeaderboardRow.tsx"]) {
      const source = code(read(file))
      expect(source).toMatch(/numberOfLines=\{1\}>\s*@\{(person|entry)\.handle\}/)
    }
  })
})

describe("a shared post still previews the event or report attached to it", () => {
  const postCard = () => EMBEDS.slice(EMBEDS.indexOf("function PostEmbedCard("), EMBEDS.indexOf("function PostEmbed("))

  it("draws the attachment with the same two cards the feed row draws it with", () => {
    const card = postCard()
    expect(card).toContain("const linkedEvent = post.event ?? post.repostOf?.event ?? null")
    expect(card).toContain("const linkedReport = post.report ?? post.repostOf?.report ?? null")
    expect(card).toMatch(/<LinkedEventCard\s+event=\{eventCard\}\s+layout="list"\s+timeZone=\{eventCard\.timezone \?\? undefined\}/)
    expect(card).toMatch(/<LinkedReportCard\s+report=\{\{\s*\.\.\.linkedRefToCardData\(reportCard\),/)
    expect(card).toMatch(/thumbUrl: reportCard\.thumbUrl \?\? localReportThumb\(reportCard\.id\),/)
    expect(card).toMatch(/layout="list"\s+headline="title"/)
    const feed = code(read("../PostCard.tsx"))
    expect(feed).toContain("const displayEvent = isRepost ? (embedded?.event ?? null) : (post.event ?? null)")
    expect(feed).toContain("const displayReport = isRepost ? (embedded?.report ?? null) : (post.report ?? null)")
  })

  it("hangs the attachment below the body and the photos, never above the byline", () => {
    const card = postCard()
    const identityAt = card.indexOf("<View style={styles.identityRow}>")
    const mediaAt = card.indexOf("<PostMediaGrid")
    const eventAt = card.indexOf("<LinkedEventCard")
    const reportAt = card.indexOf("<LinkedReportCard")
    expect(identityAt).toBeGreaterThan(-1)
    expect(eventAt).toBeGreaterThan(mediaAt)
    expect(mediaAt).toBeGreaterThan(identityAt)
    expect(reportAt).toBeGreaterThan(eventAt)
  })

  it("drops the nested card when the same entity is already linked in the message body", () => {
    const card = postCard()
    expect(card).toContain("const eventCard = linkedEvent && !embeddedKeys.has(`event:${linkedEvent.id}`) ? linkedEvent : null")
    expect(card).toContain("const reportCard = linkedReport && !embeddedKeys.has(`report:${linkedReport.id}`) ? linkedReport : null")
    expect(EMBEDS).toContain("const embeddedKeys = useMemo(() => new Set(refs.map((link) => link.key)), [refs])")
    expect(EMBEDS).toContain("embeddedKeys={embeddedKeys}")
  })

  it("opens a tapped attachment through the bubble's own internal-link path", () => {
    const card = postCard()
    expect(card).toContain('onOpen(civfixEntityRef("event", id))')
    expect(card).toContain('onOpen(civfixEntityRef("report", id))')
    expect(card).toContain("onPress={() => openEvent(eventCard.id)}")
    expect(card).toContain("onPress={() => openReport(reportCard.id)}")
    expect(EMBEDS).not.toContain("expo-router")
    expect(EMBEDS).not.toContain("useNavStore")
  })
})
