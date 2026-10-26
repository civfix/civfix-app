import * as React from "react"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen } from "@testing-library/react"
import type * as ReactNative from "react-native"
import type { LegalBlock } from "@civfix/contract"
import { CapabilitiesProvider, makeFakeCapabilities } from "../../capabilities"
import { I18nProvider } from "../../i18n"
import { ThemeProvider, themeFor } from "../../theme"
import { LegalDocumentView } from "../LegalDocumentView"
import { readableLegalDocument, type ReadableLegalDocument } from "../legalDocument"
import { legalDoc } from "./legalDocumentFixtures"

vi.mock("../../typography", async () => {
  const RN = await vi.importActual<typeof ReactNative>("react-native")
  return { Text: RN.Text, Icon: () => null, iconMap: new Proxy({}, { get: () => "icon" }) }
})

const VIEW_SOURCE = readFileSync(join(__dirname, "..", "LegalDocumentView.tsx"), "utf8")

const open = vi.fn(async (_url: string) => {})
const assign = vi.fn()

function terms(blocks: LegalBlock[], overrides: Partial<ReadableLegalDocument> = {}): ReadableLegalDocument {
  const document = readableLegalDocument(legalDoc("terms", "2026-10-30", { blocks, ...overrides }))
  if (document === null) throw new Error("fixture is not readable")
  return document
}

function show(
  document: ReadableLegalDocument,
  { current = true, scheme = "light" }: { current?: boolean; scheme?: "light" | "dark" } = {},
) {
  const capabilities = { ...makeFakeCapabilities(), openExternal: { open } }
  return render(
    <ThemeProvider preference={scheme}>
      <CapabilitiesProvider value={capabilities}>
        <I18nProvider locale="en">
          <LegalDocumentView document={document} current={current} />
        </I18nProvider>
      </CapabilitiesProvider>
    </ThemeProvider>,
  )
}

const paragraph = (text: string): LegalBlock => ({ kind: "paragraph", text })

// react-native-web reports onLayout through one ResizeObserver it creates on first use, measuring the
// node's offsetWidth; the table tests lay the scroll view out at a width of their choosing.
const layout = { notify: null as ((entries: { target: Element }[]) => void) | null, widths: new Map<Element, number>() }

