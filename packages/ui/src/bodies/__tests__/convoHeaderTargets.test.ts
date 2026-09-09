/**
 * The conversation header's four drill-down guards (bodies/conversation/headerTargets.ts).
 *
 * The bug these encode: on mobile the conversation is an expo-router screen ABOVE the shell, so a
 * default `useNavStore.push` from the header paints the pushed body on the shell's page stack BEHIND
 * the chat - an invisible page and a dead-looking tap. `pinnedList` already guarded exactly this; the
 * other three (members / group-info / view-report) now make the same decision, so the invariant under
 * test is: fullScreen && no host handler => NO affordance.
 */
import { describe, expect, it } from "vitest"
import { convoHeaderTargetEnabled, convoHeaderTargets } from "../conversation/headerTargets"

const NO_HANDLERS = {
  hasOpenPinnedList: false,
  hasOpenMembers: false,
  hasOpenGroupInfo: false,
  hasViewReport: false,
} as const

describe("convoHeaderTargetEnabled", () => {
  it("an IN-SHELL mount offers the target with or without a host handler (the store push is correct there)", () => {
    expect(convoHeaderTargetEnabled({ fullScreen: false, hasHostHandler: false })).toBe(true)
    expect(convoHeaderTargetEnabled({ fullScreen: false, hasHostHandler: true })).toBe(true)
  })

  it("a fullScreen mount with NO handler shows nothing - the default push would land behind the screen", () => {
    expect(convoHeaderTargetEnabled({ fullScreen: true, hasHostHandler: false })).toBe(false)
  })

  it("a host handler re-enables the target on a fullScreen mount", () => {
    expect(convoHeaderTargetEnabled({ fullScreen: true, hasHostHandler: true })).toBe(true)
  })
})

describe("convoHeaderTargets", () => {
  it("in-shell: all four affordances are offered (no handlers needed)", () => {
    expect(convoHeaderTargets({ fullScreen: false, ...NO_HANDLERS })).toEqual({
      pinnedList: true,
      members: true,
      groupInfo: true,
      viewReport: true,
    })
  })

  it("fullScreen with no handlers: all four are suppressed (never a dead tap)", () => {
    expect(convoHeaderTargets({ fullScreen: true, ...NO_HANDLERS })).toEqual({
      pinnedList: false,
      members: false,
      groupInfo: false,
      viewReport: false,
    })
  })

  it("each target is decided INDEPENDENTLY - one handler never enables a sibling", () => {
    expect(
      convoHeaderTargets({ fullScreen: true, ...NO_HANDLERS, hasOpenMembers: true }),
    ).toEqual({ pinnedList: false, members: true, groupInfo: false, viewReport: false })
    expect(
      convoHeaderTargets({ fullScreen: true, ...NO_HANDLERS, hasOpenGroupInfo: true }),
    ).toEqual({ pinnedList: false, members: false, groupInfo: true, viewReport: false })
    expect(
      convoHeaderTargets({ fullScreen: true, ...NO_HANDLERS, hasViewReport: true }),
    ).toEqual({ pinnedList: false, members: false, groupInfo: false, viewReport: true })
    expect(
      convoHeaderTargets({ fullScreen: true, ...NO_HANDLERS, hasOpenPinnedList: true }),
    ).toEqual({ pinnedList: true, members: false, groupInfo: false, viewReport: false })
  })

  it("the mobile /messages/[id] shape: members + group-info wired, pins + view-report still hidden", () => {
    // Exactly what app/messages/[id].tsx passes after BUG 5: the two routes that now exist, and not the
    // two that do not (/pin/<id> is a DeepLinkHost that replace("/")s; there is no pinned-list screen).
    expect(
      convoHeaderTargets({
        fullScreen: true,
        hasOpenPinnedList: false,
        hasOpenMembers: true,
        hasOpenGroupInfo: true,
        hasViewReport: false,
      }),
    ).toEqual({ pinnedList: false, members: true, groupInfo: true, viewReport: false })
  })
})
