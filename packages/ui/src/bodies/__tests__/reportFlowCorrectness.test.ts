/**
 * The report wizard has no RN renderer in this package, so the wiring below is pinned by SOURCE; the
 * behaviour behind each wire is covered by the pure models in report/__tests__/submitRecovery.test.ts and
 * report/__tests__/draftStore.test.ts.
 */
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { REPORT_TYPES } from "../../report/reportTypes"

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8")
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1")
const flat = (src: string) => src.replace(/\s+/g, " ")

const body = code(read("../ReportFlowBody.tsx"))
const submit = code(read("../../report/submit.ts"))
const reportTypes = code(read("../../report/reportTypes.ts"))

function slice(start: string, end: string): string {
  const from = body.indexOf(start)
  expect(from, start).toBeGreaterThanOrEqual(0)
  return body.slice(from, body.indexOf(end, from))
}

describe("the submit error screen (APP-BUG-157)", () => {
  const errorBranch = flat(slice('if (phase === "error") {', 'return (\n    <View style={styles.stateFill}>\n      <View style={styles.successCheck}>'))

  it("offers Edit report and shows Try again only for a retryable failure", () => {
    expect(errorBranch).toContain('{retryable ? ( <PrimaryButton label={t("submit.try_again")}')
    expect(errorBranch).toContain('label={t("submit.edit_report")}')
    expect(errorBranch).toContain("onPress={onEdit}")
  })

  it("returns to idle on the step the refusal names", () => {
    const edit = flat(slice("const editAfterFailure = useCallback(", "}, [submitRecovery])"))
    expect(edit).toContain('setSubmitPhase("idle")')
    expect(edit).toContain("setStep(target)")
    expect(body).toContain("submitErrorRecovery(appErrorCode(settled.error), appErrorFields(settled.error), stepOrder)")
    expect(body).toContain("onEdit={editAfterFailure}")
  })
})

describe("stale upload ids (APP-BUG-158)", () => {
  it("drops the cached ids when the server refuses them, then rethrows", () => {
    expect(flat(submit)).toContain(
      "} catch (err) { if (invalidatesUploadIds(err)) store.clearMediaUploadIds() throw err }",
    )
  })
})

describe("description budget (APP-BUG-159)", () => {
  it("sizes the description field from the flags that are on", () => {
    expect(body).toContain("maxLength={descriptionMaxLength(draft.flags)}")
    expect(body).not.toContain("maxLength={2000}")
  })
})

describe("report type copy is localized (APP-BUG-161)", () => {
  it("keeps no English copy in the taxonomy", () => {
    expect(reportTypes).not.toMatch(/label:|sub:/)
    for (const type of REPORT_TYPES) expect(Object.keys(type).sort()).not.toContain("label")
  })

  it("renders the label and sub from the catalogs and seeds a localized default title", () => {
    expect(body).toContain("const label = t(`enums:reportType.${type.id}`)")
    expect(body).toContain("const sub = t(`types.${type.id}.sub`)")
    expect(body).toContain('type.glyph ? "" : t(`enums:reportType.${type.id}`), type.id)')
    expect(body).not.toContain("type.label")
    expect(body).not.toContain("type.sub")
  })

  it("has an English label for every report type", () => {
    const enums = JSON.parse(read("../../i18n/locales/en/enums.json")) as { reportType: Record<string, string> }
    for (const type of REPORT_TYPES) expect(enums.reportType[type.id], type.id).toBeTruthy()
  })
})

describe("a cached null centre is resolved again when the picker opens (APP-BUG-162)", () => {
  it("refreshes only while a picker is open, and only past a null cache", () => {
    expect(body).toContain("function useApproxCenter(enabled: boolean, refreshIfNull: boolean): ApproxCenter {")
    expect(body).toContain("staleTime: refreshIfNull ? 0 : Infinity,")
    expect(flat(body)).toContain(
      'useApproxCenter( hasMedia || activeStep === "location" || activeStep === "review" || picking, picking, )',
    )
    expect(body).toContain("const initialCenter = useApproxCenter(true, !compact)")
    const hook = slice("function useApproxCenter(", "\n}\n")
    expect(hook).toContain("if (cached) {\n      setCenter(cached)\n      return\n    }")
  })
})

