import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { sliceBetween } from "../../__tests__/sourceGuards"
import {
  STEP_ORDER_COMPACT,
  STEP_ORDER_EXPANDED,
  stepOrderFor,
  resumeStep,
  stepAfterCapture,
  showsWizardFooter,
  wizardHeaderMode,
  rendersEmbeddedViewfinder,
  showsCaptureCard,
  viewfinderResumeGraceEligible,
  viewfinderSessionActive,
  pickLayerVisible,
} from "../wizardSteps"

const wizardSource = readFileSync(new URL("../../bodies/ReportFlowBody.tsx", import.meta.url), "utf8")
const wizardCode = wizardSource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1")

function viewfinderElement(): string {
  const start = wizardSource.indexOf("<Viewfinder")
  const end = wizardSource.indexOf("/>", start)
  return wizardSource.slice(start, end + 2).replace(/\s+/g, " ")
}

type DraftSlice = Parameters<typeof resumeStep>[0]

function draft(over: Partial<DraftSlice> = {}): DraftSlice {
  return { media: [], lat: null, lng: null, reportTypeId: null, title: "", ...over }
}
const withMedia: Pick<DraftSlice, "media"> = {
  media: [{ id: "m1", uri: "x", kind: "image", mime: "image/jpeg" }],
}

describe("report wizard step model", () => {
  it("inserts the dedicated location step only in the compact order", () => {
    expect(stepOrderFor("compact")).toEqual(STEP_ORDER_COMPACT)
    expect(stepOrderFor("expanded")).toEqual(STEP_ORDER_EXPANDED)
    expect(STEP_ORDER_COMPACT).toContain("location")
    expect(STEP_ORDER_EXPANDED).not.toContain("location")
  })

  it("drops the compact location step when the point was prefilled from outside the wizard", () => {
    expect(stepOrderFor("compact", { skipLocation: true })).toEqual([
      "capture",
      "category",
      "details",
      "review",
    ])
    expect(stepOrderFor("compact", { skipLocation: false })).toEqual(STEP_ORDER_COMPACT)
    expect(stepOrderFor("compact", {})).toEqual(STEP_ORDER_COMPACT)
    expect(stepOrderFor("compact")).toEqual(STEP_ORDER_COMPACT)
    expect(stepOrderFor("expanded", { skipLocation: true })).toEqual(STEP_ORDER_EXPANDED)
  })

  it("resumes at capture for an empty draft (both layouts)", () => {
    expect(resumeStep(draft(), "compact")).toBe("capture")
    expect(resumeStep(draft(), "expanded")).toBe("capture")
  })

  it("resumes at the location step (compact) when media has no fix yet", () => {
    expect(resumeStep(draft({ ...withMedia }), "compact")).toBe("location")
    expect(resumeStep(draft({ ...withMedia }), "expanded")).toBe("category")
  })

  it("resumes at category once media + a location are present but no type is chosen", () => {
    expect(resumeStep(draft({ ...withMedia, lat: 34, lng: -118 }), "compact")).toBe("category")
  })

  it("resumes at details once a category is chosen but the title is still blank", () => {
    expect(
      resumeStep(draft({ ...withMedia, lat: 34, lng: -118, reportTypeId: "pavement" }), "compact"),
    ).toBe("details")
  })

  it("resumes at review once media + location + type + a title are all present", () => {
    expect(
      resumeStep(
        draft({ ...withMedia, lat: 34, lng: -118, reportTypeId: "pavement", title: "Big pothole" }),
        "compact",
      ),
    ).toBe("review")
    expect(
      resumeStep(
        draft({ ...withMedia, lat: 34, lng: -118, reportTypeId: "pavement", title: "   " }),
        "compact",
      ),
    ).toBe("details")
  })

})

