const fs = require("fs")
const path = require("path")

const LUCIDE_BARRELS = {
  "lucide-react-native": "lucide-react-native.mjs",
  "lucide-react-native/icons": path.join("icons", "index.mjs"),
}

const REEXPORT = /^export \{([^}]*)\} from '([^']+)';$/

/**
 * Maps every export name of one lucide barrel (icons, their renamed aliases, Icon, createLucideIcon,
 * the context exports) to the module and binding it re-exports, read from the installed file so the
 * table always matches the installed version. Any export line of another shape fails the build: a
 * name this table misses would silently pull the whole barrel back in.
 */
function lucideBarrelExports(barrelFile) {
  const dir = path.dirname(barrelFile)
  const table = new Map()
  for (const line of fs.readFileSync(barrelFile, "utf8").split("\n")) {
    if (!line.startsWith("export")) continue
    const match = REEXPORT.exec(line)
    if (match === null) throw new Error(`lucide-react-native: unrecognized export in ${barrelFile}: ${line}`)
    for (const entry of match[1].split(",")) {
      const names = /^(\w+)(?: as (\w+))?$/.exec(entry.trim())
      if (names === null) throw new Error(`lucide-react-native: unrecognized export in ${barrelFile}: ${line}`)
      table.set(names[2] ?? names[1], { file: path.join(dir, match[2]), imported: names[1] })
    }
  }
  if (table.size === 0) throw new Error(`lucide-react-native: no exports found in ${barrelFile}`)
  return table
}

function specifierName(t, node) {
  return t.isIdentifier(node) ? node.name : node.value
}

/**
 * Metro does not tree-shake, so any value import from lucide's barrels bundles all ~1,700 icons. This
 * rewrites every value specifier (import or re-export) into an import of the module that defines it
 * (an absolute path, because the package's exports map exposes no per-module subpath). Only type-only
 * specifiers and namespace imports stay on the barrel; anything else that would still load it fails
 * the build.
 */
function lucideDirectImports({ types: t }, { esmDir }) {
  const barrels = new Map(
    Object.entries(LUCIDE_BARRELS).map(([source, file]) => [source, lucideBarrelExports(path.join(esmDir, file))]),
  )
  const target = (p, source, name) => {
    const found = barrels.get(source).get(name)
    if (found === undefined) {
      throw p.buildCodeFrameError(
        `"${name}" is not a value export of ${source}; import types with \`import type\` (civfix-lucide-direct-imports)`,
      )
    }
    return found
  }
  const barrelOnly = (p, what) =>
    p.buildCodeFrameError(
      `${what} would bundle every lucide icon (Metro does not tree-shake); import named exports instead (civfix-lucide-direct-imports)`,
    )
  return {
    name: "civfix-lucide-direct-imports",
    visitor: {
      ImportDeclaration(p) {
        const { node } = p
        const source = node.source.value
        if (!barrels.has(source) || node.importKind === "type") return
        if (node.specifiers.length === 0) throw barrelOnly(p, `A side-effect import of ${source}`)
        if (node.specifiers.some((spec) => t.isImportNamespaceSpecifier(spec))) return
        const direct = []
        const typeOnly = []
        for (const spec of node.specifiers) {
          if (t.isImportDefaultSpecifier(spec)) throw barrelOnly(p, `A default import of ${source}`)
          if (spec.importKind === "type") {
            typeOnly.push(spec)
            continue
          }
          const { file, imported } = target(p, source, specifierName(t, spec.imported))
          const local = t.identifier(spec.local.name)
          direct.push(
            t.importDeclaration(
              [
                imported === "default"
                  ? t.importDefaultSpecifier(local)
                  : t.importSpecifier(local, t.identifier(imported)),
              ],
              t.stringLiteral(file),
            ),
          )
        }
        if (direct.length === 0) return
        if (typeOnly.length === 0) {
          p.replaceWithMultiple(direct)
          return
        }
        const types = t.importDeclaration(
          typeOnly.map((spec) => t.importSpecifier(spec.local, spec.imported)),
          t.stringLiteral(source),
        )
        types.importKind = "type"
        p.replaceWithMultiple([types, ...direct])
      },
      ExportNamedDeclaration(p) {
        const { node } = p
        if (node.source == null || !barrels.has(node.source.value) || node.exportKind === "type") return
        const source = node.source.value
        if (node.specifiers.some((spec) => t.isExportNamespaceSpecifier(spec))) return
        const direct = []
        const typeOnly = []
        for (const spec of node.specifiers) {
          if (spec.exportKind === "type") {
            typeOnly.push(spec)
            continue
          }
          const { file, imported } = target(p, source, specifierName(t, spec.local))
          direct.push(
            t.exportNamedDeclaration(
              null,
              [t.exportSpecifier(t.identifier(imported), spec.exported)],
              t.stringLiteral(file),
            ),
          )
        }
        if (direct.length === 0) return
        if (typeOnly.length > 0) {
          const types = t.exportNamedDeclaration(
            null,
            typeOnly.map((spec) => t.exportSpecifier(spec.local, spec.exported)),
            t.stringLiteral(source),
          )
          types.exportKind = "type"
          direct.unshift(types)
        }
        p.replaceWithMultiple(direct)
      },
      ExportAllDeclaration(p) {
        const { node } = p
        if (barrels.has(node.source.value) && node.exportKind !== "type") {
          throw barrelOnly(p, `\`export *\` from ${node.source.value}`)
        }
      },
    },
  }
}

const lucideEsmDir = path.resolve(path.dirname(require.resolve("lucide-react-native")), "..", "esm")

// The worklets plugin must stay last so it sees every other plugin's output.
module.exports = function (api) {
  // Cached transforms keep the resolved per-icon file paths: after a lucide upgrade, clear Metro's
  // cache (`expo start --clear`) once so an unchanged file is re-transformed against the new files.
  api.cache(true)
  return {
    presets: ["babel-preset-expo"],
    plugins: [[lucideDirectImports, { esmDir: lucideEsmDir }], "react-native-worklets/plugin"],
  }
}

module.exports.lucideDirectImports = lucideDirectImports
module.exports.lucideBarrelExports = lucideBarrelExports
