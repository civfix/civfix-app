import { describe, expect, it } from "vitest"
import { invalidationKeysForTopic } from "../signals"
import { queryKeys } from "../keys"

describe("invalidationKeysForTopic('host')", () => {
  it("scopes to the one event the frame names", () => {
    expect(invalidationKeysForTopic("host", undefined, "e1")).toEqual([queryKeys.hostEvent("e1")])
  })

  it("falls back to the whole host family when the frame carries no id", () => {
    expect(invalidationKeysForTopic("host")).toEqual([["host"]])
  })

  it("covers counters, roster, ticket types, questions, team and waitlist by PREFIX", () => {
    const prefix = queryKeys.hostEvent("e1")
    const children = [
      queryKeys.hostCounters("e1"),
      queryKeys.hostRoster("e1", "all", ""),
      queryKeys.hostTicketTypes("e1"),
      queryKeys.hostQuestions("e1"),
      queryKeys.hostTeam("e1"),
      queryKeys.hostWaitlist("e1"),
    ]
    for (const child of children) {
      expect(child.slice(0, prefix.length), child.join("/")).toEqual([...prefix])
    }
  })

  it("keeps ANOTHER event's host caches out of the prefix", () => {
    const prefix = queryKeys.hostEvent("e1")
    const other = queryKeys.hostCounters("e2")
    expect(other.slice(0, prefix.length)).not.toEqual([...prefix])
  })

  it("keeps a seat TICKET out of the host prefix - its token must never be persisted", () => {
    const ticket = queryKeys.myTickets("e1")
    expect(ticket[0]).toBe("tickets")
    expect(ticket[0]).not.toBe("host")
  })

  it("leaves the existing topics exactly as they were", () => {
    expect(invalidationKeysForTopic("notifications")).toEqual([queryKeys.notificationsRoot])
    expect(invalidationKeysForTopic("threads")).toEqual([queryKeys.threads])
    expect(invalidationKeysForTopic("reports")).toEqual([queryKeys.myReportsRoot])
  })
})
