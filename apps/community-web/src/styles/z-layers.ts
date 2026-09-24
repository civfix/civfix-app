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
 * Marks an element on the session-alert layer. A blocking gate that makes the rest of the page inert
 * must skip it, or a notice already on screen when the gate opens would lose its retry.
 */
export const SESSION_ALERT_ATTR = "data-session-alert"
