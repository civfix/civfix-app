import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { MOTION } from "../../theme/motion"
import { menuOrigin, MENU_SCALE_FROM } from "../menuMotionModel"

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8")
const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")
const PRIMITIVES = fileURLToPath(new URL("../", import.meta.url))
const MAP = fileURLToPath(new URL("../../map/", import.meta.url))

const motionSource = strip(read("../menuMotion.ts"))
const motionModelSource = strip(read("../menuMotionModel.ts"))
const popover = strip(read("../PopoverMenu.tsx"))
const anchoredPopover = strip(read("../AnchoredPopover.tsx"))
const mapThemeToggle = strip(read("../../map/MapThemeToggle.tsx"))
const contextMenu = strip(read("../MessageContextMenu.tsx"))
const postActionBar = strip(read("../PostActionBar.tsx"))
const convoBar = strip(read("../../bodies/conversation/ConvoBar.tsx"))
const conversation = strip(read("../../bodies/ConversationBody.tsx"))
const inbox = strip(read("../../bodies/MessagingListBody.tsx"))
const reportDetail = strip(read("../../bodies/ReportDetailBody.tsx"))

describe("menu motion tokens", () => {
  it("names an entrance and a QUICKER exit in the shared motion vocabulary", () => {
    expect(MOTION.menuIn.duration).toBeGreaterThan(0)
    expect(MOTION.menuOut.duration).toBeLessThan(MOTION.menuIn.duration)
    expect(MOTION.menuIn.easing).toEqual(MOTION.easing)
    expect(MOTION.menuOut.easing).toEqual(MOTION.easing)
  })

  it("scales from just under 1 - a menu grows out of its anchor, it does not zoom", () => {
    expect(MENU_SCALE_FROM).toBe(MOTION.menuScaleFrom)
    expect(MENU_SCALE_FROM).toBeGreaterThan(0.9)
    expect(MENU_SCALE_FROM).toBeLessThan(1)
  })
})

describe("anchor-origin solve", () => {
  const anchor = { x: 320, y: 120, width: 44, height: 44 }

  it("grows from the corner nearest the trigger for a card dropped below-right of it", () => {
    const card = { left: 144, top: 168, width: 220, height: 160 }
    const origin = menuOrigin(anchor, card)
    expect(origin.originX).toBe(198)
    expect(origin.originY).toBe(0)
    expect(origin.translateX).toBeGreaterThan(0)
    expect(origin.translateY).toBeLessThan(0)
  })

  it("flips the vertical offset when the card is placed ABOVE the trigger", () => {
    const card = { left: 144, top: 0, width: 220, height: 100 }
    const origin = menuOrigin({ x: 320, y: 120, width: 44, height: 44 }, card)
    expect(origin.originY).toBe(100)
    expect(origin.translateY).toBeGreaterThan(0)
  })

  it("clamps the origin inside the card, so a far-off trigger never flings it", () => {
    const origin = menuOrigin({ x: 0, y: 0, width: 10, height: 10 }, {
      left: 300,
      top: 400,
      width: 200,
      height: 100,
    })
    expect(origin.originX).toBe(0)
    expect(origin.originY).toBe(0)
  })

  it("is a centered no-offset grow when there is no anchor to grow from", () => {
    expect(menuOrigin(null, { left: 0, top: 0, width: 200, height: 100 })).toEqual({
      originX: 0,
      originY: 0,
      translateX: 0,
      translateY: 0,
    })
    expect(menuOrigin({ x: 1, y: 1, width: 1, height: 1 }, null).translateX).toBe(0)
  })

  it("keeps the compensating translate consistent with the scale it is compensating for", () => {
    const card = { left: 0, top: 0, width: 200, height: 100 }
    const origin = menuOrigin({ x: 200, y: 100, width: 0, height: 0 }, card)
    expect(origin.translateX).toBeCloseTo((200 - 100) * (1 - MENU_SCALE_FROM))
    expect(origin.translateY).toBeCloseTo((100 - 50) * (1 - MENU_SCALE_FROM))
  })
})

