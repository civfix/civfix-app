import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const read = (relative: string): string => readFileSync(new URL(relative, import.meta.url), "utf8")

const code = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

describe("the post composers guard against a double submit", () => {
  const COMPOSERS = {
    "PostComposer.tsx": code(read("../PostComposer.tsx")),
    "thread/ReplyComposer.tsx": code(read("../thread/ReplyComposer.tsx")),
  }

  for (const [name, source] of Object.entries(COMPOSERS)) {
    it(`${name} claims the submit synchronously and releases it on settle`, () => {
      expect(source).toMatch(/submittingRef = (React\.)?useRef\(false\)/)
      expect(source).toMatch(/if \(submittingRef\.current\) return/)
      expect(source).toMatch(/submittingRef\.current = true/)
      expect(source).toMatch(/onSettled: \(\) => \{\s*submittingRef\.current = false\s*\}/)
    })

    it(`${name} checks the ref before it does any work`, () => {
      const check = source.indexOf("if (submittingRef.current) return")
      const claim = source.indexOf("submittingRef.current = true")
      const mutate = source.search(/create\.mutate\(/)
      expect(check).toBeGreaterThan(-1)
      expect(claim).toBeGreaterThan(check)
      expect(mutate).toBeGreaterThan(claim)
    })
  }
})

describe("PostComposer subscribes to the nav store by selector", () => {
  const source = code(read("../PostComposer.tsx"))

  it("takes only back, never the whole store", () => {
    expect(source).toMatch(/const back = useNavStore\(\(state\) => state\.back\)/)
    expect(source).not.toMatch(/=\s*useNavStore\(\)/)
  })
})

describe("PostOverflowMenu mounts on demand", () => {
  const source = code(read("../PostOverflowMenu.tsx"))

  it("renders nothing until the menu (or something it started) is live", () => {
    expect(source).toMatch(/const active = props\.visible \|\| reportOpen \|\| busy/)
    expect(source).toMatch(/if \(!active && !retained\) return null/)
  })

  it("keeps every subscription inside the on-demand half", () => {
    const gateAt = source.indexOf("export function PostOverflowMenu(")
    const contentAt = source.indexOf("function PostOverflowMenuContent(")
    expect(gateAt).toBeGreaterThan(-1)
    expect(contentAt).toBeGreaterThan(gateAt)
    const gate = source.slice(gateAt, contentAt)
    for (const hook of ["useAuthState", "useMyProfile", "useDeletePost", "useToast", "useClipboard", "useReportContent", "useT"]) {
      expect(gate, `${hook} runs in the always-mounted gate`).not.toMatch(new RegExp(`${hook}\\(`))
    }
  })

  it("confirms the delete IN the menu, never in an Alert that outlives it", () => {
    // A native Alert fired from a PopoverMenu row survives the popover (PopoverMenu closes itself BEFORE
    // running onPress), so it could sit over a scrolled-away, unmounted row. The confirm is a second menu
    // step instead - the RosterRow pattern - which cannot outlive the surface that owns it.
    expect(source).not.toMatch(/\bAlert\b/)
    expect(source).toMatch(/onPress: \(\) => onConfirmingDeleteChange\(true\)/)
    expect(source).toMatch(/key: "confirm-delete"/)
    expect(source).toMatch(/visible=\{visible && !confirmingDelete\}/)
    expect(source).toMatch(/visible=\{confirmingDelete\}/)
  })

  it("stays mounted while the delete mutation is outstanding", () => {
    // The confirm menu closes the moment the row fires, so without the busy flag the 400ms retention
    // timer would unmount this subtree mid-request and drop the success/failure toast.
    expect(source).toMatch(/const active = props\.visible \|\| reportOpen \|\| busy \|\| confirmingDelete/)
    expect(source).toMatch(/onBusyChange\(true\)\s*\n\s*del\.mutate\(post\.id/)
    expect(source).toMatch(/onSettled: \(\) => onBusyChange\(false\)/)
  })
})
