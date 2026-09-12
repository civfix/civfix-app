import { readdirSync, readFileSync } from "node:fs"
import { basename, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const PRUNED = new Set([
  "node_modules",
  "__tests__",
  "ios",
  "android",
  ".expo",
  "dist",
  "dist-types",
  "out",
  ".next",
])
const ROOTS = [
  fileURLToPath(new URL("../../", import.meta.url)),
  fileURLToPath(new URL("../../../../../apps/community-mobile/", import.meta.url)),
]

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (PRUNED.has(entry.name)) return []
    const full = join(dir, entry.name)
    if (entry.isDirectory()) return walk(full)
    return entry.isFile() && /\.tsx?$/.test(entry.name) ? [full] : []
  })

const FILES = ROOTS.flatMap(walk).map((file) => ({ file, src: readFileSync(file, "utf8") }))

function reactNativeSpecifiers(src: string): string[] {
  const out: string[] = []
  for (const match of src.matchAll(/import\s*\{([^}]*)\}\s*from\s*"react-native"/g)) {
    for (const raw of (match[1] ?? "").split(",")) {
      const spec = raw.trim()
      if (spec) out.push(spec)
    }
  }
  return out
}

const importsValue = (src: string, name: string) =>
  reactNativeSpecifiers(src).some(
    (spec) => !spec.startsWith("type ") && (spec === name || spec.startsWith(`${name} as `)),
  )

