import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { fileURLToPath, pathToFileURL } from "node:url"
import postcss from "postcss"
import type { AcceptedPlugin, AtRule, ChildNode, Container, Root } from "postcss"

const APP_DIR = fileURLToPath(new URL("../..", import.meta.url))
const GLOBALS = fileURLToPath(new URL("../app/globals.css", import.meta.url))

/** One flattened style rule of the compiled stylesheet. */
export interface CompiledRule {
  readonly selector: string
  /** The innermost cascade layer the rule sits in; undefined when unlayered. */
  readonly layer: string | undefined
  /** Every enclosing at-rule except @layer, outermost first, as `name params`. */
  readonly atRules: readonly string[]
  readonly decls: ReadonlyMap<string, string>
}

export interface CompiledCss {
  readonly root: Root
  readonly rules: readonly CompiledRule[]
  /** Custom properties of the theme layer, plus the initial values of registered @property rules. */
  readonly theme: ReadonlyMap<string, string>
}

function isPluginFactory(value: unknown): value is (options: unknown) => AcceptedPlugin {
  return typeof value === "function"
}

async function appPlugins(): Promise<AcceptedPlugin[]> {
  const configUrl = pathToFileURL(`${APP_DIR}/postcss.config.mjs`).href
  const loaded: unknown = await import(configUrl)
  const config =
    typeof loaded === "object" && loaded !== null && "default" in loaded ? loaded.default : null
  const plugins =
    typeof config === "object" && config !== null && "plugins" in config ? config.plugins : null
  if (typeof plugins !== "object" || plugins === null) {
    throw new Error("postcss.config.mjs exports no plugins map")
  }
  const require = createRequire(`${APP_DIR}/package.json`)
  return Object.entries(plugins).map(([name, options]) => {
    const required: unknown = require(name)
    const factory =
      typeof required === "object" && required !== null && "default" in required
        ? required.default
        : required
    if (!isPluginFactory(factory)) throw new Error(`${name} is not a PostCSS plugin`)
    return factory(options)
  })
}

function combine(parent: string | undefined, selector: string): string {
  if (parent === undefined) return selector
  return parent
    .split(/,(?![^(]*\))/)
    .map((outer) => outer.trim())
    .flatMap((outer) =>
      selector
        .split(/,(?![^(]*\))/)
        .map((inner) =>
          inner.includes("&") ? inner.trim().replaceAll("&", outer) : `${outer} ${inner.trim()}`,
        ),
    )
    .join(", ")
}

function declsOf(node: Container): Map<string, string> {
  const decls = new Map<string, string>()
  for (const child of node.nodes ?? []) {
    if (child.type === "decl") decls.set(child.prop, child.value.replace(/\s+/g, " ").trim())
  }
  return decls
}

function flatten(root: Root): CompiledRule[] {
  const rules: CompiledRule[] = []
  const walk = (
    nodes: readonly ChildNode[],
    selector: string | undefined,
    layer: string | undefined,
    atRules: readonly string[],
  ): void => {
    for (const node of nodes) {
      if (node.type === "rule") {
        const full = combine(selector, node.selector.replace(/\s+/g, " "))
        const decls = declsOf(node)
        if (decls.size > 0) rules.push({ selector: full, layer, atRules, decls })
        walk(node.nodes, full, layer, atRules)
      } else if (node.type === "atrule") {
        walkAtRule(node, selector, layer, atRules)
      }
    }
  }
  const walkAtRule = (
    node: AtRule,
    selector: string | undefined,
    layer: string | undefined,
    atRules: readonly string[],
  ): void => {
    if (node.nodes === undefined) return
    if (node.name === "layer") {
      walk(node.nodes, selector, node.params.trim(), atRules)
      return
    }
    const inner = [...atRules, `${node.name} ${node.params.replace(/\s+/g, " ").trim()}`]
    const decls = declsOf(node)
    if (selector !== undefined && decls.size > 0) {
      rules.push({ selector, layer, atRules: inner, decls })
    }
    walk(node.nodes, selector, layer, inner)
  }
  walk(root.nodes, undefined, undefined, [])
  return rules
}

function themeOf(root: Root, rules: readonly CompiledRule[]): Map<string, string> {
  const theme = new Map<string, string>()
  for (const rule of rules) {
    if (rule.layer !== "theme") continue
    for (const [prop, value] of rule.decls) if (prop.startsWith("--")) theme.set(prop, value)
  }
  root.walkAtRules("property", (node) => {
    node.walkDecls("initial-value", (decl) => {
      if (!theme.has(node.params.trim())) theme.set(node.params.trim(), decl.value.trim())
    })
  })
  return theme
}

/**
 * Compiles globals.css with the app's own PostCSS plugins and sources, the way `next build` does.
 * `candidates` are classes a case names, generated even when no component uses them yet.
 */
export async function compileGlobals(candidates: readonly string[]): Promise<CompiledCss> {
  const source = `${readFileSync(GLOBALS, "utf8")}\n@source inline(${JSON.stringify(candidates.join(" "))});\n`
  const result = await postcss(await appPlugins()).process(source, { from: GLOBALS })
  const root = postcss.parse(result.css)
  const rules = flatten(root)
  return { root, rules, theme: themeOf(root, rules) }
}

/** Follows every `var(--x)` whose property the theme defines, as the browser would at :root. */
export function resolveTheme(css: CompiledCss, value: string): string {
  let current = value
  for (let depth = 0; depth < 8; depth += 1) {
    const next = current.replace(/var\((--[\w-]+)\)/g, (match, name: string) => {
      const themed = css.theme.get(name)
      return themed === undefined || themed.includes(`var(${name})`) ? match : themed
    })
    if (next === current) return next
    current = next
  }
  return current
}

/** The rules whose whole selector is `selector`. */
export function rulesFor(css: CompiledCss, selector: string): CompiledRule[] {
  return css.rules.filter((rule) => rule.selector === selector)
}

/** The value of `prop` set by `selector` outside any at-rule, theme references resolved. */
export function resolvedDecl(css: CompiledCss, selector: string, prop: string): string | undefined {
  const values = rulesFor(css, selector)
    .filter((rule) => rule.atRules.length === 0)
    .flatMap((rule) => {
      const value = rule.decls.get(prop)
      return value === undefined ? [] : [resolveTheme(css, value)]
    })
  return values.at(-1)
}
