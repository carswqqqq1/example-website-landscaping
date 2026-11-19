# Mesa Wren Landscaping Template

This branch contains the reusable static landscaping template that powers the live Mesa Wren demo: HTML, CSS, vanilla JS, Cloudflare Pages Functions, branded emails, and the Google Sheets lead workflow.

## Source Of Truth

- GitHub repo: `https://github.com/carswqqqq1/example-website-landscaping`
- Branch: `master`
- Live demo: `https://example-website-landscaping.pages.dev`

## Hosting

The same repo can be served by two hosts. Both read `site-config.js` and the templates in `emails/`.

| Host | URL | How it deploys | Lead endpoint | Config file |
| --- | --- | --- | --- | --- |
| Cloudflare Pages (project `example-website-landscaping`) | `https://example-website-landscaping.pages.dev` | Git-connected: every push to `master` builds and deploys automatically (`npm run build:cloudflare`, output `dist`). Manual: `npm run deploy:cloudflare`. | `/api/lead` -> `functions/api/lead.js` | `wrangler.jsonc`, `scripts/build-cloudflare-pages.js` (writes `dist/_headers`) |
| Netlify (sites `thinkgreen-az`, `thinkgreen-landscape`) | `https://thinkgreen-az.netlify.app` | Netlify CLI from a checkout: `netlify deploy --site <site-id>` (draft) or `--prod`. Build: `npm install && npm --prefix netlify/functions ci && npm run build:assets`. | `/api/lead` -> `netlify/functions/lead-gateway.js` -> `netlify/functions/send-ticket-emails.js` | `netlify.toml` |

### Netlify environment variables

Set in Netlify **Site configuration -> Environment variables** (functions scope). Never commit values.

Required:

- `LEAD_PROXY_SECRET` long random string. The gateway adds it so the mailer function cannot be called directly. Without it every lead returns 503.
- `OWNER_EMAIL` where owner lead notifications go (test value `sirjarvis@mail.grokbot.com`).
- `SMTP_USER` and `SMTP_PASS` free Gmail SMTP: a Gmail address and a Google **app password** (needs 2-step verification on that Google account).

Optional:

- `FROM_EMAIL` (defaults to `Mesa Wren <SMTP_USER>`), `SMTP_HOST` (default `smtp.gmail.com`), `SMTP_PORT` (465), `SMTP_SECURE`
- `EMAIL_PROVIDER` / `OWNER_EMAIL_PROVIDER` (`smtp` or `resend`, owner defaults to `smtp`, falls back to whichever has credentials)
- `RESEND_API_KEY`, `RESEND_FROM_EMAIL` if you prefer Resend
- `GOOGLE_SHEETS_WEBHOOK_URL`, `GOOGLE_SHEETS_WEBHOOK_SECRET`, `GOOGLE_SHEET_URL` for the lead dashboard. If the webhook URL is not set, leads still go out by email. If it is set and fails, the lead is rejected so nothing is lost silently.
- `SITE_URL`, `EMAIL_LOGO_URL`

Netlify note: the browser form still renders Cloudflare Turnstile. Add the Netlify hostname to the Turnstile widget's allowed hostnames in Cloudflare, or the widget will not issue a token there. The Netlify function does not verify Turnstile server-side.

### Email logo

- File: `email-assets/logo-email.png` (320x320 PNG with the cream badge baked in, shown at 96px or smaller, about 11 KB).
- URL: `emailLogoUrl` in `site-config.js` is the one place to change it. Default is `https://raw.githubusercontent.com/carswqqqq1/example-website-landscaping/master/email-assets/logo-email.png` so emails do not depend on the demo host staying up.
- Override per host with the `EMAIL_LOGO_URL` env var (Cloudflare Pages and Netlify).
- Templates use a plain `<img>` with `width`, `height` and `alt`, no CSS filter, border-radius or object-fit. Apple Mail renders these reliably. The business name stays as text next to the logo as a fallback.
- `/img/*` and `/email-assets/*` send exactly one `Cross-Origin-Resource-Policy: cross-origin` header on both hosts. Apple Mail enforces CORP on remote images, so a conflicting `same-origin` value blanks the logo.

If production and branch ever drift, fix that before making visual or funnel edits. The branch should stay the source of truth for this template.

## Demo Brand (Fictional)

The live demo uses a made-up brand, **Mesa Wren Landscape Co.**, so it never shows a real company's identity.

