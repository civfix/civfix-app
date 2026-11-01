import assert from "node:assert/strict"
import { createRequire } from "node:module"
import { test } from "node:test"
import { appConfigFactory, pluginOptions } from "./helpers/appConfig.ts"

const require = createRequire(import.meta.url)
const { raisePodDeploymentTargets } = require("../plugins/with-pod-deployment-target.js") as {
  raisePodDeploymentTargets: (podfile: string) => string
}

const PODFILE = `target 'civfix' do
  post_install do |installer|
    react_native_post_install(installer)
  end
end
`

test("the raise runs inside post_install and reads the app's minimum", () => {
  const lines = raisePodDeploymentTargets(PODFILE).split("\n")
  const block = lines.indexOf("  post_install do |installer|")
  assert.match(lines[block + 1] ?? "", /^ {4}# civfix:/)
  assert.ok(lines.includes("    minimum_ios = podfile_properties.fetch('ios.deploymentTarget')"))
})

test("a second prebuild over the same Podfile adds nothing", () => {
  const once = raisePodDeploymentTargets(PODFILE)
  assert.equal(raisePodDeploymentTargets(once), once)
})

test("a Podfile without post_install fails the prebuild", () => {
  assert.throws(() => raisePodDeploymentTargets("target 'civfix' do\nend\n"), /post_install/)
})

test("the app config registers the plugin and sets the minimum it reads", () => {
  const config = appConfigFactory({ config: {} })
  assert.ok(config.plugins.includes("./plugins/with-pod-deployment-target.js"))
  const buildProperties = pluginOptions(config, "expo-build-properties", "no expo-build-properties")
  assert.equal((buildProperties.ios as { deploymentTarget: string }).deploymentTarget, "15.1")
})
