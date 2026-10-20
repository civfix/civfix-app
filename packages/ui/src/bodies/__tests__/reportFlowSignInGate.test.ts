/**
 * Filing a report needs an account. Every entry into the flow (the Report tab, the map's "Report an issue
 * here", a /report link) renders ReportFlowBody, so the gate lives there: signed out, the sign-in prompt
 * replaces the wizard and its camera, and signing in comes back to /report on the first step. The body
 * cannot load under vitest (native-only modules behind the primitives and the map), so this reads it.
 */
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { sliceBetween, sliceFrom } from "../../__tests__/sourceGuards"
import en from "../../i18n/locales/en/report-wizard.json"

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8")
const code = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1")

const body = code(read("../ReportFlowBody.tsx"))
const gate = sliceBetween(body, "export function ReportFlowBody() {", "function ReportSignedOut(")
const signedOut = sliceBetween(body, "function ReportSignedOut(", "function ReportFlowHeader(")
const wizard = sliceBetween(body, "function ReportWizard() {", "const HEADER_PAD_COMPACT")

describe("the report flow's sign-in gate", () => {
  it("mounts the wizard only for a signed-in viewer", () => {
    expect(gate).toContain("const { isAuthenticated, isPending } = useAuthState()")
    expect(gate).toContain("if (isAuthenticated) return <ReportWizard />")
    expect(gate).toContain("return <ReportSignedOut pending={isPending} />")
    expect(sliceFrom(body, "export function ReportFlowBody() {").match(/<ReportWizard \/>/g)).toHaveLength(1)
  })

  it("never touches the camera while signed out", () => {
    for (const camera of ["useCamera(", "Viewfinder", "CaptureStep", "useReportRunClaim("]) {
      expect(signedOut, camera).not.toContain(camera)
      expect(gate, camera).not.toContain(camera)
    }
    expect(body.match(/useCamera\(\)/g)).toHaveLength(1)
    expect(wizard).toContain("const camera = useCamera()")
  })

  it("shows the loading state while the session check is pending, and the prompt after it", () => {
    expect(signedOut).toMatch(/\{pending \? \(\s*<LoadingState variant="detail" \/>\s*\) : \(\s*<SignInPrompt/)
  })

  it("prompts with the report copy and signs in back to /report", () => {
    expect(signedOut).toContain('title={t("signin.title")}')
    expect(signedOut).toContain('body={t("signin.body")}')
    expect(signedOut).toContain('onSignIn={() => requireAuth(() => {}, { next: "/report" })}')
    expect(en.signin).toEqual({
      title: "Sign in to report a problem",
      body: "Sign in or create an account to report problems in your neighborhood.",
    })
  })

  it("keeps the flow's own header above the prompt, with its way back", () => {
    expect(signedOut).toContain(
      "<ReportFlowHeader showBack={showBack} atViewRoot={!stackNonEmpty} onBack={onBack} />",
    )
    expect(signedOut).toContain("showBackAffordance({ stack: s.stack, mode, stepIndex: 0 })")
    expect(signedOut).toContain("useNavStore.getState().leaveReportFlow()")
    expect(wizard).toContain("<ReportFlowHeader showBack={showBack} atViewRoot={atViewRoot} onBack={onBack} />")
  })
})