describe("stepAfterCapture (the CONTINUE jump off the capture step)", () => {
  const located = { ...withMedia, lat: 34.05, lng: -118.24 }

  it("SKIPS the location step when the shutter already attached a device fix", () => {
    expect(stepAfterCapture(draft(located), "compact", STEP_ORDER_COMPACT)).toBe("category")
  })

  it("still routes to the location step when the capture carried NO fix", () => {
    expect(stepAfterCapture(draft({ ...withMedia }), "compact", STEP_ORDER_COMPACT)).toBe("location")
  })

  it("lands on category in expanded, which has no location step at all", () => {
    expect(stepAfterCapture(draft({ ...withMedia }), "expanded", STEP_ORDER_EXPANDED)).toBe("category")
    expect(stepAfterCapture(draft(located), "expanded", STEP_ORDER_EXPANDED)).toBe("category")
  })

  it("jumps as far as the draft supports - Continue on a filled draft does not rewind it", () => {
    expect(
      stepAfterCapture(
        draft({ ...located, reportTypeId: "pavement", title: "Big pothole" }),
        "compact",
        STEP_ORDER_COMPACT,
      ),
    ).toBe("review")
  })

  it("NEVER names a step the running order does not contain (the orphan guard)", () => {
    const prefilledOrder = stepOrderFor("compact", { skipLocation: true })
    expect(resumeStep(draft({ ...withMedia }), "compact")).toBe("location")
    expect(prefilledOrder).not.toContain("location")
    expect(stepAfterCapture(draft({ ...withMedia }), "compact", prefilledOrder)).toBe("category")
    for (const order of [STEP_ORDER_COMPACT, STEP_ORDER_EXPANDED, prefilledOrder]) {
      for (const mode of ["compact", "expanded"] as const) {
        for (const d of [
          draft({ ...withMedia }),
          draft(located),
          draft({ ...located, reportTypeId: "pavement" }),
          draft({ ...located, reportTypeId: "pavement", title: "t" }),
        ]) {
          expect(order).toContain(stepAfterCapture(d, mode, order))
        }
      }
    }
  })

  it("never answers 'capture' - Continue that lands on the step it was pressed from is a dead button", () => {
    expect(stepAfterCapture(draft(), "compact", STEP_ORDER_COMPACT)).toBe("location")
    expect(stepAfterCapture(draft(), "expanded", STEP_ORDER_EXPANDED)).toBe("category")
    for (const order of [
      STEP_ORDER_COMPACT,
      STEP_ORDER_EXPANDED,
      stepOrderFor("compact", { skipLocation: true }),
    ]) {
      for (const mode of ["compact", "expanded"] as const) {
        expect(stepAfterCapture(draft({ ...withMedia }), mode, order)).not.toBe("capture")
      }
    }
  })

  it("is reached ONLY through the footer's Continue, never from a landed capture (wiring)", () => {
    expect(wizardSource).toContain(
      "setStep(stepAfterCapture(useDraftReportStore.getState().draft, mode, stepOrder))",
    )
    const advance = /const advanceFromCapture = useCallback\(\(\) => \{[\s\S]*?\}, \[[^\]]*\]\)/.exec(
      wizardSource,
    )?.[0]
    expect(advance).toBeTruthy()
    expect(advance).not.toContain("stepOrder[i + 1]")

    const next = /const onNext = useCallback\(\(\) => \{[\s\S]*?\}, \[[^\]]*\]\)/.exec(wizardSource)?.[0]
    expect(next).toBeTruthy()
    expect(next).toContain('if (activeStep === "capture") {')
    expect(next).toContain("advanceFromCapture()")
    expect(next).toContain("setStep(stepOrder[stepIndex + 1] as Step)")

    const callers = (wizardCode.match(/advanceFromCapture\(\)/g) ?? []).length
    expect(callers, "advanceFromCapture has exactly one caller: onNext").toBe(1)
  })

  it("is declared BEFORE onNext, so the Continue callback's dep array can name it", () => {
    expect(wizardSource.indexOf("const advanceFromCapture = useCallback")).toBeLessThan(
      wizardSource.indexOf("const onNext = useCallback"),
    )
  })

  it("stops the location step from force-opening the map over a pin the draft already has", () => {
    expect(wizardSource).toContain('if (activeStep === "location" && !hasLocation) setPicking(true)')
  })
})

describe("the progress rail is gone - the header goes straight into the step body", () => {
  it("renders no rail and keeps the live stepIndex for back/advance", () => {
    expect(wizardCode).not.toContain("ProgressRail")
    expect(wizardCode).not.toContain("railRow")
    expect(wizardSource).toContain("const stepIndex = Math.max(0, stepOrder.indexOf(activeStep))")
    expect(wizardCode).not.toContain("STEP_PHASE")
  })

  it("counts 5 compact steps, 4 in expanded and 4 when the point was prefilled", () => {
    expect(STEP_ORDER_COMPACT.length).toBe(5)
    expect(STEP_ORDER_EXPANDED.length).toBe(4)
    expect(stepOrderFor("compact", { skipLocation: true }).length).toBe(4)
  })

  it("drops the progress copy from every locale, keeping the catalogs orphan-free", () => {
    for (const locale of ["en", "es", "de", "ko"] as const) {
      const bundle = JSON.parse(
        readFileSync(new URL(`../../i18n/locales/${locale}/report-wizard.json`, import.meta.url), "utf8"),
      ) as { header: Record<string, string>; capture: Record<string, string> }
      expect(bundle.header.progress).toBeUndefined()
      expect(bundle.capture.viewfinder_cancel_a11y).toBeUndefined()
    }
  })

  it("drops the camera preview's GPS copy from every locale too, now that no surface reads it", () => {
    for (const locale of ["en", "es", "de", "ko"] as const) {
      const bundle = JSON.parse(
        readFileSync(
          new URL(`../../i18n/locales/${locale}/mobile-report-camera.json`, import.meta.url),
          "utf8",
        ),
      ) as Record<string, unknown>
      expect(bundle.gps, locale).toBeUndefined()
      expect(bundle.shutter, locale).toBeDefined()
    }
  })
})