- Phone `(480) 555-0142` (reserved 555-01xx fiction range), email `hello@mesawren.example`, city line "Scottsdale, AZ" with no street address.
- Testimonials in `google-reviews.json` are labeled sample reviews (first name and last initial). The Google reviews workflow is disabled until a real client profile is connected.
- ROC links go to the generic Arizona ROC contractor search with a placeholder license.
- Logo files: `img/logo*.png`, `img/favicon-*`, `img/apple-touch-icon.*`, and the email badge `email-assets/logo-email.png` (set in `site-config.js` as `emailLogoUrl`).
- Footer label "Sample site by Arroyo Marketing" and site-wide `noindex, nofollow` (meta tags plus `X-Robots-Tag` on both hosts).
- Project photos in `img/projects` and the hero video are still the original template assets. Swap them before showing the demo publicly as a client's own work.

## Lead Service Types

Every lead form (homepage form, quote drawer, `/free-consultation` starter, checklist gate) opens with "What do you need?":

| `service_type` | Form fields | Client email | Owner email tag |
| --- | --- | --- | --- |
| `maintenance` | name, phone, email, city, `service_address`, `yard_size`, `service_frequency`, `preferred_start_date` | "Your quote request", 24-hour callback | `[MAINTENANCE]` |
| `one_time` | name, phone, email, city, `service_address`, `job_description`, `job_timing` (photos by email reply) | "Your quote request", 24-hour callback | `[ONE-TIME]` |
| `project` | original project review flow | original project email | `[PROJECT]` |

Shared logic lives in `lib/lead-service-types.js` and is used by both the Cloudflare handler and the Netlify function. A missing `service_type` is treated as `project`; an unknown value is rejected with 422. Links can preselect a type with `?type=maintenance|one_time|project`. The recurring care page is `/yard-maintenance`.

## What Is Part Of The Template

Core template files:

- `index.html`
- `services`
- `portfolio`
- `scottsdale-landscaping.html`
- `phoenix-landscaping.html`
- `styles.css`
- `services.css`
- `portfolio.css`
- `pages.css`
- `script.js`
- `site-config.js`
- `services-data.js`
- `projects-data.js`
- `functions/api/lead.js`
- `emails/lead-client-email.html`
- `emails/lead-owner-email.html`

This branch intentionally excludes the old unrelated Next.js app so the repo stays resale-ready and limited to the live landscaping template.

## Business Values To Update For A New Client

Edit these first:

### `site-config.js`

Update:

- `businessName`
- `shortName`
- `email`
- `phone`
- `phoneTracking`
- `address`
- `serviceAreas`
- `coreServices`
- `aiReadability`
- `trustSignals`
- `brand.logoPath`
- `reviewSummary`
- `googleReviews.profileUrl`
- `googleReviews.platform`
- `trustAssets.licenseVerifyUrl`
- `trustAssets.bondVerifyUrl`
- `analytics.ga4MeasurementId`

### `services-data.js`

Update:

- service headlines
- service proof blurbs
- project ranges
- service-area language
- FAQs

### `projects-data.js`

Update:

- portfolio captions
- project categories
- style reference labels

### Email templates

Update:

- `emails/lead-client-email.html`
- `emails/lead-owner-email.html`

Swap branding, links, and footer language if the business name, city, or call-to-action needs to change.

## Trust Links And Demo Safety

Do not ship fake precision.

If a client has not given you verified numbers or URLs, soften the wording instead of inventing specifics.

Examples:

- use `Highly rated by local homeowners` instead of exact review counts
- use `Arizona licensed, bonded, and insured team` instead of exact license statements if not verified

If you keep exact review, address, or ROC/license details, they must be intentional and current for that client.

## Form, Sheet, And Email Pipeline

### Frontend

The homepage form submits through:

- same-origin `/api/lead` on Cloudflare Pages, including custom domains

The Pages Function validates the request, verifies Cloudflare Turnstile against the exact request hostname and form action, writes the lead to Google Sheets with exact-ticket idempotency, sends the owner notification and client confirmation through Resend, and optionally fans the accepted lead out to configured CRM webhooks. The browser always uses the same `/api/lead` path on preview and custom domains.

Prefill sources:

- homepage fit cards
- service-page consultation links
- portfolio `Request a Similar Project` actions

### Backend

Handled by:

- `functions/api/lead.js`

This function:

- normalizes ticket IDs
- normalizes budget ranges
- scores leads
- sends owner/client emails
- writes rows to Google Sheets
- suppresses placeholder values in owner-facing outputs

### Environment Variables

Set these in the Cloudflare Pages project's **Settings → Variables and Secrets** before deploying the Function:

