# Company website icons

Small PNG/ICO icons downloaded from company websites for identification beside
the original Segment company name. `sources.json` records the exact download
URL, website, retrieval date, and local path. These are website icons, not a
claim that each asset is a full corporate logo or freely licensed artwork.
Trademarks and artwork belong to their respective owners; no endorsement is
implied. Do not reuse them as this project's identity.

The app loads these files locally, never through a third-party favicon service.
Only City Bus is excluded. Unknown companies and unavailable/failed images keep
their text without a fabricated logo. Name lookup is case-insensitive; the raw
company label is not rewritten. RejioJet remains text-only because its spelling
has not been confirmed. The SNCF source is its official SNCF Connect website.

Refreshing icons is a manual network operation using
`node scripts/download-company-icons.mjs`; it is not run by CI or deployment.
Review refreshed assets and attribution before committing them.