describe("showsWizardFooter", () => {
  it("hides the Continue CTA on the EMPTY capture root, whose only decision is to capture", () => {
    expect(showsWizardFooter("capture", false)).toBe(false)
  })

  it("DRAWS the CTA the moment media exists - it is the only way off 'Your captures'", () => {
    expect(showsWizardFooter("capture", true)).toBe(true)
  })

  it("shows on the capture review for every source and every arrival, because it reads only hasMedia", () => {
    expect(showsWizardFooter("capture", true)).toBe(true)
    expect(showsWizardFooter("capture", false)).toBe(false)
    expect(rendersEmbeddedViewfinder("capture", true, true, "compact")).toBe(false)
    expect(showsCaptureCard("capture", true, true, "compact")).toBe(false)
    expect(showsCaptureCard("capture", true, false, "compact")).toBe(false)
  })

  it("is exactly the complement of the empty capture root's two faces, in BOTH layouts", () => {
    for (const mode of ["compact", "expanded"] as const) {
      for (const hasViewfinder of [false, true]) {
        const emptyRoot =
          rendersEmbeddedViewfinder("capture", false, hasViewfinder, mode) ||
          showsCaptureCard("capture", false, hasViewfinder, mode)
        expect(emptyRoot).toBe(true)
        expect(showsWizardFooter("capture", false)).toBe(!emptyRoot)
      }
    }
  })

  it("always draws the CTA on every step after capture, in BOTH step orders", () => {
    for (const order of [
      STEP_ORDER_COMPACT,
      STEP_ORDER_EXPANDED,
      stepOrderFor("compact", { skipLocation: true }),
    ]) {
      for (const step of order) {
        if (step === "capture") continue
        expect(showsWizardFooter(step, false)).toBe(true)
        expect(showsWizardFooter(step, true)).toBe(true)
      }
      const hideable = order.filter((s) => !showsWizardFooter(s, false))
      expect(hideable).toEqual(["capture"])
    }
  })
})

describe("wizardHeaderMode", () => {
  it("speaks the tab-root vocabulary ONLY on the compact root step", () => {
    expect(wizardHeaderMode("compact", false, true)).toBe("tab-root")
    expect(wizardHeaderMode("compact", true, false)).toBe("detail")
  })

  it("leaves COMPACT reading `showBack` alone, whatever atViewRoot says (portrait is untouched)", () => {
    for (const showBack of [false, true]) {
      for (const atViewRoot of [false, true]) {
        expect(wizardHeaderMode("compact", showBack, atViewRoot)).toBe(showBack ? "detail" : "tab-root")
      }
    }
  })

  it("speaks the tab-root vocabulary at the LANDSCAPE view root, where the rail is now the exit", () => {
    expect(wizardHeaderMode("expanded", true, true)).toBe("tab-root")
    expect(wizardHeaderMode("expanded", false, true)).toBe("tab-root")
  })

  it("reverts to the detail vocabulary on every landscape step PAST the root", () => {
    expect(wizardHeaderMode("expanded", true, false)).toBe("detail")
    expect(wizardHeaderMode("expanded", false, false)).toBe("detail")
  })

  it("switches on exactly the same boolean the back chevron is gated on", () => {
    expect(wizardSource).toContain(
      "const showBack = useNavStore((s) => showBackAffordance({ stack: s.stack, mode, stepIndex }))",
    )
    expect(wizardSource).toContain('wizardHeaderMode(mode, showBack, atViewRoot) === "tab-root"')
    expect(wizardSource).toContain("{showBack ? (")
  })

  it("derives atViewRoot from the step index AND the nav stack, at the one call site", () => {
    expect(wizardSource).toContain("const atViewRoot = stepIndex === 0 && !stackNonEmpty")
  })
})

