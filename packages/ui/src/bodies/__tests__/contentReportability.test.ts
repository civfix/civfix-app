import { readFileSync, readdirSync, statSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const read = (rel: string): string => readFileSync(new URL(rel, import.meta.url), "utf8")
const code = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

const SURFACES: Record<string, string> = {
  "PostCard.tsx": code(read("../PostCard.tsx")),
  "thread/ThreadFocalPost.tsx": code(read("../thread/ThreadFocalPost.tsx")),
  "thread/ThreadReplyRow.tsx": code(read("../thread/ThreadReplyRow.tsx")),
}

const MENU = code(read("../PostOverflowMenu.tsx"))
const BUTTON = code(read("../../primitives/PostOverflowButton.tsx"))
const BARREL = code(read("../../primitives/index.ts"))

function menuItem(key: string): string {
  const at = MENU.indexOf(`key: "${key}"`)
  expect(at, `the ${key} menu item is gone from PostOverflowMenu`).toBeGreaterThan(-1)
  const end = MENU.indexOf("}", MENU.indexOf("onPress:", at))
  expect(end).toBeGreaterThan(at)
  return MENU.slice(at, end)
}

describe("every post surface can be reported", () => {
  for (const [name, source] of Object.entries(SURFACES)) {
    it(`${name} anchors and mounts the overflow menu`, () => {
      expect(source).toContain("usePopoverAnchor(setMenuAnchor)")
      expect(source).toContain("menuTrigger.measure()")
      expect(source).toContain("post_card.more_a11y")
      expect(source).toMatch(/<PostOverflowMenu[\s\S]*?subject=\{menuSubject\}/)
      expect(source).toContain("postMenuSubject(post)")
    })

    it(`${name} renders the shared overflow button instead of a local one`, () => {
      expect(source).toMatch(/from "\.\.\/(\.\.\/)?primitives\/PostOverflowButton"/)
      expect(source).toMatch(
        /<PostOverflowButton\s+label=\{t\("post_card\.more_a11y"\)\}\s+onPress=\{[\w.]+\}\s+buttonRef=\{[\w.]+\}\s+expanded=\{menuOpen\}\s*\/>/,
      )
      expect(source).not.toContain("iconMap.Ellipsis")
      expect(source).not.toContain("moreButton")
      expect(source).not.toContain("moreHalo")
    })
  }

  it("mounts the menu at Pressable depth zero on every surface", () => {
    for (const [name, source] of Object.entries(SURFACES)) {
      const menuAt = source.indexOf("<PostOverflowMenu")
      expect(menuAt, name).toBeGreaterThan(-1)
      const before = source.slice(0, menuAt)
      const opened = (before.match(/<Pressable[\s>]/g) ?? []).length
      const closed = (before.match(/<\/Pressable>/g) ?? []).length
      expect(opened - closed, `${name} nests the menu inside a Pressable`).toBe(0)
    }
  })
})

describe("the overflow button is one primitive with one hit target", () => {
  it("tells assistive tech it opens a menu and whether that menu is open (APP-A11Y-105)", () => {
    expect(BUTTON).toContain("expanded: boolean")
    expect(BUTTON).toContain("accessibilityState={{ expanded }}")
    expect(BUTTON).toContain('const WEB_MENU_TRIGGER_PROPS = IS_WEB ? ({ "aria-haspopup": "menu" } as object) : null')
    expect(BUTTON).toContain("{...WEB_MENU_TRIGGER_PROPS}")
  })

  it("is exported from the primitives barrel", () => {
    expect(BARREL).toContain('export { POST_OVERFLOW_ROW_LIFT, PostOverflowButton } from "./PostOverflowButton"')
    expect(BUTTON).toContain("export const POST_OVERFLOW_ROW_LIFT: ViewStyle = IS_WEB ? { zIndex: 1 } : {}")
    expect((SURFACES["PostCard.tsx"] ?? "").split("<View style={[styles.metaRow, POST_OVERFLOW_ROW_LIFT]}>").length).toBe(3)
    expect(SURFACES["thread/ThreadReplyRow.tsx"] ?? "").toContain("<View style={[styles.metaRow, POST_OVERFLOW_ROW_LIFT]}>")
  })

  it("grows to the full 44pt box on web, where hitSlop does not exist", () => {
    expect(BUTTON).toContain("height: RHYTHM.overflowTarget")
    expect(BUTTON).toContain("marginTop: -WEB_MORE_TARGET_GROWTH")
    expect(BUTTON).toContain("marginBottom: -WEB_MORE_TARGET_GROWTH")
    expect(BUTTON).toContain("WEB_MORE_TARGET, webCursor(false)")
    expect(BUTTON).toContain("hitSlop={8}")
  })

  it("carries the halo, the shared glyph size and the shared glyph color", () => {
    expect(BUTTON).toContain("styles.moreHalo")
    expect(BUTTON).toContain("WEB_MORE_HALO_TOP")
    expect(BUTTON).toContain("webTransition")
    expect(BUTTON).toContain(
      "state.pressed ? styles.moreHaloPressed : webHover(state) ? styles.moreHaloHovered : null",
    )
    expect(BUTTON).toContain(
      "<Icon icon={iconMap.Ellipsis} size={RHYTHM.overflowGlyph} color={th.colors.textMuted} />",
    )
  })

  it("stops the press reaching the row it sits in", () => {
    expect(BUTTON).toContain("stopPress(event)")
    expect(BUTTON).toContain('accessibilityRole="button"')
    expect(BUTTON).toContain("accessibilityLabel={label}")
  })
})

describe("the report row prompts for sign-in instead of going dead", () => {
  it("routes report through requireAuth with a next back to the post", () => {
    expect(MENU).toContain("const requireAuth = useRequireAuth()")
    expect(MENU).toContain("requireAuth(() => onReportOpenChange(true), { next: subjectPath })")
    expect(MENU).toContain("const subjectPath = `/post/${subjectId}`")

    const report = menuItem("report")
    expect(report).toContain('label: t("post_card.menu.report")')
    expect(report).toContain('icon: "Flag" as const')
    expect(report).toContain("onPress: startReport")
    expect(report).not.toContain("disabled")
    expect(report).not.toContain("isAuthenticated")
  })

  it("reports, links and deletes the SUBJECT, never the row's own wrapper id", () => {
    expect(MENU).toContain('{ subjectType: "post", subjectId, reason')
    expect(MENU).toContain("setString(absoluteUrl(subjectPath))")
    expect(MENU).toContain("deletePost(subjectId)")
    expect(MENU).toContain("viewerId != null && viewerId === subject.authorId")
  })

  it("omits View profile when the subject's author is gone", () => {
    expect(MENU).toContain("...(authorId")
    expect(menuItem("profile")).toContain("onPress: () => onOpenPerson(authorId)")
  })

  it("offers the go-to-original item only when the host supplies the jump", () => {
    expect(MENU).toContain("...(onOpenOriginal")
    const original = menuItem("original")
    expect(original).toContain('label: t("post_card.menu.go_to_original")')
    expect(original).toContain("onPress: onOpenOriginal")
  })
})

describe("deleting from a menu leaves the surface consistent", () => {
  const BODY = code(read("../PostThreadBody.tsx"))

  it("takes the thread back when its FOCAL post is deleted", () => {
    expect(BODY).toContain("const goBack = onBack ?? back")
    expect(BODY).toMatch(/<ThreadFocalPost[\s\S]*?onDeleted=\{goBack\}/)
  })

  it("drops a deleted reply from the locally-sent list as well as the cache", () => {
    expect(BODY).toContain("current.filter((reply) => reply.id !== postId)")
    expect(BODY).toMatch(/<ThreadReplyRow[\s\S]*?onDeleted=\{onReplyDeleted\}/)
    expect(SURFACES["thread/ThreadReplyRow.tsx"] ?? "").toContain(
      "React.useCallback(() => onDeleted?.(post.id), [onDeleted, post.id])",
    )
  })

  it("invalidates every post list, the replies cache included, after a delete", () => {
    const keys = code(read("../../data/keys.ts"))
    expect(keys).toContain('postsRoot: ["posts"] as const')
    expect(keys).toContain('postReplies: (id: string) => ["posts", "replies", id] as const')
    const hooks = code(read("../../data/hooks/posts.ts"))
    const fromDelete = hooks.slice(hooks.indexOf("export function buildDeleteMutation"))
    const deleteMutation = fromDelete.slice(0, fromDelete.indexOf("export function", 1))
    expect(deleteMutation).toContain("qc.invalidateQueries({ queryKey: queryKeys.postsRoot })")
  })
})

const BODIES_DIR = fileURLToPath(new URL("../", import.meta.url))

function listTsx(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) return name === "__tests__" ? [] : listTsx(full)
    return name.endsWith(".tsx") ? [full] : []
  })
}

