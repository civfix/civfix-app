import {
  documentTitle,
  isManagedLink,
  isManagedMeta,
  metaTagsHtml,
  type LinkPreview,
  type PreviewKind,
} from "../src/lib/link-preview"
import { runPreview, type PreviewContextArg } from "./_preview-core"

export type { PreviewContextArg, PreviewEnv } from "./_preview-core"

interface RewriterElement {
  getAttribute(name: string): string | null
  setInnerContent(content: string, options?: { html?: boolean }): void
  append(content: string, options?: { html?: boolean }): void
  remove(): void
}

interface Rewriter {
  on(selector: string, handlers: { element(element: RewriterElement): void }): Rewriter
  transform(response: Response): Response
}

declare const HTMLRewriter: { new (): Rewriter }

function rewriteShell(shell: Response, preview: LinkPreview): Response {
  return new HTMLRewriter()
    .on("head > title", {
      element(element) {
        element.setInnerContent(documentTitle(preview))
      },
    })
    .on("meta", {
      element(element) {
        if (isManagedMeta(element.getAttribute("name"), element.getAttribute("property"))) {
          element.remove()
        }
      },
    })
    .on("link", {
      element(element) {
        if (isManagedLink(element.getAttribute("rel"))) element.remove()
      },
    })
    .on("head", {
      element(element) {
        element.append(metaTagsHtml(preview), { html: true })
      },
    })
    .transform(shell)
}

export function handlePreview(context: PreviewContextArg, kind: PreviewKind): Promise<Response> {
  return runPreview(context, kind, { rewrite: rewriteShell })
}
