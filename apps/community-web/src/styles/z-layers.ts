/**
 * A notice that must stay reachable over every modal layer: the first-run registration gate (200), the
 * app-download banner (100) and the auth modal (70). Only the boot splash (300), which never overlaps a
 * user action, and the Turnstile challenge sit higher.
 */
export const Z_SESSION_ALERT = 250
