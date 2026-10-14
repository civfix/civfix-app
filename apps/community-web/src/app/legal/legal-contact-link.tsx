const LEGAL_CONTACT_EMAIL = "roman@reachoutla.org"

export function LegalContactLink() {
  return <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>
}