describe("the shared menu motion hook (source-pinned)", () => {
  it("reads every duration and curve from the motion tokens, never a literal", () => {
    expect(motionSource).toMatch(/MENU_RECIPES: MenuMotionRecipes = \{ enter: motion\.menuIn, exit: motion\.menuOut \}/)
    expect(motionSource).toMatch(/recipes = MENU_RECIPES/)
    expect(motionSource).toMatch(/duration: recipes\.enter\.duration/)
    expect(motionSource).toMatch(/duration: recipes\.exit\.duration/)
    expect(motionSource).toMatch(/Easing\.bezier\(\.\.\.recipes\.enter\.easing\)/)
    expect(motionSource).toMatch(/Easing\.bezier\(\.\.\.recipes\.exit\.easing\)/)
    expect(motionSource).not.toMatch(/duration:\s*\d/)
    expect(motionModelSource).toMatch(/MENU_SCALE_FROM = MOTION\.menuScaleFrom/)
    expect(motionModelSource).not.toMatch(/0\.9\d/)
  })

  it("short-circuits to an instant, opacity-only menu under reduced motion", () => {
    expect(motionSource).toMatch(/useReducedMotion\(\) === true/)
    expect(motionSource).toMatch(/if \(reducedMotion\) \{\s*progress\.setValue\(1\)/)
    expect(motionSource).toMatch(/if \(reducedMotion\) \{\s*progress\.setValue\(0\)/)
    expect(motionSource).toMatch(
      /if \(motion\.reducedMotion\) return \{ opacity: motion\.progress \}/,
    )
  })

  it("drives opacity + transform on the native driver everywhere but web", () => {
    expect(motionSource).toMatch(/MENU_NATIVE_DRIVER = Platform\.OS !== "web"/)
    expect(motionSource).toMatch(/useNativeDriver = MENU_NATIVE_DRIVER/)
    expect(motionSource).toMatch(/useNativeDriver,/)
  })

  it("keeps the card mounted for the exit and only then reports it gone", () => {
    expect(motionSource).toMatch(/setExiting\(true\)/)
    expect(motionSource).toMatch(/exit\.start\(\(\{ finished \}\) => \{\s*if \(!finished\) return/)
    expect(motionSource).toMatch(/setRendered\(false\)/)
  })

  it("stops its animation on unmount and never leaves two timings racing", () => {
    expect(motionSource).toMatch(/animRef\.current\?\.stop\(\)/)
    expect(motionSource).toMatch(/\(\) => \{\s*animRef\.current\?\.stop\(\)/)
  })

  it("only touches state at the animation's edges - never per frame", () => {
    expect(motionSource).not.toMatch(/addListener/)
    expect(motionSource).not.toMatch(/setState/)
  })

  it("refuses, in dev, a recipes object that changes identity - reading them through a ref makes a swap inert", () => {
    expect(motionSource).toMatch(
      /MENU_MOTION_DEV_ASSERTS = process\.env\.NODE_ENV !== "production"/,
    )
    expect(motionSource).toMatch(
      /if \(MENU_MOTION_DEV_ASSERTS && recipesRef\.current !== recipes\) \{\s*throw new Error\(/,
    )
    expect(motionSource).toMatch(/const recipes = recipesRef\.current/)
  })

  it("is called only with a STABLE recipes object, so the dev guard can never fire on our own code", () => {
    const callers = [...readdirSync(PRIMITIVES), ...readdirSync(MAP)]
      .filter((name) => name.endsWith(".tsx"))
      .map((name) => {
        const dir = existsSync(join(PRIMITIVES, name)) ? PRIMITIVES : MAP
        return { name, source: strip(readFileSync(join(dir, name), "utf8")) }
      })
      .filter((file) => file.source.includes("useMenuMotion("))
    expect(callers.length).toBeGreaterThan(0)
    for (const { name, source } of callers) {
      for (const [, passed] of source.matchAll(/useMenuMotion\(\{[^}]*recipes:\s*([A-Za-z0-9_.]+)/g)) {
        expect(passed, `${name} passes ${passed} as recipes`).toMatch(/^[A-Z][A-Z0-9_]*$/)
        expect(source, `${name} must hoist ${passed} to a module constant`).toMatch(
          new RegExp(`^const ${passed}: MenuMotionRecipes = `, "m"),
        )
      }
    }
  })
})

describe("AnchoredPopover is the ONE Modal + scrim + anchored-card presentation", () => {
  it("drives its own entrance instead of the OS modal cross-fade", () => {
    expect(anchoredPopover).toMatch(/animationType="none"/)
    expect(anchoredPopover).not.toMatch(/animationType="fade"/)
    expect(anchoredPopover).toMatch(/menuCardStyle\(motion, origin\)/)
    expect(anchoredPopover).toMatch(/menuScrimStyle\(motion\)/)
  })

  it("keeps the Modal mounted through the exit, so onDismiss still fires AFTER it", () => {
    expect(anchoredPopover).toMatch(/visible=\{motion\.rendered\}/)
    expect(anchoredPopover).toMatch(/onDismiss=\{onDismiss\}/)
  })

  it("blocks interaction while the menu is leaving, so a double tap cannot re-enter it", () => {
    expect(anchoredPopover).toMatch(/pointerEvents=\{motion\.exiting \? "none" : "auto"\}/)
  })

  it("dismisses on an outside tap and on the platform back gesture", () => {
    expect(anchoredPopover).toMatch(/onRequestClose=\{onClose\}/)
    expect(anchoredPopover).toMatch(/onPress=\{onClose\}/)
    expect(anchoredPopover).toMatch(/\{\.\.\.webScrimProps\}/)
  })

  it("paints a real tint, and no primitive keeps an invisible dismiss layer of its own", () => {
    expect(anchoredPopover).toMatch(/backgroundColor: t\.colors\.scrimModal/)
    const invisible = /(?:backdrop|scrim)\w*:\s*\{[^}]*backgroundColor:\s*"transparent"/i
    const offenders = readdirSync(PRIMITIVES)
      .filter((name) => name.endsWith(".tsx"))
      .filter((name) => invisible.test(strip(readFileSync(join(PRIMITIVES, name), "utf8"))))
    expect(offenders).toEqual([])
  })

  it("takes the screen reader with it and answers the escape gesture", () => {
    expect(anchoredPopover).toMatch(/accessibilityViewIsModal/)
    expect(anchoredPopover).toMatch(/onAccessibilityEscape=\{onClose\}/)
    expect(anchoredPopover).toMatch(/accessibilityLabel=\{accessibilityLabel\}/)
  })

  it("owns the native accessibility focus handoff, so no menu hand-rolls one again", () => {
    expect(anchoredPopover).toMatch(/MOVES_ACCESSIBILITY_FOCUS = Platform\.OS !== "web"/)
    expect(anchoredPopover).toMatch(/if \(!MOVES_ACCESSIBILITY_FOCUS \|\| node == null\) return/)
    expect(anchoredPopover).toMatch(/findNodeHandle\(node\)/)
    expect(anchoredPopover).toMatch(/AccessibilityInfo\.setAccessibilityFocus\(handle\)/)
    expect(anchoredPopover).toMatch(/onShow=\{focusCard\}/)
    expect(anchoredPopover).toMatch(/focusAccessibilityNode\(cardRef\.current\)/)
    expect(anchoredPopover).toMatch(/focusAccessibilityNode\(returnFocusRef\?\.current\)/)
    expect(anchoredPopover).toMatch(/cancelAnimationFrame\(focusRequestRef\.current\)/)
    expect(popover).toMatch(/returnFocusRef=\{returnFocusRef\}/)
  })

  it("leaves keyboard dismissal to the Modal contract instead of a bespoke key listener", () => {
    for (const src of [anchoredPopover, popover]) {
      expect(src).not.toMatch(/addEventListener\("keydown"/)
      expect(src).not.toMatch(/"Escape"/)
      expect(src).not.toMatch(/\.focus\(\)/)
    }
  })

  it("runs an item's action only after it has asked the menu to close, never before", () => {
    expect(popover).toMatch(/pressPopoverMenuItem\(item, run\)/)
    expect(strip(read("../popoverMenuModel.ts"))).toMatch(/else run\(item\.onPress\)/)
    const gateHook = strip(read("../useDeferredOverlayAction.ts"))
    expect(gateHook).toMatch(/onClose\(\)\s+gate\.choose\(action\)/)
  })

  it("carries no card chrome of its own - every caller styles its own surface", () => {
    expect(anchoredPopover).not.toMatch(/borderRadius/)
    expect(anchoredPopover).not.toMatch(/backgroundColor: t\.colors\.surface/)
  })

  it("is the presentation for the menus that used to wire their own Modal", () => {
    expect(popover).toMatch(/<AnchoredPopover/)
    expect(popover).not.toMatch(/<Modal/)
    expect(mapThemeToggle).toMatch(/<AnchoredPopover/)
    expect(mapThemeToggle).not.toMatch(/<Modal/)
    expect(mapThemeToggle).not.toMatch(/position: "fixed"/)
  })
})

describe("PopoverMenu owns the animation for every menu that uses it", () => {
  it("drives the shared presentation from the house motion hook", () => {
    expect(popover).toMatch(/const motion = useMenuMotion\(/)
    expect(popover).toMatch(/motion=\{motion\}/)
    expect(popover).toMatch(/origin=\{origin\}/)
  })

  it("transforms from the anchor corner the placement solver actually chose", () => {
    expect(popover).toMatch(/const origin = menuOrigin\(\s*anchorRect,/)
    expect(popover).toMatch(/cardPosition \? \{ \.\.\.cardPosition, \.\.\.cardSizeOrEstimate \} : null/)
  })

  it("keeps the Modal mounted through the exit, so onDismiss still fires AFTER it", () => {
    expect(popover).toMatch(/onDismiss=\{onModalDismiss\}/)
    expect(popover).toMatch(/const rendered = motion\.rendered/)
  })

  it("owns the post-dismiss slot for every row action, so report detail no longer rolls its own", () => {
    expect(popover).toContain("useDeferredOverlayAction(visible, onClose, onClosed)")
    expect(reportDetail).not.toContain("pendingMenuActionRef")
    expect(reportDetail).not.toContain("onTitleMenuDismiss")
  })
})

describe("every dropdown in the package rides the same motion", () => {
  it("the chat header overflow is the house PopoverMenu now, not a hand-placed card", () => {
    expect(convoBar).toMatch(/<PopoverMenu\s/)
    expect(convoBar).toMatch(/const items: PopoverMenuItem\[\]/)
    expect(convoBar).not.toMatch(/styles\.menuBackdrop/)
    expect(convoBar).not.toMatch(/headerHeight/)
    expect(convoBar).toMatch(/destructive: true/)
  })

  it("the chat header menu is anchored to its own trigger, measured before it paints", () => {
    expect(convoBar).toMatch(/ref=\{menuAnchorRef\}/)
    expect(conversation).toMatch(/usePopoverAnchor\(/)
    expect(conversation).toMatch(/menuAnchorRef=\{menuAnchorRef\}/)
    expect(conversation).toMatch(/menuOpen \? setMenuOpen\(false\) : measureMenu\(\)/)
    expect(conversation).toMatch(/visible=\{menuOpen\}/)
  })

  it("the message context menu shares the primitive's motion values, takeover and all", () => {
    expect(contextMenu).toMatch(/const motion = useMenuMotion\(\{ visible \}\)/)
    expect(contextMenu).not.toMatch(/animationType="fade"/)
    expect(contextMenu).toMatch(/visible=\{rendered\}/)
    expect(contextMenu).toMatch(/menuCardStyle\(motion, cardOrigin\)/)
    expect(contextMenu).toMatch(/menuCardStyle\(motion, reactionOrigin\)/)
    expect(contextMenu).toMatch(/menuCardStyle\(motion, webOrigin\)/)
    expect(contextMenu).toMatch(/pointerEvents=\{motion\.exiting \? "none" : "auto"\}/)
  })

  it("the bubble clone's spring respects reduced motion and stops with the menu", () => {
    expect(contextMenu).toMatch(/if \(motion\.reducedMotion\) \{\s*scale\.setValue\(1\)/)
    expect(contextMenu).toMatch(/useNativeDriver: motion\.useNativeDriver/)
    expect(contextMenu).toMatch(/return \(\) => springIn\.stop\(\)/)
  })

  it("the repost menu is the house PopoverMenu now, so it finally tints the screen behind it", () => {
    expect(postActionBar).toMatch(/<PopoverMenu\s/)
    expect(postActionBar).toMatch(/usePopoverAnchor\(openRepostMenuAt\)/)
    expect(postActionBar).toMatch(/anchorRect=\{repostAnchor\}/)
    expect(postActionBar).toMatch(/items=\{repostMenuItems\}/)
    expect(postActionBar).toMatch(/onClose=\{closeRepostMenu\}/)
    expect(postActionBar).toMatch(/returnFocusRef=\{repostAnchorRef\}/)
    expect(postActionBar).not.toMatch(/<Modal/)
    expect(postActionBar).not.toMatch(/from "\.\/PostActionMenu"/)
  })

  it("left no hand-rolled repost-menu seam behind to drift back out of the house standard", () => {
    for (const rel of [
      "PostActionMenu.tsx",
      "PostActionMenu.web.tsx",
      "PostActionMenu.native.tsx",
      "PostActionMenu.shared.tsx",
      "PostActionMenu.types.ts",
      "PostActionMenu.webBehavior.ts",
    ]) {
      expect(existsSync(join(PRIMITIVES, rel)), rel).toBe(false)
    }
  })

  it("callers that used to unmount on close now stay mounted long enough to animate out", () => {
    expect(inbox).toMatch(/\{menuEverOpened \? \(\s*<PopoverMenu\s+visible=\{menuOpen\}/)
    expect(inbox).not.toMatch(/\{menuOpen \? \(\s*<PopoverMenu\s+visible\s/)
  })
})
