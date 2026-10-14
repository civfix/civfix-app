import * as React from "react"
import { afterEach, describe, expect, it } from "vitest"
import { cleanup, render } from "@testing-library/react"
import { parseMarkdownSubset } from "@civfix/shared/markdown"

import { Markdown, renderMarkdownNodes } from "./markdown-dom"

const SOURCE = "Hello **bold** and *soft* [site](https://civfix.org)\n\n- one\n- two\n\n1. first"

afterEach(cleanup)

describe("markdown-dom", () => {
  it("renders the public prose surface as bare elements styled by its container", () => {
    const { container } = render(<Markdown source={SOURCE} />)
    const root = container.firstElementChild!
    expect(root.className).toBe("signup-prose")
    expect(Array.from(root.children).map((el) => el.tagName)).toEqual(["P", "UL", "OL"])
    expect(root.querySelectorAll("[class]")).toHaveLength(0)
    const link = root.querySelector("a")!
    expect(link.getAttribute("href")).toBe("https://civfix.org")
    expect(link.getAttribute("rel")).toBe("noreferrer noopener nofollow")
    expect(link.getAttribute("target")).toBe("_blank")
  })

  it("applies a caller's per-element classes", () => {
    const { container } = render(
      <div>
        {renderMarkdownNodes(parseMarkdownSubset(SOURCE), {
          paragraph: "p",
          listItem: "li",
          orderedList: "ol",
          unorderedList: "ul",
          strong: "b",
          em: "i",
          link: "a",
        })}
      </div>,
    )
    const root = container.firstElementChild!
    expect(root.querySelector("p")!.className).toBe("p")
    expect(root.querySelector("ul")!.className).toBe("ul")
    expect(root.querySelector("ol")!.className).toBe("ol")
    expect(Array.from(root.querySelectorAll("li")).map((li) => li.className)).toEqual(["li", "li", "li"])
    expect(root.querySelector("strong")!.className).toBe("b")
    expect(root.querySelector("em")!.className).toBe("i")
    expect(root.querySelector("a")!.className).toBe("a")
  })

  it("never renders an unsafe href", () => {
    const { container } = render(<Markdown source="[x](javascript:alert(1))" />)
    expect(container.querySelector("a")).toBeNull()
  })
})
