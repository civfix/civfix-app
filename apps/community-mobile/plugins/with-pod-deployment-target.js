// @ts-check
const { withPodfile } = require("expo/config-plugins")

const MARKER = "# civfix: raise pod targets below the app's minimum iOS"

// react_native_post_install raises each pod's main target but not its resource bundles, which keep the
// minimum their podspec declares. Xcode 27 fails the build on any target below iOS 15.0.
const RAISE_POD_TARGETS = `    ${MARKER}
    minimum_ios = podfile_properties.fetch('ios.deploymentTarget')
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        current = config.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
        if current && Gem::Version.new(current) < Gem::Version.new(minimum_ios)
          config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = minimum_ios
        end
      end
    end
`

const POST_INSTALL = /^ *post_install do \|installer\|\n/m

/** @param {string} podfile */
function raisePodDeploymentTargets(podfile) {
  if (podfile.includes(MARKER)) return podfile
  if (!POST_INSTALL.test(podfile)) {
    throw new Error("with-pod-deployment-target: the Podfile has no post_install block to extend")
  }
  return podfile.replace(POST_INSTALL, (block) => block + RAISE_POD_TARGETS)
}

/** @type {import("expo/config-plugins").ConfigPlugin} */
const withPodDeploymentTarget = (config) =>
  withPodfile(config, (podfile) => {
    podfile.modResults.contents = raisePodDeploymentTargets(podfile.modResults.contents)
    return podfile
  })

module.exports = withPodDeploymentTarget
module.exports.raisePodDeploymentTargets = raisePodDeploymentTargets
