import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { surfaceSource } from "../../__tests__/sourceGuards"

const read = (relative: string): string => readFileSync(new URL(relative, import.meta.url), "utf8")

const code = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

const BADGED_BYLINES: ReadonlyArray<readonly [string, string, number]> = [
  ["../PostCard.tsx", "identity", 1],
  ["../EmbeddedPost.tsx", "identity", 1],
  ["../thread/ThreadReplyRow.tsx", "identity", 1],
  ["../thread/ThreadFocalPost.tsx", "identity", 1],
  ["../conversation/ChatLinkEmbeds.tsx", "identity", 1],
  ["../conversation/ChatLinkEmbeds.tsx", "profile", 1],
  ["../RosterRow.tsx", "person", 1],
  ["../ConnectionsBody.tsx", "person", 1],
]

const count = (source: string, needle: string): number => source.split(needle).length - 1

describe("the official account's check renders wherever a name renders with a badge", () => {
  it.each(BADGED_BYLINES)("%s puts the check next to %s's name", (file, subject, sites) => {
    const src = code(read(file))
    expect(src).toMatch(/import \{[^}]*\bVerifiedBadge\b[^}]*\} from "[./]+primitives(\/VerifiedBadge)?"/)
    expect(count(src, `{${subject}.official ? <VerifiedBadge size="sm" /> : null}`)).toBe(sites)
  })

  it("the chat bubble badges the sender name from the server flag", () => {
    const src = code(read("../conversation/MessageBubble.tsx"))
    expect(src).toMatch(/if \(!from\.official\) return name/)
    expect(src).toMatch(/<View style=\{styles\.whoRow\}>\s*\{name\}\s*<VerifiedBadge size="sm" \/>\s*<\/View>/)
  })

  it("the profile header badges the name from the server flag", () => {
    const src = code(surfaceSource("personDetail"))
    expect(src).toContain('{profile.official ? <VerifiedBadge size="md" /> : null}')
  })

  it("never keys the mark on a handle, display name or id literal", () => {
    const sources: ReadonlyArray<readonly [string, string]> = [
      ...[...BADGED_BYLINES.map(([f]) => f), "../conversation/MessageBubble.tsx"].map(
        (f) => [f, read(f)] as const,
      ),
      ["../PersonDetailBody.tsx", surfaceSource("personDetail")],
    ]
    for (const [file, source] of sources) {
      const src = code(source)
      expect(src, file).not.toMatch(/["'`]@?civfix["'`]/i)
      expect(src, file).not.toMatch(/00000000-0000-4000-8000-/)
    }
  })
})

describe("block is never offered against the official account", () => {
  it("the chat bubble derives blockability from isBlockableAuthor", () => {
    const src = code(read("../conversation/MessageBubble.tsx"))
    expect(src).toContain("authorBlockable: isBlockableAuthor(from),")
  })

  it("the profile menu drops Block for the official account but keeps Report and Unblock", () => {
    const src = code(surfaceSource("personDetail"))
    expect(src).toMatch(
      /profile\.blockedByMe\s*\?\s*\[unblockMenuItem, reportMenuItem\]\s*:\s*profile\.official\s*\?\s*\[reportMenuItem\]\s*:\s*\[blockMenuItem, reportMenuItem\]/,
    )
  })
})
