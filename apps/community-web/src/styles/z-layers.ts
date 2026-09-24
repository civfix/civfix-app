/** In-flow decorations lifted over their own component's content, such as table edge fades and chart tooltips. */
const Z_CONSOLE_RAISED = 20

const Z_DETAIL_HEADER = 20

const Z_CONSOLE_TOPBAR = 20

const Z_CONSOLE_BOTTOM_TABS = 30

const Z_CONSOLE_POPOVER = 40

/** Pinned to the viewport bottom while rows are selected, so it has to clear the bottom tabs. */
const Z_CONSOLE_BULK_BAR = 40

/** Drawers and the narrow-viewport bottom sheet: modal layers that open over the page chrome. */
const Z_CONSOLE_SHEET = 50

/** Confirmations and guided sheets can be raised from inside an open drawer, so they sit above it. */
const Z_CONSOLE_DIALOG = 60

/** A toast reports the outcome of a dialog action, so it must not be hidden by the dialog that caused it. */
const Z_CONSOLE_TOAST = 70

const Z_CONSOLE_SKIP_LINK = 80

/** Above the whole AppShell stack, whose layers cap at 71. */
export const Z_APP_BANNER = 100

/** The blocking first-run registration gate covers the app-download banner. */
export const Z_FIRST_RUN_GATE = 200

/** The boot splash never overlaps a user action, so it may cover every layer below it. */
export const Z_BOOT_SPLASH = 300

/**
 * A notice that must stay reachable over every modal layer: the first-run gate, the app-download banner
 * and the auth modal. Only the boot splash and the Turnstile challenge sit higher.
 */
export const Z_SESSION_ALERT = (Z_FIRST_RUN_GATE + Z_BOOT_SPLASH) / 2

/**
 * The sheet awaiting a Turnstile token is a react-native-web Modal at 9999; below it the challenge would
 * show but be unclickable, and aiming at it would dismiss the sheet.
 */
export const Z_TURNSTILE_CHALLENGE = 10500

/** The single z-index scale; tailwind.config.ts turns every key into a `z-<key>` utility. */
export const Z_LAYERS = {
  "detail-header": Z_DETAIL_HEADER,
  "console-raised": Z_CONSOLE_RAISED,
  "console-topbar": Z_CONSOLE_TOPBAR,
  "console-bottom-tabs": Z_CONSOLE_BOTTOM_TABS,
  "console-popover": Z_CONSOLE_POPOVER,
  "console-bulk-bar": Z_CONSOLE_BULK_BAR,
  "console-sheet": Z_CONSOLE_SHEET,
  "console-dialog": Z_CONSOLE_DIALOG,
  "console-toast": Z_CONSOLE_TOAST,
  "console-skip-link": Z_CONSOLE_SKIP_LINK,
  "app-banner": Z_APP_BANNER,
  "first-run-gate": Z_FIRST_RUN_GATE,
  "session-alert": Z_SESSION_ALERT,
  "boot-splash": Z_BOOT_SPLASH,
  "turnstile-challenge": Z_TURNSTILE_CHALLENGE,
} as const satisfies Record<string, number>

/**
 * Marks an element on the session-alert layer. A blocking gate that makes the rest of the page inert
 * must skip it, or a notice already on screen when the gate opens would lose its retry.
 */
export const SESSION_ALERT_ATTR = "data-session-alert"
