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