describe("the capture step's embedded viewfinder wiring", () => {
  it("DERIVES the camera from the draft - there is no open/closed state left to go stale", () => {
    expect(wizardSource).toContain(
      "const viewfinderVisible = rendersEmbeddedViewfinder(activeStep, hasMedia, Viewfinder != null, mode)",
    )
    expect(wizardCode).not.toContain("viewfinderOpen")
    expect(wizardCode).not.toContain("setViewfinderOpen")
    expect(wizardCode).not.toContain("shouldCloseViewfinder")
    expect(wizardCode).not.toContain("opensEmbeddedViewfinderOnEnter")
    expect(wizardCode).not.toContain("stepCameraAutoOpen")
    expect(wizardCode).not.toContain("autoOpened.current")
  })

  it("defers CONSTRUCTING the camera past the tab transition, without flashing the card it replaced", () => {
    expect(wizardSource).toContain(
      "const handle = setTimeout(() => setViewfinderMountable(true), VIEWFINDER_MOUNT_DELAY_MS)",
    )
    expect(wizardSource).toContain("{viewfinderVisible ? (")
    expect(wizardSource).toContain("const viewfinderMounted = viewfinderVisible && viewfinderMountable")
    expect(wizardSource).toContain("{viewfinderMounted && Viewfinder ? (")
  })

  it("gates the camera SESSION on the shared predicate, not merely on being mounted", () => {
    expect(wizardSource).toContain(
      "viewfinderSessionActive(activeStep, viewfinderMounted, stackNonEmpty, runActive)",
    )
    expect(wizardSource).toContain("active={sessionActive}")
    expect(wizardSource).toContain('const runActive = useNavStore((s) => s.view === "report")')
  })

  it("draws NO chrome of its own over the injected surface - the two stacked X buttons are gone", () => {
    expect(viewfinderElement()).toContain("active={sessionActive}")
    expect(viewfinderElement()).toContain("onCaptured={onViewfinderCaptured}")
    expect(viewfinderElement()).not.toContain("onCancel")
    expect(wizardCode).not.toContain("closeViewfinder")
    expect(wizardCode).not.toContain("viewfinderCancel")
    expect(wizardCode).not.toContain("viewfinder_cancel_a11y")
  })

  it("paints the camera slot on the app's own warm surface, edge to edge", () => {
    const layer = /viewfinderLayer: \{[^}]*\}/.exec(wizardSource)?.[0] ?? ""
    expect(layer).toContain("flex: 1")
    expect(layer).toContain("backgroundColor: t.colors.bg")
    expect(layer).not.toContain("neutral.ink")
    expect(layer).not.toContain("marginHorizontal")
    expect(layer).not.toContain("padding")
    expect(layer).not.toContain("marginBottom")
  })

  it("renders the viewfinder OUTSIDE the shared vertical ScrollView, and never in expanded", () => {
    const viewfinder = wizardSource.indexOf("style={styles.viewfinderLayer}")
    const scrollBody = wizardSource.indexOf("contentContainerStyle={[")
    expect(viewfinder).toBeGreaterThan(0)
    expect(viewfinder).toBeLessThan(scrollBody)
    expect(rendersEmbeddedViewfinder("capture", false, true, "expanded")).toBe(false)
  })
})

describe("the capture step keeps its header attached to its content", () => {
  const styleBlock = (name: string): string => {
    const start = wizardSource.indexOf(`  ${name}: {`)
    expect(start, `${name} is gone from ReportFlowBody.tsx - rename the guard, do not delete it`).toBeGreaterThan(-1)
    const end = wizardSource.indexOf("\n  },", start)
    return wizardSource.slice(start, end === -1 ? undefined : end)
  }

  it("TOP-aligns the filling block, so surplus height lands under the content and not above it", () => {
    const fill = styleBlock("stepBlockFill")
    expect(fill).toContain("flex: 1")
    expect(fill).toContain('justifyContent: "flex-start"')
    expect(fill).not.toContain('justifyContent: "center"')
  })

  it("still caps the coral card, so the fill cannot become a wall of colour", () => {
    expect(styleBlock("photoDropFill")).toContain("maxHeight: 520")
    expect(wizardSource).toContain("mode === \"expanded\" && activeStep === \"capture\" && !hasMedia ? styles.contentFill : null")
    expect(wizardSource).toContain("fill ? styles.stepBlockFill : null")
  })
})

