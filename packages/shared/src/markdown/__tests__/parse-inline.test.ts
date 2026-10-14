import { describe, expect, it } from "vitest"
import { parseMarkdownSubset } from "../index.js"

describe("parseMarkdownSubset inline spans", () => {
  it("treats a run of four stars as a literal star before a strong span", () => {
    expect(parseMarkdownSubset("****x**")).toEqual([
      {
        type: "paragraph",
        children: [{ type: "text", value: "*" }, { type: "strong", children: [{ type: "text", value: "*x" }] }],
      },
    ])
  })

  it("leaves a strong opener without a closer literal", () => {
    expect(parseMarkdownSubset("**x")).toEqual([
      { type: "paragraph", children: [{ type: "text", value: "**x" }] },
    ])
  })

  it("parses strong and both em delimiters inline", () => {
    expect(parseMarkdownSubset("a **b** c *d* e _f_ g")).toEqual([
      {
        type: "paragraph",
        children: [
          { type: "text", value: "a " },
          { type: "strong", children: [{ type: "text", value: "b" }] },
          { type: "text", value: " c " },
          { type: "em", children: [{ type: "text", value: "d" }] },
          { type: "text", value: " e " },
          { type: "em", children: [{ type: "text", value: "f" }] },
          { type: "text", value: " g" },
        ],
      },
    ])
  })

  it("closes each em at the first matching delimiter, nesting links inside", () => {
    expect(parseMarkdownSubset("*a _b **c [d](https://civfix.org/x) e** f_ g*")).toEqual([
      {
        type: "paragraph",
        children: [
          { type: "em", children: [{ type: "text", value: "a _b " }] },
          {
            type: "em",
            children: [
              { type: "text", value: "c " },
              { type: "link", href: "https://civfix.org/x", children: [{ type: "text", value: "d" }] },
              { type: "text", value: " e" },
            ],
          },
          { type: "em", children: [{ type: "text", value: " f_ g" }] },
        ],
      },
    ])
  })

  it("pairs each star with the next star instead of nesting", () => {
    expect(parseMarkdownSubset("*1 *2 *3 *4 *5 deep* * * * *")).toEqual([
      {
        type: "paragraph",
        children: [
          { type: "em", children: [{ type: "text", value: "1 " }] },
          { type: "text", value: "2 " },
          { type: "em", children: [{ type: "text", value: "3 " }] },
          { type: "text", value: "4 " },
          { type: "em", children: [{ type: "text", value: "5 deep" }] },
          { type: "text", value: " * * * *" },
        ],
      },
    ])
  })

  it("pairs each double star with the next double star instead of nesting", () => {
    expect(parseMarkdownSubset("**1 **2 **3 **4 **5** ** ** ** **")).toEqual([
      {
        type: "paragraph",
        children: [
          { type: "strong", children: [{ type: "text", value: "1 " }] },
          { type: "text", value: "2 " },
          { type: "strong", children: [{ type: "text", value: "3 " }] },
          { type: "text", value: "4 " },
          { type: "strong", children: [{ type: "text", value: "5" }] },
          { type: "text", value: " ** ** ** **" },
        ],
      },
    ])
  })

  it("unwraps an unsafe link into the surrounding text", () => {
    expect(parseMarkdownSubset("pre [click](javascript:alert(1)) post")).toEqual([
      { type: "paragraph", children: [{ type: "text", value: "pre click post" }] },
    ])
  })

  it("keeps the formatting of an unsafe link's label", () => {
    expect(parseMarkdownSubset("pre [**bold** tail](javascript:x) post")).toEqual([
      {
        type: "paragraph",
        children: [
          { type: "text", value: "pre " },
          { type: "strong", children: [{ type: "text", value: "bold" }] },
          { type: "text", value: " tail post" },
        ],
      },
    ])
  })

  it("balances parentheses in an href and leaves an unterminated one literal", () => {
    expect(parseMarkdownSubset("[a](https://civfix.org/x_(y)) and [b](https://civfix.org/(z")).toEqual([
      {
        type: "paragraph",
        children: [
          { type: "link", href: "https://civfix.org/x_(y)", children: [{ type: "text", value: "a" }] },
          { type: "text", value: " and [b](https://civfix.org/(z" },
        ],
      },
    ])
  })

  it("leaves an empty label and a bracket not followed by a parenthesis literal", () => {
    expect(parseMarkdownSubset("[  ](https://civfix.org/x) [ok] (https://civfix.org) [ok]")).toEqual([
      {
        type: "paragraph",
        children: [{ type: "text", value: "[  ](https://civfix.org/x) [ok] (https://civfix.org) [ok]" }],
      },
    ])
  })

  it("keeps scanning after an opener with no closer", () => {
    expect(parseMarkdownSubset("*unclosed then _em_ and *")).toEqual([
      {
        type: "paragraph",
        children: [
          {
            type: "em",
            children: [
              { type: "text", value: "unclosed then " },
              { type: "em", children: [{ type: "text", value: "em" }] },
              { type: "text", value: " and " },
            ],
          },
        ],
      },
    ])
  })

  it("does not cross em delimiters of different kinds", () => {
    expect(parseMarkdownSubset("_a *b_ c*")).toEqual([
      {
        type: "paragraph",
        children: [{ type: "em", children: [{ type: "text", value: "a *b" }] }, { type: "text", value: " c*" }],
      },
    ])
  })

  it("closes a label at the first closing bracket", () => {
    expect(parseMarkdownSubset("[a [b](https://civfix.org/b) c](https://civfix.org/a)")).toEqual([
      {
        type: "paragraph",
        children: [
          { type: "link", href: "https://civfix.org/b", children: [{ type: "text", value: "a [b" }] },
          { type: "text", value: " c](https://civfix.org/a)" },
        ],
      },
    ])
  })

  it("applies an escape before looking for delimiters", () => {
    expect(parseMarkdownSubset("\\**not strong**")).toEqual([
      {
        type: "paragraph",
        children: [
          { type: "text", value: "*" },
          { type: "em", children: [{ type: "text", value: "not strong" }] },
          { type: "text", value: "*" },
        ],
      },
    ])
  })

  it("leaves a strong span with only whitespace literal", () => {
    expect(parseMarkdownSubset("** **")).toEqual([
      { type: "paragraph", children: [{ type: "text", value: "** **" }] },
    ])
  })

  it("leaves a trailing star literal", () => {
    expect(parseMarkdownSubset("x*")).toEqual([
      { type: "paragraph", children: [{ type: "text", value: "x*" }] },
    ])
  })

  it("folds a continuation line into its list item and parses its inline spans", () => {
    expect(parseMarkdownSubset("- item *em\n  continued **strong**\n- [l](https://civfix.org/l) tail")).toEqual([
      {
        type: "list",
        ordered: false,
        items: [
          {
            type: "listItem",
            children: [
              { type: "text", value: "item *em continued " },
              { type: "strong", children: [{ type: "text", value: "strong" }] },
            ],
          },
          {
            type: "listItem",
            children: [
              { type: "link", href: "https://civfix.org/l", children: [{ type: "text", value: "l" }] },
              { type: "text", value: " tail" },
            ],
          },
        ],
      },
    ])
  })

  it("honours only a positive integer maxChars and falls back to the default otherwise", () => {
    expect(parseMarkdownSubset("abcdefghij", { maxChars: 4 })).toEqual([
      { type: "paragraph", children: [{ type: "text", value: "abcd" }] },
    ])
    for (const maxChars of [0, 2.5, -3]) {
      expect(parseMarkdownSubset("abcdefghij", { maxChars })).toEqual([
        { type: "paragraph", children: [{ type: "text", value: "abcdefghij" }] },
      ])
    }
  })
})
