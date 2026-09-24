/**
 * Post mutations whose OUTCOME must survive the component that fired them.
 *
 * TanStack v5's MutationObserver runs the per-call `mutate(vars, { onSuccess, onError, onSettled })`
 * callbacks only while it still has listeners. Deleting a post optimistically removes the row that owns
 * the overflow menu, and closing the composer (or swiping back) unmounts it mid-request, so those
 * callbacks would be silently dropped: no delete toast, and a failed post taking the user's text with it. The
 * first block pins that library behaviour; the rest pin that each surface reads the outcome from the
 * mutation promise instead. The surfaces import react-native, so they are checked by source (the house
 * pattern for this package).
 */
import { readFileSync } from "node:fs"
import { describe, expect, it, vi } from "vitest"
import { sliceBetween, surfaceSource } from "../../__tests__/sourceGuards"
import { MutationObserver, QueryClient } from "@tanstack/react-query"

const strip = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

const code = (relative: string): string => strip(readFileSync(new URL(relative, import.meta.url), "utf8"))

describe("the TanStack behaviour these fixes rely on", () => {
  it("drops per-call callbacks after the observer unmounts, while the promise still settles", async () => {
    const client = new QueryClient()
    const observer = new MutationObserver<unknown, Error, void>(client, {
      mutationFn: () => Promise.reject(new Error("offline")),
    })
    const unsubscribe = observer.subscribe(() => undefined)
    const onError = vi.fn()
    const outcome = observer.mutate(undefined, { onError })
    unsubscribe()
    await expect(outcome).rejects.toThrow("offline")
    expect(onError).not.toHaveBeenCalled()
  })
})

describe("deleting from the overflow menu", () => {
  const menu = code("../PostOverflowMenu.tsx")
  const runDelete = sliceBetween(menu, "const runDelete", "const closeConfirmDelete")

  it("reads the toast and onDeleted from the promise, not from per-call callbacks", () => {
    expect(menu).toContain("const deletePost = del.mutateAsync")
    expect(runDelete).toContain("deletePost(subjectId)")
    expect(runDelete).not.toMatch(/del\.mutate\(/)
    expect(runDelete).not.toMatch(/onSuccess:|onError:|onSettled:/)
    expect(runDelete).toMatch(/toast\.show\(t\("post_card\.menu\.deleted"\)\)\s*\n\s*onDeleted\?\.\(\)/)
    expect(runDelete).toContain('toast.show(t("post_card.menu.delete_failed"), { variant: "error" })')
  })

  it("always handles the rejection, so a failed delete is never an unhandled promise", () => {
    expect(runDelete).toMatch(/\.then\(\s*\(\) => \{[\s\S]*?\},\s*\(\) => toast\.show/)
  })
})

describe("a failed post keeps its text after the composer is gone", () => {
  const composers: Record<string, string> = {
    "../PostComposer.tsx": strip(surfaceSource("postComposer")),
    "../feed/InlineComposer.tsx": code("../feed/InlineComposer.tsx"),
  }
  for (const [file, source] of Object.entries(composers)) {
    const start = source.indexOf("const staged =")
    const catchAt = source.indexOf(".catch(", start)
    const end = source.indexOf("\n  }", catchAt)
    const submit = source.slice(start, end)

    it(`${file} restores from the promise's rejection, guarded against a newer draft`, () => {
      expect(start, `${file}: const staged = is gone`).toBeGreaterThan(-1)
      expect(catchAt, `${file}: no .catch( after const staged =`).toBeGreaterThan(start)
      expect(end, `${file}: the submit block no longer closes after .catch(`).toBeGreaterThan(catchAt)
      expect(submit).toMatch(/create\s*\.mutateAsync\(/)
      expect(submit).not.toContain("onError:")
      expect(submit).toMatch(/\.catch\(\(\) => \{\s*haptics\.error\(\)\s*const restored = restoreFailedPostSubmit\(staged\)/)
      expect(source).not.toMatch(/\brestore\(staged\)/)
    })

    it(`${file} tells the user once the composer that would show the inline error is gone`, () => {
      expect(submit).toMatch(/if \(!mountedRef\.current\) \{\s*toast\.show\(t\(restored \? "submit_error_restored" : "submit_error"\), \{ variant: "error" \}\)/)
      expect(source).toMatch(/return \(\) => \{\s*mountedRef\.current = false/)
    })

    it(`${file} keeps navigation and local state behind the observer, so a late success after a close does nothing`, () => {
      expect(submit).toMatch(/onSuccess: \(/)
      expect(submit).toMatch(/onSettled: \(\) => \{\s*submittingRef\.current = false\s*\}/)
    })
  }
})
