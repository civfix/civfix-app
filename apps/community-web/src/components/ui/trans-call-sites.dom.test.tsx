/**
 * Every `<Trans>` call site in the web app, rendered with its real en catalog string and exactly the
 * values and slot components the call site passes, so a react-i18next upgrade that changes what a
 * resident reads (text or links) fails here. T11 keeps the list complete.
 */
import { readFileSync, readdirSync } from "node:fs"
import { join, relative } from "node:path"
import Link from "next/link"
import { cleanup, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Trans, createI18n } from "@civfix/ui/i18n"
import { SlotLink } from "./slot-link"

const i18n = createI18n("en")
const tFor = (ns: string) => i18n.getFixedT("en", ns)

type Slot = [tag: string, href: string | null, text: string]

function slotsOf(container: HTMLElement): Slot[] {
  return Array.from(container.children).map((el) => [
    el.tagName.toLowerCase(),
    el.getAttribute("href"),
    el.textContent,
  ])
}

// next build inlines next.config's `trailingSlash: true` as this variable, and Link then keeps "/manage/";
// unset, Link strips the slash, which the static export never does.
beforeEach(() => {
  vi.stubEnv("__NEXT_TRAILING_SLASH", "true")
})

afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
})

describe("GH#299 every <Trans> renders the same text and slots", () => {
  it("T1: web-auth code.subtitle", () => {
    const { container } = render(
      <Trans
        t={tFor("web-auth")}
        i18nKey="code.subtitle"
        values={{ email: "ada@example.com" }}
        components={[<strong key="email" />]}
      />,
    )
    expect(container.textContent).toBe("Code sent to ada@example.com - expires in 5 min")
    expect(slotsOf(container)).toEqual([["strong", null, "ada@example.com"]])
  })

  it("T2: host-org public.invalid_link_body", () => {
    const { container } = render(
      <Trans
        t={tFor("host-org")}
        i18nKey="public.invalid_link_body"
        components={[<Link key="home" href="/" />]}
      />,
    )
    expect(container.textContent).toBe(
      "This link is not valid. Check the link you followed, or find organizations on civfix.",
    )
    expect(slotsOf(container)).toEqual([["a", "/", "civfix"]])
  })

  it("T3: host-org public.not_found_body", () => {
    const { container } = render(
      <Trans
        t={tFor("host-org")}
        i18nKey="public.not_found_body"
        components={[<Link key="home" href="/" />]}
      />,
    )
    expect(container.textContent).toBe(
      "It may have been renamed or removed. Find organizations on civfix.",
    )
    expect(slotsOf(container)).toEqual([["a", "/", "civfix"]])
  })

  it("T4: host-org public.footer_hosts", () => {
    const { container } = render(
      <Trans
        t={tFor("host-org")}
        i18nKey="public.footer_hosts"
        values={{ name: "Parks & Rec" }}
        components={[<Link key="home" href="/" />]}
      />,
    )
    expect(container.textContent).toBe("Parks & Rec hosts volunteer events on civfix.")
    expect(slotsOf(container)).toEqual([["a", "/", "civfix"]])
  })

  it("T5: host-org public.footer_console", () => {
    const { container } = render(
      <Trans
        t={tFor("host-org")}
        i18nKey="public.footer_console"
        components={[<Link key="console" href="/manage/" />]}
      />,
    )
    expect(container.textContent).toBe("Run an organization? Open the host console.")
    expect(slotsOf(container)).toEqual([["a", "/manage/", "Open the host console"]])
  })

  it("T6: web-signup form.terms", () => {
    const { container } = render(
      <Trans
        t={tFor("web-signup")}
        i18nKey="form.terms"
        components={[
          <SlotLink key="terms" href="/legal/terms" rel="noreferrer noopener" target="_blank" />,
          <SlotLink
            key="privacy"
            href="/legal/privacy"
            rel="noreferrer noopener"
            target="_blank"
          />,
        ]}
      />,
    )
    expect(container.textContent).toBe(
      "I agree to the Terms of Service and the Privacy Policy, and I understand the host will see my name and my answers.",
    )
    expect(slotsOf(container)).toEqual([
      ["a", "/legal/terms", "Terms of Service"],
      ["a", "/legal/privacy", "Privacy Policy"],
    ])
    for (const link of Array.from(container.children)) {
      expect(link.getAttribute("target")).toBe("_blank")
      expect(link.getAttribute("rel")).toBe("noreferrer noopener")
    }
  })

  it("T7: web-signup state.not_found_body", () => {
    const { container } = render(
      <Trans
        t={tFor("web-signup")}
        i18nKey="state.not_found_body"
        components={[<Link key="home" href="/" />]}
      />,
    )
    expect(container.textContent).toBe(
      "This signup link is not valid, or the page has been taken down. Find the event on civfix.",
    )
    expect(slotsOf(container)).toEqual([["a", "/", "civfix"]])
  })

  it("T8: web-signup footer", () => {
    const { container } = render(
      <Trans
        t={tFor("web-signup")}
        i18nKey="footer"
        components={[
          <Link key="home" href="/" />,
          <SlotLink key="terms" href="/legal/terms" />,
          <SlotLink key="privacy" href="/legal/privacy" />,
        ]}
      />,
    )
    expect(container.textContent).toBe("Hosted on civfix · Terms · Privacy")
    expect(slotsOf(container)).toEqual([
      ["a", "/", "civfix"],
      ["a", "/legal/terms", "Terms"],
      ["a", "/legal/privacy", "Privacy"],
    ])
  })

  it("T9: web-unsubscribe notifications.done", () => {
    const { container } = render(
      <Trans
        t={tFor("web-unsubscribe")}
        i18nKey="notifications.done"
        values={{ category: "Event updates & reminders" }}
        components={{ strong: <strong /> }}
      />,
    )
    expect(container.textContent).toBe(
      "You won't get emails about Event updates & reminders anymore.",
    )
    expect(slotsOf(container)).toEqual([["strong", null, "Event updates & reminders"]])
  })

  it("T10: web-unsubscribe settings_prompt", () => {
    const { container } = render(
      <Trans
        t={tFor("web-unsubscribe")}
        i18nKey="settings_prompt"
        components={[<SlotLink key="settings" href="/notifications/prefs" />]}
      />,
    )
    expect(container.textContent).toBe(
      "To change what civfix sends you generally, open notification settings.",
    )
    expect(slotsOf(container)).toEqual([["a", "/notifications/prefs", "notification settings"]])
  })

  it("T12: markup inside a value stays text and does not become a slot", () => {
    const { container } = render(
      <Trans
        t={tFor("host-org")}
        i18nKey="public.footer_hosts"
        values={{ name: "A <0>x</0> & <b>b</b>" }}
        components={[<Link key="home" href="/" />]}
      />,
    )
    expect(container.textContent).toBe("A <0>x</0> & <b>b</b> hosts volunteer events on civfix.")
    expect(slotsOf(container)).toEqual([["a", "/", "civfix"]])
  })
})

