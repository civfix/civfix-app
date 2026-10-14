import * as React from "react"
import { CircleAlert, Loader2 } from "lucide-react"

/** Each public page styles its own state screen, so the caller names the classes its stylesheet defines. */
export interface PublicPageStateClasses {
  page: string
  shell: string
  spin: string
  action: string
}

export interface PublicPageStateProps {
  classes: PublicPageStateClasses
  title: string
  busy?: boolean
  action?: { label: string; onClick: () => void }
  children: React.ReactNode
}

export function PublicPageState({ classes, title, busy, action, children }: PublicPageStateProps) {
  return (
    <main className={classes.page} aria-busy={busy ? true : undefined}>
      <div className={classes.shell}>
        {busy ? (
          <Loader2 aria-hidden="true" className={classes.spin} size={32} />
        ) : (
          <CircleAlert aria-hidden="true" size={32} />
        )}
        <h1>{title}</h1>
        <p>{children}</p>
        {action ? (
          <button type="button" className={classes.action} onClick={action.onClick}>
            {action.label}
          </button>
        ) : null}
      </div>
    </main>
  )
}
