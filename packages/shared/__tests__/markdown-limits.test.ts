import { describe, expect, it } from "vitest"
import {
  EventPageBlockSchema,
  MARKDOWN_SUBSET_MAX_CHARS,
  MAX_BROADCAST_BODY,
  markdownToPlainText,
  parseMarkdownSubset,
} from "../src/index.js"

type Def = {
  typeName?: string
  checks?: { kind: string; value: number }[]
  innerType?: unknown
  schema?: unknown
  type?: unknown
  options?: unknown
}

function stringMaxima(schema: unknown, path: string, out: Record<string, number>): void {
  const def = (schema as { _def?: Def } | null)?._def
  if (!def) return
  switch (def.typeName) {
    case "ZodString": {
      const max = (def.checks ?? []).find((check) => check.kind === "max")
      if (max) out[path] = max.value
      return
    }
    case "ZodObject": {
      const shape = (schema as { shape: Record<string, unknown> }).shape
      for (const [key, value] of Object.entries(shape)) stringMaxima(value, `${path}.${key}`, out)
      return
    }
    case "ZodArray":
      stringMaxima(def.type, `${path}[]`, out)
      return
    case "ZodOptional":
    case "ZodNullable":
    case "ZodDefault":
      stringMaxima(def.innerType, path, out)
      return
    case "ZodEffects":
      stringMaxima(def.schema, path, out)
      return
    case "ZodUnion":
    case "ZodDiscriminatedUnion": {
      const options = def.options
      const list = options instanceof Map ? [...options.values()] : ((options ?? []) as unknown[])
      list.forEach((option, index) => stringMaxima(option, `${path}<${index}>`, out))
      return
    }
    default:
      return
  }
}

describe("markdown body maxima", () => {
  it("has exactly one source of truth, and the page/broadcast fields reference it", () => {
    expect(MARKDOWN_SUBSET_MAX_CHARS).toBe(8000)
    expect(MAX_BROADCAST_BODY).toBe(MARKDOWN_SUBSET_MAX_CHARS)
  })

  it("caps every page-block string at or below the parser default", () => {
    const maxima: Record<string, number> = {}
    stringMaxima(EventPageBlockSchema, "block", maxima)
    const entries = Object.entries(maxima)
    expect(entries.length).toBeGreaterThan(10)
    const over = entries.filter(([, max]) => max > MARKDOWN_SUBSET_MAX_CHARS)
    expect(over).toEqual([])
    expect(entries.some(([path, max]) => path.endsWith(".body") && max === MARKDOWN_SUBSET_MAX_CHARS)).toBe(
      true,
    )
  })

  it("parses a body of the maximum accepted length without truncating it", () => {
    const body = "a".repeat(MARKDOWN_SUBSET_MAX_CHARS)
    expect(markdownToPlainText(parseMarkdownSubset(body))).toHaveLength(MARKDOWN_SUBSET_MAX_CHARS)

    const parsed = EventPageBlockSchema.parse({ id: "b1", kind: "about", body })
    expect((parsed as { body: string }).body).toHaveLength(MARKDOWN_SUBSET_MAX_CHARS)
    expect(() => EventPageBlockSchema.parse({ id: "b1", kind: "about", body: `${body}a` })).toThrow()
  })

  it("stays fast on a pathological body of the maximum accepted length", () => {
    const started = Date.now()
    parseMarkdownSubset("[a](".repeat(MARKDOWN_SUBSET_MAX_CHARS / 4))
    parseMarkdownSubset("**a".repeat(MARKDOWN_SUBSET_MAX_CHARS / 3))
    parseMarkdownSubset("*".repeat(MARKDOWN_SUBSET_MAX_CHARS))
    expect(Date.now() - started).toBeLessThan(1000)
  })
})
