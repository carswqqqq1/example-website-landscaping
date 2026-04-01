# Pricing & Contracts Reference

This document defines the standard pricing model for all client website projects built from this template. Keep this file updated if pricing changes.

---

## Standard Pricing

| Item | Amount | Notes |
|---|---|---|
| Initial payment | **$375** | Collected at kickoff before work begins |
| Completion payment | **$375** | Collected at launch before DNS is pointed |
| Monthly upkeep | **$250/month** | Begins the first full month after launch |
| **First-month total** | **$1,000** | $375 + $375 + $250 |
| **Annual value (12 months)** | **$3,750** | $750 setup + $3,000 upkeep |

---

## What Each Payment Covers

### $375 Initial — Project Kickoff
Collected before any work begins. Covers the intake process, branch creation, client config setup, staging environment deployment, and the first round of content implementation.

### $375 Completion — Launch
Collected when the staging site is approved and ready to go live. Covers final revisions, production deployment, DNS configuration, post-launch QA, and the handoff walkthrough.

### $250/month — Monthly Upkeep
Recurring. Covers Netlify hosting (CDN + SSL), form processing and email delivery, Google Sheets lead log, minor content updates (text, photos, hours, service changes), monthly speed and uptime checks, and priority support for any site issues within one business day. Includes an annual SEO refresh.

---

## Payment Terms

Invoices are sent via [your invoicing tool — e.g., Wave, QuickBooks, Stripe]. Accepted payment methods: credit/debit card, ACH, Venmo Business, Zelle.

- **Initial invoice:** Sent at project kickoff. Due within 24 hours to hold the launch slot.
- **Completion invoice:** Sent when the staging site is approved. Due before DNS is pointed to the new site.
- **Monthly invoice:** Auto-sent on the 1st of each month. 5-day grace period before service is paused.

---

## Cancellation Policy

The client may cancel monthly upkeep at any time with 30 days written notice. No refunds are issued for the current billing month. Setup and completion payments are non-refundable once work has begun.

If a client cancels upkeep, they retain access to their site files (delivered as a ZIP or GitHub branch handoff). Hosting and form processing will be deactivated at the end of the final paid month.

---

## Scope Creep & Change Orders

The initial $750 setup covers the deliverables listed in the offer sheet. Any work outside that scope (additional pages, custom integrations, copywriting, logo design) is billed at **$75/hour** or quoted as a flat add-on before work begins.

---

## Annual Upfront Option

Clients who want to pay for a full year upfront can be offered a small discount:

| Option | Amount |
|---|---|
| Standard (month-to-month) | $750 setup + $250/month |
| Annual upfront | $750 setup + $2,750/year (saves $250 vs. 12 months) |

---

## Revenue Projections

| Clients | Monthly Recurring | Annual Recurring | Annual Total (incl. setup) |
|---|---|---|---|
| 1 | $250 | $3,000 | $3,750 |
| 5 | $1,250 | $15,000 | $18,750 |
| 10 | $2,500 | $30,000 | $37,500 |
| 20 | $5,000 | $60,000 | $75,000 |

---

## Notes for New Client Onboarding

1. Send the offer sheet (`docs/offer-sheet-template.md`) with the demo link.
2. Collect the $375 initial payment before creating the client branch.
3. Run `node scripts/generate-client-package.js path/to/client-config.json` to scaffold the client build.
4. Follow the white-label handoff guide (`docs/white-label-handoff.md`) step by step.
5. Collect the $375 completion payment before pointing DNS.
6. Set up the monthly auto-invoice on the 1st of the following month.
