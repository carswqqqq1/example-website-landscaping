# Config-Driven Template System

All client-specific website data is centralized in `site-config.js`.

## Edit Once, Update Everywhere

Update these fields for each new client:
- `businessName`, `shortName`
- `phone.raw`, `phone.display`
- `phoneTracking.default` and `phoneTracking.sources` if call tracking numbers differ by source
- `email`
- `ownerEmail`
- `address.line1`, `city`, `state`, `zip`
- `serviceAreas`
- `coreServices`
- `primaryOffer`
- `brand.logoPath`, `brand.primary`, `brand.primaryMid`, `brand.paper`
- `reviewRating`, `reviewCount`, `reviewSource`, `reviewSourceUrl`, `reviewSnapshotDate`
 - `reviewSummary`
- `socialProfiles`
- `trustSignals`
- `trustAssets`
- `financing`
- `locationPages`
- `pageConversionGuides`
- `contactFormServices`
- `projectFit`
- `beforeAfter`
- `reviews`
- `analytics.ga4MeasurementId`

## What Updates Automatically

`script.js` applies config values to:
- Phone links/displays
- Email links/displays
- Address fields
- Logo references (`data-site-logo`)
- Year + business name in footer
- Contact form service dropdown
- Project-fit cards
- Before/after slider media + note
- Reviews cards
- Financing notes and financing navigation visibility
- Primary offer labels, quote form title, submit button, and offer promise
- GA4 events (`call_click`, `form_submit`)

## What The Config Tools Update Statically

`scripts/apply-client-config.js` also sweeps static files for clone-critical residue:
- old `siteBaseUrl`
- old `businessName` and `shortName`
- old email/owner email
- old raw and display phone numbers
- old review source URL

This protects SEO tags, schema blocks, sitemap URLs, manifest content, footer copy, and docs from staying branded to the demo company after a client config is applied.

## Clone Workflow

1. Duplicate this project.
2. Start from `docs/client-config-template.json`.
3. Generate a launch package with `node scripts/generate-client-package.js path/to/client-config.json`.
4. Apply it with `node scripts/apply-client-config.js path/to/client-config.json` or edit `site-config.js` directly.
5. Set the Cloudflare Pages variables and encrypted secrets for email and lead routing.
6. Run `npm run check:client-package` to make sure generated client materials do not contain demo brand/contact residue.
7. Deploy the `dist` directory to the client's dedicated Cloudflare Pages project.

## Generated Launch Package

`scripts/generate-client-package.js` creates:
- a merged config preview
- a branch + Cloudflare Pages project naming suggestion
- a launch checklist
- a Cloudflare environment template

Default output directory:

```bash
client-builds/<client-slug>/
```

## Release Checks

Run these before launch:

```bash
npm run build:cloudflare
npm run check:js
npm run check:a11y
npm run check:site
npm run check:speed
npm run check:client-package
```

Use `docs/white-label-handoff.md` for the full release-safe clone checklist.
