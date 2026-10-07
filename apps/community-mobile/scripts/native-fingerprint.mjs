#!/usr/bin/env node
// Prints the Android native fingerprint of the app: a hash of everything that ends up in the native
// build (dependencies with native code, config plugins, the native parts of app.config.js) and nothing
// that only changes JavaScript. A dev-client APK runs the JavaScript of any branch with the same
// fingerprint, so .github/workflows/android-dev-client.yml names its artifact after this hash and the
// agent box's Android QA installs the artifact matching the branch it tests. Both must compute it the
// same way, which is why it lives here.
//
// The `extra` section and the version fields are skipped: they carry the commit and the Play version
// code, which change on every build without changing any native code.
import { createFingerprintAsync, SourceSkips } from "@expo/fingerprint"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const appDir = join(dirname(fileURLToPath(import.meta.url)), "..")
const { hash } = await createFingerprintAsync(appDir, {
  platforms: ["android"],
  sourceSkips: SourceSkips.ExpoConfigExtraSection | SourceSkips.ExpoConfigVersions,
})
process.stdout.write(`${hash}\n`)