describe("every body that renders a post action bar also mounts the overflow menu", () => {
  const actionBarSurfaces = listTsx(BODIES_DIR).filter((file) =>
    readFileSync(file, "utf8").includes("<PostActionBar"),
  )

  it("enumerates the surfaces from disk rather than a hand-kept list", () => {
    expect(actionBarSurfaces.length).toBe(Object.keys(SURFACES).length)
    for (const file of actionBarSurfaces) {
      expect(Object.keys(SURFACES).some((name) => file.endsWith(name)), file).toBe(true)
    }
  })

  for (const file of actionBarSurfaces) {
    it(`${file.slice(BODIES_DIR.length)} mounts PostOverflowMenu`, () => {
      expect(readFileSync(file, "utf8")).toContain("<PostOverflowMenu")
    })
  }
})

describe("a repost row never deletes the original it embeds", () => {
  it("only offers Delete when the subject was not redirected from a repost", () => {
    expect(MENU).toContain("const canDelete = isOwn && repost === null")
    const deleteItem = menuItem("delete")
    expect(deleteItem).toContain("onPress: () => onConfirmingDeleteChange(true)")
    expect(MENU).toContain("...(canDelete\n        ? [\n            {\n              key: \"delete\"")
  })

  it("offers Undo repost on the viewer's own repost, driven by the repost toggle", () => {
    expect(MENU).toContain(
      "const isOwnRepost = isAuthenticated && viewerId != null && repost !== null && viewerId === repost.authorId",
    )
    expect(MENU).toContain("const undoRepost = useRepost(subjectId)")
    const undoItem = menuItem("undo-repost")
    expect(undoItem).toContain('label: t("post_card.menu.undo_repost")')
    expect(undoItem).toContain("onPress: runUndoRepost")
    expect(MENU).toContain("undoRepostMutate(true, {")
  })
})