describe("the report root's chrome", () => {
  const luminance = (hex: string) => {
    const ch = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    const lin = ch.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    return 0.2126 * (lin[0] as number) + 0.7152 * (lin[1] as number) + 0.0722 * (lin[2] as number)
  }
  const contrast = (a: string, b: string) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
    return (hi + 0.05) / (lo + 0.05)
  }
  const CARD = "#FFFDF8"
  const BLOOM_500 = "#F0685C"
  const BLOOM_700 = "#C74537"

  it("keeps the capture card's copy above the 4.5:1 AA floor", () => {
    expect(contrast(CARD, BLOOM_500)).toBeLessThan(4.5)
    expect(contrast(CARD, BLOOM_700)).toBeGreaterThanOrEqual(4.5)
    expect(wizardSource).toContain('backgroundColor: t.colors.bloom["700"]')
    const sub = /photoDropSub: \{[^}]*\}/.exec(wizardSource)?.[0] ?? ""
    expect(sub).toContain("t.colors.neutral.card")
    expect(sub).not.toContain("opacity")
  })

  it("gives the 32pt root title the SAME left edge as the step body", () => {
    const rootRow = /headerRootRow: \{[^}]*\}/.exec(wizardSource)?.[0] ?? ""
    expect(rootRow).toContain('paddingHorizontal: t.space["4"]')
    expect(rootRow).not.toMatch(/margin(Horizontal|Left)/)
    expect(/\n {2}content: \{[^}]*\}/.exec(wizardSource)?.[0] ?? "").toContain(
      'paddingHorizontal: t.space["4"]',
    )
  })
})

describe("the capture strip's media identity", () => {
  it("keys and removes by the stable DraftMedia.id, never by the uri", () => {
    expect(wizardSource).toContain("key={m.id}")
    expect(wizardSource).toContain("onPress={() => removeMedia(m.id)}")
    expect(wizardSource).not.toContain("key={m.uri}")
    expect(wizardSource).not.toContain("removeMedia(m.uri)")
  })
})

describe("rendersEmbeddedViewfinder", () => {
  it("mounts the viewfinder when a host injected one and the draft is empty", () => {
    expect(rendersEmbeddedViewfinder("capture", false, true, "compact")).toBe(true)
  })

  it("never mounts one on a host that injected none - which is the WEB answer", () => {
    expect(rendersEmbeddedViewfinder("capture", false, false, "compact")).toBe(false)
    expect(rendersEmbeddedViewfinder("capture", true, false, "compact")).toBe(false)
  })

  it("leaves a draft that already has media alone", () => {
    expect(rendersEmbeddedViewfinder("capture", true, true, "compact")).toBe(false)
  })

  it("never embeds in EXPANDED - the iPad sidebar card has no dock and no tab-bar base inset", () => {
    expect(rendersEmbeddedViewfinder("capture", false, true, "expanded")).toBe(false)
    expect(rendersEmbeddedViewfinder("capture", false, true, "compact")).toBe(true)
  })

  it("only ever fires on the capture step, in both step orders", () => {
    for (const [order, mode] of [
      [STEP_ORDER_COMPACT, "compact"],
      [STEP_ORDER_EXPANDED, "expanded"],
    ] as const) {
      for (const step of order) {
        if (step === "capture") continue
        expect(rendersEmbeddedViewfinder(step, false, true, mode)).toBe(false)
        expect(rendersEmbeddedViewfinder(step, true, true, mode)).toBe(false)
      }
    }
  })
})

describe("viewfinderSessionActive", () => {
  it("runs the capture session while the viewfinder is up on the capture step, nothing covers it, and the Report view is the visible one", () => {
    expect(viewfinderSessionActive("capture", true, false, true)).toBe(true)
  })

  it("releases the session the moment the wizard leaves capture", () => {
    expect(viewfinderSessionActive("category", true, false, true)).toBe(false)
    expect(viewfinderSessionActive("location", true, false, true)).toBe(false)
    expect(viewfinderSessionActive("review", true, false, true)).toBe(false)
  })

  it("releases the session when a detail sheet is pushed OVER the Report tab", () => {
    expect(viewfinderSessionActive("capture", true, true, true)).toBe(false)
  })

  it("is false whenever the viewfinder is not up at all", () => {
    expect(viewfinderSessionActive("capture", false, false, true)).toBe(false)
    expect(viewfinderSessionActive("capture", false, true, true)).toBe(false)
  })

  describe("the Search-overlay sequence", () => {
    it("releases the session the instant Search opens over the Report tab, with every other input unchanged", () => {
      expect(viewfinderSessionActive("capture", true, false, true)).toBe(true)
      expect(viewfinderSessionActive("capture", true, false, false)).toBe(false)
    })

    it("resumes the session the instant Search closes back to the Report tab", () => {
      expect(viewfinderSessionActive("capture", true, false, false)).toBe(false)
      expect(viewfinderSessionActive("capture", true, false, true)).toBe(true)
    })

    it("stays released if Search is opened AND a detail sheet is pushed - the two non-unmount gates both apply", () => {
      expect(viewfinderSessionActive("capture", true, true, false)).toBe(false)
    })
  })
})