- `OWNER_EMAIL`
- `TURNSTILE_SECRET_KEY` (encrypted secret paired with `turnstile.siteKey` in `site-config.js`)
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL` (must use a sender/domain verified by Resend)
- `GOOGLE_SHEETS_WEBHOOK_URL` (required for locked, exact-ticket lead capture)
- `GOOGLE_SHEETS_WEBHOOK_SECRET`
- `SITE_URL` (recommended canonical production URL; the Function can fall back to the request origin)

Optional:

- `EMAIL_LOGO_URL` absolute https logo URL for emails (defaults to `emailLogoUrl` in `site-config.js`)
- `FROM_EMAIL` as a compatibility alias for `RESEND_FROM_EMAIL`
- `GOOGLE_SHEET_URL`
- `CRM_WEBHOOK_URL`
- `CRM_WEBHOOK_SECRET`
- `SLACK_WEBHOOK_URL`
- `AIRTABLE_WEBHOOK_URL`
- `HUBSPOT_WEBHOOK_URL`

### Google Reviews Feed

If you want the reviews page and local proof sections to pull live Google reviews, set:

- `GOOGLE_PLACES_API_KEY`
- `GOOGLE_PLACE_ID` if you already know the place ID
- `GOOGLE_PLACES_TEXT_QUERY` if you want the updater to resolve the place by business name and address
- `GOOGLE_PLACES_PROFILE_URL` for the public Google Maps profile link shown on the site

The reviews page reads `/google-reviews.json`, which is refreshed by `.github/workflows/update-google-reviews.yml`. Google Places can return only a limited official review sample; when that happens, the updater preserves the fuller existing Google snapshot instead of overwriting it with fewer reviews.

## Local QA Checklist

Before shipping a cloned site:

1. Confirm homepage, portfolio, services hub, and all service pages use the same shell.
2. Confirm hero text is readable on desktop and mobile.
3. Submit the homepage form through the live website path.
4. Verify:
   - Turnstile completes before the request is accepted
   - row appears in Google Sheets
   - owner email sends
   - client email sends
   - no `Not provided` / `Not selected` placeholders appear in sheet or email
5. Check portfolio lightbox, before/after slider, FAQ accordions, and sticky mobile CTA bar.
6. Check the client and owner emails in mobile inbox rendering.

## Deploy

Build and deploy the Pages project from the template folder. The deploy command runs `check:all` before it builds or publishes:

```bash
npm run deploy:cloudflare
```

## Release Checks

```bash
npm run generate:llms
npm run build:cloudflare
npm run check:js
npm run check:a11y
npm run check:site
npm run check:speed
```

## White-Label Generator

To prepare the next client clone without rebuilding the workflow from scratch:

```bash
node scripts/generate-client-package.js path/to/client-config.json
```

This writes a launch package to `client-builds/<client-slug>/` with:
- merged config preview
- suggested branch and Cloudflare Pages project name
- Cloudflare environment template
- launch checklist

## Owner Intake Data In GitHub

If you want to keep owner-provided internal notes in the repo without rendering them on the public site, use:

- `docs/owner-profile-template.json`

This file is repo-only reference data. The website does not load it, import it, or expose it in the frontend.

Important:

- if the GitHub repo is public, anything committed there is still publicly viewable in GitHub
- use this for internal business notes, not passwords, tokens, or private customer data

## Pricing Model

This template is sold and maintained under the following standard pricing:

| Payment | Amount | When |
|---|---|---|
| Initial | $375 | At kickoff, before work begins |
| Completion | $375 | At launch, before DNS is pointed |
| Monthly upkeep | $250/month | 1st of each month after launch |
| **First-month total** | **$1,000** | |
| **Annual value (12 months)** | **$3,750** | |

See `docs/pricing-and-contracts.md` for full terms, cancellation policy, scope creep rates, and revenue projections.

## Sales + Ops Docs

- `docs/pricing-and-contracts.md` — **standard pricing, payment terms, and revenue model**
- `docs/offer-sheet-template.md` — client-facing offer with pricing
- `docs/follow-up-sequence.md` — 3-touch outreach sequence with pricing
- `docs/white-label-handoff.md` — step-by-step launch guide with payment gates
- `docs/kpi-tracker-template.csv`
- `docs/email-deliverability.md`
- `docs/config-system.md`
- `docs/google-sheet-setup.md`
- `docs/crm-webhook-setup.md`
- `docs/client-questionnaire-template.md`
- `docs/client-answer-paste-template.md`
- `docs/client-build-prompt-template.md`
- `docs/client-config-template.json`
- `docs/accessibility-release-checklist.md`
- `docs/manual-accessibility-audit-2026-03-08.md`
