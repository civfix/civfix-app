export interface MarkdownText {
  type: "text"
  value: string
}

export interface MarkdownStrong {
  type: "strong"
  children: MarkdownInline[]
}

export interface MarkdownEm {
  type: "em"
  children: MarkdownInline[]
}

export interface MarkdownLink {
  type: "link"
  href: string
  children: MarkdownInline[]
}

export type MarkdownInline = MarkdownText | MarkdownStrong | MarkdownEm | MarkdownLink

export interface MarkdownParagraph {
  type: "paragraph"
  children: MarkdownInline[]
}

export interface MarkdownListItem {
  type: "listItem"
  children: MarkdownInline[]
}

export interface MarkdownList {
  type: "list"
  ordered: boolean
  items: MarkdownListItem[]
}

export type MarkdownNode = MarkdownParagraph | MarkdownList