describe("viewfinderResumeGraceEligible", () => {
  it("is the ONE case it exists for: the camera would be running if the reporter had not tabbed away", () => {
    expect(viewfinderSessionActive("capture", true, false, true)).toBe(true)
    expect(viewfinderSessionActive("capture", true, false, false)).toBe(false)
    expect(viewfinderResumeGraceEligible("capture", true, false, false)).toBe(true)
  })

  it("is never offered while the Report view IS the visible one - there is nothing to resume", () => {
    expect(viewfinderResumeGraceEligible("capture", true, false, true)).toBe(false)
  })

  it("refuses a detail presenting over the wizard - that is not a glance away, it is another surface", () => {
    expect(viewfinderResumeGraceEligible("capture", true, true, false)).toBe(false)
  })

  it("refuses every step but capture, and an unmounted surface", () => {
    for (const step of STEP_ORDER_COMPACT.filter((s) => s !== "capture")) {
      expect(viewfinderResumeGraceEligible(step, true, false, false), step).toBe(false)
    }
    expect(viewfinderResumeGraceEligible("capture", false, false, false)).toBe(false)
  })

  it("is EXACTLY the session predicate with the view forced true, for every input combination", () => {
    for (const step of STEP_ORDER_COMPACT) {
      for (const mounted of [false, true]) {
        for (const covered of [false, true]) {
          for (const isReportView of [false, true]) {
            expect(
              viewfinderResumeGraceEligible(step, mounted, covered, isReportView),
              `${step}/${mounted}/${covered}/${isReportView}`,
            ).toBe(!isReportView && viewfinderSessionActive(step, mounted, covered, true))
          }
        }
      }
    }
  })
})

describe("the cream capture card is unreachable wherever the camera is the capture step", () => {
  it("is never shown on a compact host that injected a Viewfinder, for any draft", () => {
    for (const step of STEP_ORDER_COMPACT) {
      for (const hasMedia of [false, true]) {
        expect(showsCaptureCard(step, hasMedia, true, "compact")).toBe(false)
      }
    }
  })

  it("still shows it on WEB (no injected Viewfinder) and in LANDSCAPE - both untouched by this change", () => {
    expect(showsCaptureCard("capture", false, false, "compact")).toBe(true)
    expect(showsCaptureCard("capture", false, true, "expanded")).toBe(true)
    expect(showsCaptureCard("capture", true, false, "compact")).toBe(false)
    expect(showsCaptureCard("category", false, false, "compact")).toBe(false)
  })

  it("is the exact complement of the camera on the empty capture step - the two cannot both be false", () => {
    for (const mode of ["compact", "expanded"] as const) {
      for (const hasViewfinder of [false, true]) {
        const camera = rendersEmbeddedViewfinder("capture", false, hasViewfinder, mode)
        const card = showsCaptureCard("capture", false, hasViewfinder, mode)
        expect(camera !== card).toBe(true)
      }
    }
  })

  it("keeps the multi-capture affordances OFF the cream card and inside the flow (wiring)", () => {
    expect(wizardSource).toContain("<CaptureStep mode={mode} />")
    expect(wizardCode).not.toContain("onOpenViewfinder")
    expect(wizardSource).toContain("onPress={() => removeMedia(m.id)}")
  })
})

describe("a landed capture lands on 'Your captures', it does not advance the wizard", () => {
  it("gives CaptureStep no advance callback at all - the prop is gone, not merely unused", () => {
    expect(wizardCode).not.toContain("onFirstCapture")
    expect(wizardSource).toContain("function CaptureStep({ mode }: { mode: LayoutMode })")
    expect(wizardSource).toContain("<CaptureStep mode={mode} />")
  })

  it("has CaptureStep's landing seed or append the draft and STOP - camera and library alike", () => {
    const land = /const land = useCallback\(\n\s*async \(produce[\s\S]*?\n {4}\[[^\]]*\],\n {2}\)/.exec(
      wizardSource,
    )?.[0]
    expect(land).toBeTruthy()
    expect(land).toContain("if (captureSeedsNewReport(useDraftReportStore.getState().draft)) startFromCapture(captured)")
    expect(land).toContain("else addCapture(captured)")
    expect(land).not.toContain("setStep")
    expect(land).not.toContain("advance")
    expect(wizardSource).toContain('kind === "capture"')
    expect(wizardSource).toContain("() => camera.pickFromLibrary()")
  })

  it("has the EMBEDDED viewfinder's landing do the same, so both layouts land on the review", () => {
    const onCaptured = /const onViewfinderCaptured = useCallback\(\(media: CapturedMedia\) => \{[\s\S]*?\}, \[[^\]]*\]\)/.exec(
      wizardSource,
    )?.[0]
    expect(onCaptured).toBeTruthy()
    expect(onCaptured).toContain("store.startFromCapture(media)")
    expect(onCaptured).toContain("store.addCapture(media)")
    expect(onCaptured).not.toContain("advanceFromCapture")
    expect(onCaptured).not.toContain("setStep")
  })

  it("swaps the camera for the review on the SAME derived gate, with no step change involved", () => {
    expect(rendersEmbeddedViewfinder("capture", false, true, "compact")).toBe(true)
    expect(rendersEmbeddedViewfinder("capture", true, true, "compact")).toBe(false)
    expect(showsCaptureCard("capture", false, true, "expanded")).toBe(true)
    expect(showsCaptureCard("capture", true, true, "expanded")).toBe(false)
    expect(showsWizardFooter("capture", true)).toBe(true)
  })

  it("keeps the wizard ON capture for a whole multi-capture session (model-level)", () => {
    for (const mode of ["compact", "expanded"] as const) {
      expect(rendersEmbeddedViewfinder("capture", true, true, mode)).toBe(false)
      expect(showsCaptureCard("capture", true, true, mode)).toBe(false)
      expect(showsWizardFooter("capture", true)).toBe(true)
    }
  })
})

