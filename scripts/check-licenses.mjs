import { execFileSync } from "node:child_process"
import { realpathSync } from "node:fs"
import { fileURLToPath } from "node:url"

// civfix-app ships under AGPL-3.0-only, so every production dependency must carry a license that can be
// combined with it. Exact SPDX ids only: a variant nobody has reviewed (BSD-4-Clause's advertising
// clause, a field-of-use rider on BSD-3-Clause) fails until someone adds it here on purpose.
const ALLOWED_LICENSES = new Set(
  [
    "MIT",
    "MIT-0",
    "ISC",
    "BSD-2-Clause",
    "BSD-3-Clause",
    "0BSD",
    "Apache-2.0",
    "CC0-1.0",
    "CC-BY-4.0",
    "BlueOak-1.0.0",
    "Python-2.0",
    "MPL-2.0",
    ...["LGPL-2.0", "LGPL-2.1", "LGPL-3.0"].flatMap((id) => [
      id,
      `${id}-only`,
      `${id}-or-later`,
      `${id}+`,
    ]),
    "GPL-2.0-or-later",
    "GPL-2.0+",
    ...["GPL-3.0", "AGPL-3.0"].flatMap((id) => [id, `${id}-only`, `${id}-or-later`, `${id}+`]),
    "Unlicense",
    "WTFPL",
    "Zlib",
  ].map((id) => id.toLowerCase()),
)

const DENIED_LICENSES = [
  /^SSPL/i,
  /^BUSL/i,
  /^Commons[- ]Clause/i,
  /^CC-BY-NC/i,
  /^UNLICENSED$/i,
  /^UNKNOWN$/i,
]

/** @typedef {Record<string, { license: string, reason: string }>} AllowedPackages */

// A package whose metadata misreports its license, accepted only while it still reports exactly the
// recorded string, so a later relicense is reviewed again. Each entry says why it is safe.
/** @type {AllowedPackages} */
const ALLOWED_PACKAGES = {
  // Font packages: the MIT covers their loader code, OFL-1.1 the font files the apps ship as separate
  // data, which OFL-1.1 allows bundled with any software (REUSE.toml declares the same fonts).
  "@expo-google-fonts/baloo-2": {
    license: "MIT AND OFL-1.1",
    reason: "fonts under OFL-1.1, code under MIT",
  },
  "@expo-google-fonts/bricolage-grotesque": {
    license: "MIT AND OFL-1.1",
    reason: "fonts under OFL-1.1, code under MIT",
  },
  "@expo-google-fonts/hanken-grotesk": {
    license: "MIT AND OFL-1.1",
    reason: "fonts under OFL-1.1, code under MIT",
  },
  "@expo-google-fonts/jetbrains-mono": {
    license: "MIT AND OFL-1.1",
    reason: "fonts under OFL-1.1, code under MIT",
  },
  // Its package.json spells the license "Apache 2.0", not an SPDX id; its LICENSE file is Apache-2.0.
  "qrcode-terminal": { license: "Apache 2.0", reason: "Apache-2.0 under a non-SPDX spelling" },
}

/**
 * @typedef {{ id: string }
 *   | { or: LicenseNode[] }
 *   | { and: LicenseNode[] }
 *   | { with: LicenseNode, exception: string }} LicenseNode
 */

class LicenseSyntaxError extends Error {}

/** @param {string} expression */
const tokenize = (expression) =>
  expression
    .replace(/[()]/g, " $& ")
    .trim()
    .split(/\s+/)
    .filter((token) => token !== "")

/**
 * @param {string} expression
 * @returns {LicenseNode}
 */
export const parseLicenseExpression = (expression) => {
  const tokens = tokenize(expression)
  let index = 0
  const peek = () => tokens[index]
  /** @param {string} word */
  const keyword = (word) => peek()?.toUpperCase() === word

  /** @returns {LicenseNode} */
  const parseAtom = () => {
    const token = peek()
    if (token === undefined) throw new LicenseSyntaxError(`unexpected end of "${expression}"`)
    index++
    if (token === "(") {
      const inner = parseOr()
      if (peek() !== ")") throw new LicenseSyntaxError(`unbalanced parentheses in "${expression}"`)
      index++
      return inner
    }
    if (token === ")" || ["AND", "OR", "WITH"].includes(token.toUpperCase())) {
      throw new LicenseSyntaxError(`unexpected "${token}" in "${expression}"`)
    }
    return { id: token }
  }

  /** @returns {LicenseNode} */
  const parseWith = () => {
    const base = parseAtom()
    if (!keyword("WITH")) return base
    index++
    const exception = peek()
    if (exception === undefined || exception === "(" || exception === ")") {
      throw new LicenseSyntaxError(`missing exception after WITH in "${expression}"`)
    }
    index++
    return { with: base, exception }
  }

  /** @returns {LicenseNode} */
  const parseAnd = () => {
    const terms = [parseWith()]
    while (keyword("AND")) {
      index++
      terms.push(parseWith())
    }
    return terms.length === 1 && terms[0] !== undefined ? terms[0] : { and: terms }
  }

  /** @returns {LicenseNode} */
  function parseOr() {
    const options = [parseAnd()]
    while (keyword("OR")) {
      index++
      options.push(parseAnd())
    }
    return options.length === 1 && options[0] !== undefined ? options[0] : { or: options }
  }

  const tree = parseOr()
  const trailing = peek()
  if (trailing !== undefined)
    throw new LicenseSyntaxError(`unexpected "${trailing}" in "${expression}"`)
  return tree
}

