import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const read = (relative: string): string => readFileSync(new URL(relative, import.meta.url), "utf8")

const code = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

const REPORT_FLOW = code(read("../ReportFlowBody.tsx"))
const COMPOSER_ATTACHMENTS = code(read("../../primitives/useComposerAttachments.ts"))

describe("an over-limit video is refused before it is used", () => {
  it("the report wizard checks a capture before it lands in the draft", () => {
    expect(REPORT_FLOW).toMatch(
      /if \(await camera\.exceedsVideoLimits\?\.\(captured\)\) \{\s*setHint\(t\("common:media\.video_limits"\)\)\s*return\s*\}/,
    )
    expect(REPORT_FLOW.indexOf("camera.exceedsVideoLimits")).toBeLessThan(REPORT_FLOW.indexOf("startFromCapture(captured)"))
  })

  it("the embedded viewfinder checks a capture before it lands in the draft", () => {
    const callback = REPORT_FLOW.slice(REPORT_FLOW.indexOf("const onViewfinderCaptured"))
    expect(callback).toMatch(
      /^const onViewfinderCaptured = useCallback\(\s*async \(media: CapturedMedia\) => \{\s*if \(await camera\.exceedsVideoLimits\?\.\(media\)\) \{\s*toast\.show\(t\("common:media\.video_limits"\), \{ variant: "error" \}\)\s*return\s*\}/,
    )
    expect(callback.indexOf("camera.exceedsVideoLimits")).toBeLessThan(callback.indexOf("startFromCapture(media)"))
  })

  it("the chat composer checks a pick before it uploads it", () => {
    expect(COMPOSER_ATTACHMENTS).toMatch(
      /if \(await camera\.exceedsVideoLimits\?\.\(picked\)\) \{\s*setAttachError\(t\("media\.video_limits"\)\)\s*return\s*\}/,
    )
    expect(COMPOSER_ATTACHMENTS.indexOf("camera.exceedsVideoLimits")).toBeLessThan(
      COMPOSER_ATTACHMENTS.indexOf("uploadMediaId({"),
    )
  })
})
