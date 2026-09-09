// @ts-check
const { withDangerousMod } = require("expo/config-plugins")
const fs = require("fs")
const path = require("path")

const FMT_DEFINE = "FMT_USE_CONSTEVAL=0"

module.exports = function withFmtConstevalFix(config) {
  return withDangerousMod(config, [
    "ios",
    (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, "Podfile")
      const podfile = fs.readFileSync(podfilePath, "utf8")
      if (podfile.includes("fmt_fix_base_h")) return cfg
      if (podfile.includes(FMT_DEFINE)) {
        throw new Error(
          "with-fmt-consteval-fix: Podfile carries an outdated fmt fix block — regenerate it with expo prebuild --clean",
        )
      }
      const anchor = /post_install do \|installer\|\n/
      if (!anchor.test(podfile)) {
        throw new Error("with-fmt-consteval-fix: Podfile has no post_install block to patch")
      }
      const patched = podfile.replace(
        anchor,
        [
          "post_install do |installer|",
          '    fmt_fix_base_h = File.expand_path("Pods/fmt/include/fmt/base.h", __dir__)',
          "    if File.exist?(fmt_fix_base_h)",
          "      fmt_fix_src = File.read(fmt_fix_base_h)",
          '      unless fmt_fix_src.include?("#if defined(FMT_USE_CONSTEVAL)")',
          "        File.chmod(0644, fmt_fix_base_h)",
          "        fmt_fix_src = fmt_fix_src.sub(",
          '          "#if !defined(__cpp_lib_is_constant_evaluated)",',
          '          "#if defined(FMT_USE_CONSTEVAL)\\n#elif !defined(__cpp_lib_is_constant_evaluated)",',
          "        )",
          "        File.write(fmt_fix_base_h, fmt_fix_src)",
          "      end",
          "    end",
          "    installer.pods_project.targets.each do |fmt_fix_target|",
          "      fmt_fix_target.build_configurations.each do |fmt_fix_config|",
          '        fmt_defs = Array(fmt_fix_config.build_settings["GCC_PREPROCESSOR_DEFINITIONS"] || ["$(inherited)"])',
          `        fmt_defs << "${FMT_DEFINE}" unless fmt_defs.include?("${FMT_DEFINE}")`,
          '        fmt_fix_config.build_settings["GCC_PREPROCESSOR_DEFINITIONS"] = fmt_defs',
          "      end",
          "    end",
          "",
        ].join("\n"),
      )
      fs.writeFileSync(podfilePath, patched)
      return cfg
    },
  ])
}
