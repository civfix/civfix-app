/**
 * The bubble renderer (what a reader sees tinted) and the composer's submit-time filter (which mention
 * ids actually ship) must agree: a mention typed after punctuation is both tinted and sent, and
 * `bob@alex.com` tints nothing.
 */
import { describe, expect, it } from "vitest"
import { bodyMentionsHandle, mentionScanRegex } from "../conversation/mentionMatch"
import { escapeRegExp, normalizeHandle } from "../mentionText"

/** The renderer's tokenizer, reduced to the handles it would tint (in order). */
function scan(body: string, handles: string[]): string[] {
  const re = mentionScanRegex(handles)
  const out: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(body)) !== null) out.push(m[2]!)
  return out
}

describe("normalizeHandle", () => {
  it("strips a single leading @", () => {
    expect(normalizeHandle("@alex")).toBe("alex")
    expect(normalizeHandle("alex")).toBe("alex")
  })
})

describe("escapeRegExp", () => {
  it("escapes regex metacharacters", () => {
    expect(new RegExp(escapeRegExp("a.b+c")).test("a.b+c")).toBe(true)
    expect(new RegExp(escapeRegExp("a.b+c")).test("axbxc")).toBe(false)
  })
})

describe("bodyMentionsHandle", () => {
  it("matches at the start, after whitespace and after punctuation", () => {
    expect(bodyMentionsHandle("@alex hi", "alex")).toBe(true)
    expect(bodyMentionsHandle("hi @alex", "alex")).toBe(true)
    expect(bodyMentionsHandle("(@alex)", "alex")).toBe(true)
    expect(bodyMentionsHandle("hi,@alex", "alex")).toBe(true)
    expect(bodyMentionsHandle("hi\n@alex", "alex")).toBe(true)
  })

  it("does not match inside an email or a longer handle", () => {
    expect(bodyMentionsHandle("bob@alex.com", "alex")).toBe(false)
    expect(bodyMentionsHandle("hi @alexa", "alex")).toBe(false)
    expect(bodyMentionsHandle("hi @alex_b", "alex")).toBe(false)
  })

  it("accepts the handle with or without its leading @, and ignores an empty one", () => {
    expect(bodyMentionsHandle("hi @alex", "@alex")).toBe(true)
    expect(bodyMentionsHandle("hi @alex", "@")).toBe(false)
  })

  it("treats a handle with regex metacharacters literally instead of throwing", () => {
    expect(() => bodyMentionsHandle("hi @a+b", "a+b")).not.toThrow()
    expect(bodyMentionsHandle("hi @a+b", "a+b")).toBe(true)
    expect(bodyMentionsHandle("hi @aab", "a+b")).toBe(false)
  })
})

describe("mentionScanRegex", () => {
  it("tokenizes the same positions the submit filter accepts", () => {
    expect(scan("(@alex) and hi,@sam", ["alex", "sam"])).toEqual(["alex", "sam"])
  })

  it("skips a token with no left boundary (an email's domain)", () => {
    expect(scan("bob@alex.com", ["alex"])).toEqual([])
  })

  it("prefers the longest handle when one is a prefix of another", () => {
    expect(scan("hi @alexa", ["alex", "alexa"])).toEqual(["alexa"])
  })

  it("finds back-to-back mentions", () => {
    expect(scan("@alex @sam", ["alex", "sam"])).toEqual(["alex", "sam"])
  })

  it("agrees with bodyMentionsHandle on every case", () => {
    const bodies = ["@alex", "hi @alex", "(@alex)", "hi,@alex", "bob@alex.com", "hi @alexa", "nothing"]
    for (const body of bodies) {
      expect(scan(body, ["alex"]).length > 0).toBe(bodyMentionsHandle(body, "alex"))
    }
  })
})
