/**
 * Surfaces a refactor campaign changed by accident and that were put back as they shipped: the static
 * People and service-hours loading rows, the cluster list's raw address line, and the chat transcript's
 * empty state standing upright in its inverted list.
 */
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const read = (rel: string): string => readFileSync(new URL(rel, import.meta.url), "utf8")

describe("People list loading rows", () => {
  const social = read("../SocialBody.tsx")

  it("draws three still rows with separators rather than the pulsing announced skeleton", () => {
    expect(social).not.toContain("<LoadingState")
    expect(social.match(/<RowSkeleton \/>/g)).toHaveLength(3)
    expect(social.match(/<PeopleSkeleton \/>/g)).toHaveLength(2)
    expect(social).toMatch(/function RowSkeleton\(\) \{[\s\S]*?<View style=\{styles\.row\}>/)
  })
})

describe("service-hours ledger loading rows", () => {
  const hours = read("../profile/ServiceHoursSection.tsx")

  it("keeps the ledger skeleton still", () => {
    expect(hours).not.toContain("SkeletonGroup")
    expect(hours).not.toContain("SkeletonBlock")
    expect(hours).toContain("<View style={styles.skeletonChip} />")
  })
})

describe("cluster report rows", () => {
  const cluster = read("../ClusterReportsBody.tsx")

  it("shows the report's address as sent, else the pin description", () => {
    expect(cluster).toContain(
      "subtitle={report ? (report.addr ?? pin.description ?? null) : (pin.description ?? null)}",
    )
  })
})

describe("chat transcript empty state", () => {
  const conversation = read("../ConversationBody.tsx")

  it("hands the inverted list's flip-back style and layout handler to both empty views", () => {
    expect(
      conversation.match(/<View style=\{\[styles\.center, style\]\} onLayout=\{onLayout\}>/g),
    ).toHaveLength(2)
    expect(conversation).toContain(
      "ListEmptyComponent={<TranscriptEmpty pinnedOnly={pinnedOnly} isGroup={isGroup} />}",
    )
  })
})
