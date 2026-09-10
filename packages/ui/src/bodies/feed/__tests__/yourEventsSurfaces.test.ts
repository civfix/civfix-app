import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const read = (rel: string): string => readFileSync(new URL(rel, import.meta.url), "utf8")
const strip = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

const feed = strip(read("../../FeedBody.tsx"))
const section = strip(read("../YourEventsSection.tsx"))
const notifications = strip(read("../../NotificationsBody.tsx"))
const hooks = strip(read("../../../data/hooks/host.ts"))
const catalog = (lng: string): { your_events?: Record<string, string> } =>
  JSON.parse(read(`../../../i18n/locales/${lng}/home-feed.json`))

describe("the feed mounts the hosted-events section in its header", () => {
  it("renders it as a sibling of the title row, inside the one animated header", () => {
    expect(feed).toContain('import { YourEventsSection } from "./feed/YourEventsSection"')
    expect(feed).toMatch(/<\/View>\s*<YourEventsSection \/>\s*<\/Animated\.View>/)
  })

  it("refreshes the invite inbox with the feed, so pull-to-refresh reaches the section", () => {
    expect(feed).toContain(
      'import { invalidateMyEventInvites } from "../data/hooks/host"',
    )
    expect(feed).toContain("const queryClient = useQueryClient()")
    expect(feed).toMatch(/setRefreshing\(true\)\s*invalidateMyEventInvites\(queryClient\)/)
    expect(feed).toContain("}, [queryClient, refetch])")
  })

  it("keeps the header a single memo with no inline press handler", () => {
    expect(feed).toMatch(/const header = useMemo\(/)
    expect(feed).not.toMatch(/onPress=\{\(\) =>/)
  })

  it("passes the section no props, so the header memo gains no dependency", () => {
    expect(feed).not.toMatch(/<YourEventsSection\s+\w/)
  })
})

describe("YourEventsSection", () => {
  it("routes a hosted-event tap through the shared host-dashboard seam", () => {
    expect(section).toContain('import { openHostDashboard } from "../hostDashboardTarget"')
    expect(section).toContain("openHostDashboard({ eventId, openExternal })")
    expect(section).toContain("const openExternal: OpenExternalCapability | undefined = useOpenExternal()")
  })

  it("opens no dashboard on accept - the invite resolves in place", () => {
    const acceptBlock = section.slice(section.indexOf("const onAccept = useCallback("))
    expect(acceptBlock.slice(0, 200)).not.toContain("openHostDashboard")
  })

  it("reads the earliest-first hosted list and the invite inbox, both auth-gated hooks", () => {
    expect(section).toContain('useMyHostedEvents("upcoming")')
    expect(section).toContain("useMyEventInvites()")
    expect(section).toContain("hostedEventRows(hosted.data?.pages)")
    expect(section).toContain("myEventInviteRows(invitesQuery.data)")
  })

  it("lets the pure model own visibility, so a failed inbox is never swallowed", () => {
    expect(section).toContain("if (!model.visible) return null")
    expect(section).not.toContain("const settled =")
    expect(section).toContain("eventsPending: hosted.isPending")
    expect(section).toContain("invitesPending: invitesQuery.isPending")
    expect(section).toContain("invitesError: invitesQuery.isError")
  })

  it("offers a retry notice on a failed invite inbox rather than an empty header", () => {
    expect(section).toContain("model.inviteErrorVisible ? (")
    expect(section).toContain("<FeedNotice")
    expect(section).toContain('t("your_events.invites_error_title")')
    expect(section).toContain('t("your_events.invites_retry")')
    expect(section).toContain("onAction={retryInvites}")
    expect(section).toContain("const refetchInvites = invitesQuery.refetch")
  })

  it("asks for the whole invite inbox in ONE bounded page, so none is unreachable", () => {
    expect(hooks).toContain("export const MY_EVENT_INVITES_PAGE_SIZE = 50")
    expect(hooks).toContain("api.listMyEventInvites({ limit: MY_EVENT_INVITES_PAGE_SIZE })")
    expect(hooks).not.toContain("useInfiniteQuery<ListMyEventInvitesResponse>")
  })

  it("fetches the next hosted page when the reader expands, not just the loaded slice", () => {
    expect(section).toContain("const fetchMoreHosted = hosted.fetchNextPage")
    expect(section).toContain(
      "if (hostedHasNextPage && !hostedFetchingNextPage) void fetchMoreHosted()",
    )
  })

  it("draws the tier with the extracted chip, not a second private one", () => {
    expect(section).toContain('import { RoleChip } from "../RoleChip"')
    expect(section).not.toContain("function RoleChip(")
    expect(section).not.toContain("styles.roleChip")
  })

  it("decides what to draw in the pure model, not in the component body", () => {
    expect(section).toMatch(/buildYourEventsModel\(\{\s*isAuthenticated,\s*events,\s*invites,\s*expanded,/)
    expect(section).toContain("model.showMoreVisible")
    expect(section).toContain("model.showFewerVisible")
  })

  it("toasts a failed accept or decline instead of swallowing it", () => {
    expect(section).toContain('toast.show(t("your_events.action_error"), { variant: "error" })')
    expect(section).toContain("acceptMutate({ inviteId }, { onError: onMutationError })")
    expect(section).toContain("declineMutate({ inviteId }, { onError: onMutationError })")
  })

  it("marks the busy row from the MUTATION THAT IS RUNNING, not the last one that ran", () => {
    expect(section).toContain(
      "(accept.isPending ? accept.variables?.inviteId : undefined) ??",
    )
    expect(section).toContain(
      "(decline.isPending ? decline.variables?.inviteId : undefined) ??",
    )
    expect(section).not.toContain("accept.isPending || decline.isPending")
  })

  it("memoizes both rows and hands them stable callbacks", () => {
    expect(section).toContain("const HostedEventRow = memo(function HostedEventRow(")
    expect(section).toContain("const InviteRow = memo(function InviteRow(")
    expect(section).toContain("const press = useCallback(() => onPress(event.id), [onPress, event.id])")
  })

  it("labels the tier from the shared enums catalog, never from a local role map", () => {
    expect(section).toContain('const { t } = useT("enums")')
    expect(section).toContain("t(`cleanupMemberRole.${role}`)")
  })
})

describe("the section's copy", () => {
  it("ships every key in all four catalogs", () => {
    const keys = Object.keys(catalog("en").your_events ?? {})
    expect(keys.length).toBeGreaterThan(0)
    for (const lng of ["es", "de", "ko"]) {
      const block = catalog(lng).your_events ?? {}
      for (const key of keys) {
        if (key.endsWith("_one") && lng === "ko") continue
        expect(block[key], `${lng} is missing your_events.${key}`).toBeTruthy()
      }
    }
  })

  it("carries no orphaned pre-feed copy any more", () => {
    for (const lng of ["en", "es", "de", "ko"]) {
      const raw = JSON.parse(read(`../../../i18n/locales/${lng}/home-feed.json`)) as Record<
        string,
        unknown
      >
      expect(raw.your_feed, `${lng} still ships your_feed`).toBeUndefined()
      expect(raw.suggested, `${lng} still ships suggested`).toBeUndefined()
    }
  })
})

describe("a notification whose link is the home feed", () => {
  it("switches to the home view instead of doing nothing, and still marks the row read", () => {
    expect(notifications).toContain('import { useNavStore, entryFromPath, isRootLink } from "../nav"')
    expect(notifications).toContain("if (!item.read) mutateRead([item.id])")
    expect(notifications).toContain(
      'else if (isRootLink(item.link)) useNavStore.getState().selectView("home")',
    )
  })

  it("gives the event-team invite its own glyph in the row meta", () => {
    expect(notifications).toContain('case "event_team_invite":')
  })
})