describe("double taps (APP-BUG-167, APP-BUG-168)", () => {
  it("guards the capture landing with a ref, not the render-time busy flag", () => {
    const land = slice("const land = useCallback(", "\n  )\n")
    expect(land).toContain("if (busyRef.current) return")
    expect(land).toContain("busyRef.current = true")
    expect(land).not.toContain("if (busy) return")
  })

  it("starts every submission through the module-level single-flight slot", () => {
    expect(body).toContain("const submitRuns = createSubmitRunSlot<SubmitSettled>()")
    expect(flat(body)).toContain("const run = submitRuns.start(performSubmit) if (run) followRun(run)")
  })
})

describe("a remount adopts the run it missed (APP-BUG-169)", () => {
  it("opens on the submitting state and follows an unclaimed run", () => {
    expect(flat(body)).toContain('useState<"idle" | "submitting" | "error" | "done">(() => submitRuns.unclaimed() ? "submitting" : "idle", )')
    expect(flat(body)).toContain("const pending = submitRuns.unclaimed() if (pending) followRun(pending)")
    expect(body).toContain("if (!bodyMounted.current) return\n        submitRuns.claim(run)")
  })

  it("does the work of a run outside React state so an unmounted body loses nothing", () => {
    const perform = slice("const performSubmit = useCallback(", "}, [fromComposer, submit, reset, t, haptics])")
    expect(perform).not.toMatch(/setSubmitPhase|setResult|setShareSnapshot|setSubmitError/)
    expect(perform).toContain('return { kind: "done", result: res, share }')
    expect(perform).toContain('return { kind: "error", error: err }')
  })
})

describe("the feed share row (APP-BUG-170)", () => {
  it("seeds once per submitted report instead of mirroring the prop", () => {
    expect(body).not.toContain("useEffect(() => setState(outcome), [outcome])")
    expect(flat(body)).toContain("<FeedShareOutcomeRow key={result.reportId} outcome={result.feedShare} share={share} />")
  })

  it("ignores a retry that settles after unmount", () => {
    expect(body).toContain("if (mounted.current) setState(next)")
    expect(body).toContain("if (mounted.current) setRetrying(false)")
  })
})

describe("capture seeding (APP-BUG-171)", () => {
  it("seeds a new report only from an otherwise empty draft, on both landing paths", () => {
    expect(body).toContain("if (captureSeedsNewReport(useDraftReportStore.getState().draft)) startFromCapture(captured)")
    expect(body).toContain("if (captureSeedsNewReport(store.draft)) store.startFromCapture(media)")
    expect(body).not.toContain("draft.media.length === 0) startFromCapture")
  })
})

describe("post-submit invalidation (APP-BUG-173)", () => {
  it("drops the key that matches nothing and the dead catches", () => {
    expect(submit).not.toContain('["mapReports"]')
    expect(submit).toContain('void queryClient.invalidateQueries({ queryKey: ["map", "reports"] })')
    expect(submit).not.toContain("invalidateQueries({ queryKey: queryKeys.myReportsRoot }).catch")
  })
})

describe("target sizes and radio semantics (APP-A11Y-080, APP-A11Y-085, APP-A11Y-089)", () => {
  it("gives the capture remove button a 30px box around the 22px disc", () => {
    const remove = flat(slice("  captureRemove: {", "  captureHint: {"))
    expect(remove).toContain("width: 30, height: 30")
    expect(remove).toContain("captureRemoveDisc: { width: 22, height: 22")
    expect(body).toContain("<View style={styles.captureRemoveDisc}>")
  })

  it("makes the compact Reset link 44px tall", () => {
    expect(flat(slice("  compactLocClear: {", "  compactLocClearText: {"))).toContain("minHeight: 44")
  })

  it("groups the type rows as a radiogroup and names each row with its sub-line", () => {
    expect(body).toContain('<View style={styles.typeList} accessibilityRole="radiogroup"')
    expect(body).toContain('accessibilityLabel={t("types.row_a11y", { label, sub })}')
    expect(body).toContain("accessibilityState={{ checked: selected }}")
  })
})
