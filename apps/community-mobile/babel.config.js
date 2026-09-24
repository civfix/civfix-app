const fs = require("fs")
const path = require("path")

const LUCIDE_SOURCES = new Set(["lucide-react-native", "lucide-react-native/icons"])

/**
 * Maps every icon export name (aliases included) of lucide-react-native to its own ESM module, read
 * from the package's root barrel so the table always matches the installed version.
 */
function lucideIconFiles(esmDir) {
  const barrel = fs.readFileSync(path.join(esmDir, "lucide-react-native.mjs"), "utf8")
  const files = new Map()
  for (const [, names, file] of barrel.matchAll(/export \{([^}]+)\} from '\.\/icons\/([^']+)'/g)) {
    for (const [, name] of names.matchAll(/default as (\w+)/g)) {
      files.set(name, path.join(esmDir, "icons", file))
    }
  }
  if (files.size === 0) throw new Error(`lucide-react-native: no icon exports found in ${esmDir}`)
  return files
}

/**
 * Metro does not tree-shake, so a named import from lucide's barrels bundles all ~1,700 icons. This
 * rewrites each icon specifier into a default import of that icon's module (an absolute path, because
 * the package's exports map exposes no per-icon subpath). Anything that is not an icon (types, Icon,
 * createLucideIcon, namespace imports) stays on the original import.
 */
function lucideDirectImports({ types: t }, { esmDir }) {
  const files = lucideIconFiles(esmDir)
  return {
    name: "civfix-lucide-direct-imports",
    visitor: {
      ImportDeclaration(p) {
        const { node } = p
        if (!LUCIDE_SOURCES.has(node.source.value) || node.importKind === "type") return
        const direct = []
        const kept = []
        for (const spec of node.specifiers) {
          const file =
            t.isImportSpecifier(spec) && spec.importKind !== "type"
              ? files.get(t.isIdentifier(spec.imported) ? spec.imported.name : spec.imported.value)
              : undefined
          if (file === undefined) kept.push(spec)
          else
            direct.push(
              t.importDeclaration([t.importDefaultSpecifier(t.identifier(spec.local.name))], t.stringLiteral(file)),
            )
        }
        if (direct.length === 0) return
        if (kept.length === 0) p.replaceWithMultiple(direct)
        else {
          node.specifiers = kept
          p.insertAfter(direct)
        }
      },
    },
  }
}

const lucideEsmDir = path.resolve(path.dirname(require.resolve("lucide-react-native")), "..", "esm")

// The worklets plugin must stay last so it sees every other plugin's output.
module.exports = function (api) {
  api.cache(true)
  return {
    presets: ["babel-preset-expo"],
    plugins: [[lucideDirectImports, { esmDir: lucideEsmDir }], "react-native-worklets/plugin"],
  }
}

module.exports.lucideDirectImports = lucideDirectImports