describe("the capture review shows no location banner", () => {
  it("draws no reverse-geocoded chip anywhere in the capture step", () => {
    expect(wizardCode).not.toContain("LocatedChip")
    expect(wizardCode).not.toContain("locatedChip")
    expect(wizardCode).not.toContain("locatedDisplay")
    expect(wizardCode).not.toContain("locatedLabel")
  })

  it("leaves the location surfaces that DO belong to the flow untouched", () => {
    expect(wizardCode).toContain("function CompactLocationField(")
    expect(wizardCode).toContain("const label = useReverseLabel(point)")
    expect(wizardSource).toContain('<Text style={styles.fieldLabel}>{t("review.where_label")}</Text>')
  })

  it("stops CaptureStep reading the draft's coordinate at all", () => {
    const captureStep = sliceBetween(wizardSource, "function CaptureStep(", "function CategoryStep(")
    expect(captureStep).not.toContain("useReverseLabel")
    expect(captureStep).not.toContain("reverseLabelText")
    expect(captureStep).not.toContain("s.draft.lat")
    expect(captureStep).toContain('t("capture.hint_add_more"')
  })
})

describe("the derived-viewfinder wiring (source-pinned)", () => {
  it("keeps the camera gate a pure render-time derivation with no state and no effect behind it", () => {
    const gate = "const viewfinderVisible = rendersEmbeddedViewfinder(activeStep, hasMedia, Viewfinder != null, mode)"
    expect(wizardSource).toContain(gate)
    expect(wizardSource).not.toMatch(/useState[^\n]*rendersEmbeddedViewfinder/)
    expect(wizardCode).not.toMatch(/setViewfinder(Visible|Open)/)
  })

  it("keeps the deferral cancellable, mount-scoped, and on a clock that actually defers", () => {
    const effect =
      /useEffect\(\(\) => \{\n\s*const handle = setTimeout[\s\S]*?\}, \[\]\)/.exec(
        wizardSource,
      )?.[0]
    expect(effect).toBeTruthy()
    expect(effect).toContain("clearTimeout(handle)")
    expect(wizardSource).toContain("const VIEWFINDER_MOUNT_DELAY_MS = motion.pagePush.duration")
    expect(wizardSource).not.toMatch(/InteractionManager/)
  })

  it("passes the host surface ONLY what the capability contract says it gets", () => {
    const branchStart = wizardSource.indexOf("{viewfinderVisible ? (")
    expect(branchStart).toBeGreaterThan(-1)
    const branchEnd = wizardSource.indexOf(") : (", branchStart)
    expect(branchEnd).toBeGreaterThan(branchStart)
    const branch = wizardSource.slice(branchStart, branchEnd).replace(/\s+/g, " ")
    expect(branch).toContain("<Viewfinder active={sessionActive}")
    expect(branch).toContain("onCaptured={onViewfinderCaptured}")
    expect(branch).not.toContain("onCancel")
    expect(branch).not.toContain("Pressable")
  })
})

