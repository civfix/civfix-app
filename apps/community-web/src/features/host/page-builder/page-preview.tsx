"use client"

import type { EventPageBlock, ThemeAccent } from "@civfix/shared"
import { useT } from "@civfix/ui/i18n"

import { cn } from "@/lib/utils"
import { MarkdownPreview } from "@/components/console/forms/rich-text/preview"

const ACCENT_CLASS: Record<ThemeAccent, string> = {
  bloom: "text-console-bloom-strong",
  moss: "text-console-moss-strong",
  sun: "text-console-sun-strong",
  sky: "text-console-sky-strong",
  lilac: "text-console-lilac-strong",
}

export interface PagePreviewProps {
  title: string
  accent: ThemeAccent
  coverUrl: string | null
  blocks: readonly EventPageBlock[]
  className?: string
}

export function PagePreview({ title, accent, coverUrl, blocks, className }: PagePreviewProps) {
  const { t } = useT("host-page-builder")
  return (
    <div
      className={cn(
        "overflow-hidden rounded-md border border-console-line bg-console-surface shadow-console-1",
        className,
      )}
    >
      {coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={coverUrl} alt="" className="aspect-[16/9] w-full object-cover" />
      ) : null}
      <div className="flex flex-col gap-token-5 p-token-4">
        <h3 className={cn("font-display text-token-24 font-bold", ACCENT_CLASS[accent])}>
          {title}
        </h3>
        {blocks.length === 0 ? (
          <p className="text-token-13 text-console-ink-3">{t("preview.empty")}</p>
        ) : null}
        {blocks.map((block) => {
          switch (block.kind) {
            case "hero":
              return (
                <section key={block.id}>
                  {block.headline ? (
                    <p className="font-display text-token-20 font-bold text-console-ink">
                      {block.headline}
                    </p>
                  ) : null}
                  {block.subhead ? (
                    <p className="text-token-14 text-console-ink-2">{block.subhead}</p>
                  ) : null}
                </section>
              )
            case "about":
              return (
                <section key={block.id}>
                  <h4 className="mb-token-1 font-display text-token-16 font-bold text-console-ink">
                    {block.title ?? t("block.kind.about")}
                  </h4>
                  <MarkdownPreview source={block.body} />
                </section>
              )
            case "agenda":
              return (
                <section key={block.id}>
                  <h4 className="mb-token-1 font-display text-token-16 font-bold text-console-ink">
                    {block.title ?? t("block.kind.agenda")}
                  </h4>
                  <ol className="flex flex-col gap-token-1">
                    {block.items.map((item, index) => (
                      <li key={index} className="flex gap-token-2 text-token-13">
                        <span className="w-20 shrink-0 font-mono text-console-ink-3">
                          {item.time ?? ""}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="font-semibold text-console-ink">{item.title}</span>
                          {item.description ? (
                            <span className="block text-console-ink-2">{item.description}</span>
                          ) : null}
                        </span>
                      </li>
                    ))}
                  </ol>
                </section>
              )
            case "hosts":
              return (
                <section key={block.id}>
                  <h4 className="mb-token-1 font-display text-token-16 font-bold text-console-ink">
                    {block.title ?? t("block.kind.hosts")}
                  </h4>
                  <ul className="flex flex-col gap-token-2">
                    {block.entries.map((entry, index) => (
                      <li key={index} className="text-token-13">
                        <span className="font-semibold text-console-ink">{entry.name}</span>
                        {entry.role ? (
                          <span className="text-console-ink-3"> · {entry.role}</span>
                        ) : null}
                        {entry.bio ? (
                          <span className="block text-console-ink-2">{entry.bio}</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </section>
              )
            case "faq":
              return (
                <section key={block.id}>
                  <h4 className="mb-token-1 font-display text-token-16 font-bold text-console-ink">
                    {block.title ?? t("block.kind.faq")}
                  </h4>
                  <dl className="flex flex-col gap-token-2 text-token-13">
                    {block.items.map((item, index) => (
                      <div key={index}>
                        <dt className="font-semibold text-console-ink">{item.question}</dt>
                        <dd className="text-console-ink-2">{item.answer}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              )
            case "location":
              return (
                <section key={block.id}>
                  <h4 className="mb-token-1 font-display text-token-16 font-bold text-console-ink">
                    {block.title ?? t("block.kind.location")}
                  </h4>
                  {block.note ? (
                    <p className="text-token-13 text-console-ink-2">{block.note}</p>
                  ) : null}
                  {block.showMap ? (
                    <p className="mt-token-1 text-token-12 text-console-ink-3">
                      {t("preview.map_placeholder")}
                    </p>
                  ) : null}
                </section>
              )
            case "sponsors":
              return (
                <section key={block.id}>
                  <h4 className="mb-token-1 font-display text-token-16 font-bold text-console-ink">
                    {block.title ?? t("block.kind.sponsors")}
                  </h4>
                  <ul className="flex flex-wrap gap-token-2 text-token-13 text-console-ink-2">
                    {block.entries.map((entry, index) => (
                      <li key={index}>{entry.name}</li>
                    ))}
                  </ul>
                </section>
              )
            case "donate":
              return (
                <section key={block.id}>
                  <h4 className="mb-token-1 font-display text-token-16 font-bold text-console-ink">
                    {block.title ?? t("block.kind.donate")}
                  </h4>
                  {block.blurb ? (
                    <p className="text-token-13 text-console-ink-2">{block.blurb}</p>
                  ) : null}
                </section>
              )
            case "registration":
              return (
                <section key={block.id}>
                  <h4 className="mb-token-1 font-display text-token-16 font-bold text-console-ink">
                    {block.title ?? t("block.kind.registration")}
                  </h4>
                  {block.note ? (
                    <p className="text-token-13 text-console-ink-2">{block.note}</p>
                  ) : null}
                  <p className="mt-token-1 text-token-12 text-console-ink-3">
                    {t("preview.registration_placeholder")}
                  </p>
                </section>
              )
            case "contact":
              return (
                <section key={block.id}>
                  <h4 className="mb-token-1 font-display text-token-16 font-bold text-console-ink">
                    {block.title ?? t("block.kind.contact")}
                  </h4>
                  {block.body ? (
                    <p className="text-token-13 text-console-ink-2">{block.body}</p>
                  ) : null}
                </section>
              )
          }
        })}
      </div>
    </div>
  )
}
