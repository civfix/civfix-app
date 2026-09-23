import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

const viewfinder = readFileSync(
  new URL("../src/components/report/ReportViewfinder.tsx", import.meta.url),
  "utf8",
)

function callbackBody(name: string): string {
  const start = viewfinder.indexOf(`const ${name} = useCallback(`)
  assert.ok(start > -1, `${name} is gone`)
  const end = viewfinder.indexOf("\n  }, [", start)
  assert.ok(end > start)
  return viewfinder.slice(start, end)
}

test("a failed capture tells the user, with an error toast and an error haptic", () => {
  const report = callbackBody("reportCaptureFailure")
  assert.match(report, /setBusy\(false\)/)
  assert.match(report, /haptics\.error\(\)/)
  assert.match(report, /toast\.show\(t\(failure\), \{ variant: "error" \}\)/)
  assert.match(report, /if \(!mountedRef\.current\) return/)
})

test("every capture path that can fail reports it instead of only clearing the spinner", () => {
  assert.match(callbackBody("onTakePhoto"), /catch \{\s*reportCaptureFailure\("error\.photo"\)\s*\}/)
  assert.match(callbackBody("onPickFromLibrary"), /catch \{\s*reportCaptureFailure\("error\.library"\)\s*\}/)
  assert.match(callbackBody("onToggleRecord"), /catch \{\s*setRecordingState\(false\)\s*reportCaptureFailure\("error\.recording"\)\s*\}/)

  const onError = viewfinder.slice(viewfinder.indexOf("onRecordingError: () => {"))
  assert.match(
    onError.slice(0, onError.indexOf("},")),
    /setRecordingState\(false\)\s*reportCaptureFailure\("error\.recording"\)/,
  )
  assert.doesNotMatch(viewfinder, /catch \{\s*setBusy\(false\)\s*\}/)
})

test("cleanup stops share one justified quiet-stop helper instead of anonymous no-op catches", () => {
  assert.doesNotMatch(viewfinder, /\.catch\(\(\) => \{\}\)/)
  const helper = viewfinder.slice(viewfinder.indexOf("function stopRecordingQuietly"))
  assert.match(viewfinder, /\/\/ .*onRecordingError\.\nfunction stopRecordingQuietly/)
  assert.match(helper, /camera\?\.stopRecording\(\)\.catch\(\(\) => undefined\)/)
  assert.equal((viewfinder.match(/stopRecordingQuietly\(cameraRef\.current\)/g) ?? []).length, 3)
})

test("the shutter exposes its disabled and busy state to screen readers", () => {
  const shutter = viewfinder.slice(viewfinder.indexOf("onPress={mode === \"photo\" ? onTakePhoto : onToggleRecord}"))
  const props = shutter.slice(0, shutter.indexOf("style="))
  assert.match(props, /disabled=\{busy && !recording\}/)
  assert.match(props, /accessibilityState=\{\{ disabled: busy && !recording, busy \}\}/)
})