describe("pickLayerVisible", () => {
  it("renders the layer while the reporter is picking ON the live Report tab with nothing over it", () => {
    expect(pickLayerVisible(true, false, true)).toBe(true)
  })

  it("renders NOTHING when the body is detached, however open `picking` still is", () => {
    expect(pickLayerVisible(true, false, false)).toBe(false)
  })

  it("renders nothing under a pushed detail either - the same 'mounted but not on screen' case", () => {
    expect(pickLayerVisible(true, true, true)).toBe(false)
    expect(pickLayerVisible(true, true, false)).toBe(false)
  })

  it("is false whenever the reporter is not picking at all", () => {
    for (const covered of [false, true]) {
      for (const live of [false, true]) {
        expect(pickLayerVisible(false, covered, live)).toBe(false)
      }
    }
  })

  it("reads the SAME two liveness inputs as the camera gate, so the two surfaces cannot drift", () => {
    for (const covered of [false, true]) {
      for (const live of [false, true]) {
        expect(pickLayerVisible(true, covered, live)).toBe(
          viewfinderSessionActive("capture", true, covered, live),
        )
      }
    }
  })

  it("gates the RENDER only - returning to the tab restores the picker with no rewind", () => {
    const picking = true
    expect(pickLayerVisible(picking, false, true)).toBe(true)
    expect(pickLayerVisible(picking, false, false)).toBe(false)
    expect(pickLayerVisible(picking, false, true)).toBe(true)
  })
})

describe("the pick layer's liveness wiring (source-pinned)", () => {
  it("passes the GATED value to PortraitMapPickStep, never the bare `picking` flag", () => {
    expect(wizardSource).toContain(
      "const pickLayerOpen = pickLayerVisible(picking, stackNonEmpty, runActive)",
    )
    expect(wizardSource).toContain("visible={pickLayerMounted}")
    expect(wizardSource).toContain("inert={!pickLayerOpen}")
    expect(wizardCode).not.toContain("visible={picking}")
  })

  it("does NOT clear `picking` on detach - the state is what survives the tab switch", () => {
    const setters = wizardCode.match(/setPicking\(/g) ?? []
    expect(setters.length).toBe(4)
    expect(wizardCode).not.toMatch(/view !== "report"[^\n]*setPicking/)
  })
})

describe("the wizard's STEP transition (source-pinned)", () => {
  const stepNative = readFileSync(
    new URL("../../shell/StepTransition.native.tsx", import.meta.url),
    "utf8",
  )
  const stepWeb = readFileSync(new URL("../../shell/StepTransition.web.tsx", import.meta.url), "utf8")

  it("derives the direction from the STEP INDEX, through the shell's shared derivation", () => {
    expect(wizardCode).toContain('import { useStackDirection } from "../shell/useStackDirection"')
    expect(wizardCode).toContain("const stepDirection = useStackDirection(stepIndex)")
    expect(wizardCode).toContain("const stepIndex = Math.max(0, stepOrder.indexOf(activeStep))")
  })

  it("animates the STEP BODY only - the header, viewfinder layer and footer CTA stay put", () => {
    const transition = sliceBetween(wizardSource, "<StepTransition", "</StepTransition>")
    expect(transition).toContain("transitionKey={activeStep}")
    expect(transition).toContain("direction={stepDirection}")
    for (const step of ["CaptureStep", "LocationStep", "CategoryStep", "DetailsStep", "ReviewStep"]) {
      expect(transition, step).toContain(step)
    }
    expect(transition).not.toContain("Viewfinder")
    expect(transition).not.toContain("styles.footer")
    expect(transition).not.toContain("headerRootRow")
  })

  it("keeps the scroll host, its ref and the keyboard behaviour OUTSIDE the animated layer", () => {
    const scroll = sliceBetween(wizardSource, "<ScrollView", "<StepTransition")
    expect(scroll).toContain("ref={scrollRef}")
    expect(scroll).toContain('keyboardShouldPersistTaps="handled"')
  })

  it("preserves the expanded capture step's fill layout through the wrapper", () => {
    expect(wizardCode).toMatch(
      /mode === "expanded" && activeStep === "capture" && !hasMedia \? styles\.stepHostFill : null/,
    )
    expect(wizardCode).toMatch(/stepHostFill: \{ flexGrow: 1 \}/)
  })

  it("slides forward from the right and back from the left, on the shared body-transition plan", () => {
    for (const [name, src] of [
      ["native", stepNative],
      ["web", stepWeb],
    ] as const) {
      expect(src, name).toContain("BODY_TIMING")
      expect(src, name).toMatch(/bodyTransitionPlan\(direction, /)
      expect(src, name).not.toMatch(/duration: \d+/)
    }
  })

  it("short-circuits the step slide on the platform's reduce-motion signal", () => {
    expect(stepNative).toMatch(/useReducedMotion\(\) === true/)
    expect(stepNative).toMatch(/bodyTransitionPlan\(direction, reduceMotionRef\.current, BODY_TIMING\)/)
    expect(stepWeb).toMatch(/if \(prefersReducedMotion\(\)\) \{\s*setEntrance\(null\)/)
  })
})