/** @param {string} id */
const isDenied = (id) => DENIED_LICENSES.some((pattern) => pattern.test(id))

/**
 * @param {LicenseNode} node
 * @returns {boolean}
 */
const evaluate = (node) => {
  if ("or" in node) return node.or.some(evaluate)
  if ("and" in node) return node.and.every(evaluate)
  // An exception only ever grants extra permissions, except Commons Clause, which takes them away.
  if ("with" in node) return !isDenied(node.exception) && evaluate(node.with)
  return !isDenied(node.id) && ALLOWED_LICENSES.has(node.id.toLowerCase())
}

/** @param {string | undefined} expression */
export const isLicenseAllowed = (expression) => {
  if (expression === undefined || expression.trim() === "") return false
  try {
    return evaluate(parseLicenseExpression(expression))
  } catch (error) {
    if (error instanceof LicenseSyntaxError) return false
    throw error
  }
}

/** @typedef {Record<string, { name: string, versions: string[], license?: string }[]>} LicenseReport */

/**
 * @param {unknown} value
 * @param {string} key
 * @returns {unknown}
 */
const field = (value, key) =>
  typeof value === "object" && value !== null ? Reflect.get(value, key) : undefined

/**
 * @param {unknown} value
 * @returns {value is unknown[]}
 */
const isArray = (value) => Array.isArray(value)

/**
 * @param {unknown} value
 * @returns {value is string[]}
 */
const isStringArray = (value) => isArray(value) && value.every((item) => typeof item === "string")

/**
 * `pnpm licenses list --json`, checked field by field: a shape this script does not understand fails the
 * gate instead of passing it.
 * @param {unknown} value
 * @returns {LicenseReport}
 */
export const parseLicenseReport = (value) => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("pnpm licenses list did not print a JSON object")
  }
  /** @type {LicenseReport} */
  const report = {}
  for (const [license, packages] of Object.entries(value)) {
    if (!isArray(packages))
      throw new Error(`pnpm licenses list: "${license}" is not a list of packages`)
    report[license] = packages.map((pkg) => {
      const name = field(pkg, "name")
      const versions = field(pkg, "versions")
      const reported = field(pkg, "license")
      if (
        typeof name !== "string" ||
        !isStringArray(versions) ||
        (reported !== undefined && typeof reported !== "string")
      ) {
        throw new Error(`pnpm licenses list: an unreadable entry under "${license}"`)
      }
      return reported === undefined ? { name, versions } : { name, versions, license: reported }
    })
  }
  return report
}

/**
 * @param {LicenseReport} report
 * @param {AllowedPackages} [allowedPackages]
 */
export const findViolations = (report, allowedPackages = ALLOWED_PACKAGES) => {
  /** @type {{ name: string, versions: string[], license: string }[]} */
  const violations = []
  for (const [license, packages] of Object.entries(report)) {
    for (const pkg of packages) {
      const reported = pkg.license ?? license
      if (isLicenseAllowed(reported)) continue
      if (
        Object.hasOwn(allowedPackages, pkg.name) &&
        allowedPackages[pkg.name]?.license === reported
      )
        continue
      violations.push({ name: pkg.name, versions: pkg.versions, license: reported })
    }
  }
  return violations
}

const main = () => {
  const output = execFileSync("pnpm", ["licenses", "list", "--prod", "--json"], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  })
  const violations = findViolations(parseLicenseReport(/** @type {unknown} */ (JSON.parse(output))))
  if (violations.length === 0) {
    console.log("check-licenses: every production dependency has an AGPL-3.0-compatible license.")
    return
  }
  console.error(
    "check-licenses: production dependencies with a denied, unknown or unreviewed license:",
  )
  for (const { name, versions, license } of violations) {
    console.error(`  ${name}@${versions.join(", ")}: ${license}`)
  }
  console.error(
    "Replace the dependency, or, if its real license is compatible, add it to ALLOWED_PACKAGES with the reason.",
  )
  process.exitCode = 1
}

// realpath on both sides: through a symlinked path the comparison would otherwise miss, skip main() and
// pass the gate without checking anything.
const invokedAs = process.argv[1]
if (
  invokedAs !== undefined &&
  realpathSync(invokedAs) === realpathSync(fileURLToPath(import.meta.url))
)
  main()
