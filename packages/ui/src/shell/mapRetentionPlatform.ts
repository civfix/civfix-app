/**
 * Whether the compact shell keeps one map mounted under every view (native) or tears it down on leaving
 * the Map tab (web); Metro resolves the `.native` sibling. The flag is threaded into `portraitShellPlan`
 * from AppShell rather than imported by bodyLayout, so that module stays testable at both values.
 *
 * Web stays false: its maplibre-gl WebGL context would stay resident under every mobile-web page for no
 * gain. The cost being avoided is native-only: an AVCaptureSession and a MapLibre GL surface constructed
 * in the same tab tap.
 */
export const MAP_IS_RETAINED = false