const REACT_NATIVE_IMPORT = /import\s+([^"';]*?)\s+from\s*"react-native"/g

const importsWholeModule = (src: string) =>
  [...src.matchAll(REACT_NATIVE_IMPORT)].some(
    (match) =>
      !(match[1] ?? "")
        .replace(/^type\s+/, "")
        .trim()
        .startsWith("{"),
  )

const named = (predicate: (entry: { file: string; src: string }) => boolean) =>
  FILES.filter(predicate)
    .map((entry) => basename(entry.file))
    .sort()

describe("I0 react-native is only ever imported through named specifiers", () => {
  it("leaves no namespace or default binding for the specifier parse to miss", () => {
    expect(named(({ src }) => importsWholeModule(src))).toEqual([])
  })
})

describe("I1 the Android reserve has exactly four owners", () => {
  it("names them", () => {
    expect(named(({ src }) => /(?<!function\s)\buseKeyboardReserve\s*\(/.test(src))).toEqual([
      "ConversationBody.tsx",
      "KeyboardPinnedFooter.tsx",
      "ModalCardSheet.tsx",
      "PageStack.native.tsx",
    ])
  })

  it("keeps the pinned footers on the primitive instead of the raw hook", () => {
    for (const rel of [
      "../../bodies/NewGroupBody.tsx",
      "../../bodies/NewChannelBody.tsx",
      "../../bodies/ReportFlowBody.tsx",
    ]) {
      const src = readFileSync(new URL(rel, import.meta.url), "utf8")
      expect(src, rel).not.toMatch(/useKeyboardReserve/)
      expect(src, rel).toMatch(/<KeyboardPinnedFooter style=\{styles\.footer\}>/)
    }
  })

  it("counts one pinned footer per wizard branch", () => {
    const footers = (rel: string) =>
      readFileSync(new URL(rel, import.meta.url), "utf8").match(
        /<KeyboardPinnedFooter style=\{styles\.footer\}>/g,
      )?.length ?? 0
    expect(footers("../../bodies/NewGroupBody.tsx")).toBe(2)
    expect(footers("../../bodies/NewChannelBody.tsx")).toBe(3)
    expect(footers("../../bodies/ReportFlowBody.tsx")).toBe(1)
  })

  it("lets a lifted footer tell the scroll seams the space is already reserved", () => {
    const footer = readFileSync(
      new URL("../../primitives/KeyboardPinnedFooter.tsx", import.meta.url),
      "utf8",
    )
    expect(footer).toMatch(/const lifts = pageActive && Platform\.OS !== "ios"/)
    expect(footer).toMatch(/return keyboardHostReserveStore\.claim\(\)/)
    for (const rel of ["../KeyboardAwareScroll.native.tsx", "../KeyboardAwareScroll.web.tsx"]) {
      expect(readFileSync(new URL(rel, import.meta.url), "utf8"), rel).toMatch(
        /keyboardHostReserve/,
      )
    }
  })
})

describe("I2 KeyboardAvoidingView lives in ONE file", () => {
  it("is imported only by the iOS-only seam", () => {
    expect(named(({ src }) => importsValue(src, "KeyboardAvoidingView"))).toEqual([
      "IosKeyboardAvoidingView.native.tsx",
    ])
  })

  it("gives that seam the iOS-only behavior and the web sibling a plain View", () => {
    const native = readFileSync(new URL("../IosKeyboardAvoidingView.native.tsx", import.meta.url), "utf8")
    expect(native).toMatch(/behavior=\{Platform\.OS === "ios" \? "padding" : undefined\}/)
    const web = readFileSync(new URL("../IosKeyboardAvoidingView.web.tsx", import.meta.url), "utf8")
    expect(web).toMatch(/<View style=\{style\}>\{children\}<\/View>/)
  })
})

describe("I3 every text field is the primitive that registers its focus", () => {
  it("keeps the raw react-native TextInput to the allowlist", () => {
    expect(named(({ src }) => importsValue(src, "TextInput"))).toEqual([
      "SearchHeader.web.tsx",
      "TabBar.native.tsx",
      "TextInput.native.tsx",
      "TextInput.web.tsx",
    ])
  })

  it("registers focus, blur and content growth with the scope it renders in", () => {
    const native = readFileSync(new URL("../../primitives/TextInput.native.tsx", import.meta.url), "utf8")
    expect(native).toMatch(/const scope = useKeyboardScrollScope\(\)/)
    expect(native).toMatch(
      /keyboardFocusStore\.setFocused\(nodeRef\.current, scope, revealGroup\?\.current \?\? null\)/,
    )
    expect(native).toMatch(/keyboardFocusStore\.clearFocused\(nodeRef\.current\)/)
    expect(native).toMatch(/if \(focusedRef\.current\) keyboardFocusStore\.bump\(\)/)
  })

  it("clears its registration from a node the ref teardown cannot null", () => {
    const native = readFileSync(new URL("../../primitives/TextInput.native.tsx", import.meta.url), "utf8")
    expect(native).toMatch(/registeredRef\.current = nodeRef\.current/)
    expect(native).toMatch(
      /\(\) => \(\) => \{\s*\n\s*keyboardFocusStore\.clearFocused\(registeredRef\.current\)\s*\n\s*\},/,
    )
  })
})

describe("I4 a raw Modal never holds a text field", () => {
  const ALLOWED = new Set(["ModalCardSheet.tsx", "PortraitMapPickStep.native.tsx"])
  const FIELD = /TextInput|TextField|MemberPicker|GroupIdentityFields|SegmentedCodeInput/

  it.each(
    FILES.filter(({ file, src }) => importsValue(src, "Modal") && !ALLOWED.has(basename(file))).map(
      (entry) => [basename(entry.file), entry.src] as const,
    ),
  )("%s holds no field of its own", (_name, src) => {
    expect(src).not.toMatch(FIELD)
  })

  it("leaves the dialogs that DO hold fields on the shared sheet", () => {
    for (const rel of ["../../bodies/GroupInfoBody.tsx", "../../bodies/DeleteAccountModal.tsx"]) {
      const src = readFileSync(new URL(rel, import.meta.url), "utf8")
      expect(importsValue(src, "Modal"), rel).toBe(false)
      expect(src, rel).toMatch(/<ModalCardSheet/)
    }
  })

  it("gives the member picker a scroll host of its own through the sheet's fill mode", () => {
    const sheet = readFileSync(new URL("../../primitives/ModalCardSheet.tsx", import.meta.url), "utf8")
    expect(sheet).toMatch(
      /const MODAL_SCROLL_HOST = makeKeyboardAwareScrollHost\(PLAIN_SCROLL_HOST, \{\s*\n\s*reserveKeyboardPadding: false,\s*\n\}\)/,
    )
    expect(sheet).toMatch(/<ScrollHostProvider value=\{MODAL_SCROLL_HOST\}>\{children\}<\/ScrollHostProvider>/)
  })
})

describe("I5 no scroller outside the shell is left undecorated", () => {
  const OUTSIDE = FILES.filter(({ file }) => !file.includes("/shell/"))

  it.each(
    OUTSIDE.filter(({ src }) => src.includes("PLAIN_SCROLL_HOST")).map(
      (entry) => [basename(entry.file), entry.src] as const,
    ),
  )("%s only ever hands the plain host to the keyboard-aware decorator", (_name, src) => {
    const body = src
      .split("\n")
      .filter(
        (line) =>
          !/^\s*(import|export)\b/.test(line) && !/^\s*PLAIN_SCROLL_HOST,\s*$/.test(line),
      )
      .join("\n")
    for (const match of body.matchAll(/PLAIN_SCROLL_HOST/g)) {
      expect(body.slice(0, match.index)).toMatch(/makeKeyboardAwareScrollHost\($/)
    }
  })

  it("decorates the FlatList as well as the ScrollView, so a list header field is owned too", () => {
    const seam = readFileSync(new URL("../KeyboardAwareScroll.native.tsx", import.meta.url), "utf8")
    expect(seam).toMatch(
      /ScrollView: makeKeyboardAwareScrollable\(base\.ScrollView, options, SCROLL_VIEW\),\s*\n\s*FlatList: makeKeyboardAwareScrollable\(base\.FlatList, options, FLAT_LIST\),/,
    )
    expect(seam).toMatch(/<KeyboardScrollScopeProvider value=\{scopeId\}>\{scrollable\}/)
  })

  it("leaves a HORIZONTAL list undecorated, the way the minimize seam does", () => {
    const seam = readFileSync(new URL("../KeyboardAwareScroll.native.tsx", import.meta.url), "utf8")
    expect(seam).toMatch(/if \(horizontal\) return scrollable/)
    expect(seam.match(/useEffect\(\(\) => \{\s*\n\s*if \(horizontal\) return\s*\n/g)).toHaveLength(2)
    expect(seam).toMatch(/if \(horizontal\) return contentContainerStyle/)
  })
})

describe("I6 the composer carve-out is matched by a reserve on BOTH page stacks", () => {
  const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8")

  it("carves the plain host out of the portrait overlay only for the composer", () => {
    const portrait = read("../PortraitShell.shared.tsx")
    expect(portrait).toMatch(
      /const overlayScrollHost = frame\.overlay\.keyboardAvoidance\s*\n?\s*\? PLAIN_SCROLL_HOST\s*\n?\s*: PORTRAIT_SCROLL_HOST/,
    )
    expect(read("../bodyLayout.ts")).toMatch(/surfaceKeyboardAvoidance: active\?\.kind === "composer"/)
  })

  it("reserves for it on web with the visual-viewport inset", () => {
    expect(read("../PageStack.web.tsx")).toMatch(
      /<IosKeyboardAvoidingView style=\{\[styles\.hostContent, webKeyboardInset\]\} enabled=\{keyboardAvoidance\}>/,
    )
  })

  it("reserves for it on Android with the layer's own keyboard reserve", () => {
    const native = read("../PageStack.native.tsx")
    expect(native).toMatch(
      /const keyboardReserve = useKeyboardReserve\(\{ enabled: keyboardAvoidance && active \}\)/,
    )
    expect(native).toMatch(/paddingBottom: paddingBottom \+ keyboardReserve/)
  })
})
