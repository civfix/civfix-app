export type ConsoleLinkTarget =
  | { kind: "portfolio" }
  | { kind: "org"; orgId: string }
  | { kind: "event"; eventId: string }

export interface ConsoleLinkRowProps {
  target: ConsoleLinkTarget
}