class FakeResizeObserver {
  constructor(callback: (entries: { target: Element }[]) => void) {
    layout.notify = callback
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeAll(() => {
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(function (this: HTMLElement) {
    return layout.widths.get(this) ?? 0
  })
})

afterAll(() => {
  vi.restoreAllMocks()
})

beforeEach(() => {
  open.mockClear()
  assign.mockClear()
  layout.widths.clear()
  vi.stubGlobal("location", { origin: "https://civfix.test", assign })
  vi.stubGlobal("ResizeObserver", FakeResizeObserver)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("LegalDocumentView", () => {
  it("T5: shows the title, then the version and effective date, and no earlier-version line", () => {
    show(terms([paragraph("Body.")], { title: "Terms of Service", effectiveAt: "2026-10-30T00:00:00.000Z" }))
    const title = screen.getByText("Terms of Service")
    const meta = screen.getByText("Version 2026-10-30 · effective October 30, 2026")
    expect(title.compareDocumentPosition(meta) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.queryByText(/This is an earlier version/)).toBeNull()
  })

  it("T6: renders level 2 and level 3 headings with their aria-level", () => {
    show(
      terms([
        { kind: "heading", level: 2, text: "1. Who we are" },
        { kind: "heading", level: 3, text: "1.1 Contact" },
      ]),
    )
    const two = screen.getByRole("heading", { name: "1. Who we are" })
    const three = screen.getByRole("heading", { name: "1.1 Contact" })
    expect(two.getAttribute("aria-level")).toBe("2")
    expect(three.getAttribute("aria-level")).toBe("3")
  })

  it("T7: one paragraph with bold, italic and a link that opens the browser", () => {
    show(terms([paragraph("a **b** *c* [d](https://example.org/x)")]))
    const bold = screen.getByText("b")
    const italic = screen.getByText("c")
    const block = bold.parentElement
    expect(block?.textContent).toBe("a b c d")
    expect(block?.contains(italic)).toBe(true)
    expect(getComputedStyle(bold).fontFamily).toContain(themeFor("light").fontFamily.bodyBold)
    expect(getComputedStyle(italic).fontStyle).toBe("italic")
    const link = screen.getByRole("link", { name: "d" })
    fireEvent.click(link)
    expect(open).toHaveBeenCalledWith("https://example.org/x")
    expect(assign).not.toHaveBeenCalled()
  })

  it("T8: numbers an ordered list, bullets an unordered one, and parses each item inline", () => {
    show(
      terms([
        { kind: "list", ordered: true, items: ["one", "two"] },
        { kind: "list", ordered: false, items: ["**three**", "four"] },
      ]),
    )
    expect(screen.getByText("1.")).toBeTruthy()
    expect(screen.getByText("2.")).toBeTruthy()
    expect(screen.getAllByText("•")).toHaveLength(2)
    expect(getComputedStyle(screen.getByText("three")).fontFamily).toContain(
      themeFor("light").fontFamily.bodyBold,
    )
    expect(screen.queryByText("**three**")).toBeNull()
  })

  it("T9: a header row and one body row, inside a horizontal ScrollView", () => {
    show(terms([{ kind: "table", columns: ["Name", "Purpose"], rows: [["Cloudflare", "CDN"]] }]))
    const table = screen.getByRole("table")
    const rows = Array.from(table.querySelectorAll('[role="row"]'))
    expect(rows).toHaveLength(2)
    expect(Array.from(rows[0]!.querySelectorAll('[role="columnheader"]')).map((cell) => cell.textContent)).toEqual([
      "Name",
      "Purpose",
    ])
    expect(Array.from(rows[1]!.querySelectorAll('[role="cell"]')).map((cell) => cell.textContent)).toEqual([
      "Cloudflare",
      "CDN",
    ])
    let scroller: HTMLElement | null = table.parentElement
    while (scroller !== null && !["auto", "scroll"].includes(getComputedStyle(scroller).overflowX)) {
      scroller = scroller.parentElement
    }
    expect(scroller).not.toBeNull()
  })

  it("T10: an unsafe or plain-http link renders as its label, not a link", () => {
    show(terms([paragraph("[x](javascript:alert(1))"), paragraph("[y](http://example.org)")]))
    expect(screen.queryByRole("link")).toBeNull()
    fireEvent.click(screen.getByText("x"))
    fireEvent.click(screen.getByText("y"))
    expect(open).not.toHaveBeenCalled()
    expect(assign).not.toHaveBeenCalled()
  })

  it("T11: an earlier version says so, with its date, above the blocks", () => {
    show(terms([paragraph("Old body.")], { version: "2026-09-21", effectiveAt: "2026-09-21T00:00:00.000Z" }), {
      current: false,
    })
    const line = screen.getByText("This is an earlier version, from September 21, 2026.")
    const body = screen.getByText("Old body.")
    expect(line.compareDocumentPosition(body) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it("T12: takes every color from the theme, so dark differs from light", () => {
    expect(VIEW_SOURCE).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/)

    const document = terms([paragraph("Body.")])
    const light = show(document, { scheme: "light" })
    const colors = () => [
      getComputedStyle(screen.getByText("Terms of Service")).color,
      getComputedStyle(screen.getByText("Body.")).color,
    ]
    const lightColors = colors()
    light.unmount()
    show(document, { scheme: "dark" })
    const darkColors = colors()
    expect(darkColors[0]).not.toBe(lightColors[0])
    expect(darkColors[1]).not.toBe(lightColors[1])
  })

  it("T14: on web a civfix.org legal link goes to the site's own page in the same tab", () => {
    show(terms([paragraph("[Cookies](https://civfix.org/legal/cookies)")]))
    fireEvent.click(screen.getByRole("link", { name: "Cookies" }))
    expect(assign).toHaveBeenCalledWith("/legal/cookies/")
    expect(open).not.toHaveBeenCalled()
  })

  it.each(["https://civfix.org/legal/unknown", "https://civfix.org/about", "https://example.org/legal/terms"])(
    "T14: on web %s opens in the browser",
    (href) => {
      show(terms([paragraph(`[Elsewhere](${href})`)]))
      fireEvent.click(screen.getByRole("link", { name: "Elsewhere" }))
      expect(open).toHaveBeenCalledWith(href)
      expect(assign).not.toHaveBeenCalled()
    },
  )

  describe("table widths", () => {
    const FOUR_COLUMNS: LegalBlock = {
      kind: "table",
      columns: ["Sub-processor", "Purpose", "Data", "Location"],
      rows: [["Cloudflare", "CDN and edge security for every request", "IP address, request metadata", "Global"]],
    }

    function tableParts() {
      const table = screen.getByRole("table")
      let scroller: HTMLElement | null = table.parentElement
      while (scroller !== null && !["auto", "scroll"].includes(getComputedStyle(scroller).overflowX)) {
        scroller = scroller.parentElement
      }
      if (scroller === null) throw new Error("the table has no horizontal scroll view")
      const cells = Array.from(table.querySelectorAll<HTMLElement>('[role="columnheader"], [role="cell"]'))
      return { table, scroller, cells }
    }

    async function layOut(node: HTMLElement, width: number) {
      layout.widths.set(node, width)
      await act(async () => {
        layout.notify?.([{ target: node }])
        // rnw measures on a timer before it calls onLayout.
        await new Promise((resolve) => setTimeout(resolve, 0))
      })
    }

    const widthOf = (element: HTMLElement) => getComputedStyle(element).width

    it("T37: two columns in a 718 wide scroll view fill its 716 inner width, 358 each, without shrinking", async () => {
      show(terms([{ kind: "table", columns: ["Name", "Purpose"], rows: [["Cloudflare", "CDN"]] }]))
      const { table, scroller, cells } = tableParts()
      await layOut(scroller, 718)
      expect(widthOf(table)).toBe("716px")
      expect(cells).toHaveLength(4)
      for (const cell of cells) {
        expect(widthOf(cell)).toBe("358px")
        expect(getComputedStyle(cell).flexShrink).toBe("0")
      }
    })

    it("T38: four columns in a 718 wide scroll view all fit, 179 each", async () => {
      show(terms([FOUR_COLUMNS]))
      const { table, scroller, cells } = tableParts()
      await layOut(scroller, 718)
      expect(widthOf(table)).toBe("716px")
      expect(cells).toHaveLength(8)
      for (const cell of cells) expect(widthOf(cell)).toBe("179px")
    })

    it("T39: four columns in a 348 wide scroll view keep their 176 minimum and scroll sideways", async () => {
      show(terms([FOUR_COLUMNS]))
      const { table, scroller, cells } = tableParts()
      await layOut(scroller, 348)
      expect(widthOf(table)).toBe("704px")
      for (const cell of cells) expect(widthOf(cell)).toBe("176px")
    })

    it("T40: before the scroll view lays out, four columns are 176 each", () => {
      show(terms([FOUR_COLUMNS]))
      const { table, cells } = tableParts()
      expect(widthOf(table)).toBe("704px")
      for (const cell of cells) expect(widthOf(cell)).toBe("176px")
    })

    it("T41: no header or body cell clamps its lines or keeps its text on one line", () => {
      show(terms([FOUR_COLUMNS]))
      const { cells } = tableParts()
      for (const cell of cells) {
        const style = getComputedStyle(cell)
        expect(style.whiteSpace).not.toBe("nowrap")
        expect(style.getPropertyValue("-webkit-line-clamp")).toBe("")
      }
    })
  })
})
