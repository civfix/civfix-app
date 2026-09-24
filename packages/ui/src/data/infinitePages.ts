import type { InfiniteData } from "@tanstack/react-query"
import { listItems } from "./types"

type ListField<TPage> = {
  [K in keyof TPage]-?: NonNullable<TPage[K]> extends readonly unknown[] ? K : never
}[keyof TPage]

/**
 * A `select` that turns each page's list fields into real arrays of non-null entries, since the client
 * does not validate responses. Build it once at module scope: React Query re-runs `select` whenever its
 * identity changes.
 */
export function coercePages<TPage extends object>(
  ...fields: ListField<TPage>[]
): (data: InfiniteData<TPage>) => InfiniteData<TPage> {
  return (data) => ({
    ...data,
    pages: data.pages.map((page) => {
      const next = { ...page }
      for (const field of fields) {
        ;(next as Record<PropertyKey, unknown>)[field] = listItems(
          page?.[field] as readonly unknown[] | null | undefined,
        )
      }
      return next
    }),
  })
}