const WEB_ROOT = join(__dirname, "..", "..", "..")
const APP_ROOT = join(WEB_ROOT, "..", "..")
const SOURCE_ROOTS = [join(WEB_ROOT, "src"), join(APP_ROOT, "packages", "ui", "src")]

// A file that renders <Trans> with a `t` it receives as a prop, keyed by path from the civfix-app
// root, with the namespace of the useT its caller passes in.
const THREADED_T_NAMESPACE: Record<string, string> = {
  "apps/community-web/src/components/auth/auth-modal-steps.tsx": "web-auth",
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      return entry.name === "__tests__" || entry.name === "node_modules" ? [] : sourceFiles(path)
    }
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : []
  })
}

function transCallSites(path: string): string[] {
  // Comments mention <Trans> in prose; only code counts.
  const source = readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
  const file = relative(APP_ROOT, path)
  const sites: string[] = []
  for (const match of source.matchAll(/<Trans\b[^>]*?\bt=\{(\w+)\}[\s\S]*?\bi18nKey="([^"]+)"/g)) {
    const [, tName = "", key = ""] = match
    const before = source.slice(0, match.index)
    const hooks = [...before.matchAll(/const \{ t(?:: (\w+))? \} = useT\("([^"]+)"\)/g)].filter(
      (hook) => (hook[1] ?? "t") === tName,
    )
    const namespace = hooks.at(-1)?.[2] ?? THREADED_T_NAMESPACE[file]
    sites.push(`${namespace ?? `<no useT for ${tName} in ${file}>`} ${key}`)
  }
  const bare = source.match(/<Trans\b/g)?.length ?? 0
  if (bare !== sites.length) sites.push(`<unread <Trans> in ${file}>`)
  return sites
}

describe("GH#299 the <Trans> cases cover every call site", () => {
  it("T11: the web app and packages/ui render exactly the ten <Trans> keys of T1-T10", () => {
    const sites = SOURCE_ROOTS.flatMap(sourceFiles).flatMap(transCallSites).sort()
    expect(sites).toEqual(
      [
        "web-auth code.subtitle",
        "host-org public.invalid_link_body",
        "host-org public.not_found_body",
        "host-org public.footer_hosts",
        "host-org public.footer_console",
        "web-signup form.terms",
        "web-signup state.not_found_body",
        "web-signup footer",
        "web-unsubscribe notifications.done",
        "web-unsubscribe settings_prompt",
      ].sort(),
    )
  })
})
