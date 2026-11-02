import { registerHooks } from "node:module"
import { afterEach, beforeEach } from "node:test"
import { startConsoleGuard, stopConsoleGuard } from "@civfix/testing/console"

const APP_ROOT = new URL("../", import.meta.url).href

// The app's TypeScript is ES modules, but package.json cannot say "type": "module": Expo loads
// app.config.js, babel.config.js and metro.config.js as CommonJS. Declaring the format here, for the test
// runner only, spares Node a failed CommonJS parse and its MODULE_TYPELESS_PACKAGE_JSON warning per file.
registerHooks({
  load(url, context, nextLoad) {
    const { pathname } = new URL(url)
    if (
      url.startsWith(APP_ROOT) &&
      pathname.endsWith(".ts") &&
      !pathname.includes("/node_modules/")
    ) {
      return nextLoad(url, { ...context, format: "module-typescript" })
    }
    return nextLoad(url, context)
  },
})

// Node reports process warnings through console.error, so the guard fails a test on those too. The test
// script passes --disable-warning=ExperimentalWarning because the suite runs on what Node 22 still marks
// experimental (type stripping, mock timers, coverage); that notice says nothing about the app.
beforeEach(startConsoleGuard)
afterEach(stopConsoleGuard)
