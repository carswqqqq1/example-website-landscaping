# White-Label Handoff Guide

Use this guide when cloning the landscaping template for a new client. Follow the steps in order — each section has a payment gate or quality gate before you proceed.

## Status Note

This template is ship-ready for live use. Any remaining work is in the "could improve later" category, such as more SEO content depth or a fuller white-label product system — not broken-site issues.

---

## 0. Before You Start — Collect Initial Payment

**Do not begin any work until the $375 initial payment is received.**

Send the offer sheet (`docs/offer-sheet-template.md`) with your demo link. Once the client replies "GO" and the invoice is paid, proceed to step 1.

See `docs/pricing-and-contracts.md` for full payment terms.

---

## 1. Branch + Environment

1. Create a new client branch from the current production-ready template branch:
   ```bash
   git checkout claude/landscaping-company-website-hl2cg
   git checkout -b codex/<client-slug>-site
   ```
2. Link or create a dedicated Netlify site for that client.
3. Set the client-specific environment variables before any live form testing.

---

## 2. Generate the Client Package

If you have a completed client config JSON, run this first:

```bash
node scripts/generate-client-package.js path/to/client-config.json
```

This outputs a branch/site naming suggestion, merged config preview, Netlify env template, and a full launch checklist (with payment milestones) in `client-builds/<client-slug>/`.

Then apply the config:

```bash
node scripts/apply-client-config.js path/to/client-config.json
```

---

## 3. Replace Client Identity

Update `site-config.js` first. The `apply-client-config.js` script handles this automatically if you have a JSON file. Key fields:

- `businessName` and `shortName`
- `email` and `ownerEmail`
- `phone.raw` and `phone.display`
- `address` (line1, city, state, zip)
- `serviceAreas`
- `brand.logoPath`, `brand.primary`, `brand.primaryMid`, `brand.paper`
- `reviewRating`, `reviewCount`, `reviewSource`, `reviewSourceUrl`, `reviewSnapshotDate`
- `trustAssets` (license numbers, verify URLs, insurance statement)
- `locationPages`
- `socialProfiles`

Do not manually search-and-replace copy first. Update config, then sweep for any remaining branded copy.

---

## 4. Replace Proof Carefully

Do not invent any of the following. If a client has not provided verified data, soften or remove the claim until it is confirmed:

- Review counts and ratings
- License, bond, and insurance claims
- Years in business
- Service-area claims
- Project count claims

---

## 5. Sweep Required Files

After updating config, review these files for any remaining demo brand residue:

- `index.html` and all HTML pages
- `services/` — all service pages
- Local/city pages
- `resources.html` and article pages
- `reviews.html`, `process.html`, `free-consultation.html`
- `emails/thinkgreen-client-email.html` and `emails/thinkgreen-owner-email.html`
- `.env.example`
- `README.md`
- `llms.txt` and `llms-full.txt`
- `sitemap.xml`

---

## 6. Replace Contact + Routing Defaults

Confirm all of the following are set to the client's values (not demo values):

- `OWNER_EMAIL`
- `FROM_EMAIL`
- `RESEND_FROM_EMAIL`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`
- `GOOGLE_SHEETS_WEBHOOK_URL`
- `CRM_WEBHOOK_URL` (if applicable)

No personal or test email values should remain in `.env.example` or production settings.

---

## 7. Rebuild + QA

```bash
npm run build:assets
npm run check:js
npm run check:a11y
npm run check:speed
npm run check:site
```

Then manually verify:

1. Homepage form submits and both emails arrive (client confirmation + owner notification).
2. Sticky mobile CTA works on phone.
3. Consultation drawer opens and closes.
4. Portfolio lightbox works.
5. FAQ toggles work.
6. All primary routes return `200`.
7. Google Sheets lead log receives the test submission.

---

## 8. Collect Completion Payment — Then Launch

**Do not point DNS until the $375 completion payment is received.**

Once the staging site is approved by the client and payment is collected:

1. Deploy to Netlify production.
2. Point DNS to the new site.
3. Verify production routes and lead flow one final time.

---

## 9. Final Release Check

Before handoff:

- GitHub branch is current and matches production
- Netlify production matches the pushed commit
- No client-unverified trust claims remain
- No old business name, phone, email, or city residue remains
- No personal or test email values remain
- Monthly auto-invoice is set up for $250/month starting the first full month after launch

---

## 10. Set Up Monthly Upkeep

After launch, set up the $250/month auto-invoice in your invoicing platform. Invoice date should be the 1st of each month. See `docs/pricing-and-contracts.md` for cancellation terms and scope of what monthly upkeep covers.

---

This template is strongest when each new client launch is treated as a config-first clone, a trust-proof sweep, and a payment-gated deployment.
