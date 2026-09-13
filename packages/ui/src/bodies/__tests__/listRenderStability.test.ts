import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const read = (rel: string): string => readFileSync(new URL(rel, import.meta.url), "utf8")
const code = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

describe("NotificationsBody rows survive a parent re-render", () => {
  const SRC = code(read("../NotificationsBody.tsx"))

  it("memoizes the row and hands it stable callbacks", () => {
    expect(SRC).toContain("const NotificationRow = memo(function NotificationRow(")
    expect(SRC).toMatch(/const renderItem = useCallback\(/)
    expect(SRC).toContain("renderItem={renderItem}")
    expect(SRC).not.toMatch(/renderItem=\{\(\{ item \}/)
    expect(SRC).not.toMatch(/onPress=\{\(\) => onPressItem\(item\)\}/)
  })

  it("depends on the mutation's stable `mutate`, not the churning result object", () => {
    expect(SRC).toContain("const mutateRead = markRead.mutate")
    expect(SRC).not.toMatch(/}, \[markRead\]\)/)
  })

  it("keeps the empty-data array stable so `data` does not change identity per render", () => {
    expect(SRC).toContain("query.data ?? NO_NOTIFICATIONS")
    expect(SRC).toContain("const NO_NOTIFICATIONS: readonly NotificationDTO[] = []")
  })
})

describe("MembersBody coalesces its roster before the grouping memo", () => {
  const SRC = code(read("../MembersBody.tsx"))

  it("wraps the per-kind flatMap in a memo keyed on the query data", () => {
    expect(SRC).toMatch(/const items: RosterPerson\[\] = useMemo\(/)
    expect(SRC).toContain("[roomKind, groupPages, reportRoster, attendeeRoster]")
  })

  it("no longer allocates the roster inline in the render body", () => {
    expect(SRC).not.toMatch(/const items: RosterPerson\[\] =\s*\n\s*roomKind === "group"/)
  })
})

describe("FeedBody hands the FlatList stable props", () => {
  const SRC = code(read("../FeedBody.tsx"))

  it("hoists the key extractor out of the render and takes the refresh palette from the shared hook", () => {
    expect(SRC).toContain("keyExtractor={postKeyExtractor}")
    expect(SRC).toContain("const postKeyExtractor = (item: PostDTO): string => item.id")
    expect(SRC).toContain("const refreshSpinner = useRefreshControlProps()")
    expect(SRC).toContain("{...refreshSpinner}")
    expect(SRC).not.toMatch(/keyExtractor=\{\(item: PostDTO\) => item\.id\}/)
  })

  it("keeps no private copy of the refresh colors, and reaches for no theme of its own", () => {
    expect(SRC).not.toContain("refreshColors")
    expect(SRC).not.toContain("tintColor=")
    expect(SRC).not.toContain("useTheme")
  })

  it("keeps the entrance style STABLE, or the header memo below it is dead on arrival", () => {
    expect(SRC).toContain(
      "return useMemo(() => ({ opacity, transform: [{ translateY }] }), [opacity, translateY])",
    )
    expect(SRC).not.toMatch(/return \{ opacity, transform: \[\{ translateY \}\] \}/)
    expect(SRC).toContain(
      "const headerStyle = useMemo(() => [entranceStyle, styles.headerInset], [entranceStyle, styles])",
    )
  })

  it("memoizes every element slot and every composed style array", () => {
    for (const slot of ["header", "empty", "footer"]) {
      expect(SRC, `${slot} is rebuilt per render`).toMatch(
        new RegExp(`const ${slot} = useMemo\\(`),
      )
    }
    expect(SRC).toContain("contentContainerStyle={contentStyle}")
    expect(SRC).toContain("refreshControl={refresh}")
    expect(SRC).toContain(
      "const emptyStyle = useMemo(() => [styles.list, styles.headerInset, styles.emptyFill], [styles])",
    )
    expect(SRC).toContain(
      "const footerStyle = useMemo(() => [styles.footer, styles.headerInset], [styles])",
    )
  })

  it("gives the header's only control a stable press handler, never an inline arrow", () => {
    expect(SRC).toContain(
      'const openComposer = useCallback(() => useNavStore.getState().push({ kind: "composer" }), [])',
    )
    expect(SRC).toContain("onPress={openComposer}")
    expect(SRC).not.toMatch(/onPress=\{\(\) =>/)
  })

  it("uses the shared alpha helper instead of a private hex-to-rgba copy", () => {
    expect(SRC).toContain('import { alpha } from "../theme/alpha"')
    expect(SRC).not.toContain("function withAlpha(")
  })

  it("carries no leftover empty-expression artifacts from the comment stripper", () => {
    expect(SRC).not.toMatch(/^\s*\{ \}\s*$/m)
  })
})

describe("LinkedEventCard does not fetch a roster per feed row", () => {
  const SRC = code(read("../LinkedEventCard.tsx"))

  it("gates the attendee query behind the DETAIL variant, and the default is the feed row", () => {
    expect(SRC).toContain('variant = "feed"')
    expect(SRC).toContain('const showControls = variant === "detail" && !selectable')
    expect(SRC).toContain("useCleanupAttendees(showControls ? event.id : undefined)")
  })

  it("keeps the cheap path intact: the ref's own count and organizer", () => {
    const model = code(read("../linkedEventCardModel.ts"))
    expect(model).toContain("const going = context.going ?? event.going")
    expect(model).toContain("attendeePreview: attendees.length > 0 ? attendees : [event.organizer]")
  })

  it("renders no RSVP pill and no attendee footer unless the host opts in", () => {
    const mount = SRC.slice(SRC.indexOf("{showControls ? ("), SRC.indexOf("if (!onRemove) return card"))
    expect(mount).toContain("<EventCardFooter")
    expect(mount).not.toContain("<RsvpPill")

    const footer = SRC.slice(SRC.indexOf("function EventCardFooter("), SRC.indexOf("export function LinkedEventCard("))
    expect(footer).toContain("useJoinCleanup(eventId)")
    expect(footer).toContain("<AttendeeStack")
    expect(footer).toContain("<RsvpPill")
  })

  it("instantiates no join mutation on a feed row, because the footer owns it", () => {
    const card = SRC.slice(SRC.indexOf("export function LinkedEventCard("))
    expect(card).not.toContain("useJoinCleanup(")
    expect((SRC.match(/useJoinCleanup\(/g) ?? []).length).toBe(1)
  })

  it("still paints a stack once the footer is asked for, so it is never a bare count", () => {
    expect(SRC).toContain(
      "const visibleCount = Math.min(3, Math.max(model.attendeePreview.length, Math.min(3, model.going)))",
    )
    expect(SRC).toContain("{showAvatars ? (")
  })

  it("the THREAD's single focal card opts in - one roster per screen, not one per row", () => {
    const focal = code(read("../thread/ThreadFocalPost.tsx"))
    expect(focal).toMatch(/<LinkedEventCard\s+event=\{post\.event\}\s+layout="list"\s+variant="detail"/)
  })

  it("the list-scale rows stay on the default feed variant", () => {
    for (const rel of ["../PostCard.tsx", "../thread/ThreadReplyRow.tsx"]) {
      expect(code(read(rel)), `${rel} must not opt a list row into the roster fetch`).not.toContain(
        'variant="detail"',
      )
    }
  })

  it("paints the card on the shared surface recipe and keeps no beige fill anywhere", () => {
    const card = SRC.slice(SRC.indexOf("  card: {"), SRC.indexOf("  cardStrip: {"))
    expect(card).toContain("backgroundColor: t.colors.surface")
    expect(card).toContain("borderColor: t.colors.border")
    expect(card).toContain("...t.shadows.s1")
    expect(card).toContain("borderRadius: t.radius.lg")
    expect(card).not.toContain("overflow")
    expect(SRC).not.toContain('backgroundColor: t.colors.sun')
    expect(SRC).not.toContain('borderColor: t.colors.sun')
  })
})

describe("Avatar", () => {
  const SRC = code(read("../../primitives/Avatar.tsx"))

  it("memoizes the monogram text style on size, so the Text child keeps its identity", () => {
    expect(SRC).toContain("const monogramStyle = useMemo<TextStyle>(")
    expect(SRC).toContain("[size]")
    expect(SRC).toContain("style={monogramStyle}")
  })

  it("renders the monogram UNDER the photo, so a loading avatar is never a blank disc", () => {
    const monogramAt = SRC.indexOf("{monogram(name)}")
    const imageAt = SRC.indexOf("<Image")
    expect(monogramAt).toBeGreaterThan(-1)
    expect(imageAt).toBeGreaterThan(monogramAt)
    expect(SRC).toContain("backgroundColor: color")
    expect(SRC).not.toContain("showPhoto ? theme.colors.neutral.paper2 : color")
  })
})

describe("Toast", () => {
  const SRC = code(read("../../primitives/Toast.tsx"))

  it("lets taps through everywhere but the card, which dismisses itself", () => {
    expect(SRC).toContain('<View style={styles.overlay} pointerEvents="box-none">')
    expect(SRC).not.toContain('pointerEvents="none"')
    expect(SRC).toContain("onPress={dismiss}")
  })

  it("paints one toast at a time, the outgoing one crossfading out", () => {
    expect(SRC).toContain("if (previous !== null) retire(previous)")
    expect(SRC).toContain("currentId.current = id")
  })
})

describe("MonthCalendarGrid re-reads today instead of freezing it at mount", () => {
  const SRC = code(read("../MonthCalendarGrid.tsx"))

  it("derives the past/future boundary per render", () => {
    expect(SRC).toContain("const today = startOfDay(new Date())")
    expect(SRC).not.toContain("useMemo(() => startOfDay(new Date()), [])")
  })
})

describe("ConversationBody surfaces the chat hook's transient error", () => {
  const SRC = code(read("../ConversationBody.tsx"))

  it("toasts once per distinct error instance, not per render, with code-aware copy", () => {
    expect(SRC).toContain("const transientError = chat.transientError")
    expect(SRC).toContain("toastedErrorRef.current === transientError")
    expect(SRC).toContain(
      'toast.show(t(transientErrorCopyKey(transientError.code)), { variant: "error" })',
    )
  })

  it("puts the current calendar day in the render-item memo key", () => {
    expect(SRC).toContain("const now = todayKey()")
    expect(SRC).toContain("[tDate, locale, now]")
    expect(SRC).toContain("buildRenderItems(chat.items, isGroup, dayLabels)")
  })
})

describe("the thumbnail contexts spend the 400px rendition, and the lightbox gets real dimensions", () => {
  it("ReportDetailBody's strip reads thumbUrl for images too, and passes width/height on", () => {
    const SRC = code(read("../ReportDetailBody.tsx"))
    expect(SRC).toContain("const thumbUri = m.thumbUrl ?? m.url")
    expect(SRC).not.toContain('m.kind === "video" ? (m.thumbUrl ?? m.url) : m.url')
    expect(SRC).toMatch(/thumbUrl: m\.thumbUrl \?\? null,\s*width: m\.width \?\? null,\s*height: m\.height \?\? null,/)
  })

  it("MessageBubble's 220pt attachment decodes the thumb, and its lightbox keeps full resolution", () => {
    const SRC = code(read("../conversation/MessageBubble.tsx"))
    expect(SRC).toContain("thumbUri={m.thumbUrl ?? null}")
    expect(SRC).toMatch(/thumbUrl: m\.thumbUrl \?\? null,\s*width: m\.width \?\? null,\s*height: m\.height \?\? null,/)
    expect(SRC).toContain("url: m.url")
  })
})
